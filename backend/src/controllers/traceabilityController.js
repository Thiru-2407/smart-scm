const mongoose = require('mongoose');
const Project = require('../models/Project');
const Version = require('../models/Version');
const Bug = require('../models/Bug');
const ChangeRequest = require('../models/ChangeRequest');
const Release = require('../models/Release');
const auditService = require('../services/auditService');

/**
 * @desc    Get complete SCM Traceability Matrix and summary metrics
 * @route   GET /api/traceability
 * @access  Private (Authenticated users)
 */
const getTraceabilityData = async (req, res) => {
  try {
    const { project: projectParam, status, version, release } = req.query;

    let targetProjectIds = [];
    let accessibleProjects = [];

    // RBAC: Admins can query all projects; non-admins can only query their owned or member projects
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
            message: 'Forbidden: You do not have permission to view traceability for this project'
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
            linkedChangeRequests: 0,
            totalBugs: 0,
            linkedBugs: 0,
            totalVersions: 0,
            linkedVersions: 0,
            totalReleases: 0,
            linkedReleases: 0,
            uvcsLinkedVersions: 0,
            uvcsLinkedReleases: 0,
            coveragePercentage: 0,
            crCoverage: 0,
            bugCoverage: 0,
            versionCoverage: 0,
            releaseCoverage: 0,
            uvcsCoverage: 0
          },
          rows: [],
          filters: {
            projects: accessibleProjects.map((p) => ({ id: p._id, name: p.name, key: p.key })),
            versions: [],
            releases: []
          }
        }
      });
    }

    // Fetch all related SCM artifacts in parallel across targeted projects
    const [rawVersions, rawReleases, rawBugs, rawCRs] = await Promise.all([
      Version.find({ project: { $in: targetProjectIds } }).sort({ versionNumber: 1 }).lean(),
      Release.find({ project: { $in: targetProjectIds } }).populate('version').sort({ createdAt: -1 }).lean(),
      Bug.find({ project: { $in: targetProjectIds } }).sort({ createdAt: -1 }).lean(),
      ChangeRequest.find({ project: { $in: targetProjectIds } }).sort({ createdAt: -1 }).lean()
    ]);

    // Map projects by ID for quick lookup
    const projectMap = new Map();
    accessibleProjects.forEach((p) => projectMap.set(p._id.toString(), p));

    // Maps for entity lookup
    const versionMap = new Map();
    rawVersions.forEach((v) => versionMap.set(v._id.toString(), v));

    const releaseMap = new Map();
    rawReleases.forEach((r) => releaseMap.set(r._id.toString(), r));

    const bugMap = new Map();
    rawBugs.forEach((b) => bugMap.set(b._id.toString(), b));

    const crMap = new Map();
    rawCRs.forEach((c) => crMap.set(c._id.toString(), c));

    // Multi-directional relationship graph mappings
    const crToBugs = new Map(); // crId -> Set<bugId>
    const bugToCR = new Map(); // bugId -> crId
    const bugToVersion = new Map(); // bugId -> versionId
    const bugToReleases = new Map(); // bugId -> Array<release>
    const versionToReleases = new Map(); // versionId -> Array<release>
    const crToVersion = new Map(); // crId -> versionId
    const crToReleases = new Map(); // crId -> Array<release>

    // Populate bug links
    rawBugs.forEach((b) => {
      const bId = b._id.toString();
      if (b.changeRequest) {
        const crId = b.changeRequest.toString();
        bugToCR.set(bId, crId);
        if (!crToBugs.has(crId)) crToBugs.set(crId, new Set());
        crToBugs.get(crId).add(bId);
      }
      if (b.version) {
        bugToVersion.set(bId, b.version.toString());
      }
    });

    // Populate change request links
    rawCRs.forEach((cr) => {
      const crId = cr._id.toString();
      if (cr.targetVersion) {
        crToVersion.set(crId, cr.targetVersion.toString());
      }
      if (Array.isArray(cr.relatedBugs)) {
        cr.relatedBugs.forEach((bRef) => {
          const bId = (bRef._id || bRef).toString();
          if (!crToBugs.has(crId)) crToBugs.set(crId, new Set());
          crToBugs.get(crId).add(bId);
          if (!bugToCR.has(bId)) bugToCR.set(bId, crId);
        });
      }
    });

    // Populate release links
    rawReleases.forEach((rel) => {
      const relVer = rel.version;
      const verId = relVer ? (relVer._id || relVer).toString() : null;

      if (verId) {
        if (!versionToReleases.has(verId)) versionToReleases.set(verId, []);
        versionToReleases.get(verId).push(rel);
      }

      if (Array.isArray(rel.fixedBugs)) {
        rel.fixedBugs.forEach((bRef) => {
          const bId = (bRef._id || bRef).toString();
          if (!bugToReleases.has(bId)) bugToReleases.set(bId, []);
          bugToReleases.get(bId).push(rel);

          // Derived link: if bug doesn't have an explicit version, it inherits release's version
          if (!bugToVersion.has(bId) && verId) {
            bugToVersion.set(bId, verId);
          }
        });
      }

      if (Array.isArray(rel.changeRequests)) {
        rel.changeRequests.forEach((cRef) => {
          const cId = (cRef._id || cRef).toString();
          if (!crToReleases.has(cId)) crToReleases.set(cId, []);
          crToReleases.get(cId).push(rel);
        });
      }
    });

    // Compute linked status for summary metrics
    let linkedCRCount = 0;
    rawCRs.forEach((cr) => {
      const crId = cr._id.toString();
      const hasBugs = crToBugs.has(crId) && crToBugs.get(crId).size > 0;
      const hasVer = crToVersion.has(crId);
      const hasRel = crToReleases.has(crId) && crToReleases.get(crId).length > 0;
      if (hasBugs || hasVer || hasRel) {
        linkedCRCount++;
      }
    });

    let linkedBugCount = 0;
    rawBugs.forEach((b) => {
      const bId = b._id.toString();
      const hasCR = bugToCR.has(bId);
      const hasVer = bugToVersion.has(bId);
      const hasRel = bugToReleases.has(bId) && bugToReleases.get(bId).length > 0;
      if (hasCR || hasVer || hasRel) {
        linkedBugCount++;
      }
    });

    let linkedVersionCount = 0;
    let uvcsLinkedVersions = 0;
    rawVersions.forEach((v) => {
      const vId = v._id.toString();
      const hasUVCS = v.uvcs && v.uvcs.changesetId !== null && v.uvcs.changesetId !== undefined;
      const hasRel = versionToReleases.has(vId) && versionToReleases.get(vId).length > 0;
      if (hasUVCS) uvcsLinkedVersions++;
      if (hasUVCS || hasRel) {
        linkedVersionCount++;
      }
    });

    let linkedReleaseCount = 0;
    let uvcsLinkedReleases = 0;
    rawReleases.forEach((r) => {
      const hasVer = !!r.version;
      const hasBugs = Array.isArray(r.fixedBugs) && r.fixedBugs.length > 0;
      const hasCRs = Array.isArray(r.changeRequests) && r.changeRequests.length > 0;
      const hasUVCS = r.uvcs && r.uvcs.changesetId !== null && r.uvcs.changesetId !== undefined;
      if (hasUVCS) uvcsLinkedReleases++;
      if (hasVer || hasBugs || hasCRs || hasUVCS) {
        linkedReleaseCount++;
      }
    });

    // Assemble comprehensive traceability rows per project
    const allRows = [];
    let rowSequence = 1;

    for (const projId of targetProjectIds) {
      const projIdStr = projId.toString();
      const project = projectMap.get(projIdStr);
      if (!project) continue;

      const projCRs = rawCRs.filter((c) => c.project.toString() === projIdStr);
      const projBugs = rawBugs.filter((b) => b.project.toString() === projIdStr);
      const projVersions = rawVersions.filter((v) => v.project.toString() === projIdStr);
      const projReleases = rawReleases.filter((r) => r.project.toString() === projIdStr);

      const visitedCRIds = new Set();
      const visitedBugIds = new Set();
      const visitedVersionIds = new Set();
      const visitedReleaseIds = new Set();

      // Helper function to build a structured row
      const createRow = (cr, bug, ver, rel, relationType) => {
        // Resolve UVCS baseline info safely from version or release
        let uvcsData = null;
        if (ver && ver.uvcs && ver.uvcs.changesetId !== null && ver.uvcs.changesetId !== undefined) {
          uvcsData = {
            changesetId: ver.uvcs.changesetId,
            branch: ver.uvcs.branch || '/main',
            repository: ver.uvcs.repository || 'default@local'
          };
        } else if (rel && rel.uvcs && rel.uvcs.changesetId !== null && rel.uvcs.changesetId !== undefined) {
          uvcsData = {
            changesetId: rel.uvcs.changesetId,
            branch: rel.uvcs.branch || '/main',
            repository: rel.uvcs.repository || 'default@local'
          };
        }

        // Determine overall lifecycle status of this chain
        let lifecycleStage = 'Unlinked';
        if (rel && rel.status === 'published') {
          lifecycleStage = 'Released to Production';
        } else if (rel) {
          lifecycleStage = `Release ${rel.status.replace(/_/g, ' ')}`;
        } else if (ver && ver.status === 'released') {
          lifecycleStage = 'Version Released';
        } else if (ver) {
          lifecycleStage = `Version in ${ver.status}`;
        } else if (bug && (bug.status === 'resolved' || bug.status === 'closed')) {
          lifecycleStage = 'Defect Resolved';
        } else if (bug) {
          lifecycleStage = `Defect ${bug.status.replace(/_/g, ' ')}`;
        } else if (cr && (cr.status === 'approved' || cr.status === 'implemented')) {
          lifecycleStage = `Change ${cr.status}`;
        } else if (cr) {
          lifecycleStage = `Change ${cr.status.replace(/_/g, ' ')}`;
        }

        return {
          id: `row-${projIdStr}-${rowSequence++}`,
          project: {
            id: project._id,
            name: project.name,
            key: project.key
          },
          changeRequest: cr
            ? {
                id: cr._id,
                key: `CR-${cr._id.toString().slice(-6).toUpperCase()}`,
                title: cr.title,
                status: cr.status,
                priority: cr.priority
              }
            : null,
          bug: bug
            ? {
                id: bug._id,
                key: `BUG-${bug._id.toString().slice(-6).toUpperCase()}`,
                title: bug.title,
                status: bug.status,
                severity: bug.severity,
                priority: bug.priority
              }
            : null,
          version: ver
            ? {
                id: ver._id,
                versionNumber: ver.versionNumber,
                name: ver.name,
                status: ver.status
              }
            : null,
          uvcs: uvcsData,
          release: rel
            ? {
                id: rel._id,
                releaseName: rel.releaseName,
                status: rel.status,
                releaseDate: rel.releaseDate
              }
            : null,
          lifecycleStage,
          relationshipType: relationType
        };
      };

      // 1. Process Change Requests and their downstream connections
      for (const cr of projCRs) {
        const crId = cr._id.toString();
        const linkedBugIds = Array.from(crToBugs.get(crId) || []);

        if (linkedBugIds.length > 0) {
          for (const bId of linkedBugIds) {
            const bug = bugMap.get(bId);
            if (!bug) continue;
            visitedBugIds.add(bId);
            visitedCRIds.add(crId);

            const verId = bugToVersion.get(bId) || crToVersion.get(crId);
            const ver = verId ? versionMap.get(verId) : null;
            if (ver) visitedVersionIds.add(ver._id.toString());

            const rels = bugToReleases.get(bId) || (ver ? versionToReleases.get(ver._id.toString()) : []) || [];
            if (rels.length > 0) {
              for (const rel of rels) {
                visitedReleaseIds.add(rel._id.toString());
                allRows.push(createRow(cr, bug, ver, rel, 'direct'));
              }
            } else {
              allRows.push(createRow(cr, bug, ver, null, 'partial'));
            }
          }
        } else {
          // CR without linked bugs: check if it targets a version or release
          const verId = crToVersion.get(crId);
          const ver = verId ? versionMap.get(verId) : null;
          if (ver) visitedVersionIds.add(ver._id.toString());

          const rels = ver
            ? versionToReleases.get(ver._id.toString()) || []
            : crToReleases.get(crId) || [];

          visitedCRIds.add(crId);
          if (rels.length > 0) {
            for (const rel of rels) {
              visitedReleaseIds.add(rel._id.toString());
              allRows.push(createRow(cr, null, ver, rel, 'partial'));
            }
          } else {
            allRows.push(createRow(cr, null, ver, null, ver ? 'partial' : 'unlinked'));
          }
        }
      }

      // 2. Process Bugs not yet linked to CRs
      for (const bug of projBugs) {
        const bId = bug._id.toString();
        if (visitedBugIds.has(bId)) continue;
        visitedBugIds.add(bId);

        const verId = bugToVersion.get(bId);
        const ver = verId ? versionMap.get(verId) : null;
        if (ver) visitedVersionIds.add(ver._id.toString());

        const rels = bugToReleases.get(bId) || (ver ? versionToReleases.get(ver._id.toString()) : []) || [];
        if (rels.length > 0) {
          for (const rel of rels) {
            visitedReleaseIds.add(rel._id.toString());
            allRows.push(createRow(null, bug, ver, rel, 'derived'));
          }
        } else {
          allRows.push(createRow(null, bug, ver, null, ver ? 'derived' : 'unlinked'));
        }
      }

      // 3. Process Releases not yet visited
      for (const rel of projReleases) {
        const relId = rel._id.toString();
        if (visitedReleaseIds.has(relId)) continue;
        visitedReleaseIds.add(relId);

        const ver = rel.version
          ? rel.version._id
            ? rel.version
            : versionMap.get(rel.version.toString())
          : null;
        if (ver) visitedVersionIds.add(ver._id.toString());

        allRows.push(createRow(null, null, ver, rel, ver ? 'derived' : 'unlinked'));
      }

      // 4. Process Versions not yet visited
      for (const ver of projVersions) {
        const verId = ver._id.toString();
        if (visitedVersionIds.has(verId)) continue;
        visitedVersionIds.add(verId);

        allRows.push(createRow(null, null, ver, null, ver.uvcs?.changesetId !== null ? 'partial' : 'unlinked'));
      }
    }

    // Apply optional filter parameters to rows
    let filteredRows = [...allRows];

    if (status) {
      const s = status.toLowerCase().trim();
      filteredRows = filteredRows.filter((r) => {
        const crMatch = r.changeRequest && r.changeRequest.status.toLowerCase() === s;
        const bugMatch = r.bug && r.bug.status.toLowerCase() === s;
        const verMatch = r.version && r.version.status.toLowerCase() === s;
        const relMatch = r.release && r.release.status.toLowerCase() === s;
        const stageMatch = r.lifecycleStage.toLowerCase().includes(s);
        return crMatch || bugMatch || verMatch || relMatch || stageMatch;
      });
    }

    if (version) {
      const v = version.toString().toLowerCase().trim();
      filteredRows = filteredRows.filter((r) => {
        if (!r.version) return false;
        return (
          r.version.id.toString().toLowerCase() === v ||
          r.version.versionNumber.toLowerCase() === v ||
          r.version.versionNumber.toLowerCase() === `v${v}`
        );
      });
    }

    if (release) {
      const relParam = release.toString().toLowerCase().trim();
      filteredRows = filteredRows.filter((r) => {
        if (!r.release) return false;
        return (
          r.release.id.toString().toLowerCase() === relParam ||
          r.release.releaseName.toLowerCase().includes(relParam)
        );
      });
    }

    // Total counts & coverage percentages
    const totalChangeRequests = rawCRs.length;
    const totalBugs = rawBugs.length;
    const totalVersions = rawVersions.length;
    const totalReleases = rawReleases.length;

    const totalTracked = totalChangeRequests + totalBugs + totalVersions + totalReleases;
    const totalLinked = linkedCRCount + linkedBugCount + linkedVersionCount + linkedReleaseCount;
    const coveragePercentage = totalTracked > 0 ? Math.round((totalLinked / totalTracked) * 100) : 0;

    const crCoverage = totalChangeRequests > 0 ? Math.round((linkedCRCount / totalChangeRequests) * 100) : 0;
    const bugCoverage = totalBugs > 0 ? Math.round((linkedBugCount / totalBugs) * 100) : 0;
    const versionCoverage = totalVersions > 0 ? Math.round((linkedVersionCount / totalVersions) * 100) : 0;
    const releaseCoverage = totalReleases > 0 ? Math.round((linkedReleaseCount / totalReleases) * 100) : 0;
    const uvcsCoverage = totalVersions > 0 ? Math.round((uvcsLinkedVersions / totalVersions) * 100) : 0;

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalChangeRequests,
          linkedChangeRequests: linkedCRCount,
          totalBugs,
          linkedBugs: linkedBugCount,
          totalVersions,
          linkedVersions: linkedVersionCount,
          totalReleases,
          linkedReleases: linkedReleaseCount,
          uvcsLinkedVersions,
          uvcsLinkedReleases,
          coveragePercentage,
          crCoverage,
          bugCoverage,
          versionCoverage,
          releaseCoverage,
          uvcsCoverage
        },
        rows: filteredRows,
        filters: {
          projects: accessibleProjects.map((p) => ({ id: p._id, name: p.name, key: p.key })),
          versions: rawVersions.map((v) => ({
            id: v._id,
            versionNumber: v.versionNumber,
            name: v.name,
            project: v.project
          })),
          releases: rawReleases.map((r) => ({
            id: r._id,
            releaseName: r.releaseName,
            project: r.project
          }))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching traceability data:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve traceability matrix data',
      error: error.message
    });
  }
};

/**
 * @desc    Establish an explicit traceability link between SCM entities
 * @route   POST /api/traceability/link
 * @access  Private (Owner, Admin, or Project Member)
 */
const createTraceabilityLink = async (req, res) => {
  try {
    const { projectId, changeRequestId, bugId, versionId, releaseId } = req.body;

    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ success: false, message: 'Valid projectId is required' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    // RBAC: Must be owner, admin, or project member
    const isOwner = project.owner.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    const isMember = Array.isArray(project.members) && project.members.some((m) => m.toString() === req.user._id.toString());

    if (!isOwner && !isAdmin && !isMember) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to link artifacts in this project'
      });
    }

    let linkedItems = [];

    // 1. Link Change Request & Bug
    if (changeRequestId && bugId) {
      if (!mongoose.Types.ObjectId.isValid(changeRequestId) || !mongoose.Types.ObjectId.isValid(bugId)) {
        return res.status(400).json({ success: false, message: 'Invalid changeRequestId or bugId' });
      }

      const [cr, bug] = await Promise.all([
        ChangeRequest.findOne({ _id: changeRequestId, project: projectId }),
        Bug.findOne({ _id: bugId, project: projectId })
      ]);

      if (!cr) return res.status(404).json({ success: false, message: 'Change Request not found in project' });
      if (!bug) return res.status(404).json({ success: false, message: 'Bug not found in project' });

      bug.changeRequest = cr._id;
      await bug.save();

      if (!Array.isArray(cr.relatedBugs)) cr.relatedBugs = [];
      if (!cr.relatedBugs.some((id) => id.toString() === bug._id.toString())) {
        cr.relatedBugs.push(bug._id);
        await cr.save();
      }
      linkedItems.push(`CR (${cr.title}) -> Bug (${bug.title})`);
    }

    // 2. Link Bug & Version
    if (bugId && versionId) {
      if (!mongoose.Types.ObjectId.isValid(bugId) || !mongoose.Types.ObjectId.isValid(versionId)) {
        return res.status(400).json({ success: false, message: 'Invalid bugId or versionId' });
      }

      const [bug, ver] = await Promise.all([
        Bug.findOne({ _id: bugId, project: projectId }),
        Version.findOne({ _id: versionId, project: projectId })
      ]);

      if (!bug) return res.status(404).json({ success: false, message: 'Bug not found in project' });
      if (!ver) return res.status(404).json({ success: false, message: 'Version not found in project' });

      bug.version = ver._id;
      await bug.save();
      linkedItems.push(`Bug (${bug.title}) -> Version (${ver.versionNumber})`);
    }

    // 3. Link Change Request & Version
    if (changeRequestId && versionId) {
      if (!mongoose.Types.ObjectId.isValid(changeRequestId) || !mongoose.Types.ObjectId.isValid(versionId)) {
        return res.status(400).json({ success: false, message: 'Invalid changeRequestId or versionId' });
      }

      const [cr, ver] = await Promise.all([
        ChangeRequest.findOne({ _id: changeRequestId, project: projectId }),
        Version.findOne({ _id: versionId, project: projectId })
      ]);

      if (!cr) return res.status(404).json({ success: false, message: 'Change Request not found in project' });
      if (!ver) return res.status(404).json({ success: false, message: 'Version not found in project' });

      cr.targetVersion = ver._id;
      await cr.save();
      linkedItems.push(`CR (${cr.title}) -> Version (${ver.versionNumber})`);
    }

    // 4. Link Release & Change Request
    if (releaseId && changeRequestId) {
      if (!mongoose.Types.ObjectId.isValid(releaseId) || !mongoose.Types.ObjectId.isValid(changeRequestId)) {
        return res.status(400).json({ success: false, message: 'Invalid releaseId or changeRequestId' });
      }

      const [rel, cr] = await Promise.all([
        Release.findOne({ _id: releaseId, project: projectId }),
        ChangeRequest.findOne({ _id: changeRequestId, project: projectId })
      ]);

      if (!rel) return res.status(404).json({ success: false, message: 'Release not found in project' });
      if (!cr) return res.status(404).json({ success: false, message: 'Change Request not found in project' });

      if (!Array.isArray(rel.changeRequests)) rel.changeRequests = [];
      if (!rel.changeRequests.some((id) => id.toString() === cr._id.toString())) {
        rel.changeRequests.push(cr._id);
        await rel.save();
      }
      linkedItems.push(`Release (${rel.releaseName}) -> CR (${cr.title})`);
    }

    // 5. Link Release & Bug
    if (releaseId && bugId) {
      if (!mongoose.Types.ObjectId.isValid(releaseId) || !mongoose.Types.ObjectId.isValid(bugId)) {
        return res.status(400).json({ success: false, message: 'Invalid releaseId or bugId' });
      }

      const [rel, bug] = await Promise.all([
        Release.findOne({ _id: releaseId, project: projectId }),
        Bug.findOne({ _id: bugId, project: projectId })
      ]);

      if (!rel) return res.status(404).json({ success: false, message: 'Release not found in project' });
      if (!bug) return res.status(404).json({ success: false, message: 'Bug not found in project' });

      if (!Array.isArray(rel.fixedBugs)) rel.fixedBugs = [];
      if (!rel.fixedBugs.some((id) => id.toString() === bug._id.toString())) {
        rel.fixedBugs.push(bug._id);
        await rel.save();
      }
      linkedItems.push(`Release (${rel.releaseName}) -> Bug (${bug.title})`);
    }

    if (linkedItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid pair of entities provided to establish a traceability link'
      });
    }

    // Record audit activity per Step 17 requirement
    await auditService.logActivity({
      project: projectId,
      actor: req.user._id,
      action: 'TRACEABILITY_LINK_CREATED',
      entityType: 'Traceability',
      entityId: changeRequestId || bugId || versionId || releaseId,
      description: `Established traceability relationship: ${linkedItems.join(', ')}`,
      metadata: { projectId, changeRequestId, bugId, versionId, releaseId, links: linkedItems }
    });

    return res.status(200).json({
      success: true,
      message: 'Traceability link created successfully',
      links: linkedItems
    });
  } catch (error) {
    console.error('Error creating traceability link:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create traceability link',
      error: error.message
    });
  }
};

module.exports = {
  getTraceabilityData,
  createTraceabilityLink
};
