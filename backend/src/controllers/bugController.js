const mongoose = require('mongoose');
const Bug = require('../models/Bug');
const Project = require('../models/Project');
const User = require('../models/User');
const auditService = require('../services/auditService');

const isOwnerOrAdmin = (project, user) => {
  if (!project || !user) return false;
  return project.owner.toString() === user._id.toString() || user.role === 'admin';
};

// @desc    Create a new bug report
// @route   POST /api/projects/:projectId/bugs
// @access  Private
const createBug = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ success: false, message: 'Invalid project ID' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const { title, description, severity, priority, assignedTo } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both a bug title and description'
      });
    }

    // Validate enums
    const validSeverities = ['critical', 'high', 'medium', 'low'];
    if (severity && !validSeverities.includes(severity)) {
      return res.status(400).json({
        success: false,
        message: `Invalid severity. Allowed: ${validSeverities.join(', ')}`
      });
    }

    const validPriorities = ['urgent', 'high', 'medium', 'low'];
    if (priority && !validPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: `Invalid priority. Allowed: ${validPriorities.join(', ')}`
      });
    }

    let assignedUserId = null;
    if (assignedTo) {
      if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
        return res.status(400).json({ success: false, message: 'Invalid assigned user ID' });
      }
      const userExists = await User.findById(assignedTo);
      if (!userExists) {
        return res.status(404).json({ success: false, message: 'Assigned user not found' });
      }
      assignedUserId = userExists._id;
    }

    const bug = await Bug.create({
      project: projectId,
      title: title.trim(),
      description: description.trim(),
      severity: severity || 'medium',
      priority: priority || 'medium',
      status: 'open',
      reportedBy: req.user._id,
      assignedTo: assignedUserId
    });

    const populated = await Bug.findById(bug._id)
      .populate('reportedBy', 'name email role')
      .populate('assignedTo', 'name email role')
      .populate('project', 'name key owner');

    await auditService.logActivity({
      project: projectId,
      actor: req.user._id,
      action: 'BUG_CREATED',
      entityType: 'Bug',
      entityId: bug._id,
      description: `Bug '${bug.title}' was reported (${bug.severity} severity, ${bug.priority} priority)`,
      metadata: { severity: bug.severity, priority: bug.priority, status: bug.status }
    });

    return res.status(201).json({
      success: true,
      message: 'Bug reported successfully',
      bug: populated
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error creating bug'
    });
  }
};

// @desc    Get all bugs for a project
// @route   GET /api/projects/:projectId/bugs
// @access  Private
const getBugs = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ success: false, message: 'Invalid project ID' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const bugs = await Bug.find({ project: projectId })
      .populate('reportedBy', 'name email role')
      .populate('assignedTo', 'name email role')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: bugs.length,
      bugs
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching bugs'
    });
  }
};

// @desc    Get single bug by ID
// @route   GET /api/projects/:projectId/bugs/:bugId
// @access  Private
const getBugById = async (req, res) => {
  try {
    const { projectId, bugId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(bugId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }

    const bug = await Bug.findOne({ _id: bugId, project: projectId })
      .populate('reportedBy', 'name email role')
      .populate('assignedTo', 'name email role')
      .populate('project', 'name key owner');

    if (!bug) {
      return res.status(404).json({ success: false, message: 'Bug not found for this project' });
    }

    return res.status(200).json({
      success: true,
      bug
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching bug'
    });
  }
};

// @desc    Update bug details or status/resolution
// @route   PUT /api/projects/:projectId/bugs/:bugId
// @access  Private (Owner, Admin, Assigned Dev, or Reporter)
const updateBug = async (req, res) => {
  try {
    const { projectId, bugId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(bugId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const bug = await Bug.findOne({ _id: bugId, project: projectId });
    if (!bug) {
      return res.status(404).json({ success: false, message: 'Bug not found' });
    }

    const isOwnerAdmin = isOwnerOrAdmin(project, req.user);
    const isAssignedDev = bug.assignedTo && bug.assignedTo.toString() === req.user._id.toString();
    const isReporter = bug.reportedBy.toString() === req.user._id.toString();

    if (!isOwnerAdmin && !isAssignedDev && !isReporter) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to update this bug'
      });
    }

    const { title, description, severity, priority, status, resolution } = req.body;

    // Validate status if provided
    if (status) {
      const validStatuses = ['open', 'in_progress', 'resolved', 'closed', 'reopened'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid bug status. Allowed: ${validStatuses.join(', ')}`
        });
      }
      bug.status = status;
    }

    if (resolution !== undefined) {
      bug.resolution = resolution.trim();
    }

    // Full field updates allowed for owner, admin, or reporter
    if (isOwnerAdmin || isReporter) {
      if (title) bug.title = title.trim();
      if (description) bug.description = description.trim();

      if (severity) {
        const validSeverities = ['critical', 'high', 'medium', 'low'];
        if (!validSeverities.includes(severity)) {
          return res.status(400).json({
            success: false,
            message: `Invalid severity. Allowed: ${validSeverities.join(', ')}`
          });
        }
        bug.severity = severity;
      }

      if (priority) {
        const validPriorities = ['urgent', 'high', 'medium', 'low'];
        if (!validPriorities.includes(priority)) {
          return res.status(400).json({
            success: false,
            message: `Invalid priority. Allowed: ${validPriorities.join(', ')}`
          });
        }
        bug.priority = priority;
      }
    }

    await bug.save();

    const updated = await Bug.findById(bug._id)
      .populate('reportedBy', 'name email role')
      .populate('assignedTo', 'name email role')
      .populate('project', 'name key owner');

    await auditService.logActivity({
      project: projectId,
      actor: req.user._id,
      action: 'BUG_UPDATED',
      entityType: 'Bug',
      entityId: bug._id,
      description: `Bug '${bug.title}' was updated (status: ${bug.status})`,
      metadata: { status: bug.status, severity: bug.severity, priority: bug.priority }
    });

    return res.status(200).json({
      success: true,
      message: 'Bug updated successfully',
      bug: updated
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error updating bug'
    });
  }
};

// @desc    Assign developer to bug
// @route   PUT /api/projects/:projectId/bugs/:bugId/assign
// @access  Private (Owner or Admin)
const assignBug = async (req, res) => {
  try {
    const { projectId, bugId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(bugId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    if (!isOwnerOrAdmin(project, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the project owner or an administrator can assign bugs'
      });
    }

    const bug = await Bug.findOne({ _id: bugId, project: projectId });
    if (!bug) {
      return res.status(404).json({ success: false, message: 'Bug not found' });
    }

    const { assignedTo } = req.body;

    if (assignedTo === null || assignedTo === '') {
      bug.assignedTo = null;
    } else {
      if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
        return res.status(400).json({ success: false, message: 'Invalid user ID' });
      }
      const user = await User.findById(assignedTo);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User to assign was not found' });
      }
      bug.assignedTo = user._id;
    }

    await bug.save();

    const updated = await Bug.findById(bug._id)
      .populate('reportedBy', 'name email role')
      .populate('assignedTo', 'name email role')
      .populate('project', 'name key owner');

    await auditService.logActivity({
      project: projectId,
      actor: req.user._id,
      action: 'BUG_UPDATED',
      entityType: 'Bug',
      entityId: bug._id,
      description: updated.assignedTo
        ? `Bug '${bug.title}' was assigned to ${updated.assignedTo.name}`
        : `Bug '${bug.title}' was unassigned`,
      metadata: { assignedTo: updated.assignedTo?.name || null }
    });

    return res.status(200).json({
      success: true,
      message: 'Bug assignment updated',
      bug: updated
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error assigning bug'
    });
  }
};

// @desc    Delete bug
// @route   DELETE /api/projects/:projectId/bugs/:bugId
// @access  Private (Owner or Admin)
const deleteBug = async (req, res) => {
  try {
    const { projectId, bugId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(bugId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    if (!isOwnerOrAdmin(project, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the project owner or an administrator can delete bugs'
      });
    }

    const bug = await Bug.findOneAndDelete({ _id: bugId, project: projectId });
    if (!bug) {
      return res.status(404).json({ success: false, message: 'Bug not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Bug deleted successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error deleting bug'
    });
  }
};

// @desc    Get bug statistics across all projects
// @route   GET /api/bugs/stats/summary
// @access  Private
const getBugStats = async (req, res) => {
  try {
    const totalBugs = await Bug.countDocuments();
    const openBugs = await Bug.countDocuments({ status: 'open' });
    const inProgressBugs = await Bug.countDocuments({ status: 'in_progress' });
    const resolvedBugs = await Bug.countDocuments({ status: 'resolved' });
    const closedBugs = await Bug.countDocuments({ status: 'closed' });
    const reopenedBugs = await Bug.countDocuments({ status: 'reopened' });

    return res.status(200).json({
      success: true,
      stats: {
        totalBugs,
        openBugs,
        inProgressBugs,
        resolvedBugs,
        closedBugs,
        reopenedBugs
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching bug statistics'
    });
  }
};

module.exports = {
  createBug,
  getBugs,
  getBugById,
  updateBug,
  assignBug,
  deleteBug,
  getBugStats
};
