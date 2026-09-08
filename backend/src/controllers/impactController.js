const mongoose = require('mongoose');
const Project = require('../models/Project');
const ChangeRequest = require('../models/ChangeRequest');
const Bug = require('../models/Bug');
const Version = require('../models/Version');
const Release = require('../models/Release');

/**
 * Helper to compute impact metrics and structure for a single Change Request
 */
const computeSingleCRImpact = async (cr, allProjectVersions = null, allProjectBugs = null, allProjectReleases = null) => {
  const crIdStr = cr._id.toString();
  const crKey = `CR-${cr._id.toString().slice(-6).toUpperCase()}`;
  const projectId = cr.project._id ? cr.project._id.toString() : cr.project.toString();

  // 1. Identify Related Bugs (Direct: cr.relatedBugs OR bug.changeRequest === cr._id)
  let linkedBugs = [];
  if (allProjectBugs) {
    linkedBugs = allProjectBugs.filter((b) => {
      const bCrRef = b.changeRequest ? (b.changeRequest._id || b.changeRequest).toString() : null;
      const isRelated = Array.isArray(cr.relatedBugs) && cr.relatedBugs.some((rId) => (rId._id || rId).toString() === b._id.toString());
      return bCrRef === crIdStr || isRelated;
    });
  } else {
    linkedBugs = await Bug.find({
      $or: [
        { _id: { $in: cr.relatedBugs || [] } },
        { changeRequest: cr._id }
      ]
    })
      .populate('reportedBy', 'name email')
      .populate('assignedTo', 'name email')
      .lean();
  }

  const linkedBugIds = new Set(linkedBugs.map((b) => b._id.toString()));

  // 2. Identify Target / Affected Versions
  // Direct: cr.targetVersion
  // Derived: bug.version from any linked bug
  const versionMap = new Map();
  const directVersionId = cr.targetVersion ? (cr.targetVersion._id || cr.targetVersion).toString() : null;

  if (allProjectVersions) {
    if (directVersionId) {
      const directVer = allProjectVersions.find((v) => v._id.toString() === directVersionId);
      if (directVer) {
        versionMap.set(directVer._id.toString(), { ...directVer, isDirect: true });
      }
    }
    linkedBugs.forEach((b) => {
      if (b.version) {
        const vId = (b.version._id || b.version).toString();
        if (!versionMap.has(vId)) {
          const derivedVer = allProjectVersions.find((v) => v._id.toString() === vId);
          if (derivedVer) {
            versionMap.set(vId, { ...derivedVer, isDirect: false });
          }
        }
      }
    });
  } else {
    if (directVersionId) {
      const directVer = await Version.findById(directVersionId).lean();
      if (directVer) {
        versionMap.set(directVer._id.toString(), { ...directVer, isDirect: true });
      }
    }
    for (const b of linkedBugs) {
      if (b.version) {
        const vId = (b.version._id || b.version).toString();
        if (!versionMap.has(vId)) {
          const derivedVer = await Version.findById(vId).lean();
          if (derivedVer) {
            versionMap.set(vId, { ...derivedVer, isDirect: false });
          }
        }
      }
    }
  }

  const affectedVersions = Array.from(versionMap.values());
  const affectedVersionIds = new Set(affectedVersions.map((v) => v._id.toString()));

  // 3. Identify UVCS Baselines (from affected versions or releases)
  const baselines = [];
  const baselineKeys = new Set();

  affectedVersions.forEach((v) => {
    if (v.uvcs && v.uvcs.changesetId !== null && v.uvcs.changesetId !== undefined) {
      const bKey = `${v.uvcs.changesetId}-${v.uvcs.branch || '/main'}`;
      if (!baselineKeys.has(bKey)) {
        baselineKeys.add(bKey);
        baselines.push({
          changesetId: v.uvcs.changesetId,
          branch: v.uvcs.branch || '/main',
          repository: v.uvcs.repository || 'default@local',
          versionNumber: v.versionNumber,
          versionId: v._id,
          relationship: 'baseline',
          relationshipType: 'DIRECT',
          impact: 'Affected'
        });
      }
    }
  });

  // 4. Identify Affected Releases
  // Direct: release.changeRequests includes cr._id
  // Derived via Version: release.version is in affectedVersionIds
  // Derived via Bug: release.fixedBugs contains any linkedBugIds
  let candidateReleases = [];
  if (allProjectReleases) {
    candidateReleases = allProjectReleases.filter((r) => r.project.toString() === projectId);
  } else {
    candidateReleases = await Release.find({ project: projectId }).populate('version').lean();
  }

  const releaseMap = new Map();
  candidateReleases.forEach((rel) => {
    const relIdStr = rel._id.toString();
    const isDirectRel = Array.isArray(rel.changeRequests) && rel.changeRequests.some((c) => (c._id || c).toString() === crIdStr);
    const relVerId = rel.version ? (rel.version._id || rel.version).toString() : null;
    const isVerRel = relVerId && affectedVersionIds.has(relVerId);
    const isBugRel = Array.isArray(rel.fixedBugs) && rel.fixedBugs.some((b) => linkedBugIds.has((b._id || b).toString()));

    if (isDirectRel || isVerRel || isBugRel) {
      let relSource = 'Direct CR link';
      let relType = 'DIRECT';

      if (isDirectRel && isVerRel) {
        relSource = 'Direct CR link & Target Version';
        relType = 'DIRECT';
      } else if (isDirectRel) {
        relSource = 'Direct CR link';
        relType = 'DIRECT';
      } else if (isVerRel && isBugRel) {
        relSource = 'Derived via Version & Fixed Bug';
        relType = 'DERIVED';
      } else if (isVerRel) {
        relSource = 'Derived via Target Version';
        relType = 'DERIVED';
      } else if (isBugRel) {
        relSource = 'Derived via Fixed Bug';
        relType = 'DERIVED';
      }

      // If release also has a UVCS baseline and version didn't, register it
      if (rel.uvcs && rel.uvcs.changesetId !== null && rel.uvcs.changesetId !== undefined) {
        const bKey = `${rel.uvcs.changesetId}-${rel.uvcs.branch || '/main'}`;
        if (!baselineKeys.has(bKey)) {
          baselineKeys.add(bKey);
          baselines.push({
            changesetId: rel.uvcs.changesetId,
            branch: rel.uvcs.branch || '/main',
            repository: rel.uvcs.repository || 'default@local',
            versionNumber: rel.version?.versionNumber || null,
            versionId: relVerId,
            relationship: 'baseline',
            relationshipType: 'DIRECT',
            impact: 'Affected'
          });
        }
      }

      releaseMap.set(relIdStr, {
        ...rel,
        relationship: 'delivered_by',
        relationshipType: relType,
        relationshipSource: relSource,
        impact: 'Affected'
      });
    }
  });

  const affectedReleases = Array.from(releaseMap.values());

  // 5. Dynamic SCM Impact Severity Calculation
  const bugsCount = linkedBugs.length;
  const versionsCount = affectedVersions.length;
  const baselinesCount = baselines.length;
  const releasesCount = affectedReleases.length;

  let impactLevel = 'LOW';
  if (bugsCount === 0 && versionsCount === 0 && releasesCount === 0) {
    impactLevel = 'LOW';
  } else if (
    releasesCount >= 2 ||
    (bugsCount >= 2 && baselinesCount >= 1 && releasesCount >= 1) ||
    (versionsCount >= 2 && releasesCount >= 1)
  ) {
    impactLevel = 'CRITICAL';
  } else if (baselinesCount >= 1 || releasesCount >= 1) {
    impactLevel = 'HIGH';
  } else {
    // Has >=1 bugs or 1 version, but no UVCS baseline and 0 releases
    impactLevel = 'MEDIUM';
  }

  // 6. Natural Language Configuration Impact Explanation
  let explanation = '';
  if (impactLevel === 'LOW') {
    explanation = 'This change request currently has LOW configuration impact because no downstream bugs, versions, baselines, or releases are linked.';
  } else {
    const bugText = `${bugsCount} defect/bug${bugsCount === 1 ? '' : 's'}`;
    const verText = versionsCount > 0 ? `targets version ${affectedVersions.map((v) => v.versionNumber).join(', ')}` : 'targets no version';
    const baseText = baselinesCount > 0 ? 'has an associated UVCS baseline' : 'has no UVCS baseline';
    const relText = releasesCount > 0 ? `is included in ${releasesCount} release${releasesCount === 1 ? '' : 's'}` : 'is not linked to any releases';

    explanation = `${crKey} has a ${impactLevel} configuration impact because it is linked to ${bugText}, ${verText}, ${baseText}, and ${relText}. Impact level is based on the number and type of linked configuration artifacts.`;
  }

  // 7. Ordered Visual Impact Path
  const impactPath = [];
  impactPath.push({
    type: 'ChangeRequest',
    id: cr._id,
    key: crKey,
    name: cr.title,
    status: cr.status,
    priority: cr.priority,
    relationship: 'source',
    relationshipType: 'DIRECT'
  });

  linkedBugs.forEach((b) => {
    impactPath.push({
      type: 'Bug',
      id: b._id,
      key: `BUG-${b._id.toString().slice(-6).toUpperCase()}`,
      name: b.title,
      status: b.status,
      severity: b.severity,
      priority: b.priority,
      relationship: 'direct',
      relationshipType: 'DIRECT'
    });
  });

  affectedVersions.forEach((v) => {
    impactPath.push({
      type: 'Version',
      id: v._id,
      name: `v${v.versionNumber} — ${v.name}`,
      versionNumber: v.versionNumber,
      status: v.status,
      relationship: v.isDirect ? 'target' : 'derived',
      relationshipType: v.isDirect ? 'DIRECT' : 'DERIVED'
    });
  });

  baselines.forEach((b) => {
    impactPath.push({
      type: 'UVCS',
      changesetId: b.changesetId,
      branch: b.branch,
      repository: b.repository,
      relationship: 'baseline',
      relationshipType: 'DIRECT'
    });
  });

  affectedReleases.forEach((r) => {
    impactPath.push({
      type: 'Release',
      id: r._id,
      name: r.releaseName,
      status: r.status,
      releaseDate: r.releaseDate,
      version: r.version?.versionNumber || null,
      relationship: 'delivered_by',
      relationshipType: r.relationshipType,
      relationshipSource: r.relationshipSource
    });
  });

  // 8. Impacted Artifact Table
  const artifactTable = [];

  // CR itself
  artifactTable.push({
    id: cr._id,
    artifact: cr.title,
    code: crKey,
    type: 'Change Request',
    relationship: 'Source',
    relationshipType: 'DIRECT',
    status: cr.status,
    impact: 'Source',
    url: `/projects/${projectId}/change-requests/${cr._id}`
  });

  // Bugs
  linkedBugs.forEach((b) => {
    artifactTable.push({
      id: b._id,
      artifact: b.title,
      code: `BUG-${b._id.toString().slice(-6).toUpperCase()}`,
      type: 'Bug',
      relationship: 'Direct Defect',
      relationshipType: 'DIRECT',
      status: b.status,
      impact: 'Affected',
      url: `/projects/${projectId}/bugs/${b._id}`
    });
  });

  // Versions
  affectedVersions.forEach((v) => {
    artifactTable.push({
      id: v._id,
      artifact: `v${v.versionNumber} — ${v.name}`,
      code: `v${v.versionNumber}`,
      type: 'Version',
      relationship: v.isDirect ? 'Target Version' : 'Derived Version',
      relationshipType: v.isDirect ? 'DIRECT' : 'DERIVED',
      status: v.status,
      impact: 'Affected',
      url: `/projects/${projectId}/versions/${v._id}`
    });
  });

  // UVCS Baselines
  baselines.forEach((b) => {
    artifactTable.push({
      id: `uvcs-${b.changesetId}`,
      artifact: `cs:${b.changesetId} (${b.branch}) [${b.repository}]`,
      code: `cs:${b.changesetId}`,
      type: 'UVCS Baseline',
      relationship: 'Configuration Baseline',
      relationshipType: 'DIRECT',
      status: 'Active',
      impact: 'Affected',
      url: '/uvcs'
    });
  });

  // Releases
  affectedReleases.forEach((r) => {
    artifactTable.push({
      id: r._id,
      artifact: r.releaseName,
      code: r.version?.versionNumber ? `Rel v${r.version.versionNumber}` : 'Release',
      type: 'Release',
      relationship: r.relationshipSource,
      relationshipType: r.relationshipType,
      status: r.status,
      impact: 'Affected',
      url: `/projects/${projectId}/releases/${r._id}`
    });
  });

  return {
    summary: {
      impactLevel,
      impactedChangeRequests: 1,
      impactedBugs: bugsCount,
      impactedVersions: versionsCount,
      impactedBaselines: baselinesCount,
      impactedReleases: releasesCount,
      explanation
    },
    changeRequest: {
      id: cr._id,
      key: crKey,
      title: cr.title,
      description: cr.description,
      reason: cr.reason,
      status: cr.status,
      priority: cr.priority,
      requestedBy: cr.requestedBy,
      reviewedBy: cr.reviewedBy,
      targetVersion: cr.targetVersion,
      createdAt: cr.createdAt,
      project: cr.project
    },
    impacts: {
      bugs: linkedBugs.map((b) => ({
        id: b._id,
        key: `BUG-${b._id.toString().slice(-6).toUpperCase()}`,
        title: b.title,
        status: b.status,
        severity: b.severity,
        priority: b.priority,
        relationship: 'direct',
        relationshipType: 'DIRECT',
        impact: 'Affected'
      })),
      versions: affectedVersions.map((v) => ({
        id: v._id,
        versionNumber: v.versionNumber,
        name: v.name,
        status: v.status,
        relationship: v.isDirect ? 'target' : 'derived',
        relationshipType: v.isDirect ? 'DIRECT' : 'DERIVED',
        impact: 'Affected'
      })),
      baselines: baselines.map((b) => ({
        changesetId: b.changesetId,
        branch: b.branch,
        repository: b.repository,
        versionNumber: b.versionNumber,
        relationship: 'baseline',
        relationshipType: 'DIRECT',
        impact: 'Affected'
      })),
      releases: affectedReleases.map((r) => ({
        id: r._id,
        releaseName: r.releaseName,
        status: r.status,
        releaseDate: r.releaseDate,
        version: r.version?.versionNumber || null,
        relationship: 'delivered_by',
        relationshipType: r.relationshipType,
        relationshipSource: r.relationshipSource,
        impact: 'Affected'
      }))
    },
    impactPath,
    artifactTable
  };
};

/**
 * @desc    Get Change Impact Analysis overview and selectable CRs
 * @route   GET /api/impact-analysis
 * @access  Private (Authenticated users)
 */
const getImpactAnalysis = async (req, res) => {
  try {
    const { project: projectParam, changeRequest: crParam, impactLevel: impactLevelFilter } = req.query;

    let accessibleProjects = [];
    let targetProjectIds = [];

    // RBAC: Admins can view all projects; non-admins only their owned/member projects
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
            message: 'Forbidden: You do not have permission to view impact analysis for this project'
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
          summary: {
            totalChangeRequests: 0,
            lowCount: 0,
            mediumCount: 0,
            highCount: 0,
            criticalCount: 0
          },
          changeRequests: [],
          filters: {
            projects: accessibleProjects.map((p) => ({ id: p._id, name: p.name, key: p.key }))
          },
          selectedImpact: null
        }
      });
    }

    // Fetch all relevant data for target projects
    const [rawCRs, rawVersions, rawBugs, rawReleases] = await Promise.all([
      ChangeRequest.find({ project: { $in: targetProjectIds } })
        .populate('project', 'name key')
        .populate('targetVersion', 'versionNumber name status uvcs')
        .sort({ createdAt: -1 })
        .lean(),
      Version.find({ project: { $in: targetProjectIds } }).lean(),
      Bug.find({ project: { $in: targetProjectIds } }).lean(),
      Release.find({ project: { $in: targetProjectIds } }).populate('version').lean()
    ]);

    // Compute impact summary for each Change Request
    const crSummaries = [];
    let selectedImpact = null;

    for (const cr of rawCRs) {
      const crImpact = await computeSingleCRImpact(cr, rawVersions, rawBugs, rawReleases);
      const isSelected = crParam && (crParam === cr._id.toString() || crParam === crImpact.changeRequest.key);

      const item = {
        id: cr._id,
        key: crImpact.changeRequest.key,
        title: cr.title,
        status: cr.status,
        priority: cr.priority,
        project: cr.project,
        impactLevel: crImpact.summary.impactLevel,
        impactedBugs: crImpact.summary.impactedBugs,
        impactedVersions: crImpact.summary.impactedVersions,
        impactedBaselines: crImpact.summary.impactedBaselines,
        impactedReleases: crImpact.summary.impactedReleases,
        explanation: crImpact.summary.explanation
      };

      if (!impactLevelFilter || crImpact.summary.impactLevel.toLowerCase() === impactLevelFilter.toLowerCase()) {
        crSummaries.push(item);
      }

      if (isSelected) {
        selectedImpact = crImpact;
      }
    }

    // If a specific CR was requested via query param but not found among accessible CRs
    if (crParam && !selectedImpact) {
      if (!mongoose.Types.ObjectId.isValid(crParam)) {
        return res.status(400).json({ success: false, message: 'Invalid change request ID format' });
      }
      const crCheck = await ChangeRequest.findById(crParam).populate('project').lean();
      if (!crCheck) {
        return res.status(404).json({ success: false, message: 'Change request not found' });
      }
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to view impact analysis for this change request'
      });
    }

    // Overall metrics
    const summary = {
      totalChangeRequests: rawCRs.length,
      lowCount: crSummaries.filter((c) => c.impactLevel === 'LOW').length,
      mediumCount: crSummaries.filter((c) => c.impactLevel === 'MEDIUM').length,
      highCount: crSummaries.filter((c) => c.impactLevel === 'HIGH').length,
      criticalCount: crSummaries.filter((c) => c.impactLevel === 'CRITICAL').length
    };

    return res.status(200).json({
      success: true,
      data: {
        summary,
        changeRequests: crSummaries,
        filters: {
          projects: accessibleProjects.map((p) => ({ id: p._id, name: p.name, key: p.key }))
        },
        selectedImpact
      }
    });
  } catch (error) {
    console.error('Error in getImpactAnalysis:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate change impact analysis',
      error: error.message
    });
  }
};

/**
 * @desc    Get detailed Change Impact Analysis for a specific Change Request
 * @route   GET /api/impact-analysis/change-request/:changeRequestId
 * @access  Private (Authenticated users)
 */
const getChangeRequestImpact = async (req, res) => {
  try {
    const { changeRequestId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(changeRequestId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid change request ID format'
      });
    }

    const cr = await ChangeRequest.findById(changeRequestId)
      .populate('project', 'name key owner members')
      .populate('requestedBy', 'name email role')
      .populate('reviewedBy', 'name email role')
      .populate('targetVersion', 'versionNumber name status uvcs')
      .lean();

    if (!cr) {
      return res.status(404).json({
        success: false,
        message: 'Change request not found'
      });
    }

    // RBAC: Check project authorization
    if (req.user.role !== 'admin') {
      const project = cr.project;
      const isOwner = project && project.owner && project.owner.toString() === req.user._id.toString();
      const isMember = project && Array.isArray(project.members) && project.members.some((m) => m.toString() === req.user._id.toString());

      if (!isOwner && !isMember) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You do not have permission to view impact analysis for this change request'
        });
      }
    }

    // Compute detailed impact analysis
    const impactData = await computeSingleCRImpact(cr);

    return res.status(200).json({
      success: true,
      data: impactData
    });
  } catch (error) {
    console.error('Error in getChangeRequestImpact:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve change request impact analysis',
      error: error.message
    });
  }
};

module.exports = {
  getImpactAnalysis,
  getChangeRequestImpact,
  computeSingleCRImpact
};
