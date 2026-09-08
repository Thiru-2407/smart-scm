const mongoose = require('mongoose');
const Version = require('../models/Version');
const Project = require('../models/Project');
const uvcsService = require('../services/uvcsService');
const auditService = require('../services/auditService');

// Helper to check if user is project owner or admin
const isAuthorizedForProject = (project, user) => {
  if (!project || !user) return false;
  const isOwner = project.owner.toString() === user._id.toString();
  const isAdmin = user.role === 'admin';
  return isOwner || isAdmin;
};

// @desc    Create a new version for a project
// @route   POST /api/projects/:projectId/versions
// @access  Private (Owner or Admin)
const createVersion = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID format'
      });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Permission check
    if (!isAuthorizedForProject(project, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the project owner or an administrator can create versions'
      });
    }

    const { versionNumber, name, description, status, releaseDate, changes } = req.body;

    if (!versionNumber || !name) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both version number and version name'
      });
    }

    const trimmedVersion = versionNumber.trim();

    // Check for duplicate version number within project
    const existingVersion = await Version.findOne({
      project: projectId,
      versionNumber: trimmedVersion
    });

    if (existingVersion) {
      return res.status(400).json({
        success: false,
        message: `Version '${trimmedVersion}' already exists in this project. Version numbers must be unique within a project.`
      });
    }

    // Process changes list
    let changesList = [];
    if (Array.isArray(changes)) {
      changesList = changes.map(c => typeof c === 'string' ? c.trim() : '').filter(Boolean);
    } else if (typeof changes === 'string' && changes.trim()) {
      changesList = changes.split('\n').map(c => c.trim()).filter(Boolean);
    }

    const version = await Version.create({
      project: projectId,
      versionNumber: trimmedVersion,
      name: name.trim(),
      description: description ? description.trim() : '',
      status: status || 'development',
      releaseDate: releaseDate ? new Date(releaseDate) : null,
      changes: changesList,
      createdBy: req.user._id
    });

    const populated = await Version.findById(version._id)
      .populate('createdBy', 'name email role')
      .populate('project', 'name key owner');

    await auditService.logActivity({
      project: projectId,
      actor: req.user._id,
      action: 'VERSION_CREATED',
      entityType: 'Version',
      entityId: version._id,
      description: `Version v${version.versionNumber} ('${version.name}') was created`,
      metadata: { versionNumber: version.versionNumber, name: version.name, status: version.status }
    });

    return res.status(201).json({
      success: true,
      message: 'Version created successfully',
      version: populated
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Version number already exists in this project'
      });
    }
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error creating version'
    });
  }
};

// @desc    Get all versions for a project
// @route   GET /api/projects/:projectId/versions
// @access  Private
const getVersions = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID format'
      });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const versions = await Version.find({ project: projectId })
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: versions.length,
      versions
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching versions'
    });
  }
};

// @desc    Get single version by ID
// @route   GET /api/projects/:projectId/versions/:versionId
// @access  Private
const getVersionById = async (req, res) => {
  try {
    const { projectId, versionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(versionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID or version ID format'
      });
    }

    const version = await Version.findOne({ _id: versionId, project: projectId })
      .populate('createdBy', 'name email role')
      .populate('project', 'name key owner');

    if (!version) {
      return res.status(404).json({
        success: false,
        message: 'Version not found for this project'
      });
    }

    return res.status(200).json({
      success: true,
      version
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching version'
    });
  }
};

// @desc    Update version
// @route   PUT /api/projects/:projectId/versions/:versionId
// @access  Private (Owner or Admin)
const updateVersion = async (req, res) => {
  try {
    const { projectId, versionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(versionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID or version ID format'
      });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Permission check
    if (!isAuthorizedForProject(project, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the project owner or an administrator can update versions'
      });
    }

    const version = await Version.findOne({ _id: versionId, project: projectId });
    if (!version) {
      return res.status(404).json({
        success: false,
        message: 'Version not found'
      });
    }

    const { versionNumber, name, description, status, releaseDate, changes } = req.body;

    // Check version number uniqueness if changed
    if (versionNumber && versionNumber.trim() !== version.versionNumber) {
      const trimmedVersion = versionNumber.trim();
      const existing = await Version.findOne({
        project: projectId,
        versionNumber: trimmedVersion,
        _id: { $ne: version._id }
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Version number '${trimmedVersion}' is already in use for this project`
        });
      }
      version.versionNumber = trimmedVersion;
    }

    if (name) version.name = name.trim();
    if (description !== undefined) version.description = description.trim();
    if (status) version.status = status;
    if (releaseDate !== undefined) version.releaseDate = releaseDate ? new Date(releaseDate) : null;

    if (changes !== undefined) {
      if (Array.isArray(changes)) {
        version.changes = changes.map(c => typeof c === 'string' ? c.trim() : '').filter(Boolean);
      } else if (typeof changes === 'string') {
        version.changes = changes.split('\n').map(c => c.trim()).filter(Boolean);
      }
    }

    if (req.body.uvcs !== undefined) {
      if (req.body.uvcs === null || req.body.uvcs.changesetId === null || req.body.uvcs.changesetId === undefined) {
        version.uvcs = { changesetId: null, branch: null, repository: null };
      } else {
        const repo = req.body.uvcs.repository || 'default@local';
        const validation = await uvcsService.validateChangeset(req.body.uvcs.changesetId, repo);
        if (!validation.valid) {
          return res.status(400).json({
            success: false,
            message: validation.error || `Changeset ${req.body.uvcs.changesetId} not found in UVCS repository`
          });
        }
        version.uvcs = {
          changesetId: validation.changeset.changesetId,
          branch: req.body.uvcs.branch || validation.changeset.branch,
          repository: repo
        };
      }
    }

    await version.save();

    const updated = await Version.findById(version._id)
      .populate('createdBy', 'name email role')
      .populate('project', 'name key owner');

    await auditService.logActivity({
      project: projectId,
      actor: req.user._id,
      action: 'VERSION_UPDATED',
      entityType: 'Version',
      entityId: version._id,
      description: `Version v${version.versionNumber} was updated`,
      metadata: { versionNumber: version.versionNumber, status: version.status }
    });

    return res.status(200).json({
      success: true,
      message: 'Version updated successfully',
      version: updated
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error updating version'
    });
  }
};

// @desc    Delete version
// @route   DELETE /api/projects/:projectId/versions/:versionId
// @access  Private (Owner or Admin)
const deleteVersion = async (req, res) => {
  try {
    const { projectId, versionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(versionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID or version ID format'
      });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Permission check
    if (!isAuthorizedForProject(project, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the project owner or an administrator can delete versions'
      });
    }

    const version = await Version.findOneAndDelete({ _id: versionId, project: projectId });
    if (!version) {
      return res.status(404).json({
        success: false,
        message: 'Version not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Version deleted successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error deleting version'
    });
  }
};

// @desc    Get version statistics across system
// @route   GET /api/versions/stats/summary
// @access  Private
const getVersionStats = async (req, res) => {
  try {
    const totalVersions = await Version.countDocuments();
    const development = await Version.countDocuments({ status: 'development' });
    const testing = await Version.countDocuments({ status: 'testing' });
    const released = await Version.countDocuments({ status: 'released' });
    const deprecated = await Version.countDocuments({ status: 'deprecated' });

    return res.status(200).json({
      success: true,
      stats: {
        totalVersions,
        development,
        testing,
        released,
        deprecated
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching version statistics'
    });
  }
};

// @desc    Link or unlink UVCS changeset baseline to a version
// @route   PUT /api/projects/:projectId/versions/:versionId/link-uvcs
// @access  Private (Owner or Admin)
const linkUvcsBaseline = async (req, res) => {
  try {
    const { projectId, versionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(versionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID or version ID format'
      });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    if (!isAuthorizedForProject(project, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the project owner or an administrator can link version baselines'
      });
    }

    const version = await Version.findOne({ _id: versionId, project: projectId });
    if (!version) {
      return res.status(404).json({
        success: false,
        message: 'Version not found'
      });
    }

    const { changesetId, branch, repository } = req.body;

    if (changesetId === null || changesetId === undefined || changesetId === '') {
      version.uvcs = { changesetId: null, branch: null, repository: null };
    } else {
      const repoSpec = repository || 'default@local';
      const validation = await uvcsService.validateChangeset(changesetId, repoSpec);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.error || `Changeset ${changesetId} not found in UVCS repository`
        });
      }

      version.uvcs = {
        changesetId: validation.changeset.changesetId,
        branch: branch || validation.changeset.branch,
        repository: repoSpec
      };
    }

    await version.save();

    const updated = await Version.findById(version._id)
      .populate('createdBy', 'name email role')
      .populate('project', 'name key owner');

    await auditService.logActivity({
      project: projectId,
      actor: req.user._id,
      action: 'UVCS_BASELINE_LINKED',
      entityType: 'UVCS',
      entityId: version._id,
      description: version.uvcs?.changesetId !== null
        ? `Linked UVCS changeset ${version.uvcs.changesetId} baseline to version v${version.versionNumber}`
        : `Unlinked UVCS baseline from version v${version.versionNumber}`,
      metadata: {
        versionNumber: version.versionNumber,
        changesetId: version.uvcs?.changesetId,
        branch: version.uvcs?.branch,
        repository: version.uvcs?.repository
      }
    });

    return res.status(200).json({
      success: true,
      message: version.uvcs?.changesetId !== null
        ? `Successfully linked UVCS changeset ${version.uvcs.changesetId} baseline`
        : 'Successfully unlinked UVCS baseline',
      version: updated
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error linking UVCS baseline'
    });
  }
};

module.exports = {
  createVersion,
  getVersions,
  getVersionById,
  updateVersion,
  deleteVersion,
  getVersionStats,
  linkUvcsBaseline
};
