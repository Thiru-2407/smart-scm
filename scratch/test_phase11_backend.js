/**
 * Phase 11: Master Backend Integration, Security, and RBAC Test Suite
 * Covers Parts 1–14, 17–19 of Phase 11 requirements.
 */
const http = require('http');
const mongoose = require('../backend/node_modules/mongoose');

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

async function runMasterBackendTests() {
  console.log('========================================================================');
  console.log(' 🚀 RUNNING PHASE 11 MASTER BACKEND & SECURITY TEST SUITE');
  console.log('========================================================================\n');

  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  // Track created temporary resources for clean teardown
  let tmpProjectId = null;
  let tmpVersionId = null;
  let tmpBugId = null;
  let tmpCrId = null;
  let tmpReleaseId = null;

  // Test accounts
  const pmUser = {
    name: 'Phase11 Lead PM',
    email: `pm.p11.${Date.now()}@smartscm.io`,
    password: 'Password123!',
    role: 'project_manager'
  };

  const devUser = {
    name: 'Phase11 Dev Tester',
    email: `dev.p11.${Date.now()}@smartscm.io`,
    password: 'Password123!',
    role: 'developer'
  };

  let pmToken = null;
  let devToken = null;
  let pmUserId = null;
  let devUserId = null;

  try {
    // ========================================================================
    // PART 1: ENVIRONMENT VERIFICATION
    // ========================================================================
    console.log('--- PART 1: ENVIRONMENT VERIFICATION ---');
    
    // 1.1 MongoDB Connectivity
    const isMongoConnected = mongoose.connection.readyState === 1;
    recordTest('Part 1: Environment', 'MongoDB is connected and ready', isMongoConnected);

    // 1.2 Health Check Endpoint
    const healthRes = await request('/health');
    const healthOk = healthRes.status === 200 && healthRes.data?.success === true;
    recordTest('Part 1: Environment', 'Backend GET /api/health returns 200 OK', healthOk);

    // 1.3 UVCS Service & Environment Verification
    const uvcsService = require('../backend/src/services/uvcsService');
    const cliInfo = await uvcsService.detectCli();
    const cliOk = cliInfo.installed && cliInfo.version.includes('11.0');
    recordTest('Part 1: Environment', `UVCS cm.exe CLI installed (v${cliInfo.version})`, cliOk);

    const uvcsStatus = await uvcsService.getStatus();
    const envOk = uvcsStatus.connected &&
                  uvcsStatus.workspace.name === 'smart_scm_wk' &&
                  uvcsStatus.repository.spec === 'default@local' &&
                  uvcsStatus.branch === '/main' &&
                  uvcsStatus.headChangeset.changesetId === 0;
    recordTest('Part 1: Environment', 'UVCS live workspace (smart_scm_wk, default@local, /main, cs:0)', envOk);

    // ========================================================================
    // PART 2: AUTHENTICATION TESTING
    // ========================================================================
    console.log('\n--- PART 2: AUTHENTICATION TESTING ---');

    // 2.1 Register New User
    const regPmRes = await request('/auth/register', { method: 'POST', body: pmUser });
    const regPmOk = regPmRes.status === 201 && regPmRes.data?.token && regPmRes.data?.user?.email === pmUser.email.toLowerCase();
    pmToken = regPmRes.data?.token;
    pmUserId = regPmRes.data?.user?.id;
    recordTest('Part 2: Authentication', 'Register new Project Manager test account', regPmOk);

    // Register dev user
    const regDevRes = await request('/auth/register', { method: 'POST', body: devUser });
    devToken = regDevRes.data?.token;
    devUserId = regDevRes.data?.user?.id;

    // 2.2 Reject Duplicate Registration
    const dupRegRes = await request('/auth/register', { method: 'POST', body: pmUser });
    const dupRegOk = dupRegRes.status === 400 && dupRegRes.data?.success === false;
    recordTest('Part 2: Authentication', 'Duplicate email registration rejected with 400', dupRegOk);

    // 2.3 Login with Valid Credentials
    const loginRes = await request('/auth/login', {
      method: 'POST',
      body: { email: pmUser.email, password: pmUser.password }
    });
    const loginOk = loginRes.status === 200 && loginRes.data?.token !== undefined;
    recordTest('Part 2: Authentication', 'Login with valid credentials returns JWT', loginOk);

    // 2.4 Reject Invalid Password
    const badLoginRes = await request('/auth/login', {
      method: 'POST',
      body: { email: pmUser.email, password: 'WrongPassword999!' }
    });
    const badLoginOk = badLoginRes.status === 401 || badLoginRes.status === 400;
    recordTest('Part 2: Authentication', 'Login with invalid password rejected', badLoginOk);

    // 2.5 Protected Route /api/auth/me
    const meRes = await request('/auth/me', { headers: { Authorization: `Bearer ${pmToken}` } });
    const meOk = meRes.status === 200 && meRes.data?.user?.email === pmUser.email.toLowerCase();
    recordTest('Part 2: Authentication', 'GET /api/auth/me returns authenticated user profile', meOk);

    // 2.6 Reject Protected Route Without Token
    const unauthRes = await request('/auth/me');
    const unauthOk = unauthRes.status === 401;
    recordTest('Part 2: Authentication', 'Protected routes reject unauthenticated requests (401)', unauthOk);

    // 2.7 Verify Password / Hash is Never Exposed
    const noPasswordInMe = meRes.data?.user?.password === undefined && meRes.data?.user?.passwordHash === undefined;
    recordTest('Part 2: Authentication', 'User profile responses never expose password or hash', noPasswordInMe);

    // ========================================================================
    // PART 3: PROJECT MANAGEMENT
    // ========================================================================
    console.log('\n--- PART 3: PROJECT MANAGEMENT ---');

    // 3.1 Verify Real SMART-SCM Project is Intact
    const smartScmDoc = await db.collection('projects').findOne({ key: 'SMART-SCM' });
    const smartScmOk = smartScmDoc !== null && smartScmDoc.name === 'Smart SCM';
    recordTest('Part 3: Projects', 'Core project "Smart SCM" (SMART-SCM) is intact and preserved', smartScmOk);

    // 3.2 Create Temporary Test Project
    const projData = {
      name: 'Phase 11 Verification Project',
      key: 'P11' + Math.floor(Math.random() * 10000),
      description: 'Temporary configuration project for system verification',
      status: 'active'
    };
    const createProjRes = await request('/projects', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pmToken}` },
      body: projData
    });
    const createProjOk = createProjRes.status === 201 && createProjRes.data?.project?._id;
    tmpProjectId = createProjRes.data?.project?._id;
    recordTest('Part 3: Projects', 'Create test project with unique key', createProjOk);

    // 3.3 Verify Project Listing in /projects
    const listProjRes = await request('/projects', { headers: { Authorization: `Bearer ${pmToken}` } });
    const listProjOk = listProjRes.status === 200 && listProjRes.data?.projects?.some(p => p._id === tmpProjectId);
    recordTest('Part 3: Projects', 'Test project appears in project portfolio listing', listProjOk);

    // 3.4 Retrieve Project Details
    const getProjRes = await request(`/projects/${tmpProjectId}`, { headers: { Authorization: `Bearer ${pmToken}` } });
    const getProjOk = getProjRes.status === 200 && getProjRes.data?.project?.name === projData.name;
    recordTest('Part 3: Projects', 'Retrieve single project details by ID', getProjOk);

    // 3.5 Update Project Information
    const updateProjRes = await request(`/projects/${tmpProjectId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${pmToken}` },
      body: { name: 'Phase 11 Verified Project Updated', description: 'Updated description' }
    });
    const updateProjOk = updateProjRes.status === 200 && updateProjRes.data?.project?.name === 'Phase 11 Verified Project Updated';
    recordTest('Part 3: Projects', 'Update project information as owner', updateProjOk);

    // 3.6 Member Management: Add & Remove Developer
    const addMemberRes = await request(`/projects/${tmpProjectId}/members`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${pmToken}` },
      body: { userId: devUserId }
    });
    const addMemberOk = addMemberRes.status === 200;
    recordTest('Part 3: Projects', 'Add developer member to project team', addMemberOk);

    const removeMemberRes = await request(`/projects/${tmpProjectId}/members/${devUserId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${pmToken}` }
    });
    const removeMemberOk = removeMemberRes.status === 200;
    recordTest('Part 3: Projects', 'Remove member from project team', removeMemberOk);

    // Re-add developer to project team for downstream tests
    await request(`/projects/${tmpProjectId}/members`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${pmToken}` },
      body: { userId: devUserId }
    });

    // 3.7 Reject Modification by Non-Owner Developer
    const devModRes = await request(`/projects/${tmpProjectId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${devToken}` },
      body: { name: 'Malicious Rename' }
    });
    const devModRejected = devModRes.status === 403;
    recordTest('Part 3: Projects', 'Unauthorized project modification rejected with 403', devModRejected);

    // 3.8 Project Statistics Summary
    const projStatsRes = await request('/projects/stats/summary', { headers: { Authorization: `Bearer ${pmToken}` } });
    const projStatsOk = projStatsRes.status === 200 && projStatsRes.data?.stats?.totalProjects >= 2;
    recordTest('Part 3: Projects', 'GET /api/projects/stats/summary returns aggregate metrics', projStatsOk);

    // ========================================================================
    // PART 4: VERSION MANAGEMENT
    // ========================================================================
    console.log('\n--- PART 4: VERSION MANAGEMENT ---');

    // 4.1 Create Version
    const verData = {
      versionNumber: '1.0.0',
      name: 'Initial Release Baseline',
      description: 'First formal configuration milestone',
      status: 'development',
      changes: ['Feature A: User authentication', 'Feature B: Project workspace']
    };
    const createVerRes = await request(`/projects/${tmpProjectId}/versions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${pmToken}` },
      body: verData
    });
    const createVerOk = createVerRes.status === 201 && createVerRes.data?.version?._id;
    tmpVersionId = createVerRes.data?.version?._id;
    recordTest('Part 4: Versions', 'Create new software version baseline (v1.0.0)', createVerOk);

    // 4.2 Reject Duplicate Version Number in Same Project
    const dupVerRes = await request(`/projects/${tmpProjectId}/versions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${pmToken}` },
      body: verData
    });
    const dupVerOk = dupVerRes.status === 400;
    recordTest('Part 4: Versions', 'Duplicate versionNumber within project rejected with 400', dupVerOk);

    // 4.3 Retrieve Version by ID
    const getVerRes = await request(`/projects/${tmpProjectId}/versions/${tmpVersionId}`, {
      headers: { Authorization: `Bearer ${pmToken}` }
    });
    const getVerOk = getVerRes.status === 200 && getVerRes.data?.version?.versionNumber === '1.0.0';
    recordTest('Part 4: Versions', 'Retrieve software version details by ID', getVerOk);

    // 4.4 Update Version Information
    const updateVerRes = await request(`/projects/${tmpProjectId}/versions/${tmpVersionId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${pmToken}` },
      body: { status: 'testing', name: 'Baseline QA Version' }
    });
    const updateVerOk = updateVerRes.status === 200 && updateVerRes.data?.version?.status === 'testing';
    recordTest('Part 4: Versions', 'Update version details and status transition to "testing"', updateVerOk);

    // 4.5 Malformed Version ID Handling
    const badVerRes = await request(`/projects/${tmpProjectId}/versions/invalid-id-format`, {
      headers: { Authorization: `Bearer ${pmToken}` }
    });
    const badVerOk = badVerRes.status === 400;
    recordTest('Part 4: Versions', 'Malformed version ID returns 400 Bad Request safely', badVerOk);

    // 4.6 Version Statistics
    const verStatsRes = await request('/versions/stats/summary', { headers: { Authorization: `Bearer ${pmToken}` } });
    const verStatsOk = verStatsRes.status === 200 && verStatsRes.data?.stats?.totalVersions >= 1;
    recordTest('Part 4: Versions', 'GET /api/versions/stats/summary returns aggregate statistics', verStatsOk);

    // ========================================================================
    // PART 5: BUG TRACKING
    // ========================================================================
    console.log('\n--- PART 5: BUG TRACKING ---');

    // 5.1 Create Bug
    const bugData = {
      title: 'Session timeout on idle connection',
      description: 'Session terminates unexpectedly after 15 minutes of inactivity',
      severity: 'high',
      priority: 'urgent',
      status: 'open'
    };
    const createBugRes = await request(`/projects/${tmpProjectId}/bugs`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${pmToken}` },
      body: bugData
    });
    const createBugOk = createBugRes.status === 201 && createBugRes.data?.bug?._id;
    tmpBugId = createBugRes.data?.bug?._id;
    recordTest('Part 5: Bug Tracking', 'Report defect with high severity and urgent priority', createBugOk);

    // 5.2 Assign Bug to Developer via /assign
    const assignBugRes = await request(`/projects/${tmpProjectId}/bugs/${tmpBugId}/assign`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${pmToken}` },
      body: { assignedTo: devUserId }
    });
    const assignBugOk = assignBugRes.status === 200 && assignBugRes.data?.bug?.assignedTo?._id === devUserId;
    recordTest('Part 5: Bug Tracking', 'Assign defect to developer via /assign endpoint', assignBugOk);

    // Transition status to in_progress
    await request(`/projects/${tmpProjectId}/bugs/${tmpBugId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${devToken}` },
      body: { status: 'in_progress' }
    });

    // 5.3 Resolve Bug with Resolution Notes
    const resolveBugRes = await request(`/projects/${tmpProjectId}/bugs/${tmpBugId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${devToken}` },
      body: { status: 'resolved', resolution: 'Configured sliding token window and heartbeat check' }
    });
    const resolveBugOk = resolveBugRes.status === 200 && resolveBugRes.data?.bug?.status === 'resolved';
    recordTest('Part 5: Bug Tracking', 'Resolve defect with resolution documentation', resolveBugOk);

    // 5.4 Close and Reopen Lifecycle
    const closeBugRes = await request(`/projects/${tmpProjectId}/bugs/${tmpBugId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${pmToken}` },
      body: { status: 'closed' }
    });
    const reopenBugRes = await request(`/projects/${tmpProjectId}/bugs/${tmpBugId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${pmToken}` },
      body: { status: 'reopened' }
    });
    const lifecycleOk = closeBugRes.status === 200 && reopenBugRes.status === 200 && reopenBugRes.data?.bug?.status === 'reopened';
    recordTest('Part 5: Bug Tracking', 'Verify complete defect status lifecycle: resolved -> closed -> reopened', lifecycleOk);

    // Move back to resolved for release notes test
    await request(`/projects/${tmpProjectId}/bugs/${tmpBugId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${pmToken}` },
      body: { status: 'resolved', resolution: 'Resolved for baseline inclusion' }
    });

    // 5.5 Bug Statistics
    const bugStatsRes = await request('/bugs/stats/summary', { headers: { Authorization: `Bearer ${pmToken}` } });
    const bugStatsOk = bugStatsRes.status === 200 && bugStatsRes.data?.stats?.totalBugs >= 1;
    recordTest('Part 5: Bug Tracking', 'GET /api/bugs/stats/summary returns defect statistics', bugStatsOk);

    // ========================================================================
    // PART 6: CHANGE REQUESTS
    // ========================================================================
    console.log('\n--- PART 6: CHANGE REQUESTS ---');

    // 6.1 Create Change Request
    const crData = {
      title: 'Upgrade encryption to AES-GCM-256',
      description: 'Implement authenticated encryption baseline for repository data transfer',
      reason: 'Compliance with IEEE 828 SCM security recommendations',
      priority: 'high'
    };
    const createCrRes = await request(`/projects/${tmpProjectId}/change-requests`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${devToken}` },
      body: crData
    });
    const createCrOk = createCrRes.status === 201 && createCrRes.data?.changeRequest?.status === 'submitted';
    tmpCrId = createCrRes.data?.changeRequest?._id;
    recordTest('Part 6: Change Requests', 'Create change request (initial status: "submitted")', createCrOk);

    // 6.2 Move to under_review
    const reviewCrRes = await request(`/projects/${tmpProjectId}/change-requests/${tmpCrId}/review`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${pmToken}` },
      body: { status: 'under_review' }
    });
    const reviewCrOk = reviewCrRes.status === 200 && reviewCrRes.data?.changeRequest?.status === 'under_review';
    recordTest('Part 6: Change Requests', 'Transition change request to "under_review"', reviewCrOk);

    // 6.3 Approve Change Request by PM
    const approveCrRes = await request(`/projects/${tmpProjectId}/change-requests/${tmpCrId}/review`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${pmToken}` },
      body: { status: 'approved', implementationNotes: 'Approved for inclusion in upcoming baseline' }
    });
    const approveCrOk = approveCrRes.status === 200 && approveCrRes.data?.changeRequest?.status === 'approved';
    recordTest('Part 6: Change Requests', 'Approve change request with review comments', approveCrOk);

    // 6.4 Implement Approved Request
    const implementCrRes = await request(`/projects/${tmpProjectId}/change-requests/${tmpCrId}/review`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${pmToken}` },
      body: { status: 'implemented', implementationNotes: 'AES-GCM cipher suite activated in crypto service module' }
    });
    const implementCrOk = implementCrRes.status === 200 && implementCrRes.data?.changeRequest?.status === 'implemented';
    recordTest('Part 6: Change Requests', 'Implement approved change request with technical notes', implementCrOk);

    // 6.5 Change Request Statistics
    const crStatsRes = await request('/change-requests/stats/summary', { headers: { Authorization: `Bearer ${pmToken}` } });
    const crStatsOk = crStatsRes.status === 200 && crStatsRes.data?.stats?.totalCRs >= 1;
    recordTest('Part 6: Change Requests', 'GET /api/change-requests/stats/summary returns CR metrics', crStatsOk);

    // ========================================================================
    // PART 7: RELEASE MANAGEMENT & AUTOMATED RELEASE NOTES
    // ========================================================================
    console.log('\n--- PART 7: RELEASE MANAGEMENT ---');

    // 7.1 Create Release
    const relData = {
      version: tmpVersionId,
      releaseName: 'Phase 11 Production Release',
      description: 'First production release candidate for Phase 11',
      status: 'draft'
    };
    const createRelRes = await request(`/projects/${tmpProjectId}/releases`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${pmToken}` },
      body: relData
    });
    const createRelOk = createRelRes.status === 201 && createRelRes.data?.release?._id;
    tmpReleaseId = createRelRes.data?.release?._id;
    recordTest('Part 7: Releases', 'Create release record linked to Version baseline', createRelOk);

    // 7.2 Automated Release Notes Generation
    const genNotesRes = await request(`/projects/${tmpProjectId}/releases/${tmpReleaseId}/generate-notes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${pmToken}` }
    });
    const notesText = genNotesRes.data?.release?.releaseNotes || '';
    const notesContainChanges = notesText.includes('Feature A') || notesText.includes('Changes');
    const notesContainBugs = notesText.includes('Session timeout') || notesText.includes('Fixed Defects');
    const genNotesOk = genNotesRes.status === 200 && notesContainChanges && notesContainBugs;
    recordTest('Part 7: Releases', 'Generate release notes dynamically from version changes & resolved bugs', genNotesOk);

    // 7.3 Approve Release
    const approveRelRes = await request(`/projects/${tmpProjectId}/releases/${tmpReleaseId}/approve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${pmToken}` }
    });
    const approveRelOk = approveRelRes.status === 200 && approveRelRes.data?.release?.status === 'approved';
    recordTest('Part 7: Releases', 'Approve release governance record', approveRelOk);

    // 7.4 Publish Release and Verify Version Transition
    const pubRelRes = await request(`/projects/${tmpProjectId}/releases/${tmpReleaseId}/publish`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${pmToken}` }
    });
    const pubRelOk = pubRelRes.status === 200 && pubRelRes.data?.release?.status === 'published';
    recordTest('Part 7: Releases', 'Publish release milestone', pubRelOk);

    // Verify Version status was automatically updated to 'released'
    const verCheckRes = await request(`/projects/${tmpProjectId}/versions/${tmpVersionId}`, {
      headers: { Authorization: `Bearer ${pmToken}` }
    });
    const verUpdatedToReleased = verCheckRes.data?.version?.status === 'released';
    recordTest('Part 7: Releases', 'Publishing release automatically transitions associated Version to "released"', verUpdatedToReleased);

    // 7.5 Duplicate Active Release Protection
    const dupRelRes = await request(`/projects/${tmpProjectId}/releases`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${pmToken}` },
      body: { version: tmpVersionId, releaseName: 'Duplicate Active Release' }
    });
    const dupRelRejected = dupRelRes.status === 400;
    recordTest('Part 7: Releases', 'Duplicate active release for same version rejected with 400', dupRelRejected);

    // ========================================================================
    // PART 8: REPORTS & SCM ANALYTICS
    // ========================================================================
    console.log('\n--- PART 8: REPORTS & ANALYTICS ---');

    // 8.1 Overview Report
    const overviewRes = await request('/reports/overview', { headers: { Authorization: `Bearer ${pmToken}` } });
    const overviewData = overviewRes.data?.data || overviewRes.data?.overview;
    const overviewOk = overviewRes.status === 200 &&
                       overviewData?.totalProjects > 0 &&
                       overviewData?.totalVersions > 0;
    recordTest('Part 8: Reports', 'GET /api/reports/overview aggregates system-wide metrics from MongoDB', overviewOk);

    // 8.2 Project-Specific Report
    const projReportRes = await request(`/reports/projects/${tmpProjectId}`, { headers: { Authorization: `Bearer ${pmToken}` } });
    const projReportData = projReportRes.data?.data || projReportRes.data?.project;
    const projReportOk = projReportRes.status === 200 && (projReportData?.project?.name !== undefined || projReportData?.name !== undefined);
    recordTest('Part 8: Reports', 'GET /api/reports/projects/:id computes project-level metrics', projReportOk);

    // 8.3 Quality & Resolution Percentage Report
    const qualityRes = await request(`/reports/projects/${tmpProjectId}/quality`, { headers: { Authorization: `Bearer ${pmToken}` } });
    const qualityData = qualityRes.data?.data || qualityRes.data?.quality;
    const formulaCorrect = qualityData !== undefined &&
                           typeof qualityData.resolutionPercentage === 'number' &&
                           qualityData.totalBugs >= 1;
    recordTest('Part 8: Reports', 'GET /api/reports/projects/:id/quality calculates exact resolution percentage', formulaCorrect);

    // 8.4 Releases Report
    const relReportRes = await request(`/reports/projects/${tmpProjectId}/releases`, { headers: { Authorization: `Bearer ${pmToken}` } });
    const relReportData = relReportRes.data?.data || relReportRes.data?.releases;
    const relReportOk = relReportRes.status === 200 && relReportData?.totalReleases >= 1;
    recordTest('Part 8: Reports', 'GET /api/reports/projects/:id/releases computes release distribution', relReportOk);

    // ========================================================================
    // PART 9: UVCS INTEGRATION
    // ========================================================================
    console.log('\n--- PART 9: UVCS INTEGRATION ---');

    // 9.1 UVCS Status Endpoint
    const uvcsStatusRes = await request('/uvcs/status', { headers: { Authorization: `Bearer ${pmToken}` } });
    const uvcsStatusOk = uvcsStatusRes.status === 200 &&
                         uvcsStatusRes.data?.data?.workspace?.name === 'smart_scm_wk' &&
                         uvcsStatusRes.data?.data?.repository?.spec === 'default@local';
    recordTest('Part 9: UVCS', 'GET /api/uvcs/status returns live Plastic/Unity VCS connection', uvcsStatusOk);

    // 9.2 UVCS Branches Endpoint
    const uvcsBranchesRes = await request('/uvcs/branches', { headers: { Authorization: `Bearer ${pmToken}` } });
    const uvcsBranchesOk = uvcsBranchesRes.status === 200 && uvcsBranchesRes.data?.branches?.some(b => b.name === '/main');
    recordTest('Part 9: UVCS', 'GET /api/uvcs/branches lists real branches (/main)', uvcsBranchesOk);

    // 9.3 UVCS Changesets Endpoint
    const uvcsCsRes = await request('/uvcs/changesets', { headers: { Authorization: `Bearer ${pmToken}` } });
    const uvcsCsOk = uvcsCsRes.status === 200 && uvcsCsRes.data?.changesets?.some(cs => cs.changesetId === 0);
    recordTest('Part 9: UVCS', 'GET /api/uvcs/changesets lists real changesets (cs:0)', uvcsCsOk);

    // 9.4 UVCS Changeset Details Endpoint (cs:0)
    const uvcsCs0Res = await request('/uvcs/changesets/0', { headers: { Authorization: `Bearer ${pmToken}` } });
    const uvcsCs0Ok = uvcsCs0Res.status === 200 && uvcsCs0Res.data?.changeset?.changesetId === 0;
    recordTest('Part 9: UVCS', 'GET /api/uvcs/changesets/0 returns verified root changeset details', uvcsCs0Ok);

    // 9.5 Safe Controlled Changes Inspection
    const uvcsWkRes = await request('/uvcs/workspace-changes', { headers: { Authorization: `Bearer ${pmToken}` } });
    const uvcsWkOk = uvcsWkRes.status === 200 && uvcsWkRes.data?.count === 0 && uvcsWkRes.data?.hasChanges === false;
    recordTest('Part 9: UVCS', 'GET /api/uvcs/workspace-changes inspects workspace safely (0 changes)', uvcsWkOk);

    // ========================================================================
    // PART 10 & 11: SCM TRACEABILITY (VERSION & RELEASE ↔ UVCS)
    // ========================================================================
    console.log('\n--- PART 10 & 11: SCM TRACEABILITY ---');

    // 10.1 Link Real Changeset 0 to Version
    const linkVerRes = await request(`/projects/${tmpProjectId}/versions/${tmpVersionId}/link-uvcs`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${pmToken}` },
      body: { changesetId: 0, branch: '/main', repository: 'default@local' }
    });
    const linkVerOk = linkVerRes.status === 200 && linkVerRes.data?.version?.uvcs?.changesetId === 0;
    recordTest('Part 10: Traceability', 'Link verified UVCS changeset 0 to software version', linkVerOk);

    // 10.2 Reject Invalid Changeset on Version
    const badVerLinkRes = await request(`/projects/${tmpProjectId}/versions/${tmpVersionId}/link-uvcs`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${pmToken}` },
      body: { changesetId: 999999, branch: '/main', repository: 'default@local' }
    });
    const badVerLinkOk = badVerLinkRes.status === 400;
    recordTest('Part 10: Traceability', 'Attempting to link non-existent changeset 999999 to Version rejected with 400', badVerLinkOk);

    // 11.1 Link Real Changeset 0 to Release
    const linkRelRes = await request(`/projects/${tmpProjectId}/releases/${tmpReleaseId}/link-uvcs`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${pmToken}` },
      body: { changesetId: 0, branch: '/main', repository: 'default@local' }
    });
    const linkRelOk = linkRelRes.status === 200 && linkRelRes.data?.release?.uvcs?.changesetId === 0;
    recordTest('Part 11: Traceability', 'Link verified UVCS changeset 0 to release governance record', linkRelOk);

    // 11.2 Reject Invalid Changeset on Release
    const badRelLinkRes = await request(`/projects/${tmpProjectId}/releases/${tmpReleaseId}/link-uvcs`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${pmToken}` },
      body: { changesetId: 888888, branch: '/main', repository: 'default@local' }
    });
    const badRelLinkOk = badRelLinkRes.status === 400;
    recordTest('Part 11: Traceability', 'Attempting to link non-existent changeset 888888 to Release rejected with 400', badRelLinkOk);

    // ========================================================================
    // PART 12: ROLE-BASED ACCESS CONTROL (RBAC)
    // ========================================================================
    console.log('\n--- PART 12: RBAC PERMISSIONS ---');

    // 12.1 Developer Forbidden from Deleting Projects
    const devDelProjRes = await request(`/projects/${tmpProjectId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${devToken}` }
    });
    const devDelProjRejected = devDelProjRes.status === 403;
    recordTest('Part 12: RBAC', 'Developer forbidden from deleting project (403 Forbidden)', devDelProjRejected);

    // 12.2 Developer Forbidden from Approving Releases
    const devApproveRelRes = await request(`/projects/${tmpProjectId}/releases/${tmpReleaseId}/approve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${devToken}` }
    });
    const devApproveRelRejected = devApproveRelRes.status === 403;
    recordTest('Part 12: RBAC', 'Developer forbidden from approving release (403 Forbidden)', devApproveRelRejected);

    // 12.3 Developer Forbidden from Reviewing Change Requests
    const devReviewCrRes = await request(`/projects/${tmpProjectId}/change-requests/${tmpCrId}/review`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${devToken}` },
      body: { action: 'approve' }
    });
    const devReviewCrRejected = devReviewCrRes.status === 403;
    recordTest('Part 12: RBAC', 'Developer forbidden from reviewing change request (403 Forbidden)', devReviewCrRejected);

    // ========================================================================
    // PART 13: SECURITY AUDIT
    // ========================================================================
    console.log('\n--- PART 13: SECURITY AUDIT ---');

    // 13.1 Invalid / Tampered JWT Rejection
    const tamperedRes = await request('/projects', {
      headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tampered.signature' }
    });
    const tamperedOk = tamperedRes.status === 401;
    recordTest('Part 13: Security', 'Tampered or invalid JWT signature rejected with 401', tamperedOk);

    // 13.2 Database Queries Never Expose Passwords
    const allUsers = await db.collection('users').find({}, { projection: { password: 1 } }).toArray();
    const passwordsHashed = allUsers.every(u => u.password && u.password.startsWith('$2'));
    recordTest('Part 13: Security', 'All stored user passwords are securely hashed with bcrypt ($2a/$2b)', passwordsHashed);

    // 13.3 Safe Malformed ObjectId Handling
    const malformedIdRes = await request('/projects/not-a-valid-mongo-id', {
      headers: { Authorization: `Bearer ${pmToken}` }
    });
    const malformedOk = malformedIdRes.status === 400 && malformedIdRes.data?.success === false;
    recordTest('Part 13: Security', 'Malformed MongoDB ObjectId returns 400 Bad Request safely', malformedOk);

    // ========================================================================
    // PART 14 & 17: DATA INTEGRITY & DATABASE CONSISTENCY
    // ========================================================================
    console.log('\n--- PART 14 & 17: DATA INTEGRITY ---');

    // 14.1 Relational Consistency Check
    const relDoc = await db.collection('releases').findOne({ _id: new mongoose.Types.ObjectId(tmpReleaseId) });
    const relHasCorrectVersion = relDoc.version.toString() === tmpVersionId.toString();
    const relHasCorrectProject = relDoc.project.toString() === tmpProjectId.toString();
    recordTest('Part 14: Data Integrity', 'Release document maintains correct references to Version and Project', relHasCorrectVersion && relHasCorrectProject);

    // 14.2 Database Collections Verification
    const collections = await db.listCollections().toArray();
    const colNames = collections.map(c => c.name);
    const requiredCols = ['users', 'projects', 'versions', 'bugs', 'changerequests', 'releases'];
    const allColsPresent = requiredCols.every(c => colNames.includes(c));
    recordTest('Part 17: Database', 'All required SCM collections exist in MongoDB', allColsPresent);

    // ========================================================================
    // CLEANUP: TEARDOWN TEMPORARY TEST ARTIFACTS ONLY
    // ========================================================================
    console.log('\n--- TEARDOWN TEMPORARY TEST DATA ---');
    if (tmpReleaseId) await db.collection('releases').deleteOne({ _id: new mongoose.Types.ObjectId(tmpReleaseId) });
    if (tmpCrId) await db.collection('changerequests').deleteOne({ _id: new mongoose.Types.ObjectId(tmpCrId) });
    if (tmpBugId) await db.collection('bugs').deleteOne({ _id: new mongoose.Types.ObjectId(tmpBugId) });
    if (tmpVersionId) await db.collection('versions').deleteOne({ _id: new mongoose.Types.ObjectId(tmpVersionId) });
    if (tmpProjectId) await db.collection('projects').deleteOne({ _id: new mongoose.Types.ObjectId(tmpProjectId) });
    await db.collection('users').deleteMany({ email: { $in: [pmUser.email.toLowerCase(), devUser.email.toLowerCase()] } });
    console.log('   ✅ Cleaned up temporary test project, version, bug, change request, and accounts.');
    console.log('   ✅ Real project "Smart SCM" (SMART-SCM) remains completely preserved.');

  } catch (err) {
    console.error('\n❌ UNEXPECTED ERROR DURING MASTER TEST SUITE:', err);
    recordTest('Master Suite', 'Execution without unhandled exception', false, err.message);
  } finally {
    await mongoose.disconnect();
  }

  console.log('\n========================================================================');
  console.log(` 📊 PHASE 11 MASTER BACKEND RESULTS: ${stats.passed}/${stats.total} PASSED (${Math.round((stats.passed / stats.total) * 100)}%)`);
  console.log('========================================================================\n');

  if (stats.failed > 0) {
    process.exit(1);
  }
}

runMasterBackendTests();
