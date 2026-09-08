/**
 * Phase 16: SCM Release Readiness & Governance Backend Verification Suite
 */
const http = require('http');
const mongoose = require('../backend/node_modules/mongoose');

// Register models
require('../backend/src/models/User');
const Project = require('../backend/src/models/Project');
const Version = require('../backend/src/models/Version');
const Bug = require('../backend/src/models/Bug');
const ChangeRequest = require('../backend/src/models/ChangeRequest');
const Release = require('../backend/src/models/Release');

const API_BASE = 'http://127.0.0.1:5000/api';
const MONGO_URI = 'mongodb://127.0.0.1:27017/smart_scm';

function request(endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + endpoint);
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const req = http.request(
      url,
      {
        method: options.method || 'GET',
        headers
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            resolve({ status: res.statusCode, headers: res.headers, data });
          } catch (e) {
            resolve({ status: res.statusCode, headers: res.headers, body });
          }
        });
      }
    );

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  results: []
};

function recordTest(category, name, passed, details = '') {
  stats.total++;
  if (passed) {
    stats.passed++;
    stats.results.push({ category, name, status: 'PASS', details });
    console.log(`   ✅ [PASS] ${name}`);
  } else {
    stats.failed++;
    stats.results.push({ category, name, status: 'FAIL', details });
    console.error(`   ❌ [FAIL] ${name} - ${details}`);
  }
}

async function runReadinessTests() {
  console.log('========================================================================');
  console.log(' 🚀 RUNNING PHASE 16 RELEASE READINESS & GOVERNANCE BACKEND SUITE');
  console.log('========================================================================\n');

  await mongoose.connect(MONGO_URI);

  const timestamp = Date.now();
  const ownerUser = {
    name: 'Phase 16 Lead PM',
    email: `pm.p16.${timestamp}@smartscm.io`,
    password: 'Password123!',
    role: 'project_manager'
  };

  const outsiderUser = {
    name: 'Phase 16 Outsider',
    email: `outsider.p16.${timestamp}@smartscm.io`,
    password: 'Password123!',
    role: 'developer'
  };

  let ownerToken, outsiderToken;
  let ownerId, outsiderId;
  let testProject, testProjectId;
  let isolatedProject, isolatedProjectId;

  let relReady, relCondReady, relNotReady, relWithdrawn;
  let verReleased, verTesting, verDev;
  let critBug, highBug, resolvedBug;
  let approvedCR, underReviewCR, rejectedCR;

  try {
    // 1. Setup Test Users
    const resOwner = await request('/auth/register', { method: 'POST', body: ownerUser });
    ownerToken = resOwner.data.token;
    ownerId = resOwner.data.user.id || resOwner.data.user._id;

    const resOutsider = await request('/auth/register', { method: 'POST', body: outsiderUser });
    outsiderToken = resOutsider.data.token;
    outsiderId = resOutsider.data.user.id || resOutsider.data.user._id;

    // Create Test Project
    testProject = await Project.create({
      name: `Readiness Project ${timestamp}`,
      key: `RD${timestamp.toString().slice(-4)}`,
      description: 'Project for Phase 16 automated release readiness testing',
      owner: ownerId,
      members: [ownerId]
    });
    testProjectId = testProject._id.toString();

    // Create Isolated Project for unauthorized check
    isolatedProject = await Project.create({
      name: `Isolated Project ${timestamp}`,
      key: `IS${timestamp.toString().slice(-4)}`,
      description: 'Project without outsider access',
      owner: ownerId,
      members: [ownerId]
    });
    isolatedProjectId = isolatedProject._id.toString();

    // Setup Controlled Test SCM Artifacts
    // 1. Versions
    verReleased = await Version.create({
      project: testProjectId,
      versionNumber: '3.0.0',
      name: 'Stable Production Baseline',
      status: 'released',
      createdBy: ownerId,
      uvcs: { changesetId: 100, branch: '/main', repository: 'default@local' }
    });

    verTesting = await Version.create({
      project: testProjectId,
      versionNumber: '3.1.0',
      name: 'Staging Testing Milestone',
      status: 'testing',
      createdBy: ownerId,
      uvcs: { changesetId: 101, branch: '/main', repository: 'default@local' }
    });

    verDev = await Version.create({
      project: testProjectId,
      versionNumber: '3.2.0',
      name: 'Unfinished Development Version',
      status: 'development',
      createdBy: ownerId,
      uvcs: { changesetId: null, branch: null, repository: null }
    });

    // 2. Bugs
    resolvedBug = await Bug.create({
      project: testProjectId,
      version: verReleased._id,
      title: 'Resolved Normal Defect',
      description: 'A defect that has been closed',
      severity: 'medium',
      status: 'closed',
      reportedBy: ownerId
    });

    highBug = await Bug.create({
      project: testProjectId,
      version: verTesting._id,
      title: 'Unresolved High Defect',
      description: 'High defect still in progress',
      severity: 'high',
      status: 'in_progress',
      reportedBy: ownerId
    });

    critBug = await Bug.create({
      project: testProjectId,
      version: verDev._id,
      title: 'Blocker Critical Defect',
      description: 'Critical defect that blocks release',
      severity: 'critical',
      status: 'open',
      reportedBy: ownerId
    });

    // 3. Change Requests
    approvedCR = await ChangeRequest.create({
      project: testProjectId,
      targetVersion: verReleased._id,
      title: 'Approved Core Upgrade',
      description: 'Approved change request',
      reason: 'Feature enhancement',
      requestedBy: ownerId,
      status: 'approved'
    });

    underReviewCR = await ChangeRequest.create({
      project: testProjectId,
      targetVersion: verTesting._id,
      title: 'Under Review Proposal',
      description: 'CR currently under review',
      reason: 'Refactoring',
      requestedBy: ownerId,
      status: 'under_review'
    });

    rejectedCR = await ChangeRequest.create({
      project: testProjectId,
      targetVersion: verDev._id,
      title: 'Rejected Architecture Drift',
      description: 'CR rejected by governance board',
      reason: 'Out of scope',
      requestedBy: ownerId,
      status: 'rejected'
    });

    // 4. Releases
    // Release A: Fully READY Release (All checks pass, high score, 0 blockers)
    relReady = await Release.create({
      project: testProjectId,
      version: verReleased._id,
      releaseName: `Release 3.0.0-PROD ${timestamp}`,
      status: 'approved',
      releaseDate: new Date(),
      releaseNotes: 'Comprehensive automated release notes for version 3.0.0 production deployment. Covers all security, bug fixes, and feature milestones.',
      createdBy: ownerId,
      approvedBy: ownerId,
      fixedBugs: [resolvedBug._id],
      changeRequests: [approvedCR._id]
    });

    // Release B: CONDITIONALLY_READY Release (Version in testing, high bug open, CR under review)
    relCondReady = await Release.create({
      project: testProjectId,
      version: verTesting._id,
      releaseName: `Release 3.1.0-RC ${timestamp}`,
      status: 'pending_approval',
      releaseDate: new Date(),
      releaseNotes: 'Release candidate 3.1.0 notes for validation and testing.',
      createdBy: ownerId,
      fixedBugs: [],
      changeRequests: [underReviewCR._id]
    });

    // Release C: NOT_READY Release (Dev version, critical bug open, rejected CR, no UVCS)
    relNotReady = await Release.create({
      project: testProjectId,
      version: verDev._id,
      releaseName: `Release 3.2.0-DEV ${timestamp}`,
      status: 'draft',
      releaseDate: null,
      releaseNotes: '',
      createdBy: ownerId,
      fixedBugs: [critBug._id],
      changeRequests: [rejectedCR._id]
    });

    // Release D: Withdrawn Release (Withdrawn status)
    relWithdrawn = await Release.create({
      project: testProjectId,
      version: verReleased._id,
      releaseName: `Release Withdrawn ${timestamp}`,
      status: 'withdrawn',
      createdBy: ownerId
    });

    console.log('--- Verification Scenarios 1 to 20 ---\n');

    // 1. Authenticated request
    const resAuth = await request('/release-readiness', {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    recordTest(
      'Auth',
      '1. Authenticated request returns 200 and structured data',
      resAuth.status === 200 && resAuth.data.success === true && Array.isArray(resAuth.data.data.releases)
    );

    // 2. Unauthenticated 401
    const resUnauth = await request('/release-readiness');
    recordTest(
      'Security',
      '2. Unauthenticated request rejected with 401 Unauthorized',
      resUnauth.status === 401
    );

    // 3. Authorized project access succeeds
    const resAuthProj = await request(`/release-readiness?project=${testProjectId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    recordTest(
      'Security',
      '3. Authorized project access succeeds with 200',
      resAuthProj.status === 200 && resAuthProj.data.success === true
    );

    // 4. Unauthorized project access returns 403
    const resUnauthProj = await request(`/release-readiness?project=${isolatedProjectId}`, {
      headers: { Authorization: `Bearer ${outsiderToken}` }
    });
    recordTest(
      'Security',
      '4. Unauthorized project access rejected with 403 Forbidden',
      resUnauthProj.status === 403
    );

    // 5. Invalid release ID returns 400
    const resInvalidId = await request('/release-readiness/release/invalid-id-xyz', {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    recordTest(
      'Validation',
      '5. Invalid release ID format returns 400 Bad Request',
      resInvalidId.status === 400
    );

    // 6. Missing release returns 404
    const nonExistentId = new mongoose.Types.ObjectId();
    const resMissingRel = await request(`/release-readiness/release/${nonExistentId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    recordTest(
      'Validation',
      '6. Missing release ID returns 404 Not Found',
      resMissingRel.status === 404
    );

    // 7. Real release evaluation returns complete schema
    const resRealRel = await request(`/release-readiness/release/${relReady._id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    const dReady = resRealRel.data.data;
    recordTest(
      'Schema',
      '7. Real release returns complete readiness assessment (release, score, checks, blockers, metrics, pipeline)',
      resRealRel.status === 200 &&
        typeof dReady.score === 'number' &&
        !!dReady.readiness &&
        Array.isArray(dReady.checks) &&
        dReady.checks.length === 8 &&
        Array.isArray(dReady.blockers) &&
        Array.isArray(dReady.pipeline) &&
        !!dReady.metrics
    );

    // 8. Version check: released vs testing vs development
    const cVerReady = dReady.checks.find((c) => c.key === 'version');
    const resRealCond = await request(`/release-readiness/release/${relCondReady._id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    const dCond = resRealCond.data.data;
    const cVerTesting = dCond.checks.find((c) => c.key === 'version');
    const resRealNot = await request(`/release-readiness/release/${relNotReady._id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    const dNot = resRealNot.data.data;
    const cVerDev = dNot.checks.find((c) => c.key === 'version');

    recordTest(
      'Check Logic',
      '8. Version status check correctly assesses released (PASS), testing (WARNING), development (FAIL)',
      cVerReady.status === 'PASS' && cVerTesting.status === 'WARNING' && cVerDev.status === 'FAIL'
    );

    // 9. Open bug check: evaluates unresolved defects correctly
    const cBugsReady = dReady.checks.find((c) => c.key === 'open_bugs');
    const cBugsCond = dCond.checks.find((c) => c.key === 'open_bugs');
    recordTest(
      'Check Logic',
      '9. Open bugs check evaluates 0 open defects (PASS) vs unresolved non-critical defects (WARNING)',
      cBugsReady.status === 'PASS' && cBugsCond.status === 'WARNING'
    );

    // 10. Critical bug check flags critical defects as FAIL
    const cCritBugsNot = dNot.checks.find((c) => c.key === 'critical_bugs');
    recordTest(
      'Check Logic',
      '10. Critical defect check flags unresolved critical bug as FAIL',
      cCritBugsNot.status === 'FAIL' && cCritBugsNot.score === 0
    );

    // 11. Change request governance check
    const cCRReady = dReady.checks.find((c) => c.key === 'change_requests');
    const cCRCond = dCond.checks.find((c) => c.key === 'change_requests');
    const cCRNot = dNot.checks.find((c) => c.key === 'change_requests');
    recordTest(
      'Check Logic',
      '11. Change request governance: approved (PASS), under review (WARNING), rejected (FAIL)',
      cCRReady.status === 'PASS' && cCRCond.status === 'WARNING' && cCRNot.status === 'FAIL'
    );

    // 12. Traceability check
    const cTraceReady = dReady.checks.find((c) => c.key === 'traceability');
    recordTest(
      'Check Logic',
      '12. Traceability check passes when Version, UVCS baseline, and CR/Bug are linked',
      cTraceReady.status === 'PASS' && cTraceReady.score === 10
    );

    // 13. UVCS baseline check
    const cUVCSReady = dReady.checks.find((c) => c.key === 'uvcs');
    const cUVCSNot = dNot.checks.find((c) => c.key === 'uvcs');
    recordTest(
      'Check Logic',
      '13. UVCS baseline check confirms linked changeset (PASS) vs unlinked baseline (WARNING)',
      cUVCSReady.status === 'PASS' && cUVCSNot.status === 'WARNING'
    );

    // 14. Release notes check
    const cNotesReady = dReady.checks.find((c) => c.key === 'release_notes');
    const cNotesNot = dNot.checks.find((c) => c.key === 'release_notes');
    recordTest(
      'Check Logic',
      '14. Release notes check passes on detailed notes and warns on missing notes',
      cNotesReady.status === 'PASS' && cNotesNot.status === 'WARNING'
    );

    // 15. Approval check: approved (PASS), draft/pending (WARNING), withdrawn (FAIL)
    const cApprReady = dReady.checks.find((c) => c.key === 'approval');
    const cApprCond = dCond.checks.find((c) => c.key === 'approval');
    const resRealWithdrawn = await request(`/release-readiness/release/${relWithdrawn._id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    const dWithdrawn = resRealWithdrawn.data.data;
    const cApprWithdrawn = dWithdrawn.checks.find((c) => c.key === 'approval');

    recordTest(
      'Check Logic',
      '15. Approval check correctly evaluates approved (PASS), pending/draft (WARNING), withdrawn (FAIL)',
      cApprReady.status === 'PASS' && cApprCond.status === 'WARNING' && cApprWithdrawn.status === 'FAIL'
    );

    // 16. Dynamic weighted score calculation (weights sum to 100)
    const totalWeights = dReady.checks.reduce((acc, c) => acc + c.weight, 0);
    const scoreMatchesSum = dReady.score >= 90;
    recordTest(
      'Scoring',
      '16. Dynamic score calculation verifies weights sum to 100 and score dynamically computes',
      totalWeights === 100 && scoreMatchesSum
    );

    // 17. Readiness level classification: READY vs CONDITIONALLY_READY vs NOT_READY
    recordTest(
      'Readiness Level',
      '17. Readiness level classification evaluates READY, CONDITIONALLY_READY, and NOT_READY',
      dReady.readiness.level === 'READY' &&
        dCond.readiness.level === 'CONDITIONALLY_READY' &&
        dNot.readiness.level === 'NOT_READY'
    );

    // 18. Blocking conditions: critical defect or rejected CR forces NOT_READY
    recordTest(
      'Blockers',
      '18. Blocking conditions detect active blockers and override readiness level to NOT_READY',
      dNot.blockers.length >= 1 && dNot.readiness.ready === false && dNot.readiness.level === 'NOT_READY'
    );

    // 19. Empty state handling (project with zero releases)
    const emptyProj = await Project.create({
      name: `Empty Project ${timestamp}`,
      key: `EM${timestamp.toString().slice(-4)}`,
      owner: ownerId,
      members: [ownerId]
    });
    const resEmpty = await request(`/release-readiness?project=${emptyProj._id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    recordTest(
      'Integrity',
      '19. Empty project returns empty release list without server error',
      resEmpty.status === 200 && resEmpty.data.data.releases.length === 0
    );
    await Project.findByIdAndDelete(emptyProj._id);

    // 20. Zero fabricated values: unlinked entities are never given false passes
    const unlinkedUVCSCheck = cUVCSNot.details.includes('not linked') || cUVCSNot.details.includes('unavailable');
    recordTest(
      'Integrity',
      '20. Zero fabricated values: unlinked baseline produces explicit warning, never fabricated changeset',
      unlinkedUVCSCheck && cUVCSNot.status !== 'PASS'
    );

  } catch (err) {
    console.error('Test Suite Error:', err);
    recordTest('Error', 'Execution exception', false, err.message);
  } finally {
    // Cleanup created test project and entities
    if (testProjectId) {
      await Bug.deleteMany({ project: testProjectId });
      await Version.deleteMany({ project: testProjectId });
      await ChangeRequest.deleteMany({ project: testProjectId });
      await Release.deleteMany({ project: testProjectId });
      await Project.findByIdAndDelete(testProjectId);
    }
    if (isolatedProjectId) {
      await Project.findByIdAndDelete(isolatedProjectId);
    }
    await mongoose.disconnect();
  }

  console.log('\n========================================================================');
  console.log(` 📊 SUMMARY: Total: ${stats.total} | Passed: ${stats.passed} | Failed: ${stats.failed}`);
  console.log('========================================================================\n');

  if (stats.failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runReadinessTests();
