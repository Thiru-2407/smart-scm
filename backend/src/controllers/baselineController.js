const mongoose = require('mongoose');
const Baseline = require('../models/Baseline');
const Project = require('../models/Project');
const Version = require('../models/Version');
const Release = require('../models/Release');
const uvcsService = require('../services/uvcsService');
const auditService = require('../services/auditService');

// Helper to check if user is authorized to manage project baselines (Owner or Admin)
const isAuthorizedForManagement = (project, user) => {
  if (!project || !user) return false;
  const isOwner = project.owner.toString() === user._id.toString();
  const isAdmin = user.role === 'admin';
  return isOwner || isAdmin;
};

// Helper to check if user has access to view project baselines (Owner, Member, or Admin)
const isAuthorizedForView = (project, user) => {
  if (!project || !user) return false;
  if (user.role === 'admin') return true;
  const isOwner = project.owner.toString() === user._id.toString();
  const isMember = Array.isArray(project.members) && project.members.some(
    (m) => (m._id || m).toString() === user._id.toString()
  );
  return isOwner || isMember;
};

/**
 * Generate sequential baseline ID per project (e.g., BL-001, BL-002)
 */
const generateBaselineId = async (projectId) => {
  const count = await Baseline.countDocuments({ project: projectId });
  const nextNumber = count + 1;
  return `BL-${String(nextNumber).padStart(3, '0')}`;
};

/**
 * @desc    Get all Configuration Baselines across accessible projects
 * @route   GET /api/baselines
 * @access  Private
 */
const getBaselines = async (req, res) => {
  try {
    const { project: projectParam, version: versionParam, status, search } = req.query;

    let targetProjectIds = [];

    if (req.user.role === 'admin') {
      if (projectParam) {
        if (!mongoose.Types.ObjectId.isValid(projectParam)) {
          return res.status(400).json({ success: false, message: 'Invalid project ID format' });
        }
        targetProjectIds = [new mongoose.Types.ObjectId(projectParam)];
      } else {
        const allProjects = await Project.find({}).select('_id').lean();
        targetProjectIds = allProjects.map((p) => p._id);
      }
    } else {
      const userProjects = await Project.find({
        $or: [{ owner: req.user._id }, { members: req.user._id }]
      }).select('_id').lean();

      const userProjectIds = userProjects.map((p) => p._id.toString());

      if (projectParam) {
        if (!mongoose.Types.ObjectId.isValid(projectParam)) {
          return res.status(400).json({ success: false, message: 'Invalid project ID format' });
        }
        if (!userProjectIds.includes(projectParam.toString())) {
          return res.status(403).json({
            success: false,
            message: 'Forbidden: You do not have permission to view baselines for this project'
          });
        }
        targetProjectIds = [new mongoose.Types.ObjectId(projectParam)];
      } else {
        targetProjectIds = userProjects.map((p) => p._id);
      }
    }

    const query = { project: { $in: targetProjectIds } };

    if (versionParam) {
      if (!mongoose.Types.ObjectId.isValid(versionParam)) {
        return res.status(400).json({ success: false, message: 'Invalid version ID format' });
      }
      query.version = versionParam;
    }

    if (status && ['draft', 'active', 'frozen', 'superseded'].includes(status)) {
      query.status = status;
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { baselineId: searchRegex },
        { name: searchRegex },
        { description: searchRegex },
        { branch: searchRegex }
      ];
    }

    const baselines = await Baseline.find(query)
      .populate('project', 'name key owner')
      .populate('version', 'versionNumber name status')
      .populate('release', 'releaseName status')
      .populate('createdBy', 'name email role')
      .populate('frozenBy', 'name email role')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: baselines.length,
      baselines
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error retrieving baselines'
    });
  }
};

/**
 * @desc    Get Baselines for a specific project
 * @route   GET /api/projects/:projectId/baselines
 * @access  Private
 */
const getProjectBaselines = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ success: false, message: 'Invalid project ID format' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    if (!isAuthorizedForView(project, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to view baselines for this project'
      });
    }

    const baselines = await Baseline.find({ project: projectId })
      .populate('project', 'name key owner')
      .populate('version', 'versionNumber name status')
      .populate('release', 'releaseName status')
      .populate('createdBy', 'name email role')
      .populate('frozenBy', 'name email role')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: baselines.length,
      baselines
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error retrieving project baselines'
    });
  }
};

/**
 * @desc    Get single Configuration Baseline by ID
 * @route   GET /api/baselines/:id
 * @access  Private
 */
const getBaselineById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid baseline ID format' });
    }

    const baseline = await Baseline.findById(id)
      .populate('project', 'name key owner members')
      .populate('version', 'versionNumber name status changes')
      .populate('release', 'releaseName status releaseDate')
      .populate('createdBy', 'name email role')
      .populate('frozenBy', 'name email role');

    if (!baseline) {
      return res.status(404).json({ success: false, message: 'Configuration baseline not found' });
    }

    if (!isAuthorizedForView(baseline.project, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to view this baseline'
      });
    }

    return res.status(200).json({
      success: true,
      baseline
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error retrieving baseline details'
    });
  }
};

/**
 * @desc    Create a new Configuration Baseline
 * @route   POST /api/projects/:projectId/baselines
 * @access  Private (Owner or Admin)
 */
const createBaseline = async (req, res) => {
  try {
    const projectId = req.params.projectId || req.body.projectId || req.body.project;

    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ success: false, message: 'Invalid or missing project ID format' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    if (!isAuthorizedForManagement(project, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the project owner or an administrator can create configuration baselines'
      });
    }

    const {
      name,
      description,
      version,
      versionId: altVersionId,
      release,
      releaseId: altReleaseId,
      repository,
      branch,
      changesetId,
      status
    } = req.body;

    const versionId = version || altVersionId;
    const releaseId = release || altReleaseId;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Baseline name is required' });
    }

    if (!versionId) {
      return res.status(400).json({ success: false, message: 'Software version reference is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(versionId)) {
      return res.status(400).json({ success: false, message: 'Invalid version ID format' });
    }

    const versionDoc = await Version.findOne({ _id: versionId, project: projectId });
    if (!versionDoc) {
      return res.status(404).json({
        success: false,
        message: 'Referenced software version not found in this project'
      });
    }

    if (changesetId === undefined || changesetId === null || changesetId === '') {
      return res.status(400).json({
        success: false,
        message: 'UVCS Changeset ID is required to establish a verified source-control baseline'
      });
    }

    const repoSpec = repository ? repository.trim() : 'default@local';
    const validation = await uvcsService.validateChangeset(changesetId, repoSpec);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error || `Changeset ${changesetId} could not be verified in UVCS repository '${repoSpec}'`
      });
    }

    const verifiedCs = validation.changeset;
    const finalBranch = branch ? branch.trim() : (verifiedCs.branch || '/main');

    // Optional release verification
    let validReleaseId = null;
    if (releaseId) {
      if (!mongoose.Types.ObjectId.isValid(releaseId)) {
        return res.status(400).json({ success: false, message: 'Invalid release ID format' });
      }
      const releaseDoc = await Release.findOne({ _id: releaseId, project: projectId });
      if (!releaseDoc) {
        return res.status(404).json({ success: false, message: 'Referenced release not found in this project' });
      }
      validReleaseId = releaseDoc._id;
    }

    const baselineId = await generateBaselineId(projectId);

    const baseline = await Baseline.create({
      baselineId,
      name: name.trim(),
      description: description ? description.trim() : '',
      project: projectId,
      version: versionId,
      release: validReleaseId,
      repository: repoSpec,
      branch: finalBranch,
      changesetId: verifiedCs.changesetId,
      changesetGuid: verifiedCs.guid || '',
      changesetAuthor: verifiedCs.owner || '',
      changesetDate: verifiedCs.date || '',
      changesetComment: verifiedCs.comment || '',
      status: status && ['draft', 'active', 'frozen', 'superseded'].includes(status) ? status : 'active',
      createdBy: req.user._id
    });

    // Synchronize software version baseline reference and UVCS metadata
    versionDoc.baseline = baseline._id;
    versionDoc.uvcs = {
      changesetId: verifiedCs.changesetId,
      branch: finalBranch,
      repository: repoSpec
    };
    await versionDoc.save();

    // If release provided, synchronize release baseline reference
    if (validReleaseId) {
      await Release.findByIdAndUpdate(validReleaseId, {
        baseline: baseline._id,
        uvcs: {
          changesetId: verifiedCs.changesetId,
          branch: finalBranch,
          repository: repoSpec
        }
      });
    }

    const populated = await Baseline.findById(baseline._id)
      .populate('project', 'name key owner')
      .populate('version', 'versionNumber name status')
      .populate('release', 'releaseName status')
      .populate('createdBy', 'name email role');

    await auditService.logActivity({
      project: projectId,
      actor: req.user._id,
      action: 'BASELINE_CREATED',
      entityType: 'Baseline',
      entityId: baseline._id,
      description: `Configuration baseline ${baseline.baselineId} ('${baseline.name}') created at UVCS changeset cs:${verifiedCs.changesetId}`,
      metadata: {
        baselineId: baseline.baselineId,
        name: baseline.name,
        changesetId: verifiedCs.changesetId,
        branch: finalBranch,
        repository: repoSpec,
        versionNumber: versionDoc.versionNumber
      }
    });

    return res.status(201).json({
      success: true,
      message: `Configuration baseline ${baseline.baselineId} created and verified successfully`,
      baseline: populated
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error creating baseline'
    });
  }
};

/**
 * @desc    Freeze a Configuration Baseline to lock its state
 * @route   PUT /api/baselines/:id/freeze
 * @route   PUT /api/projects/:projectId/baselines/:baselineId/freeze
 * @access  Private (Owner or Admin)
 */
const freezeBaseline = async (req, res) => {
  try {
    const id = req.params.baselineId || req.params.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid baseline ID format' });
    }

    const baseline = await Baseline.findById(id).populate('project');
    if (!baseline) {
      return res.status(404).json({ success: false, message: 'Configuration baseline not found' });
    }

    if (!isAuthorizedForManagement(baseline.project, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the project owner or an administrator can freeze configuration baselines'
      });
    }

    if (baseline.status === 'frozen') {
      return res.status(400).json({
        success: false,
        message: `Baseline ${baseline.baselineId} is already frozen.`
      });
    }

    baseline.status = 'frozen';
    baseline.frozenBy = req.user._id;
    baseline.frozenAt = new Date();
    await baseline.save();

    const populated = await Baseline.findById(baseline._id)
      .populate('project', 'name key owner')
      .populate('version', 'versionNumber name status')
      .populate('release', 'releaseName status')
      .populate('createdBy', 'name email role')
      .populate('frozenBy', 'name email role');

    await auditService.logActivity({
      project: baseline.project._id,
      actor: req.user._id,
      action: 'BASELINE_FROZEN',
      entityType: 'Baseline',
      entityId: baseline._id,
      description: `Configuration baseline ${baseline.baselineId} ('${baseline.name}') was frozen (locked for release)`,
      metadata: {
        baselineId: baseline.baselineId,
        name: baseline.name,
        changesetId: baseline.changesetId,
        status: 'frozen'
      }
    });

    return res.status(200).json({
      success: true,
      message: `Configuration baseline ${baseline.baselineId} is now frozen and locked`,
      baseline: populated
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error freezing baseline'
    });
  }
};

/**
 * @desc    Update Configuration Baseline metadata
 * @route   PUT /api/baselines/:id
 * @route   PUT /api/projects/:projectId/baselines/:baselineId
 * @access  Private (Owner or Admin)
 */
const updateBaseline = async (req, res) => {
  try {
    const id = req.params.baselineId || req.params.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid baseline ID format' });
    }

    const baseline = await Baseline.findById(id).populate('project');
    if (!baseline) {
      return res.status(404).json({ success: false, message: 'Configuration baseline not found' });
    }

    if (!isAuthorizedForManagement(baseline.project, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the project owner or an administrator can update configuration baselines'
      });
    }

    if (baseline.status === 'frozen') {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify a frozen configuration baseline'
      });
    }

    const { name, description, status, release: releaseId } = req.body;

    if (name && name.trim()) {
      baseline.name = name.trim();
    }

    if (description !== undefined) {
      baseline.description = description ? description.trim() : '';
    }

    if (status && ['draft', 'active', 'frozen', 'superseded'].includes(status)) {
      if (status === 'frozen' && baseline.status !== 'frozen') {
        baseline.frozenBy = req.user._id;
        baseline.frozenAt = new Date();
      }
      baseline.status = status;
    }

    if (releaseId !== undefined) {
      if (releaseId === null || releaseId === '') {
        baseline.release = null;
      } else if (mongoose.Types.ObjectId.isValid(releaseId)) {
        baseline.release = releaseId;
      }
    }

    await baseline.save();

    const populated = await Baseline.findById(baseline._id)
      .populate('project', 'name key owner')
      .populate('version', 'versionNumber name status')
      .populate('release', 'releaseName status')
      .populate('createdBy', 'name email role')
      .populate('frozenBy', 'name email role');

    await auditService.logActivity({
      project: baseline.project._id,
      actor: req.user._id,
      action: 'BASELINE_UPDATED',
      entityType: 'Baseline',
      entityId: baseline._id,
      description: `Configuration baseline ${baseline.baselineId} was updated`,
      metadata: {
        baselineId: baseline.baselineId,
        name: baseline.name,
        status: baseline.status
      }
    });

    return res.status(200).json({
      success: true,
      message: `Configuration baseline ${baseline.baselineId} updated successfully`,
      baseline: populated
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error updating baseline'
    });
  }
};

/**
 * @desc    Delete Configuration Baseline
 * @route   DELETE /api/baselines/:id
 * @route   DELETE /api/projects/:projectId/baselines/:baselineId
 * @access  Private (Owner or Admin)
 */
const deleteBaseline = async (req, res) => {
  try {
    const id = req.params.baselineId || req.params.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid baseline ID format' });
    }

    const baseline = await Baseline.findById(id).populate('project');
    if (!baseline) {
      return res.status(404).json({ success: false, message: 'Configuration baseline not found' });
    }

    if (!isAuthorizedForManagement(baseline.project, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the project owner or an administrator can delete configuration baselines'
      });
    }

    // Protection: frozen baselines are strictly immutable and cannot be deleted
    if (baseline.status === 'frozen') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a frozen configuration baseline'
      });
    }

    await Baseline.findByIdAndDelete(id);

    // Unlink from version if referencing this baseline
    await Version.updateMany({ baseline: id }, { $set: { baseline: null } });
    await Release.updateMany({ baseline: id }, { $set: { baseline: null } });

    await auditService.logActivity({
      project: baseline.project._id,
      actor: req.user._id,
      action: 'BASELINE_DELETED',
      entityType: 'Baseline',
      entityId: id,
      description: `Configuration baseline ${baseline.baselineId} ('${baseline.name}') was deleted`,
      metadata: {
        baselineId: baseline.baselineId,
        name: baseline.name,
        changesetId: baseline.changesetId
      }
    });

    return res.status(200).json({
      success: true,
      message: `Configuration baseline ${baseline.baselineId} deleted successfully`
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error deleting baseline'
    });
  }
};

/**
 * @desc    Get summary statistics for Baselines
 * @route   GET /api/baselines/stats/summary
 * @access  Private
 */
const getBaselineStats = async (req, res) => {
  try {
    const totalBaselines = await Baseline.countDocuments();
    const activeBaselines = await Baseline.countDocuments({ status: 'active' });
    const frozenBaselines = await Baseline.countDocuments({ status: 'frozen' });
    const draftBaselines = await Baseline.countDocuments({ status: 'draft' });
    const supersededBaselines = await Baseline.countDocuments({ status: 'superseded' });

    return res.status(200).json({
      success: true,
      stats: {
        totalBaselines,
        activeBaselines,
        frozenBaselines,
        draftBaselines,
        supersededBaselines
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error retrieving baseline statistics'
    });
  }
};

module.exports = {
  getBaselines,
  getProjectBaselines,
  getBaselineById,
  createBaseline,
  freezeBaseline,
  updateBaseline,
  deleteBaseline,
  getBaselineStats
};
