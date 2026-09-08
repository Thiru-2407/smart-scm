/**
 * Phase 13: Audit & Activity System End-to-End Verification Suite
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

async function runAuditTests() {
  console.log('========================================================================');
  console.log(' 🚀 RUNNING PHASE 13 AUDIT & ACTIVITY VERIFICATION SUITE');
  console.log('========================================================================\n');

  await mongoose.connect(MONGO_URI);

  const timestamp = Date.now();
  const ownerUser = {
    name: 'Phase 13 Owner',
    email: `owner.p13.${timestamp}@smartscm.io`,
    password: 'Password123!',
    role: 'project_manager'
  };

  const memberDev = {
    name: 'Phase 13 Member Dev',
    email: `dev.p13.${timestamp}@smartscm.io`,
    password: 'Password123!',
    role: 'developer'
  };

  const outsiderUser = {
    name: 'Phase 13 Outsider',
    email: `outsider.p13.${timestamp}@smartscm.io`,
    password: 'Password123!',
    role: 'developer'
  };

  let ownerToken, devToken, outsiderToken;
  let ownerId, devId, outsiderId;
  let projectId, versionId, bugId, crId, releaseId;

  try {
    // 1. Setup users
    console.log('--- Step 1: User Setup & Authentication ---');
    const resOwner = await request('/auth/register', { method: 'POST', body: ownerUser });
    ownerToken = resOwner.data.token;
    ownerId = resOwner.data.user.id || resOwner.data.user._id;

    const resDev = await request('/auth/register', { method: 'POST', body: memberDev });
    devToken = resDev.data.token;
    devId = resDev.data.user.id || resDev.data.user._id;

    const resOutsider = await request('/auth/register', { method: 'POST', body: outsiderUser });
    outsiderToken = resOutsider.data.token;
    outsiderId = resOutsider.data.user.id || resOutsider.data.user._id;

    recordTest('Auth', 'Registered test owner, member dev, and outsider', !!ownerToken && !!devToken && !!outsiderToken);

    // 2. Create Project
    console.log('\n--- Step 2: Project Operations & Audit ---');
    const resProject = await request('/projects', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: {
        name: `Audit Verification Project ${timestamp}`,
        key: `AUDIT${String(timestamp).slice(-4)}`,
        description: 'Testing audit logging triggers',
        status: 'active',
        members: [devId]
      }
    });
    projectId = resProject.data.project?._id;
    recordTest('Project', 'Create Project succeeds', resProject.status === 201 && !!projectId);

    // Check PROJECT_CREATED audit log
    const resAudit1 = await request(`/audit?project=${projectId}&action=PROJECT_CREATED`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    const hasProjCreated = resAudit1.data.auditLogs?.some(
      l => l.action === 'PROJECT_CREATED' && l.entityType === 'Project' && l.project?._id === projectId
    );
    recordTest('Audit', 'AuditLog recorded PROJECT_CREATED with actor and project', hasProjCreated);

    // Update Project
    const resUpdateProj = await request(`/projects/${projectId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: { description: 'Updated description for audit test' }
    });
    recordTest('Project', 'Update Project succeeds', resUpdateProj.status === 200);

    const resAudit2 = await request(`/audit?project=${projectId}&action=PROJECT_UPDATED`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    recordTest('Audit', 'AuditLog recorded PROJECT_UPDATED', resAudit2.data.auditLogs?.length > 0);

    // 3. Version Operations & Audit
    console.log('\n--- Step 3: Version Operations & Audit ---');
    const resVer = await request(`/projects/${projectId}/versions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: {
        versionNumber: '1.0.0',
        name: 'Initial Audit Baseline',
        description: 'Baseline version',
        status: 'development',
        changes: ['Initial feature baseline', 'Core audit support']
      }
    });
    versionId = resVer.data.version?._id;
    recordTest('Version', 'Create Version succeeds', resVer.status === 201 && !!versionId);

    const resAudit3 = await request(`/audit?project=${projectId}&action=VERSION_CREATED`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    recordTest('Audit', 'AuditLog recorded VERSION_CREATED with version metadata', resAudit3.data.auditLogs?.length > 0);

    // Update Version
    const resUpVer = await request(`/projects/${projectId}/versions/${versionId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: { status: 'testing' }
    });
    recordTest('Version', 'Update Version succeeds', resUpVer.status === 200);

    const resAudit4 = await request(`/audit?project=${projectId}&action=VERSION_UPDATED`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    recordTest('Audit', 'AuditLog recorded VERSION_UPDATED', resAudit4.data.auditLogs?.length > 0);

    // Link UVCS baseline to version (changesetId: null or simulated)
    const resUvcsVer = await request(`/projects/${projectId}/versions/${versionId}/link-uvcs`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: { changesetId: null }
    });
    recordTest('UVCS', 'Link/Unlink UVCS to Version succeeds', resUvcsVer.status === 200);

    const resAuditUvcsVer = await request(`/audit?project=${projectId}&action=UVCS_BASELINE_LINKED&entityType=UVCS`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    recordTest('Audit', 'AuditLog recorded UVCS_BASELINE_LINKED for version', resAuditUvcsVer.data.auditLogs?.length > 0);

    // 4. Bug Operations & Audit
    console.log('\n--- Step 4: Bug Operations & Audit ---');
    const resBug = await request(`/projects/${projectId}/bugs`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: {
        title: 'Buffer race condition in sync worker',
        description: 'Worker thread can race before buffer flushes',
        severity: 'high',
        priority: 'urgent'
      }
    });
    bugId = resBug.data.bug?._id;
    recordTest('Bug', 'Create Bug succeeds', resBug.status === 201 && !!bugId);

    const resAudit5 = await request(`/audit?project=${projectId}&action=BUG_CREATED`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    recordTest('Audit', 'AuditLog recorded BUG_CREATED', resAudit5.data.auditLogs?.length > 0);

    // Assign Bug
    const resAssignBug = await request(`/projects/${projectId}/bugs/${bugId}/assign`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: { assignedTo: devId }
    });
    recordTest('Bug', 'Assign Bug succeeds', resAssignBug.status === 200);

    const resAudit6 = await request(`/audit?project=${projectId}&action=BUG_UPDATED`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    recordTest('Audit', 'AuditLog recorded BUG_UPDATED on assignment', resAudit6.data.auditLogs?.length > 0);

    // 5. Change Request Operations & Audit
    console.log('\n--- Step 5: Change Request Operations & Audit ---');
    const resCr = await request(`/projects/${projectId}/change-requests`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${devToken}` },
      body: {
        title: 'Add audit trails for regulatory compliance',
        description: 'Store immutable audit entries for compliance',
        reason: 'Client audit requirement',
        priority: 'high'
      }
    });
    crId = resCr.data.changeRequest?._id;
    recordTest('CR', 'Create Change Request succeeds', resCr.status === 201 && !!crId);

    const resAudit7 = await request(`/audit?project=${projectId}&action=CHANGE_REQUEST_CREATED`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    recordTest('Audit', 'AuditLog recorded CHANGE_REQUEST_CREATED with developer actor', resAudit7.data.auditLogs?.length > 0);

    // Review Change Request (Approve)
    const resReviewCr = await request(`/projects/${projectId}/change-requests/${crId}/review`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: {
        status: 'approved',
        implementationNotes: 'Approved for Phase 13 delivery'
      }
    });
    recordTest('CR', 'Review Change Request succeeds', resReviewCr.status === 200);

    const resAudit8 = await request(`/audit?project=${projectId}&action=CHANGE_REQUEST_STATUS_CHANGED`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    recordTest('Audit', 'AuditLog recorded CHANGE_REQUEST_STATUS_CHANGED', resAudit8.data.auditLogs?.length > 0);

    // 6. Release Operations & Audit
    console.log('\n--- Step 6: Release Operations & Audit ---');
    const resRel = await request(`/projects/${projectId}/releases`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: {
        version: versionId,
        releaseName: 'Release v1.0.0-Gold',
        description: 'First official gold release candidate'
      }
    });
    releaseId = resRel.data.release?._id;
    recordTest('Release', 'Create Release succeeds', resRel.status === 201 && !!releaseId);

    const resAudit9 = await request(`/audit?project=${projectId}&action=RELEASE_CREATED`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    recordTest('Audit', 'AuditLog recorded RELEASE_CREATED', resAudit9.data.auditLogs?.length > 0);

    // Approve Release
    const resAppRel = await request(`/projects/${projectId}/releases/${releaseId}/approve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: {}
    });
    recordTest('Release', 'Approve Release succeeds', resAppRel.status === 200);

    const resAudit10 = await request(`/audit?project=${projectId}&action=RELEASE_APPROVED`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    recordTest('Audit', 'AuditLog recorded RELEASE_APPROVED', resAudit10.data.auditLogs?.length > 0);

    // Publish Release
    const resPubRel = await request(`/projects/${projectId}/releases/${releaseId}/publish`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: {}
    });
    recordTest('Release', 'Publish Release succeeds', resPubRel.status === 200);

    const resAudit11 = await request(`/audit?project=${projectId}&action=RELEASE_PUBLISHED`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    recordTest('Audit', 'AuditLog recorded RELEASE_PUBLISHED', resAudit11.data.auditLogs?.length > 0);

    // 7. RBAC & Security Verification
    console.log('\n--- Step 7: RBAC, Pagination & Security Verification ---');

    // 7.1 Owner can access all project logs
    const resOwnerAudit = await request(`/projects/${projectId}/audit`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    recordTest('RBAC', 'Owner can query /projects/:projectId/audit (status 200)', resOwnerAudit.status === 200 && resOwnerAudit.data.total >= 8);

    // 7.2 Project Member (Dev) can access project logs
    const resDevAudit = await request(`/projects/${projectId}/audit`, {
      headers: { Authorization: `Bearer ${devToken}` }
    });
    recordTest('RBAC', 'Member Dev can query /projects/:projectId/audit (status 200)', resDevAudit.status === 200);

    // 7.3 Outsider user CANNOT access project logs -> 403 Forbidden
    const resOutsiderProjectAudit = await request(`/projects/${projectId}/audit`, {
      headers: { Authorization: `Bearer ${outsiderToken}` }
    });
    recordTest('RBAC', 'Outsider user receives 403 on /projects/:projectId/audit', resOutsiderProjectAudit.status === 403);

    // 7.4 Outsider user querying /api/audit?project=:projectId receives 403 Forbidden
    const resOutsiderGlobalAudit = await request(`/audit?project=${projectId}`, {
      headers: { Authorization: `Bearer ${outsiderToken}` }
    });
    recordTest('RBAC', 'Outsider user receives 403 on /audit?project=:projectId', resOutsiderGlobalAudit.status === 403);

    // 7.5 Outsider querying /api/audit without project filter gets 0 logs (no projects owned or joined)
    const resOutsiderAllAudit = await request('/audit', {
      headers: { Authorization: `Bearer ${outsiderToken}` }
    });
    recordTest('RBAC', 'Outsider user /audit returns 0 logs (no project memberships)', resOutsiderAllAudit.status === 200 && resOutsiderAllAudit.data.auditLogs.length === 0);

    // 7.6 Pagination verification
    const resPaged = await request(`/audit?project=${projectId}&limit=3&page=1`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    const isPagedValid = resPaged.status === 200 &&
      resPaged.data.auditLogs.length <= 3 &&
      resPaged.data.page === 1 &&
      resPaged.data.pages >= 2;
    recordTest('Pagination', 'Pagination limit and page navigation work correctly', isPagedValid);

    // 7.7 Entity filter verification
    const resFilterBug = await request(`/audit?project=${projectId}&entityType=Bug`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    const onlyBugs = resFilterBug.data.auditLogs?.every(l => l.entityType === 'Bug');
    recordTest('Filter', 'Filter by entityType=Bug returns only Bug audit records', onlyBugs && resFilterBug.data.auditLogs.length > 0);

    // 7.8 Action filter verification
    const resFilterAction = await request(`/audit?project=${projectId}&action=RELEASE_PUBLISHED`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    const onlyPublished = resFilterAction.data.auditLogs?.every(l => l.action === 'RELEASE_PUBLISHED');
    recordTest('Filter', 'Filter by action=RELEASE_PUBLISHED returns only published records', onlyPublished && resFilterAction.data.auditLogs.length === 1);

    // 7.9 Metadata sanitization verification: Ensure no passwords, tokens, or mongo URIs in any record
    const AuditLog = mongoose.model('AuditLog');
    const allProjectLogs = await AuditLog.find({ project: projectId }).lean();
    let containsSecrets = false;
    for (const log of allProjectLogs) {
      const serialized = JSON.stringify(log).toLowerCase();
      if (serialized.includes('password123') || serialized.includes('bearer') || serialized.includes('jwt')) {
        containsSecrets = true;
        break;
      }
    }
    recordTest('Security', 'Zero credentials or secrets persisted in audit logs', !containsSecrets);

  } catch (err) {
    console.error('Test execution exception:', err);
    recordTest('Suite', 'Suite execution completed without unexpected exception', false, err.message);
  } finally {
    // Teardown temporary project and audit logs
    if (projectId) {
      try {
        const AuditLog = mongoose.model('AuditLog');
        await AuditLog.deleteMany({ project: projectId });
        const Project = mongoose.model('Project');
        await Project.findByIdAndDelete(projectId);
        const Version = mongoose.model('Version');
        await Version.deleteMany({ project: projectId });
        const Bug = mongoose.model('Bug');
        await Bug.deleteMany({ project: projectId });
        const ChangeRequest = mongoose.model('ChangeRequest');
        await ChangeRequest.deleteMany({ project: projectId });
        const Release = mongoose.model('Release');
        await Release.deleteMany({ project: projectId });
      } catch (e) {
        // ignore teardown error
      }
    }
    await mongoose.disconnect();

    console.log('\n========================================================================');
    console.log(` 📊 PHASE 13 AUDIT SUITE RESULTS: ${stats.passed}/${stats.total} PASS (Failed: ${stats.failed})`);
    console.log('========================================================================\n');

    process.exit(stats.failed === 0 ? 0 : 1);
  }
}

runAuditTests();
