/**
 * Automated test suite for Phase 10: Unity Version Control (UVCS) Integration Backend
 */
const http = require('http');

const API_BASE = 'http://127.0.0.1:5000/api';

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

async function runTests() {
  console.log('====================================================');
  console.log('🚀 RUNNING PHASE 10 UVCS BACKEND TEST SUITE');
  console.log('====================================================\n');

  let token = null;
  let user = null;
  let testProject = null;
  let testVersion = null;
  let testRelease = null;

  // 1. Health Check
  console.log('1. Verifying API Health...');
  const healthRes = await request('/health');
  if (healthRes.status !== 200 || !healthRes.data?.success) {
    throw new Error(`Health check failed: ${JSON.stringify(healthRes)}`);
  }
  console.log('   ✅ API Health verified: 200 OK\n');

  // 2. Authentication
  console.log('2. Authenticating as Lead Project Manager...');
  const testUser = {
    name: 'Lead PM Tester',
    email: 'lead.phase10@smartscm.io',
    password: 'Password123!',
    role: 'project_manager'
  };

  let loginRes = await request('/auth/login', {
    method: 'POST',
    body: {
      email: testUser.email,
      password: testUser.password
    }
  });

  if (loginRes.status === 200 && loginRes.data?.token) {
    token = loginRes.data.token;
    user = loginRes.data.user;
    console.log(`   ✅ Logged in as: ${user.name} (${user.role})\n`);
  } else {
    console.log('   Registering test user...');
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: testUser
    });
    if (regRes.status === 201 && regRes.data?.token) {
      token = regRes.data.token;
      user = regRes.data.user;
      console.log(`   ✅ Registered and authenticated as: ${user.name} (${user.role})\n`);
    } else {
      throw new Error(`Authentication failed: ${JSON.stringify(regRes.data)}`);
    }
  }

  const authHeaders = { Authorization: `Bearer ${token}` };

  // 3. Security: Check 401 Unauthorized without JWT
  console.log('3. Verifying security: unauthenticated access rejection...');
  const unauthRes = await request('/uvcs/status');
  if (unauthRes.status === 401) {
    console.log('   ✅ Correctly rejected unauthenticated request with 401 Unauthorized\n');
  } else {
    throw new Error(`Expected 401, got ${unauthRes.status}: ${JSON.stringify(unauthRes.data)}`);
  }

  // 4. UVCS Status endpoint
  console.log('4. Testing GET /api/uvcs/status...');
  const statusRes = await request('/uvcs/status', { headers: authHeaders });
  if (statusRes.status !== 200 || !statusRes.data?.success) {
    throw new Error(`GET /api/uvcs/status failed: ${JSON.stringify(statusRes.data)}`);
  }
  const uvcsData = statusRes.data.data;
  console.log(`   ✅ Status Success!`);
  console.log(`      - CLI Installed: ${uvcsData.cli?.installed} (Version: ${uvcsData.cli?.version})`);
  console.log(`      - Workspace: ${uvcsData.workspace?.name} (${uvcsData.workspace?.path})`);
  console.log(`      - Repository: ${uvcsData.repository?.spec}`);
  console.log(`      - Branch: ${uvcsData.branch}`);
  console.log(`      - Head Changeset: cs:${uvcsData.headChangeset?.changesetId}\n`);

  if (!uvcsData.cli?.installed) throw new Error('CLI reported not installed');
  if (uvcsData.workspace?.name !== 'smart_scm_wk') throw new Error(`Unexpected workspace: ${uvcsData.workspace?.name}`);
  if (uvcsData.repository?.spec !== 'default@local') throw new Error(`Unexpected repo: ${uvcsData.repository?.spec}`);

  // 5. UVCS Branches endpoint
  console.log('5. Testing GET /api/uvcs/branches...');
  const branchesRes = await request('/uvcs/branches', { headers: authHeaders });
  if (branchesRes.status !== 200 || !branchesRes.data?.success) {
    throw new Error(`GET /api/uvcs/branches failed: ${JSON.stringify(branchesRes.data)}`);
  }
  const branches = branchesRes.data.branches;
  console.log(`   ✅ Found ${branches.length} branches:`);
  branches.forEach(b => console.log(`      * ${b.name} (ID: ${b.id}, Head cs:${b.changeset})`));
  const hasMain = branches.some(b => b.name === '/main');
  if (!hasMain) throw new Error('Branch /main was not found in branches list');
  console.log('   ✅ Confirmed presence of /main branch\n');

  // 6. UVCS Changesets endpoint
  console.log('6. Testing GET /api/uvcs/changesets...');
  const changesetsRes = await request('/uvcs/changesets', { headers: authHeaders });
  if (changesetsRes.status !== 200 || !changesetsRes.data?.success) {
    throw new Error(`GET /api/uvcs/changesets failed: ${JSON.stringify(changesetsRes.data)}`);
  }
  const changesets = changesetsRes.data.changesets;
  console.log(`   ✅ Found ${changesets.length} changesets:`);
  changesets.forEach(cs => console.log(`      * cs:${cs.changesetId} on ${cs.branch} by ${cs.owner} at ${cs.date}`));
  const hasCs0 = changesets.some(cs => cs.changesetId === 0);
  if (!hasCs0) throw new Error('Changeset 0 not found in changesets list');
  console.log('   ✅ Confirmed presence of Changeset 0\n');

  // 7. UVCS Changeset Details endpoint for cs:0
  console.log('7. Testing GET /api/uvcs/changesets/0...');
  const cs0Res = await request('/uvcs/changesets/0', { headers: authHeaders });
  if (cs0Res.status !== 200 || !cs0Res.data?.success) {
    throw new Error(`GET /api/uvcs/changesets/0 failed: ${JSON.stringify(cs0Res.data)}`);
  }
  console.log(`   ✅ Changeset 0 Details: Branch: ${cs0Res.data.changeset?.branch}, GUID: ${cs0Res.data.changeset?.guid}\n`);

  // 8. UVCS Changeset Details for non-existent changeset
  console.log('8. Testing GET /api/uvcs/changesets/999999 (should return 404)...');
  const csInvalidRes = await request('/uvcs/changesets/999999', { headers: authHeaders });
  if (csInvalidRes.status === 404) {
    console.log('   ✅ Correctly returned 404 Not Found for non-existent changeset\n');
  } else {
    throw new Error(`Expected 404, got ${csInvalidRes.status}: ${JSON.stringify(csInvalidRes.data)}`);
  }

  // 9. UVCS Controlled Workspace Changes endpoint
  console.log('9. Testing GET /api/uvcs/workspace-changes...');
  const wkChangesRes = await request('/uvcs/workspace-changes', { headers: authHeaders });
  if (wkChangesRes.status !== 200 || !wkChangesRes.data?.success) {
    throw new Error(`GET /api/uvcs/workspace-changes failed: ${JSON.stringify(wkChangesRes.data)}`);
  }
  console.log(`   ✅ Controlled changes safely checked: count = ${wkChangesRes.data.count}, hasChanges = ${wkChangesRes.data.hasChanges}\n`);

  // 10. Traceability: Link UVCS to Version
  console.log('10. Testing Version UVCS Baseline Linking...');
  // Create dedicated project for Phase 10 owned by test user
  let projectKey = 'UV' + Math.floor(Math.random() * 10000);
  const createProjRes = await request('/projects', {
    method: 'POST',
    headers: authHeaders,
    body: {
      name: 'UVCS Verification Project',
      key: projectKey,
      description: 'Verification project for UVCS source baselines'
    }
  });

  if (!createProjRes.data?.project) {
    throw new Error(`Failed to create test project: ${JSON.stringify(createProjRes.data)}`);
  }
  testProject = createProjRes.data.project;
  console.log(`    Created Project: ${testProject.name} (${testProject.key})`);

  // Create a version in this project
  const newVerRes = await request(`/projects/${testProject._id}/versions`, {
    method: 'POST',
    headers: authHeaders,
    body: {
      versionNumber: '1.0.0',
      name: 'Initial Baseline Release',
      description: 'First version milestone'
    }
  });
  if (!newVerRes.data?.version) {
    throw new Error(`Failed to create version: ${JSON.stringify(newVerRes.data)}`);
  }
  testVersion = newVerRes.data.version;
  console.log(`    Target Version: v${testVersion.versionNumber} (${testVersion._id})`);

  // Try linking invalid changeset (should be rejected with 400)
  console.log('    a) Testing linking non-existent changeset 999999 (must fail)...');
  const invalidVerLink = await request(`/projects/${testProject._id}/versions/${testVersion._id}/link-uvcs`, {
    method: 'PUT',
    headers: authHeaders,
    body: { changesetId: 999999, branch: '/main', repository: 'default@local' }
  });
  if (invalidVerLink.status === 400) {
    console.log(`       ✅ Correctly rejected invalid changeset with 400: "${invalidVerLink.data?.message}"`);
  } else {
    throw new Error(`Expected 400 for invalid changeset, got ${invalidVerLink.status}: ${JSON.stringify(invalidVerLink.data)}`);
  }

  // Link valid changeset 0
  console.log('    b) Testing linking REAL changeset 0 baseline...');
  const validVerLink = await request(`/projects/${testProject._id}/versions/${testVersion._id}/link-uvcs`, {
    method: 'PUT',
    headers: authHeaders,
    body: { changesetId: 0, branch: '/main', repository: 'default@local' }
  });
  if (validVerLink.status === 200 && validVerLink.data?.version?.uvcs?.changesetId === 0) {
    console.log(`       ✅ Successfully linked UVCS cs:0 to Version v${testVersion.versionNumber}`);
    console.log(`          Stored baseline: cs:${validVerLink.data.version.uvcs.changesetId}@${validVerLink.data.version.uvcs.branch} (${validVerLink.data.version.uvcs.repository})`);
  } else {
    throw new Error(`Failed to link valid changeset: ${JSON.stringify(validVerLink.data)}`);
  }

  // 11. Traceability: Link UVCS to Release
  console.log('\n11. Testing Release UVCS Baseline Linking...');
  const releasesRes = await request(`/projects/${testProject._id}/releases`, { headers: authHeaders });
  if (releasesRes.data?.releases?.length > 0) {
    testRelease = releasesRes.data.releases[0];
  } else {
    const newRelRes = await request(`/projects/${testProject._id}/releases`, {
      method: 'POST',
      headers: authHeaders,
      body: {
        version: testVersion._id,
        releaseName: 'Production Baseline Release',
        description: 'First production release'
      }
    });
    testRelease = newRelRes.data.release;
  }
  console.log(`    Target Release: ${testRelease.releaseName} (${testRelease._id})`);

  // Try linking invalid changeset (should be rejected with 400)
  console.log('    a) Testing linking non-existent changeset 888888 (must fail)...');
  const invalidRelLink = await request(`/projects/${testProject._id}/releases/${testRelease._id}/link-uvcs`, {
    method: 'PUT',
    headers: authHeaders,
    body: { changesetId: 888888, branch: '/main', repository: 'default@local' }
  });
  if (invalidRelLink.status === 400) {
    console.log(`       ✅ Correctly rejected invalid changeset with 400: "${invalidRelLink.data?.message}"`);
  } else {
    throw new Error(`Expected 400 for invalid changeset, got ${invalidRelLink.status}: ${JSON.stringify(invalidRelLink.data)}`);
  }

  // Link valid changeset 0
  console.log('    b) Testing linking REAL changeset 0 baseline...');
  const validRelLink = await request(`/projects/${testProject._id}/releases/${testRelease._id}/link-uvcs`, {
    method: 'PUT',
    headers: authHeaders,
    body: { changesetId: 0, branch: '/main', repository: 'default@local' }
  });
  if (validRelLink.status === 200 && validRelLink.data?.release?.uvcs?.changesetId === 0) {
    console.log(`       ✅ Successfully linked UVCS cs:0 to Release "${testRelease.releaseName}"`);
    console.log(`          Stored baseline: cs:${validRelLink.data.release.uvcs.changesetId}@${validRelLink.data.release.uvcs.branch} (${validRelLink.data.release.uvcs.repository})\n`);
  } else {
    throw new Error(`Failed to link valid changeset: ${JSON.stringify(validRelLink.data)}`);
  }

  console.log('====================================================');
  console.log('🎉 ALL PHASE 10 BACKEND UVCS TESTS PASSED 100%!');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
