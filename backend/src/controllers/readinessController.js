const mongoose = require('mongoose');
const Project = require('../models/Project');
const Release = require('../models/Release');
const Version = require('../models/Version');
const Bug = require('../models/Bug');
const ChangeRequest = require('../models/ChangeRequest');
const uvcsService = require('../services/uvcsService');

/**
 * Computes the 8 SCM Governance Readiness Checks for a specific Release
 */
const evaluateReleaseReadiness = async (releaseDoc, cachedUVCSStatus = null) => {
  const releaseId = releaseDoc._id.toString();
  const projectId = releaseDoc.project._id ? releaseDoc.project._id.toString() : releaseDoc.project.toString();
  const versionId = releaseDoc.version ? (releaseDoc.version._id ? releaseDoc.version._id.toString() : releaseDoc.version.toString()) : null;

  // Retrieve populated target version if needed
  let versionDoc = null;
  if (versionId) {
    versionDoc = await Version.findById(versionId).lean();
  }

  // Retrieve bugs linked to version or in release.fixedBugs
  const candidateBugs = await Bug.find({
    $or: [
      { project: projectId, version: versionId },
      { _id: { $in: releaseDoc.fixedBugs || [] } }
    ]
  }).lean();

  const unresolvedBugs = candidateBugs.filter((b) => ['open', 'in_progress', 'reopened'].includes(b.status));
  const criticalUnresolved = unresolvedBugs.filter((b) => b.severity === 'critical');
  const highUnresolved = unresolvedBugs.filter((b) => b.severity === 'high');

  // Retrieve Change Requests linked to target version or release.changeRequests
  const candidateCRs = await ChangeRequest.find({
    $or: [
      { project: projectId, targetVersion: versionId },
      { _id: { $in: releaseDoc.changeRequests || [] } }
    ]
  }).lean();

  const rejectedOrCancelledCRs = candidateCRs.filter((c) => ['rejected', 'cancelled'].includes(c.status));
  const pendingCRs = candidateCRs.filter((c) => ['submitted', 'under_review'].includes(c.status));
  const approvedOrImplementedCRs = candidateCRs.filter((c) => ['approved', 'implemented'].includes(c.status));

  // Retrieve UVCS baseline status safely
  const hasVersionUVCS = versionDoc && versionDoc.uvcs && versionDoc.uvcs.changesetId !== null && versionDoc.uvcs.changesetId !== undefined;
  const hasReleaseUVCS = releaseDoc.uvcs && releaseDoc.uvcs.changesetId !== null && releaseDoc.uvcs.changesetId !== undefined;
  const uvcsLinked = hasVersionUVCS || hasReleaseUVCS;

  let uvcsStatusData = cachedUVCSStatus;
  if (!uvcsStatusData) {
    try {
      uvcsStatusData = await uvcsService.getStatus();
    } catch (e) {
      uvcsStatusData = { installed: false, inWorkspace: false };
    }
  }

  const checks = [];
  const blockers = [];

  // ==========================================
  // CHECK 1: VERSION STATUS (Weight: 15)
  // ==========================================
  const checkVersion = {
    key: 'version',
    name: 'Version Configuration',
    weight: 15,
    score: 0,
    status: 'FAIL',
    description: 'Verifies the software version lifecycle baseline state.',
    details: ''
  };

  if (!versionDoc) {
    checkVersion.status = 'FAIL';
    checkVersion.score = 0;
    checkVersion.details = 'No software version is linked to this release.';
    blockers.push('No software version baseline linked to release.');
  } else if (versionDoc.status === 'released') {
    checkVersion.status = 'PASS';
    checkVersion.score = 15;
    checkVersion.details = `Version v${versionDoc.versionNumber} is officially in released status.`;
  } else if (versionDoc.status === 'testing') {
    checkVersion.status = 'WARNING';
    checkVersion.score = 7.5;
    checkVersion.details = `Version v${versionDoc.versionNumber} is currently in testing status (approaching final milestone).`;
  } else if (versionDoc.status === 'development') {
    checkVersion.status = 'FAIL';
    checkVersion.score = 0;
    checkVersion.details = `Version v${versionDoc.versionNumber} is still in active development.`;
    blockers.push(`Target version v${versionDoc.versionNumber} is still in development state.`);
  } else {
    checkVersion.status = 'FAIL';
    checkVersion.score = 0;
    checkVersion.details = `Version v${versionDoc.versionNumber} is in ${versionDoc.status} state.`;
  }
  checks.push(checkVersion);

  // ==========================================
  // CHECK 2: OPEN BUGS (Weight: 20)
  // ==========================================
  const checkOpenBugs = {
    key: 'open_bugs',
    name: 'Defect Resolution State',
    weight: 20,
    score: 0,
    status: 'FAIL',
    description: 'Evaluates unresolved defects associated with the release version scope.',
    details: ''
  };

  if (unresolvedBugs.length === 0) {
    checkOpenBugs.status = 'PASS';
    checkOpenBugs.score = 20;
    checkOpenBugs.details = 'Zero unresolved defects linked to this version and release scope.';
  } else if (criticalUnresolved.length === 0) {
    checkOpenBugs.status = 'WARNING';
    checkOpenBugs.score = 10;
    checkOpenBugs.details = `${unresolvedBugs.length} non-critical defect(s) remain unresolved (${unresolvedBugs.map((b) => b.title).slice(0, 2).join(', ')}).`;
  } else {
    checkOpenBugs.status = 'FAIL';
    checkOpenBugs.score = 0;
    checkOpenBugs.details = `${criticalUnresolved.length} critical defect(s) remain unresolved (${criticalUnresolved.map((b) => b.title).slice(0, 2).join(', ')}).`;
    blockers.push(`${criticalUnresolved.length} critical defect(s) remain unresolved in the release scope.`);
  }
  checks.push(checkOpenBugs);

  // ==========================================
  // CHECK 3: CRITICAL/HIGH BUGS (Weight: 15)
  // ==========================================
  const checkSeverityBugs = {
    key: 'critical_bugs',
    name: 'High & Critical Defect Triage',
    weight: 15,
    score: 0,
    status: 'FAIL',
    description: 'Ensures no high or critical priority bugs bypass release governance.',
    details: ''
  };

  if (criticalUnresolved.length === 0 && highUnresolved.length === 0) {
    checkSeverityBugs.status = 'PASS';
    checkSeverityBugs.score = 15;
    checkSeverityBugs.details = 'Zero high or critical priority unresolved defects detected.';
  } else if (criticalUnresolved.length === 0 && highUnresolved.length > 0) {
    checkSeverityBugs.status = 'WARNING';
    checkSeverityBugs.score = 7.5;
    checkSeverityBugs.details = `${highUnresolved.length} high-severity defect(s) remain unresolved.`;
  } else {
    checkSeverityBugs.status = 'FAIL';
    checkSeverityBugs.score = 0;
    checkSeverityBugs.details = `${criticalUnresolved.length} critical defect(s) and ${highUnresolved.length} high-severity defect(s) remain open.`;
  }
  checks.push(checkSeverityBugs);

  // ==========================================
  // CHECK 4: CHANGE REQUEST GOVERNANCE (Weight: 15)
  // ==========================================
  const checkCR = {
    key: 'change_requests',
    name: 'Change Request Governance',
    weight: 15,
    score: 0,
    status: 'FAIL',
    description: 'Audits change proposal approvals and scope integrity.',
    details: ''
  };

  if (rejectedOrCancelledCRs.length > 0) {
    checkCR.status = 'FAIL';
    checkCR.score = 0;
    checkCR.details = `${rejectedOrCancelledCRs.length} rejected or cancelled change proposal(s) are included in release scope.`;
    blockers.push(`Rejected or cancelled change request(s) (${rejectedOrCancelledCRs.map((c) => c.title).slice(0, 2).join(', ')}) included in release.`);
  } else if (pendingCRs.length > 0) {
    checkCR.status = 'WARNING';
    checkCR.score = 7.5;
    checkCR.details = `${pendingCRs.length} change request(s) are still under review or pending approval.`;
  } else if (candidateCRs.length === 0) {
    checkCR.status = 'PASS';
    checkCR.score = 15;
    checkCR.details = 'No pending change requests in scope; baseline changes formally reviewed.';
  } else {
    checkCR.status = 'PASS';
    checkCR.score = 15;
    checkCR.details = `All ${candidateCRs.length} associated change request(s) are approved or implemented.`;
  }
  checks.push(checkCR);

  // ==========================================
  // CHECK 5: TRACEABILITY (Weight: 10)
  // ==========================================
  const checkTraceability = {
    key: 'traceability',
    name: 'SCM Traceability Alignment',
    weight: 10,
    score: 0,
    status: 'FAIL',
    description: 'Verifies bi-directional linkage from change request through version, UVCS baseline, and release.',
    details: ''
  };

  const missingTrace = [];
  if (!versionDoc) missingTrace.push('Missing version link');
  if (!uvcsLinked) missingTrace.push('UVCS baseline not linked');
  if (candidateCRs.length === 0 && candidateBugs.length === 0) {
    missingTrace.push('Release has no linked change requests or fixed defects');
  }

  if (missingTrace.length === 0) {
    checkTraceability.status = 'PASS';
    checkTraceability.score = 10;
    checkTraceability.details = 'End-to-end traceability established across Change Requests, Defects, Version, UVCS Baseline, and Release.';
  } else if (missingTrace.length <= 1 && versionDoc) {
    checkTraceability.status = 'WARNING';
    checkTraceability.score = 5;
    checkTraceability.details = `Partial traceability: ${missingTrace.join('; ')}.`;
  } else {
    checkTraceability.status = 'FAIL';
    checkTraceability.score = 0;
    checkTraceability.details = `Traceability gaps detected: ${missingTrace.join('; ')}.`;
  }
  checks.push(checkTraceability);

  // ==========================================
  // CHECK 6: UVCS BASELINE (Weight: 10)
  // ==========================================
  const checkUVCS = {
    key: 'uvcs',
    name: 'Unity Version Control Baseline',
    weight: 10,
    score: 0,
    status: 'FAIL',
    description: 'Ensures release is anchored to an immutable source-control changeset.',
    details: ''
  };

  const activeUVCS = versionDoc?.uvcs?.changesetId !== null && versionDoc?.uvcs?.changesetId !== undefined
    ? versionDoc.uvcs
    : releaseDoc.uvcs?.changesetId !== null && releaseDoc.uvcs?.changesetId !== undefined
    ? releaseDoc.uvcs
    : null;

  if (activeUVCS && activeUVCS.changesetId !== null && activeUVCS.changesetId !== undefined) {
    checkUVCS.status = 'PASS';
    checkUVCS.score = 10;
    checkUVCS.details = `Anchored to UVCS changeset cs:${activeUVCS.changesetId} on branch ${activeUVCS.branch || '/main'} (${activeUVCS.repository || 'default@local'}).`;
  } else if (!uvcsStatusData || !uvcsStatusData.installed) {
    checkUVCS.status = 'WARNING';
    checkUVCS.score = 5;
    checkUVCS.details = 'UVCS unavailable: Plastic SCM CLI not detected; configuration readiness cannot fully verify source-control baseline.';
  } else {
    checkUVCS.status = 'WARNING';
    checkUVCS.score = 5;
    checkUVCS.details = 'Version exists but UVCS changeset baseline is not linked.';
  }
  checks.push(checkUVCS);

  // ==========================================
  // CHECK 7: RELEASE NOTES (Weight: 5)
  // ==========================================
  const checkNotes = {
    key: 'release_notes',
    name: 'Release Documentation & Notes',
    weight: 5,
    score: 0,
    status: 'FAIL',
    description: 'Verifies comprehensive release notes compiling resolved items and changes.',
    details: ''
  };

  const notesText = (releaseDoc.releaseNotes || '').trim();
  if (notesText.length >= 30) {
    checkNotes.status = 'PASS';
    checkNotes.score = 5;
    checkNotes.details = `Comprehensive release notes generated (${notesText.length} characters).`;
  } else if (notesText.length > 0) {
    checkNotes.status = 'WARNING';
    checkNotes.score = 2.5;
    checkNotes.details = 'Release notes are very brief. Compile detailed notes before publication.';
  } else {
    checkNotes.status = 'WARNING';
    checkNotes.score = 2.5;
    checkNotes.details = 'Release notes have not been generated yet. Use automated release notes compiler.';
  }
  checks.push(checkNotes);

  // ==========================================
  // CHECK 8: APPROVAL (Weight: 10)
  // ==========================================
  const checkApproval = {
    key: 'approval',
    name: 'Release Governance & Approval',
    weight: 10,
    score: 0,
    status: 'FAIL',
    description: 'Validates administrative sign-off and approval governance milestone.',
    details: ''
  };

  if (releaseDoc.status === 'published') {
    checkApproval.status = 'PASS';
    checkApproval.score = 10;
    checkApproval.details = `Release is officially published (approved by ${releaseDoc.approvedBy?.name || 'Administrator'}).`;
  } else if (releaseDoc.status === 'approved') {
    checkApproval.status = 'PASS';
    checkApproval.score = 10;
    checkApproval.details = `Release has received formal governance approval from ${releaseDoc.approvedBy?.name || 'Project Manager'}.`;
  } else if (releaseDoc.status === 'pending_approval') {
    checkApproval.status = 'WARNING';
    checkApproval.score = 5;
    checkApproval.details = 'Release has been submitted and is pending formal governance sign-off.';
    blockers.push('Release approval is pending formal review.');
  } else if (releaseDoc.status === 'draft') {
    checkApproval.status = 'WARNING';
    checkApproval.score = 5;
    checkApproval.details = 'Release is currently in draft state; submission and approval required prior to publishing.';
    blockers.push('Release approval is pending (release in draft status).');
  } else if (releaseDoc.status === 'withdrawn') {
    checkApproval.status = 'FAIL';
    checkApproval.score = 0;
    checkApproval.details = 'Release has been withdrawn and cannot be published.';
    blockers.push('Release has been withdrawn from publication lifecycle.');
  } else {
    checkApproval.status = 'FAIL';
    checkApproval.score = 0;
    checkApproval.details = `Release has unrecognized status '${releaseDoc.status}'.`;
  }
  checks.push(checkApproval);

  // ==========================================
  // DYNAMIC WEIGHTED SCORING
  // ==========================================
  let totalScore = 0;
  let totalApplicableWeight = 0;
  let passedCount = 0;
  let warningCount = 0;
  let failedCount = 0;
  let naCount = 0;

  checks.forEach((c) => {
    if (c.status === 'PASS') passedCount++;
    else if (c.status === 'WARNING') warningCount++;
    else if (c.status === 'FAIL') failedCount++;
    else if (c.status === 'NOT_APPLICABLE') naCount++;

    if (c.status !== 'NOT_APPLICABLE') {
      totalScore += c.score;
      totalApplicableWeight += c.weight;
    }
  });

  const finalScore = totalApplicableWeight > 0 ? Math.round((totalScore / totalApplicableWeight) * 100) : 0;

  // ==========================================
  // READINESS LEVEL DETERMINATION
  // ==========================================
  // Critical blockers force NOT_READY regardless of numerical score
  const hasCriticalBlocker =
    criticalUnresolved.length > 0 ||
    releaseDoc.status === 'withdrawn' ||
    rejectedOrCancelledCRs.length > 0 ||
    !versionDoc;

  let readinessLevel = 'NOT_READY';
  let isReady = false;

  if (hasCriticalBlocker) {
    readinessLevel = 'NOT_READY';
    isReady = false;
  } else if (finalScore >= 80 && blockers.length === 0) {
    readinessLevel = 'READY';
    isReady = true;
  } else if (finalScore >= 60) {
    readinessLevel = 'CONDITIONALLY_READY';
    isReady = false;
  } else {
    readinessLevel = 'NOT_READY';
    isReady = false;
  }

  // ==========================================
  // VISUAL GOVERNANCE PIPELINE STAGES
  // ==========================================
  const pipeline = [
    {
      stage: 'VERSION',
      name: 'Software Version',
      status: checkVersion.status,
      label: versionDoc ? `v${versionDoc.versionNumber} (${versionDoc.status})` : 'No Version'
    },
    {
      stage: 'DEFECT_REVIEW',
      name: 'Defect Review',
      status: checkOpenBugs.status === 'FAIL' || checkSeverityBugs.status === 'FAIL' ? 'FAIL' : checkOpenBugs.status === 'WARNING' || checkSeverityBugs.status === 'WARNING' ? 'WARNING' : 'PASS',
      label: `${unresolvedBugs.length} Open (${criticalUnresolved.length} Crit, ${highUnresolved.length} High)`
    },
    {
      stage: 'CHANGE_GOVERNANCE',
      name: 'Change Governance',
      status: checkCR.status,
      label: `${candidateCRs.length} CRs (${approvedOrImplementedCRs.length} Approved)`
    },
    {
      stage: 'TRACEABILITY',
      name: 'Traceability',
      status: checkTraceability.status,
      label: checkTraceability.status === 'PASS' ? 'Bi-directional Linkage' : `${missingTrace.length} Gap(s)`
    },
    {
      stage: 'UVCS_BASELINE',
      name: 'UVCS Baseline',
      status: checkUVCS.status,
      label: activeUVCS?.changesetId !== null && activeUVCS?.changesetId !== undefined ? `cs:${activeUVCS.changesetId}` : 'Not Linked'
    },
    {
      stage: 'APPROVAL',
      name: 'Governance Approval',
      status: checkApproval.status,
      label: releaseDoc.status.replace(/_/g, ' ').toUpperCase()
    },
    {
      stage: 'RELEASE',
      name: 'Publication Readiness',
      status: readinessLevel === 'READY' ? 'PASS' : readinessLevel === 'CONDITIONALLY_READY' ? 'WARNING' : 'FAIL',
      label: readinessLevel.replace(/_/g, ' ')
    }
  ];

  return {
    release: {
      id: releaseDoc._id,
      releaseName: releaseDoc.releaseName,
      status: releaseDoc.status,
      releaseDate: releaseDoc.releaseDate,
      description: releaseDoc.description,
      releaseNotes: releaseDoc.releaseNotes,
      includedChanges: releaseDoc.includedChanges,
      fixedBugs: releaseDoc.fixedBugs,
      changeRequests: releaseDoc.changeRequests,
      createdBy: releaseDoc.createdBy,
      approvedBy: releaseDoc.approvedBy,
      uvcs: releaseDoc.uvcs,
      project: releaseDoc.project,
      version: versionDoc
        ? {
            id: versionDoc._id,
            versionNumber: versionDoc.versionNumber,
            name: versionDoc.name,
            status: versionDoc.status,
            uvcs: versionDoc.uvcs
          }
        : null
    },
    score: finalScore,
    readiness: {
      level: readinessLevel,
      ready: isReady
    },
    summary: {
      passed: passedCount,
      warnings: warningCount,
      failed: failedCount,
      notApplicable: naCount
    },
    checks,
    blockers,
    metrics: {
      openBugs: unresolvedBugs.length,
      criticalBugs: criticalUnresolved.length,
      highBugs: highUnresolved.length,
      pendingChangeRequests: pendingCRs.length,
      traceabilityGaps: missingTrace.length,
      uvcsLinked
    },
    pipeline
  };
};

/**
 * @desc    Get Release Readiness overview and selectable releases
 * @route   GET /api/release-readiness
 * @access  Private (Authenticated users)
 */
const getReleaseReadiness = async (req, res) => {
  try {
    const { project: projectParam, release: releaseParam } = req.query;

    let accessibleProjects = [];
    let targetProjectIds = [];

    // RBAC: Admins can query all projects; non-admins restricted to their owned/member projects
    if (req.user.role === 'admin') {
      accessibleProjects = await Project.find({}).select('name key owner members status').lean();

      if (projectParam) {
        if (!mongoose.Types.ObjectId.isValid(projectParam)) {
          return res.status(400).json({ success: false, message: 'Invalid project ID format' });
        }
        const targetProj = accessibleProjects.find((p) => p._id.toString() === projectParam.toString());
        if (!targetProj) {
          return res.status(404).json({ success: false, message: 'Project not found' });
        }
        targetProjectIds = [targetProj._id];
      } else {
        targetProjectIds = accessibleProjects.map((p) => p._id);
      }
    } else {
      accessibleProjects = await Project.find({
        $or: [{ owner: req.user._id }, { members: req.user._id }]
      })
        .select('name key owner members status')
        .lean();

      const userProjectIds = accessibleProjects.map((p) => p._id.toString());

      if (projectParam) {
        if (!mongoose.Types.ObjectId.isValid(projectParam)) {
          return res.status(400).json({ success: false, message: 'Invalid project ID format' });
        }
        if (!userProjectIds.includes(projectParam.toString())) {
          return res.status(403).json({
            success: false,
            message: 'Forbidden: You do not have permission to view release readiness for this project'
          });
        }
        targetProjectIds = [new mongoose.Types.ObjectId(projectParam)];
      } else {
        targetProjectIds = accessibleProjects.map((p) => p._id);
      }
    }

    if (targetProjectIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          releases: [],
          filters: {
            projects: accessibleProjects.map((p) => ({ id: p._id, name: p.name, key: p.key }))
          },
          selectedReadiness: null
        }
      });
    }

    // Retrieve releases belonging to target projects
    const rawReleases = await Release.find({ project: { $in: targetProjectIds } })
      .populate('project', 'name key')
      .populate('version')
      .populate('createdBy', 'name email role')
      .populate('approvedBy', 'name email role')
      .sort({ createdAt: -1 })
      .lean();

    const releaseSummaries = [];
    let selectedReadiness = null;

    let cachedUVCS = null;
    try {
      cachedUVCS = await uvcsService.getStatus();
    } catch (e) {
      cachedUVCS = { installed: false, inWorkspace: false };
    }

    for (const rel of rawReleases) {
      const evaluation = await evaluateReleaseReadiness(rel, cachedUVCS);
      const isSelected = releaseParam && releaseParam === rel._id.toString();

      releaseSummaries.push({
        id: rel._id,
        releaseName: rel.releaseName,
        status: rel.status,
        releaseDate: rel.releaseDate,
        version: rel.version ? `v${rel.version.versionNumber}` : 'None',
        project: rel.project,
        score: evaluation.score,
        readinessLevel: evaluation.readiness.level,
        ready: evaluation.readiness.ready,
        blockersCount: evaluation.blockers.length,
        metrics: evaluation.metrics
      });

      if (isSelected) {
        selectedReadiness = evaluation;
      }
    }

    // If a specific release was requested via query param but not in accessible list
    if (releaseParam && !selectedReadiness) {
      if (!mongoose.Types.ObjectId.isValid(releaseParam)) {
        return res.status(400).json({ success: false, message: 'Invalid release ID format' });
      }
      const relCheck = await Release.findById(releaseParam).populate('project').lean();
      if (!relCheck) {
        return res.status(404).json({ success: false, message: 'Release not found' });
      }
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to view readiness for this release'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        releases: releaseSummaries,
        filters: {
          projects: accessibleProjects.map((p) => ({ id: p._id, name: p.name, key: p.key }))
        },
        selectedReadiness
      }
    });
  } catch (error) {
    console.error('Error in getReleaseReadiness:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve release readiness data',
      error: error.message
    });
  }
};

/**
 * @desc    Get detailed Release Readiness evaluation for a specific Release
 * @route   GET /api/release-readiness/release/:releaseId
 * @access  Private (Authenticated users)
 */
const getReleaseReadinessByRelease = async (req, res) => {
  try {
    const { releaseId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(releaseId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid release ID format'
      });
    }

    const release = await Release.findById(releaseId)
      .populate('project', 'name key owner members')
      .populate('version')
      .populate('createdBy', 'name email role')
      .populate('approvedBy', 'name email role')
      .lean();

    if (!release) {
      return res.status(404).json({
        success: false,
        message: 'Release not found'
      });
    }

    // RBAC: Check project authorization
    if (req.user.role !== 'admin') {
      const project = release.project;
      const isOwner = project && project.owner && project.owner.toString() === req.user._id.toString();
      const isMember = project && Array.isArray(project.members) && project.members.some((m) => m.toString() === req.user._id.toString());

      if (!isOwner && !isMember) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You do not have permission to view readiness for this release'
        });
      }
    }

    // Compute detailed readiness evaluation
    const readinessData = await evaluateReleaseReadiness(release);

    return res.status(200).json({
      success: true,
      data: readinessData
    });
  } catch (error) {
    console.error('Error in getReleaseReadinessByRelease:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to evaluate release readiness',
      error: error.message
    });
  }
};

module.exports = {
  getReleaseReadiness,
  getReleaseReadinessByRelease,
  evaluateReleaseReadiness
};
