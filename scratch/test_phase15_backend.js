/**
 * Phase 15: SCM Change Impact Analysis Backend Verification Suite
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

async function runImpactAnalysisTests() {
  console.log('========================================================================');
  console.log(' 🚀 RUNNING PHASE 15 CHANGE IMPACT ANALYSIS BACKEND VERIFICATION SUITE');
  console.log('========================================================================\n');

  await mongoose.connect(MONGO_URI);

  const timestamp = Date.now();
  const ownerUser = {
    name: 'Phase 15 Lead PM',
    email: `pm.p15.${timestamp}@smartscm.io`,
    password: 'Password123!',
    role: 'project_manager'
  };

  const outsiderUser = {
    name: 'Phase 15 Outsider',
    email: `outsider.p15.${timestamp}@smartscm.io`,
    password: 'Password123!',
    role: 'developer'
  };

  let ownerToken, outsiderToken;
  let ownerId, outsiderId;
  let testProject, testProjectId;
  let isolatedProject, isolatedProjectId;

  let crLow, crMedium, crHigh, crCritical;
  let testBug1, testBug2;
  let verWithBaseline, verWithoutBaseline;
  let testRelease1, testRelease2;

  try {
    // 1. Setup Test Users
    const resOwner = await request('/auth/register', { method: 'POST', body: ownerUser });
    ownerToken = resOwner.data.token;
    ownerId = resOwner.data.user.id || resOwner.data.user._id;

    const resOutsider = await request('/auth/register', { method: 'POST', body: outsiderUser });
    outsiderToken = resOutsider.data.token;
    outsiderId = resOutsider.data.user.id || resOutsider.data.user._id;

    // Create Test Project owned by ownerUser
    testProject = await Project.create({
      name: `Impact Test Project ${timestamp}`,
      key: `IMP${timestamp.toString().slice(-4)}`,
      description: 'Project for Phase 15 automated impact verification',
      owner: ownerId,
      members: [ownerId]
    });
    testProjectId = testProject._id.toString();

    // Create Isolated Project for unauthorized check
    isolatedProject = await Project.create({
      name: `Isolated Project ${timestamp}`,
      key: `ISO${timestamp.toString().slice(-4)}`,
      description: 'Project without outsider access',
      owner: ownerId,
      members: [ownerId]
    });
    isolatedProjectId = isolatedProject._id.toString();

    // Setup Controlled Test SCM Artifacts
    // Versions
    verWithBaseline = await Version.create({
      project: testProjectId,
      versionNumber: '2.0.0',
      name: 'Baseline Version',
      status: 'released',
      createdBy: ownerId,
      uvcs: {
        changesetId: 42,
        branch: '/main',
        repository: 'default@local'
      }
    });

    verWithoutBaseline = await Version.create({
      project: testProjectId,
      versionNumber: '2.1.0',
      name: 'Development Version',
      status: 'development',
      createdBy: ownerId,
      uvcs: {
        changesetId: null,
        branch: null,
        repository: null
      }
    });

    // Bugs
    testBug1 = await Bug.create({
      project: testProjectId,
      title: 'Impact Defect One',
      description: 'First bug for impact test',
      severity: 'high',
      status: 'open',
      reportedBy: ownerId,
      version: verWithBaseline._id
    });

    testBug2 = await Bug.create({
      project: testProjectId,
      title: 'Impact Defect Two',
      description: 'Second bug for impact test',
      severity: 'critical',
      status: 'in_progress',
      reportedBy: ownerId,
      version: verWithBaseline._id
    });

    // CR 1: LOW impact (0 bugs, 0 versions, 0 releases)
    crLow = await ChangeRequest.create({
      project: testProjectId,
      title: 'CR Low Impact Proposal',
      description: 'Stand-alone change proposal with zero downstream links',
      reason: 'SCM documentation refresh',
      requestedBy: ownerId,
      status: 'submitted',
      targetVersion: null,
      relatedBugs: []
    });

    // CR 2: MEDIUM impact (1 bug, 0 baselines, 0 releases)
    const devBug = await Bug.create({
      project: testProjectId,
      title: 'Dev Defect for Medium Impact',
      description: 'Bug on version without baseline',
      severity: 'medium',
      status: 'open',
      reportedBy: ownerId,
      version: verWithoutBaseline._id
    });

    crMedium = await ChangeRequest.create({
      project: testProjectId,
      title: 'CR Medium Impact Proposal',
      description: 'Change request linked to version without baseline',
      reason: 'Fix dev defect',
      requestedBy: ownerId,
      status: 'under_review',
      targetVersion: verWithoutBaseline._id,
      relatedBugs: [devBug._id]
    });

    // CR 3: HIGH impact (targetVersion with UVCS baseline + 1 release)
    testRelease1 = await Release.create({
      project: testProjectId,
      version: verWithBaseline._id,
      releaseName: `Release 2.0.0-PROD ${timestamp}`,
      status: 'published',
      releaseDate: new Date(),
      createdBy: ownerId,
      fixedBugs: [testBug1._id]
    });

    crHigh = await ChangeRequest.create({
      project: testProjectId,
      title: 'CR High Impact Baseline Proposal',
      description: 'Change request targeting version with UVCS baseline and 1 release',
      reason: 'Upgrade baseline protocol',
      requestedBy: ownerId,
      status: 'approved',
      targetVersion: verWithBaseline._id,
      relatedBugs: [testBug1._id]
    });

    // Version for Hotfix
    const verHotfix = await Version.create({
      project: testProjectId,
      versionNumber: '2.0.1',
      name: 'Hotfix Version',
      status: 'released',
      createdBy: ownerId,
      uvcs: {
        changesetId: 43,
        branch: '/main',
        repository: 'default@local'
      }
    });

    // CR 4: CRITICAL impact (multiple releases affected: >= 2 releases)
    testRelease2 = await Release.create({
      project: testProjectId,
      version: verHotfix._id,
      releaseName: `Release 2.0.1-HOTFIX ${timestamp}`,
      status: 'published',
      releaseDate: new Date(),
      createdBy: ownerId,
      fixedBugs: [testBug2._id]
    });

    crCritical = await ChangeRequest.create({
      project: testProjectId,
      title: 'CR Critical Multi-Release Impact',
      description: 'Change request touching multiple downstream releases and defects',
      reason: 'Core architecture overhaul',
      requestedBy: ownerId,
      status: 'approved',
      targetVersion: verWithBaseline._id,
      relatedBugs: [testBug1._id, testBug2._id]
    });

    // Update releases with CR reference directly to test direct linkage
    testRelease1.changeRequests = [crHigh._id, crCritical._id];
    await testRelease1.save();
    testRelease2.changeRequests = [crCritical._id];
    await testRelease2.save();

    console.log('--- Verification Scenarios 1 to 18 ---\n');

    // 1. Authenticated access (200)
    const resAuth = await request('/impact-analysis', {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    recordTest(
      'Auth',
      '1. Authenticated access returns 200 and structured data',
      resAuth.status === 200 && resAuth.data.success === true && Array.isArray(resAuth.data.data.changeRequests)
    );

    // 2. Unauthenticated access returns 401
    const resUnauth = await request('/impact-analysis');
    recordTest(
      'Security',
      '2. Unauthenticated access rejected with 401 Unauthorized',
      resUnauth.status === 401
    );

    // 3. Authorized project access succeeds
    const resAuthProj = await request(`/impact-analysis?project=${testProjectId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    recordTest(
      'Security',
      '3. Authorized project access succeeds with 200',
      resAuthProj.status === 200 && resAuthProj.data.success === true
    );

    // 4. Unauthorized project access returns 403
    const resUnauthProj = await request(`/impact-analysis?project=${isolatedProjectId}`, {
      headers: { Authorization: `Bearer ${outsiderToken}` }
    });
    recordTest(
      'Security',
      '4. Unauthorized project access rejected with 403 Forbidden',
      resUnauthProj.status === 403
    );

    // 5. Invalid change request ID returns 400
    const resInvalidId = await request('/impact-analysis/change-request/invalid-id-12345', {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    recordTest(
      'Validation',
      '5. Invalid change request ID returns 400 Bad Request',
      resInvalidId.status === 400
    );

    // 6. Missing change request returns 404
    const nonExistentId = new mongoose.Types.ObjectId();
    const resMissingCR = await request(`/impact-analysis/change-request/${nonExistentId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    recordTest(
      'Validation',
      '6. Missing change request returns 404 Not Found',
      resMissingCR.status === 404
    );

    // 7. Real change request returns full hierarchy
    const resRealCR = await request(`/impact-analysis/change-request/${crHigh._id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    const dHigh = resRealCR.data.data;
    recordTest(
      'Functionality',
      '7. Real change request returns full hierarchy (summary, impacts, impactPath, artifactTable)',
      resRealCR.status === 200 &&
        !!dHigh.summary &&
        !!dHigh.changeRequest &&
        !!dHigh.impacts &&
        Array.isArray(dHigh.impactPath) &&
        Array.isArray(dHigh.artifactTable)
    );

    // 8. Change request with no downstream artifacts returns LOW
    const resLow = await request(`/impact-analysis/change-request/${crLow._id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    recordTest(
      'Impact Logic',
      '8. Change request with no downstream artifacts returns LOW impact',
      resLow.status === 200 &&
        resLow.data.data.summary.impactLevel === 'LOW' &&
        resLow.data.data.summary.impactedBugs === 0 &&
        resLow.data.data.summary.impactedVersions === 0 &&
        resLow.data.data.summary.impactedReleases === 0
    );

    // 9. Change request with related bug returns MEDIUM or higher
    const resMed = await request(`/impact-analysis/change-request/${crMedium._id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    recordTest(
      'Impact Logic',
      '9. Change request with related bug returns MEDIUM impact',
      resMed.status === 200 &&
        resMed.data.data.summary.impactLevel === 'MEDIUM' &&
        resMed.data.data.summary.impactedBugs >= 1
    );

    // 10. Change request with target version identified correctly
    recordTest(
      'Impact Logic',
      '10. Change request with target version targets correct Version entity',
      resMed.status === 200 &&
        resMed.data.data.impacts.versions.length >= 1 &&
        resMed.data.data.impacts.versions[0].versionNumber === '2.1.0'
    );

    // 11. Version with UVCS baseline returns HIGH impact
    recordTest(
      'Impact Logic',
      '11. Version with UVCS baseline identified and elevates impact to HIGH',
      resRealCR.status === 200 &&
        dHigh.summary.impactLevel === 'HIGH' &&
        dHigh.summary.impactedBaselines >= 1 &&
        dHigh.impacts.baselines[0].changesetId === 42
    );

    // 12. Version without UVCS baseline handled without error
    recordTest(
      'Impact Logic',
      '12. Version without UVCS baseline does not fabricate baseline (0 baselines)',
      resMed.status === 200 && resMed.data.data.summary.impactedBaselines === 0
    );

    // 13. Release impact correctly identifies direct & derived releases
    recordTest(
      'Impact Logic',
      '13. Release impact identifies affected releases with direct/derived relationshipSource',
      resRealCR.status === 200 &&
        dHigh.summary.impactedReleases >= 1 &&
        dHigh.impacts.releases.some((r) => r.relationshipType === 'DIRECT' || r.relationshipType === 'DERIVED')
    );

    // 14. Project filter restricts results accurately
    const resFilter = await request(`/impact-analysis?project=${testProjectId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    const allBelong = resFilter.data.data.changeRequests.every(
      (c) => c.project._id === testProjectId || c.project === testProjectId
    );
    recordTest(
      'Filtering',
      '14. Project filter restricts change requests to target project only',
      resFilter.status === 200 && allBelong && resFilter.data.data.changeRequests.length >= 4
    );

    // 15. Dynamic impact level calculation matches formula
    const lowMatches = resLow.data.data.summary.impactLevel === 'LOW';
    const medMatches = resMed.data.data.summary.impactLevel === 'MEDIUM';
    const highMatches = dHigh.summary.impactLevel === 'HIGH';
    recordTest(
      'Calculation',
      '15. Dynamic impact level calculation matches formula across LOW, MEDIUM, HIGH',
      lowMatches && medMatches && highMatches
    );

    // 16. Multiple downstream artifacts result in CRITICAL impact
    const resCrit = await request(`/impact-analysis/change-request/${crCritical._id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    recordTest(
      'Calculation',
      '16. Multiple downstream releases (>=2) result in CRITICAL impact level',
      resCrit.status === 200 &&
        resCrit.data.data.summary.impactLevel === 'CRITICAL' &&
        resCrit.data.data.summary.impactedReleases >= 2
    );

    // 17. No fabricated relationships (unlinked artifacts return null/empty, not fake)
    const unlinkedCheck =
      resLow.data.data.impacts.bugs.length === 0 &&
      resLow.data.data.impacts.versions.length === 0 &&
      resLow.data.data.impacts.baselines.length === 0 &&
      resLow.data.data.impacts.releases.length === 0;
    recordTest(
      'Integrity',
      '17. Zero fabricated relationships: unlinked entities are strictly empty arrays',
      unlinkedCheck
    );

    // 18. Response structure validation
    const structureValid =
      typeof dHigh.summary.impactLevel === 'string' &&
      typeof dHigh.summary.explanation === 'string' &&
      dHigh.summary.explanation.includes('configuration impact') &&
      typeof dHigh.changeRequest.title === 'string' &&
      Array.isArray(dHigh.impactPath) &&
      dHigh.impactPath.length > 0 &&
      Array.isArray(dHigh.artifactTable) &&
      dHigh.artifactTable.every((row) => row.artifact && row.type && row.relationship && row.status && row.impact);

    recordTest(
      'Integrity',
      '18. Response structure validation passes complete schema checks',
      structureValid
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

runImpactAnalysisTests();
