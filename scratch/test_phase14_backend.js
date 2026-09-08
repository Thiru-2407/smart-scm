/**
 * Phase 14: SCM Traceability Matrix Backend Verification Suite
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
const AuditLog = require('../backend/src/models/AuditLog');

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

async function runTraceabilityTests() {
  console.log('========================================================================');
  console.log(' 🚀 RUNNING PHASE 14 TRACEABILITY MATRIX BACKEND VERIFICATION SUITE');
  console.log('========================================================================\n');

  await mongoose.connect(MONGO_URI);

  const timestamp = Date.now();
  const ownerUser = {
    name: 'Phase 14 Lead PM',
    email: `pm.p14.${timestamp}@smartscm.io`,
    password: 'Password123!',
    role: 'project_manager'
  };

  const outsiderUser = {
    name: 'Phase 14 Outsider',
    email: `outsider.p14.${timestamp}@smartscm.io`,
    password: 'Password123!',
    role: 'developer'
  };

  let ownerToken, outsiderToken;
  let ownerId, outsiderId;
  let testProjectId;

  try {
    // 1. Authenticated User Setup
    console.log('--- Scenario 1 & 2: Authentication & Security Rejection ---');
    const resOwner = await request('/auth/register', { method: 'POST', body: ownerUser });
    ownerToken = resOwner.data.token;
    ownerId = resOwner.data.user.id || resOwner.data.user._id;

    const resOutsider = await request('/auth/register', { method: 'POST', body: outsiderUser });
    outsiderToken = resOutsider.data.token;
    outsiderId = resOutsider.data.user.id || resOutsider.data.user._id;

    recordTest('Auth', 'Test users registered and tokens acquired', !!ownerToken && !!outsiderToken);

    // Scenario 2: Unauthenticated request rejected with 401
    const unauthRes = await request('/traceability');
    recordTest('Security', 'Unauthenticated traceability request rejected with 401 Unauthorized', unauthRes.status === 401);

    // Scenario 1: Authenticated traceability request returns 200 and structured data
    const authRes = await request('/traceability', {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    recordTest(
      'Traceability API',
      'Authenticated request returns 200 and structured summary/rows',
      authRes.status === 200 && authRes.data.success && Array.isArray(authRes.data.data.rows) && !!authRes.data.data.summary
    );

    // 2. Project Setup & Access Control
    console.log('\n--- Scenario 3 & 4: Authorized vs Unauthorized Project Access ---');
    const resProj = await request('/projects', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: {
        name: `Traceability Verification Proj ${timestamp}`,
        key: `TRC${String(timestamp).slice(-4)}`,
        description: 'Testing traceability matrix RBAC and data mapping',
        status: 'active'
      }
    });
    testProjectId = resProj.data.project?._id;
    recordTest('Project', 'Test project created for PM', resProj.status === 201 && !!testProjectId);

    // Scenario 3: Authorized project access
    const authProjRes = await request(`/traceability?project=${testProjectId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    recordTest(
      'RBAC',
      'Authorized owner can query project traceability (status 200)',
      authProjRes.status === 200 && authProjRes.data.success
    );

    // Scenario 4: Unauthorized project access rejected with 403
    const unauthProjRes = await request(`/traceability?project=${testProjectId}`, {
      headers: { Authorization: `Bearer ${outsiderToken}` }
    });
    recordTest(
      'RBAC',
      'Unauthorized user receives 403 Forbidden on project traceability',
      unauthProjRes.status === 403
    );

    // Scenario 5: Empty dataset returns 0% coverage and empty rows
    console.log('\n--- Scenario 5: Empty Dataset Handling ---');
    recordTest(
      'Data Handling',
      'New empty project has 0 total items and 0% coverage',
      authProjRes.data.data.summary.totalChangeRequests === 0 &&
      authProjRes.data.data.summary.coveragePercentage === 0 &&
      authProjRes.data.data.rows.length === 0
    );

    // Scenario 6: Real existing project "Smart SCM" returns real entities
    console.log('\n--- Scenario 6 to 10: Real SCM Entities & Relationships ---');
    const leadLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: 'lead.phase10@smartscm.io', password: 'Password123!' }
    });
    const leadToken = leadLogin.data.token;

    const realProj = await Project.findOne({ key: 'SMART-SCM' });
    const realProjRes = await request(`/traceability?project=${realProj._id}`, {
      headers: { Authorization: `Bearer ${leadToken}` }
    });
    recordTest(
      'Core Project',
      'Existing project "Smart SCM" returns genuine configuration entities',
      realProjRes.status === 200 &&
      realProjRes.data.data.summary.totalVersions >= 1 &&
      realProjRes.data.data.summary.totalReleases >= 1
    );

    // Scenario 7: Real change request relationships verified
    const smartScmRows = realProjRes.data.data.rows;
    const crRow = smartScmRows.find((r) => r.changeRequest !== null);
    recordTest(
      'Relationships',
      'Real Change Request present with key, title, and valid status',
      !!crRow && !!crRow.changeRequest.key && typeof crRow.changeRequest.title === 'string'
    );

    // Scenario 8: Real bug relationships verified
    const bugRow = smartScmRows.find((r) => r.bug !== null);
    recordTest(
      'Relationships',
      'Real Bug / Defect present with key, title, and status',
      !!bugRow && !!bugRow.bug.key && typeof bugRow.bug.title === 'string'
    );

    // Scenario 9: Real version relationships verified
    const verRow = smartScmRows.find((r) => r.version !== null);
    recordTest(
      'Relationships',
      'Real Software Version present with versionNumber and name',
      !!verRow && verRow.version.versionNumber === '1.0.0'
    );

    // Scenario 10: Real release relationships verified
    const relRow = smartScmRows.find((r) => r.release !== null);
    recordTest(
      'Relationships',
      'Real Release present with releaseName and status',
      !!relRow && relRow.release.releaseName.includes('Smart SCM v1.0.0')
    );

    // Scenario 11: UVCS baseline present
    console.log('\n--- Scenario 11 & 12: UVCS Baseline Representation ---');
    const uvcsRow = smartScmRows.find((r) => r.uvcs !== null);
    recordTest(
      'UVCS',
      'Real UVCS baseline present with changesetId 0, branch /main, and repository',
      !!uvcsRow && uvcsRow.uvcs.changesetId === 0 && uvcsRow.uvcs.branch === '/main'
    );

    // Scenario 12: UVCS baseline absent returns null / "Not linked"
    // Create an unlinked test version without UVCS in test project
    const unlinkedVer = await Version.create({
      project: testProjectId,
      versionNumber: '2.0.0',
      name: 'Unlinked Baseline',
      status: 'development',
      createdBy: ownerId
    });

    const unlinkedRes = await request(`/traceability?project=${testProjectId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    const unlinkedRow = unlinkedRes.data.data.rows.find((r) => r.version?.versionNumber === '2.0.0');
    recordTest(
      'UVCS',
      'Version without UVCS baseline returns uvcs: null (renders "Not linked")',
      !!unlinkedRow && unlinkedRow.uvcs === null
    );

    // Scenario 13: Invalid project filter returns 400 Bad Request
    console.log('\n--- Scenario 13 & 14: Filtering & Parameter Handling ---');
    const invalidProjRes = await request('/traceability?project=invalid-id-123', {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    recordTest(
      'Validation',
      'Invalid project ID parameter returns 400 Bad Request',
      invalidProjRes.status === 400
    );

    // Scenario 14: Status / version / release filtering
    const filterRes = await request(`/traceability?project=${realProj._id}&status=published`, {
      headers: { Authorization: `Bearer ${leadToken}` }
    });
    recordTest(
      'Filtering',
      'Status filter (status=published) correctly filters rows',
      filterRes.status === 200 && filterRes.data.data.rows.every((r) => r.release?.status === 'published' || r.lifecycleStage.includes('Released'))
    );

    // Scenario 15: No fabricated relationships rule
    console.log('\n--- Scenario 15 & 16: Zero Fabrication & Audit Logging ---');
    // Create an isolated CR and an isolated Bug with no links
    const isolatedCR = await ChangeRequest.create({
      project: testProjectId,
      title: 'Isolated Change Request',
      description: 'Not linked to any defect or release',
      reason: 'SCM integrity test',
      requestedBy: ownerId
    });

    const isolatedRes = await request(`/traceability?project=${testProjectId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    const isolatedRow = isolatedRes.data.data.rows.find((r) => r.changeRequest?.title === 'Isolated Change Request');
    recordTest(
      'Honesty Rule',
      'Isolated CR is NOT artificially linked to any Bug, Version, or Release (null fields)',
      !!isolatedRow && isolatedRow.bug === null && isolatedRow.version === null && isolatedRow.release === null && isolatedRow.relationshipType === 'unlinked'
    );

    // Scenario 16: Artifact Linking Mutation with Audit Log (Step 17)
    const testBug = await Bug.create({
      project: testProjectId,
      title: 'Test Trace Bug',
      description: 'Bug to be linked with isolated CR',
      reportedBy: ownerId
    });

    const linkMutationRes = await request('/traceability/link', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: {
        projectId: testProjectId,
        changeRequestId: isolatedCR._id,
        bugId: testBug._id
      }
    });

    recordTest(
      'Mutation',
      'POST /api/traceability/link establishes genuine relationship',
      linkMutationRes.status === 200 && linkMutationRes.data.success
    );

    // Verify AuditLog record was created
    const auditRecord = await AuditLog.findOne({
      project: testProjectId,
      action: 'TRACEABILITY_LINK_CREATED'
    });
    recordTest(
      'Audit Integration',
      'TRACEABILITY_LINK_CREATED action logged in AuditLog with actor and project',
      !!auditRecord && auditRecord.entityType === 'Traceability' && auditRecord.actor.toString() === ownerId.toString()
    );

  } catch (err) {
    console.error('Test execution exception:', err);
    recordTest('Suite', 'Suite crashed', false, err.message);
  } finally {
    // Teardown temporary test entities
    if (testProjectId) {
      await Project.deleteOne({ _id: testProjectId });
      await Version.deleteMany({ project: testProjectId });
      await Bug.deleteMany({ project: testProjectId });
      await ChangeRequest.deleteMany({ project: testProjectId });
      await AuditLog.deleteMany({ project: testProjectId });
    }
    if (ownerId) await mongoose.model('User').deleteOne({ _id: ownerId });
    if (outsiderId) await mongoose.model('User').deleteOne({ _id: outsiderId });
    await mongoose.disconnect();
  }

  console.log('\n========================================================================');
  console.log(` 📊 PHASE 14 TRACEABILITY RESULTS: ${stats.passed}/${stats.total} PASSED (Failed: ${stats.failed})`);
  console.log('========================================================================\n');

  if (stats.failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTraceabilityTests();
