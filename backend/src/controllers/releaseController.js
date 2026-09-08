const mongoose = require('mongoose');
const Release = require('../models/Release');
const Project = require('../models/Project');
const Version = require('../models/Version');
const Bug = require('../models/Bug');
const ChangeRequest = require('../models/ChangeRequest');
const uvcsService = require('../services/uvcsService');

const isOwnerOrAdmin = (project, user) => {
  if (!project || !user) return false;
  return project.owner.toString() === user._id.toString() || user.role === 'admin';
};

// @desc    Create a new release for a project version
// @route   POST /api/projects/:projectId/releases
// @access  Private (Owner or Admin)
const createRelease = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ success: false, message: 'Invalid project ID format' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    if (!isOwnerOrAdmin(project, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the project owner or an administrator can create releases'
      });
    }

    const { version: versionId, releaseName, description, releaseDate } = req.body;

    if (!versionId) {
      return res.status(400).json({ success: false, message: 'Version reference is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(versionId)) {
      return res.status(400).json({ success: false, message: 'Invalid version ID format' });
    }

    if (!releaseName || !releaseName.trim()) {
      return res.status(400).json({ success: false, message: 'Release name is required' });
    }

    const versionDoc = await Version.findById(versionId);
    if (!versionDoc) {
      return res.status(404).json({ success: false, message: 'Referenced software version not found' });
    }

    // Validate that the version belongs to this project
    if (versionDoc.project.toString() !== projectId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Referenced software version does not belong to this project'
      });
    }

    // Prevent multiple active releases for the same project/version unless explicitly withdrawn
    const existingActiveRelease = await Release.findOne({
      project: projectId,
      version: versionId,
      status: { $ne: 'withdrawn' }
    });

    if (existingActiveRelease) {
      return res.status(400).json({
        success: false,
        message: `An active release ('${existingActiveRelease.releaseName}', status: ${existingActiveRelease.status}) already exists for version v${versionDoc.versionNumber}. A new release can only be created if the previous release is withdrawn.`
      });
    }

    const release = await Release.create({
      project: projectId,
      version: versionId,
      releaseName: releaseName.trim(),
      description: description ? description.trim() : '',
      status: 'draft',
      releaseDate: releaseDate ? new Date(releaseDate) : null,
      includedChanges: versionDoc.changes || [],
      fixedBugs: [],
      createdBy: req.user._id
    });

    const populated = await Release.findById(release._id)
      .populate('version')
      .populate('project', 'name key owner')
      .populate('createdBy', 'name email role');

    return res.status(201).json({
      success: true,
      message: 'Release created successfully in Draft status',
      release: populated
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error creating release'
    });
  }
};

// @desc    Get all releases for a project
// @route   GET /api/projects/:projectId/releases
// @access  Private (Project members, owner, admin)
const getReleases = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ success: false, message: 'Invalid project ID format' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const releases = await Release.find({ project: projectId })
      .populate('version')
      .populate('createdBy', 'name email role')
      .populate('approvedBy', 'name email role')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: releases.length,
      releases
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching releases'
    });
  }
};

// @desc    Get single release by ID with populated details
// @route   GET /api/projects/:projectId/releases/:releaseId
// @access  Private (Project members, owner, admin)
const getReleaseById = async (req, res) => {
  try {
    const { projectId, releaseId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(releaseId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }

    const release = await Release.findOne({ _id: releaseId, project: projectId })
      .populate('project', 'name key owner')
      .populate('version')
      .populate('createdBy', 'name email role')
      .populate('approvedBy', 'name email role')
      .populate({
        path: 'fixedBugs',
        select: 'title severity priority status resolution reportedBy assignedTo',
        populate: [
          { path: 'reportedBy', select: 'name email' },
          { path: 'assignedTo', select: 'name email' }
        ]
      });

    if (!release) {
      return res.status(404).json({ success: false, message: 'Release not found' });
    }

    // Retrieve approved change requests for this project to provide complete SCM release scope
    const relatedCRs = await ChangeRequest.find({
      project: projectId,
      status: { $in: ['approved', 'implemented'] }
    })
      .populate('requestedBy', 'name email')
      .populate('reviewedBy', 'name email')
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      release,
      relatedChangeRequests: relatedCRs
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching release'
    });
  }
};

// @desc    Update release details and/or transition status
// @route   PUT /api/projects/:projectId/releases/:releaseId
// @access  Private (Owner or Admin)
const updateRelease = async (req, res) => {
  try {
    const { projectId, releaseId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(releaseId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    if (!isOwnerOrAdmin(project, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the project owner or an administrator can modify releases'
      });
    }

    const release = await Release.findOne({ _id: releaseId, project: projectId });
    if (!release) {
      return res.status(404).json({ success: false, message: 'Release not found' });
    }

    const { releaseName, description, releaseDate, status, releaseNotes, version: newVersionId } = req.body;

    if (releaseName) release.releaseName = releaseName.trim();
    if (description !== undefined) release.description = description.trim();
    if (releaseDate !== undefined) release.releaseDate = releaseDate ? new Date(releaseDate) : null;
    if (releaseNotes !== undefined) release.releaseNotes = releaseNotes;

    // Validate version if changing
    if (newVersionId && newVersionId.toString() !== release.version.toString()) {
      if (!mongoose.Types.ObjectId.isValid(newVersionId)) {
        return res.status(400).json({ success: false, message: 'Invalid version ID format' });
      }
      const versionDoc = await Version.findById(newVersionId);
      if (!versionDoc || versionDoc.project.toString() !== projectId.toString()) {
        return res.status(400).json({
          success: false,
          message: 'Referenced software version does not exist or does not belong to this project'
        });
      }

      // Check duplicate
      const duplicate = await Release.findOne({
        _id: { $ne: release._id },
        project: projectId,
        version: newVersionId,
        status: { $ne: 'withdrawn' }
      });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: `An active release already exists for version v${versionDoc.versionNumber}`
        });
      }

      release.version = newVersionId;
      release.includedChanges = versionDoc.changes || [];
    }

    // Status transition validation
    if (status) {
      const validStatuses = ['draft', 'pending_approval', 'approved', 'published', 'withdrawn'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Allowed: ${validStatuses.join(', ')}`
        });
      }
      release.status = status;
      if (status === 'approved' && !release.approvedBy) {
        release.approvedBy = req.user._id;
      }
    }

    if (req.body.uvcs !== undefined) {
      if (req.body.uvcs === null || req.body.uvcs.changesetId === null || req.body.uvcs.changesetId === undefined) {
        release.uvcs = { changesetId: null, branch: null, repository: null };
      } else {
        const repo = req.body.uvcs.repository || 'default@local';
        const validation = await uvcsService.validateChangeset(req.body.uvcs.changesetId, repo);
        if (!validation.valid) {
          return res.status(400).json({
            success: false,
            message: validation.error || `Changeset ${req.body.uvcs.changesetId} not found in UVCS repository`
          });
        }
        release.uvcs = {
          changesetId: validation.changeset.changesetId,
          branch: req.body.uvcs.branch || validation.changeset.branch,
          repository: repo
        };
      }
    }

    await release.save();

    const updated = await Release.findById(release._id)
      .populate('project', 'name key owner')
      .populate('version')
      .populate('createdBy', 'name email role')
      .populate('approvedBy', 'name email role')
      .populate('fixedBugs');

    return res.status(200).json({
      success: true,
      message: 'Release updated successfully',
      release: updated
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error updating release'
    });
  }
};

// @desc    Approve a release (transition to approved)
// @route   PUT /api/projects/:projectId/releases/:releaseId/approve
// @access  Private (Owner or Admin Only)
const approveRelease = async (req, res) => {
  try {
    const { projectId, releaseId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(releaseId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    if (!isOwnerOrAdmin(project, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the project owner or an administrator can approve releases'
      });
    }

    const release = await Release.findOne({ _id: releaseId, project: projectId });
    if (!release) {
      return res.status(404).json({ success: false, message: 'Release not found' });
    }

    if (release.status === 'withdrawn') {
      return res.status(400).json({
        success: false,
        message: 'Cannot approve a withdrawn release. Please create or update a new release baseline.'
      });
    }

    release.status = 'approved';
    release.approvedBy = req.user._id;
    await release.save();

    const updated = await Release.findById(release._id)
      .populate('project', 'name key owner')
      .populate('version')
      .populate('createdBy', 'name email role')
      .populate('approvedBy', 'name email role')
      .populate('fixedBugs');

    return res.status(200).json({
      success: true,
      message: 'Release approved successfully',
      release: updated
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error approving release'
    });
  }
};

// @desc    Publish a release (transition to published)
// @route   PUT /api/projects/:projectId/releases/:releaseId/publish
// @access  Private (Owner or Admin Only)
const publishRelease = async (req, res) => {
  try {
    const { projectId, releaseId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(releaseId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    if (!isOwnerOrAdmin(project, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the project owner or an administrator can publish releases'
      });
    }

    const release = await Release.findOne({ _id: releaseId, project: projectId });
    if (!release) {
      return res.status(404).json({ success: false, message: 'Release not found' });
    }

    if (release.status === 'withdrawn') {
      return res.status(400).json({
        success: false,
        message: 'Cannot publish a withdrawn release.'
      });
    }

    release.status = 'published';
    if (!release.approvedBy) {
      release.approvedBy = req.user._id;
    }
    if (!release.releaseDate) {
      release.releaseDate = new Date();
    }

    await release.save();

    // Mark the associated Version document as 'released'
    await Version.findByIdAndUpdate(release.version, {
      status: 'released',
      releaseDate: release.releaseDate
    });

    const updated = await Release.findById(release._id)
      .populate('project', 'name key owner')
      .populate('version')
      .populate('createdBy', 'name email role')
      .populate('approvedBy', 'name email role')
      .populate('fixedBugs');

    return res.status(200).json({
      success: true,
      message: 'Release published successfully to production baseline',
      release: updated
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error publishing release'
    });
  }
};

// @desc    Generate release notes from real MongoDB application data
// @route   POST /api/projects/:projectId/releases/:releaseId/generate-notes
// @access  Private (Owner or Admin)
const generateReleaseNotes = async (req, res) => {
  try {
    const { projectId, releaseId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(releaseId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    if (!isOwnerOrAdmin(project, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the project owner or an administrator can generate release notes'
      });
    }

    const release = await Release.findOne({ _id: releaseId, project: projectId }).populate('version');
    if (!release) {
      return res.status(404).json({ success: false, message: 'Release not found' });
    }

    const version = release.version;
    if (!version) {
      return res.status(404).json({ success: false, message: 'Version record not found' });
    }

    // 1. Retrieve real resolved or closed bugs for this project
    const resolvedBugs = await Bug.find({
      project: projectId,
      status: { $in: ['resolved', 'closed'] }
    }).sort({ priority: 1, createdAt: -1 });

    // 2. Retrieve real approved or implemented change requests for this project
    const approvedCRs = await ChangeRequest.find({
      project: projectId,
      status: { $in: ['approved', 'implemented'] }
    }).sort({ priority: 1, createdAt: -1 });

    // 3. Assemble formatted real release notes content
    const currentDateStr = release.releaseDate
      ? new Date(release.releaseDate).toLocaleDateString()
      : new Date().toLocaleDateString();

    const versionChangesText =
      version.changes && version.changes.length > 0
        ? version.changes.map((c, i) => `${i + 1}. ${c}`).join('\n')
        : '1. Production baseline release.';

    const bugsText =
      resolvedBugs.length > 0
        ? resolvedBugs
            .map(
              (b) =>
                `- [BUG-${b._id.toString().slice(-6).toUpperCase()}] ${b.title} (Severity: ${b.severity}, Priority: ${b.priority}, Status: ${b.status})${b.resolution ? `\n  *Resolution: ${b.resolution}*` : ''}`
            )
            .join('\n')
        : '- No resolved defects recorded for this milestone.';

    const crText =
      approvedCRs.length > 0
        ? approvedCRs
            .map(
              (cr) =>
                `- [CR-${cr._id.toString().slice(-6).toUpperCase()}] ${cr.title} (Priority: ${cr.priority}, Status: ${cr.status})\n  *Justification: ${cr.reason}*`
            )
            .join('\n')
        : '- No approved change requests incorporated in this milestone.';

    const uvcsBaseline =
      release.uvcs?.changesetId !== null && release.uvcs?.changesetId !== undefined
        ? release.uvcs
        : (version.uvcs?.changesetId !== null && version.uvcs?.changesetId !== undefined ? version.uvcs : null);

    const uvcsTraceabilityText = uvcsBaseline
      ? `- **Unity Version Control Changeset**: cs:${uvcsBaseline.changesetId}
- **Unity Version Control Branch**: ${uvcsBaseline.branch || '/main'}
- **Repository Baseline**: ${uvcsBaseline.repository || 'default@local'}
- **Baseline Audit**: Verified against repository changesets`
      : `- **Unity Version Control Changeset**: Not linked yet
- **Unity Version Control Branch**: Not linked yet
*(Source code commits and branches are managed in Unity Version Control and tracked separately)*`;

    const releaseNotesMarkdown = `# Release Notes: ${release.releaseName} (v${version.versionNumber})

## Release Overview
- **Project**: ${project.name} (${project.key})
- **Software Version**: v${version.versionNumber} — ${version.name}
- **Lifecycle Status**: ${release.status.toUpperCase()}
- **Release Date**: ${currentDateStr}
- **Description**: ${release.description || version.description || 'Production software release.'}

## New Features / Changes
${versionChangesText}

## Bug Fixes (${resolvedBugs.length} Resolved)
${bugsText}

## Approved Change Requests (${approvedCRs.length} Approved)
${crText}

## Configuration Information
- **System Baseline Key**: ${project.key}
- **Version Number**: ${version.versionNumber}
- **Compiled By**: ${req.user.name} (${req.user.role})
- **Audit Timestamp**: ${new Date().toISOString()}

## Configuration Management Traceability
${uvcsTraceabilityText}
`;

    // 4. Update release document in MongoDB
    release.releaseNotes = releaseNotesMarkdown;
    release.includedChanges = version.changes || [];
    release.fixedBugs = resolvedBugs.map((b) => b._id);
    await release.save();

    const updated = await Release.findById(release._id)
      .populate('project', 'name key owner')
      .populate('version')
      .populate('createdBy', 'name email role')
      .populate('approvedBy', 'name email role')
      .populate('fixedBugs');

    return res.status(200).json({
      success: true,
      message: 'Release notes generated successfully from live project data',
      release: updated
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error generating release notes'
    });
  }
};

// @desc    Delete release
// @route   DELETE /api/projects/:projectId/releases/:releaseId
// @access  Private (Owner or Admin)
const deleteRelease = async (req, res) => {
  try {
    const { projectId, releaseId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(releaseId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    if (!isOwnerOrAdmin(project, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the project owner or an administrator can delete releases'
      });
    }

    const release = await Release.findOneAndDelete({ _id: releaseId, project: projectId });
    if (!release) {
      return res.status(404).json({ success: false, message: 'Release not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Release deleted successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error deleting release'
    });
  }
};

// @desc    Get release statistics across all projects
// @route   GET /api/releases/stats/summary
// @access  Private
const getReleaseStats = async (req, res) => {
  try {
    const totalReleases = await Release.countDocuments();
    const draftReleases = await Release.countDocuments({ status: 'draft' });
    const pendingApproval = await Release.countDocuments({ status: 'pending_approval' });
    const approvedReleases = await Release.countDocuments({ status: 'approved' });
    const publishedReleases = await Release.countDocuments({ status: 'published' });
    const withdrawnReleases = await Release.countDocuments({ status: 'withdrawn' });

    return res.status(200).json({
      success: true,
      stats: {
        totalReleases,
        draftReleases,
        pendingApproval,
        approvedReleases,
        publishedReleases,
        withdrawnReleases
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching release statistics'
    });
  }
};

// @desc    Get recent releases across all projects
// @route   GET /api/releases/recent
// @access  Private
const getRecentReleases = async (req, res) => {
  try {
    const recentReleases = await Release.find()
      .populate('project', 'name key')
      .populate('version', 'versionNumber name status')
      .populate('createdBy', 'name email role')
      .populate('approvedBy', 'name email role')
      .sort({ createdAt: -1 })
      .limit(6);

    return res.status(200).json({
      success: true,
      count: recentReleases.length,
      releases: recentReleases
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching recent releases'
    });
  }
};

// @desc    Link or unlink UVCS changeset baseline to a release
// @route   PUT /api/projects/:projectId/releases/:releaseId/link-uvcs
// @access  Private (Owner or Admin)
const linkUvcsBaseline = async (req, res) => {
  try {
    const { projectId, releaseId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(releaseId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    if (!isOwnerOrAdmin(project, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the project owner or an administrator can link release baselines'
      });
    }

    const release = await Release.findOne({ _id: releaseId, project: projectId });
    if (!release) {
      return res.status(404).json({ success: false, message: 'Release not found' });
    }

    const { changesetId, branch, repository } = req.body;

    if (changesetId === null || changesetId === undefined || changesetId === '') {
      release.uvcs = { changesetId: null, branch: null, repository: null };
    } else {
      const repoSpec = repository || 'default@local';
      const validation = await uvcsService.validateChangeset(changesetId, repoSpec);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.error || `Changeset ${changesetId} not found in UVCS repository`
        });
      }

      release.uvcs = {
        changesetId: validation.changeset.changesetId,
        branch: branch || validation.changeset.branch,
        repository: repoSpec
      };
    }

    await release.save();

    const updated = await Release.findById(release._id)
      .populate('project', 'name key')
      .populate('version', 'versionNumber name status')
      .populate('createdBy', 'name email role')
      .populate('approvedBy', 'name email role');

    return res.status(200).json({
      success: true,
      message: release.uvcs?.changesetId !== null
        ? `Successfully linked UVCS changeset ${release.uvcs.changesetId} baseline`
        : 'Successfully unlinked UVCS baseline',
      release: updated
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error linking UVCS baseline to release'
    });
  }
};

module.exports = {
  createRelease,
  getReleases,
  getReleaseById,
  updateRelease,
  approveRelease,
  publishRelease,
  generateReleaseNotes,
  deleteRelease,
  getReleaseStats,
  getRecentReleases,
  linkUvcsBaseline
};
