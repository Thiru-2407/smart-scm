const mongoose = require('mongoose');
const Project = require('../models/Project');
const User = require('../models/User');
const auditService = require('../services/auditService');

// Helper to check if current user is owner or admin
const isAuthorizedToModify = (project, user) => {
  if (!project || !user) return false;
  const isOwner = project.owner.toString() === user._id.toString();
  const isAdmin = user.role === 'admin';
  return isOwner || isAdmin;
};

// @desc    Create a new project
// @route   POST /api/projects
// @access  Private
const createProject = async (req, res) => {
  try {
    const { name, key, description, status, members } = req.body;

    if (!name || !key) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both a project name and a project key'
      });
    }

    const formattedKey = key.trim().toUpperCase();

    // Check key format
    const keyRegex = /^[A-Z0-9_-]+$/;
    if (!keyRegex.test(formattedKey)) {
      return res.status(400).json({
        success: false,
        message: 'Project key can only contain uppercase alphanumeric characters, dashes, and underscores'
      });
    }

    // Check for duplicate key
    const existingProject = await Project.findOne({ key: formattedKey });
    if (existingProject) {
      return res.status(400).json({
        success: false,
        message: `Project key '${formattedKey}' is already in use. Please choose a unique key.`
      });
    }

    // Sanitize members array if provided
    let initialMembers = [];
    if (Array.isArray(members) && members.length > 0) {
      // Filter out owner if included, and remove duplicates
      const uniqueMemberIds = [...new Set(members.map(m => m.toString()))]
        .filter(mId => mId !== req.user._id.toString() && mongoose.Types.ObjectId.isValid(mId));
      initialMembers = uniqueMemberIds;
    }

    const project = await Project.create({
      name: name.trim(),
      key: formattedKey,
      description: description ? description.trim() : '',
      status: status || 'planning',
      owner: req.user._id,
      members: initialMembers
    });

    const populatedProject = await Project.findById(project._id)
      .populate('owner', 'name email role')
      .populate('members', 'name email role');

    await auditService.logActivity({
      project: project._id,
      actor: req.user._id,
      action: 'PROJECT_CREATED',
      entityType: 'Project',
      entityId: project._id,
      description: `Project '${project.name}' (${project.key}) was created`,
      metadata: { key: project.key, status: project.status }
    });

    return res.status(201).json({
      success: true,
      message: 'Project created successfully',
      project: populatedProject
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error creating project'
    });
  }
};

// @desc    Get all projects
// @route   GET /api/projects
// @access  Private
const getProjects = async (req, res) => {
  try {
    const projects = await Project.find()
      .populate('owner', 'name email role')
      .populate('members', 'name email role')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: projects.length,
      projects
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching projects'
    });
  }
};

// @desc    Get project summary statistics
// @route   GET /api/projects/stats/summary
// @access  Private
const getProjectStats = async (req, res) => {
  try {
    const totalProjects = await Project.countDocuments();
    const activeProjects = await Project.countDocuments({ status: 'active' });
    const completedProjects = await Project.countDocuments({ status: 'completed' });
    const planningProjects = await Project.countDocuments({ status: 'planning' });
    const archivedProjects = await Project.countDocuments({ status: 'archived' });

    return res.status(200).json({
      success: true,
      stats: {
        totalProjects,
        activeProjects,
        completedProjects,
        planningProjects,
        archivedProjects
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching project statistics'
    });
  }
};

// @desc    Get single project by ID
// @route   GET /api/projects/:id
// @access  Private
const getProjectById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID format'
      });
    }

    const project = await Project.findById(req.params.id)
      .populate('owner', 'name email role')
      .populate('members', 'name email role');

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    return res.status(200).json({
      success: true,
      project
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching project'
    });
  }
};

// @desc    Update project
// @route   PUT /api/projects/:id
// @access  Private (Owner or Admin)
const updateProject = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID format'
      });
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Permission check
    if (!isAuthorizedToModify(project, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the project owner or an administrator can update this project'
      });
    }

    const { name, key, description, status } = req.body;

    if (name) project.name = name.trim();
    if (description !== undefined) project.description = description.trim();
    if (status) project.status = status;

    if (key && key.trim().toUpperCase() !== project.key) {
      const newKey = key.trim().toUpperCase();
      const existing = await Project.findOne({ key: newKey, _id: { $ne: project._id } });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Project key '${newKey}' is already taken`
        });
      }
      project.key = newKey;
    }

    await project.save();

    const updated = await Project.findById(project._id)
      .populate('owner', 'name email role')
      .populate('members', 'name email role');

    await auditService.logActivity({
      project: project._id,
      actor: req.user._id,
      action: 'PROJECT_UPDATED',
      entityType: 'Project',
      entityId: project._id,
      description: `Project '${project.name}' details were updated`,
      metadata: { key: project.key, status: project.status }
    });

    return res.status(200).json({
      success: true,
      message: 'Project updated successfully',
      project: updated
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error updating project'
    });
  }
};

// @desc    Delete project
// @route   DELETE /api/projects/:id
// @access  Private (Owner or Admin)
const deleteProject = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID format'
      });
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Permission check
    if (!isAuthorizedToModify(project, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the project owner or an administrator can delete this project'
      });
    }

    await Project.findByIdAndDelete(project._id);

    return res.status(200).json({
      success: true,
      message: 'Project deleted successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error deleting project'
    });
  }
};

// @desc    Add member to project
// @route   POST /api/projects/:id/members
// @access  Private (Owner or Admin)
const addProjectMember = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID format'
      });
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Permission check
    if (!isAuthorizedToModify(project, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the project owner or an administrator can manage members'
      });
    }

    const { userId } = req.body;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid user ID to add as member'
      });
    }

    const userToAdd = await User.findById(userId).select('-password');
    if (!userToAdd) {
      return res.status(404).json({
        success: false,
        message: 'User to add was not found'
      });
    }

    // Cannot add owner as member
    if (project.owner.toString() === userId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Project owner is already the lead and cannot be added as a member'
      });
    }

    // Check if already a member
    const alreadyMember = project.members.some(
      m => m.toString() === userId.toString()
    );
    if (alreadyMember) {
      return res.status(400).json({
        success: false,
        message: `${userToAdd.name} is already a member of this project`
      });
    }

    project.members.push(userId);
    await project.save();

    const updated = await Project.findById(project._id)
      .populate('owner', 'name email role')
      .populate('members', 'name email role');

    return res.status(200).json({
      success: true,
      message: `Member ${userToAdd.name} added successfully`,
      project: updated
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error adding member'
    });
  }
};

// @desc    Remove member from project
// @route   DELETE /api/projects/:id/members/:userId
// @access  Private (Owner or Admin)
const removeProjectMember = async (req, res) => {
  try {
    const { id, userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID or user ID format'
      });
    }

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Permission check
    if (!isAuthorizedToModify(project, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the project owner or an administrator can remove members'
      });
    }

    const isMember = project.members.some(
      m => m.toString() === userId.toString()
    );
    if (!isMember) {
      return res.status(404).json({
        success: false,
        message: 'User is not currently a member of this project'
      });
    }

    project.members = project.members.filter(
      m => m.toString() !== userId.toString()
    );
    await project.save();

    const updated = await Project.findById(project._id)
      .populate('owner', 'name email role')
      .populate('members', 'name email role');

    return res.status(200).json({
      success: true,
      message: 'Member removed from project successfully',
      project: updated
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error removing member'
    });
  }
};

// @desc    Get all available users for member assignment
// @route   GET /api/projects/users/available
// @access  Private
const getAvailableUsers = async (req, res) => {
  try {
    const users = await User.find().select('name email role _id').sort({ name: 1 });
    return res.status(200).json({
      success: true,
      users
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching users'
    });
  }
};

module.exports = {
  createProject,
  getProjects,
  getProjectStats,
  getProjectById,
  updateProject,
  deleteProject,
  addProjectMember,
  removeProjectMember,
  getAvailableUsers
};
