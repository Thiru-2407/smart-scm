const mongoose = require('mongoose');
const Project = require('../models/Project');
const Version = require('../models/Version');
const Bug = require('../models/Bug');
const ChangeRequest = require('../models/ChangeRequest');
const Release = require('../models/Release');

// @desc    Get system-wide SCM overview metrics across all projects
// @route   GET /api/reports/overview
// @access  Private (Authenticated users)
const getOverviewReport = async (req, res) => {
  try {
    const [
      totalProjects,
      activeProjects,
      completedProjects,
      totalVersions,
      versionsInDevelopment,
      versionsInTesting,
      releasedVersions,
      deprecatedVersions,
      totalBugs,
      openBugs,
      inProgressBugs,
      resolvedBugs,
      closedBugs,
      totalChangeRequests,
      pendingChangeRequests,
      approvedChangeRequests,
      implementedChangeRequests,
      totalReleases,
      draftReleases,
      pendingApprovalReleases,
      approvedReleases,
      publishedReleases,
      withdrawnReleases
    ] = await Promise.all([
      // Projects
      Project.countDocuments({}),
      Project.countDocuments({ status: 'active' }),
      Project.countDocuments({ status: 'completed' }),

      // Versions
      Version.countDocuments({}),
      Version.countDocuments({ status: 'development' }),
      Version.countDocuments({ status: 'testing' }),
      Version.countDocuments({ status: 'released' }),
      Version.countDocuments({ status: 'deprecated' }),

      // Bugs
      Bug.countDocuments({}),
      Bug.countDocuments({ status: 'open' }),
      Bug.countDocuments({ status: 'in_progress' }),
      Bug.countDocuments({ status: 'resolved' }),
      Bug.countDocuments({ status: 'closed' }),

      // Change Requests
      ChangeRequest.countDocuments({}),
      ChangeRequest.countDocuments({ status: { $in: ['submitted', 'under_review'] } }),
      ChangeRequest.countDocuments({ status: 'approved' }),
      ChangeRequest.countDocuments({ status: 'implemented' }),

      // Releases
      Release.countDocuments({}),
      Release.countDocuments({ status: 'draft' }),
      Release.countDocuments({ status: 'pending_approval' }),
      Release.countDocuments({ status: 'approved' }),
      Release.countDocuments({ status: 'published' }),
      Release.countDocuments({ status: 'withdrawn' })
    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalProjects,
        activeProjects,
        completedProjects,
        totalVersions,
        versionsInDevelopment,
        versionsInTesting,
        releasedVersions,
        deprecatedVersions,
        totalBugs,
        openBugs,
        inProgressBugs,
        resolvedBugs,
        closedBugs,
        totalChangeRequests,
        pendingChangeRequests,
        approvedChangeRequests,
        implementedChangeRequests,
        totalReleases,
        draftReleases,
        pendingApprovalReleases,
        approvedReleases,
        publishedReleases,
        withdrawnReleases
      }
    });
  } catch (error) {
    console.error('Error in getOverviewReport:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate overview report',
      error: error.message
    });
  }
};

// @desc    Get detailed project-specific SCM report
// @route   GET /api/reports/projects/:projectId
// @access  Private (Authenticated users)
const getProjectReport = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const project = await Project.findById(projectId)
      .populate('owner', 'name email role')
      .populate('members', 'name email role')
      .select('-__v');

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    // Query project child entities in parallel
    const [
      versions,
      bugs,
      changeRequests,
      releases
    ] = await Promise.all([
      Version.find({ project: projectId }).select('versionNumber name status releaseDate createdAt').sort({ createdAt: -1 }),
      Bug.find({ project: projectId }).select('title severity priority status createdAt resolution').sort({ createdAt: -1 }),
      ChangeRequest.find({ project: projectId }).select('title priority status createdAt reason').sort({ createdAt: -1 }),
      Release.find({ project: projectId }).populate('version', 'versionNumber name').select('releaseName status releaseDate createdAt').sort({ createdAt: -1 })
    ]);

    // Version status breakdown
    const versionStatusBreakdown = {
      development: versions.filter(v => v.status === 'development').length,
      testing: versions.filter(v => v.status === 'testing').length,
      released: versions.filter(v => v.status === 'released').length,
      deprecated: versions.filter(v => v.status === 'deprecated').length
    };

    // Bug breakdowns
    const bugSeverityBreakdown = {
      critical: bugs.filter(b => b.severity === 'critical').length,
      high: bugs.filter(b => b.severity === 'high').length,
      medium: bugs.filter(b => b.severity === 'medium').length,
      low: bugs.filter(b => b.severity === 'low').length
    };

    const bugStatusBreakdown = {
      open: bugs.filter(b => b.status === 'open').length,
      in_progress: bugs.filter(b => b.status === 'in_progress').length,
      resolved: bugs.filter(b => b.status === 'resolved').length,
      closed: bugs.filter(b => b.status === 'closed').length,
      reopened: bugs.filter(b => b.status === 'reopened').length
    };

    // Change request status breakdown
    const changeRequestStatusBreakdown = {
      submitted: changeRequests.filter(cr => cr.status === 'submitted').length,
      under_review: changeRequests.filter(cr => cr.status === 'under_review').length,
      approved: changeRequests.filter(cr => cr.status === 'approved').length,
      rejected: changeRequests.filter(cr => cr.status === 'rejected').length,
      implemented: changeRequests.filter(cr => cr.status === 'implemented').length,
      cancelled: changeRequests.filter(cr => cr.status === 'cancelled').length
    };

    // Release status breakdown
    const releaseStatusBreakdown = {
      draft: releases.filter(r => r.status === 'draft').length,
      pending_approval: releases.filter(r => r.status === 'pending_approval').length,
      approved: releases.filter(r => r.status === 'approved').length,
      published: releases.filter(r => r.status === 'published').length,
      withdrawn: releases.filter(r => r.status === 'withdrawn').length
    };

    // Recent activity compilation
    const recentActivity = [
      ...versions.slice(0, 5).map(v => ({ type: 'version', title: `v${v.versionNumber} - ${v.name}`, status: v.status, date: v.createdAt })),
      ...bugs.slice(0, 5).map(b => ({ type: 'bug', title: b.title, status: b.status, severity: b.severity, date: b.createdAt })),
      ...changeRequests.slice(0, 5).map(cr => ({ type: 'change_request', title: cr.title, status: cr.status, date: cr.createdAt })),
      ...releases.slice(0, 5).map(r => ({ type: 'release', title: r.releaseName, status: r.status, date: r.createdAt }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

    return res.status(200).json({
      success: true,
      data: {
        project: {
          _id: project._id,
          name: project.name,
          key: project.key,
          description: project.description,
          status: project.status,
          owner: project.owner,
          membersCount: project.members ? project.members.length : 0,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt
        },
        totalVersions: versions.length,
        versionStatusBreakdown,
        totalBugs: bugs.length,
        bugSeverityBreakdown,
        bugStatusBreakdown,
        totalChangeRequests: changeRequests.length,
        changeRequestStatusBreakdown,
        totalReleases: releases.length,
        releaseStatusBreakdown,
        recentActivity
      }
    });
  } catch (error) {
    console.error('Error in getProjectReport:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate project report',
      error: error.message
    });
  }
};

// @desc    Get project quality report (defect severity, status, and resolution percentage)
// @route   GET /api/reports/projects/:projectId/quality
// @access  Private (Authenticated users)
const getProjectQualityReport = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const projectExists = await Project.exists({ _id: projectId });
    if (!projectExists) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const bugs = await Bug.find({ project: projectId }).select('severity status resolution createdAt');

    const totalBugs = bugs.length;
    const criticalBugs = bugs.filter(b => b.severity === 'critical').length;
    const highSeverityBugs = bugs.filter(b => b.severity === 'high').length;
    const mediumSeverityBugs = bugs.filter(b => b.severity === 'medium').length;
    const lowSeverityBugs = bugs.filter(b => b.severity === 'low').length;

    const openBugs = bugs.filter(b => b.status === 'open').length;
    const inProgressBugs = bugs.filter(b => b.status === 'in_progress').length;
    const resolvedBugs = bugs.filter(b => b.status === 'resolved').length;
    const closedBugs = bugs.filter(b => b.status === 'closed').length;
    const reopenedBugs = bugs.filter(b => b.status === 'reopened').length;

    const resolvedOrClosed = resolvedBugs + closedBugs;
    const resolutionPercentage = totalBugs > 0
      ? Math.round((resolvedOrClosed / totalBugs) * 1000) / 10
      : 0;

    return res.status(200).json({
      success: true,
      data: {
        totalBugs,
        criticalBugs,
        highSeverityBugs,
        mediumSeverityBugs,
        lowSeverityBugs,
        openBugs,
        inProgressBugs,
        resolvedBugs,
        closedBugs,
        reopenedBugs,
        resolutionPercentage
      }
    });
  } catch (error) {
    console.error('Error in getProjectQualityReport:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate project quality report',
      error: error.message
    });
  }
};

// @desc    Get project release governance report
// @route   GET /api/reports/projects/:projectId/releases
// @access  Private (Authenticated users)
const getProjectReleasesReport = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const projectExists = await Project.exists({ _id: projectId });
    if (!projectExists) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const releases = await Release.find({ project: projectId })
      .populate('version', 'versionNumber name status')
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 });

    const totalReleases = releases.length;
    const draftReleases = releases.filter(r => r.status === 'draft').length;
    const pendingApprovalReleases = releases.filter(r => r.status === 'pending_approval').length;
    const approvedReleases = releases.filter(r => r.status === 'approved').length;
    const publishedReleases = releases.filter(r => r.status === 'published').length;
    const withdrawnReleases = releases.filter(r => r.status === 'withdrawn').length;

    const recentReleases = releases.slice(0, 10).map(r => ({
      _id: r._id,
      releaseName: r.releaseName,
      versionNumber: r.version?.versionNumber || '1.0.0',
      versionName: r.version?.name || '',
      status: r.status,
      releaseDate: r.releaseDate,
      createdAt: r.createdAt,
      createdBy: r.createdBy ? { name: r.createdBy.name, email: r.createdBy.email } : null,
      approvedBy: r.approvedBy ? { name: r.approvedBy.name, email: r.approvedBy.email } : null
    }));

    return res.status(200).json({
      success: true,
      data: {
        totalReleases,
        draftReleases,
        pendingApprovalReleases,
        approvedReleases,
        publishedReleases,
        withdrawnReleases,
        recentReleases
      }
    });
  } catch (error) {
    console.error('Error in getProjectReleasesReport:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate project releases report',
      error: error.message
    });
  }
};

module.exports = {
  getOverviewReport,
  getProjectReport,
  getProjectQualityReport,
  getProjectReleasesReport
};
