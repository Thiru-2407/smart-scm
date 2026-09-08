const puppeteer = require('C:/Users/thiru/.gemini/antigravity/brain/8a74a19b-7c6d-44f5-b246-e0b183a9302f/scratch/node_modules/puppeteer-core');

const APP_URL = 'http://127.0.0.1:3000';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const testUser = {
  email: 'lead.phase10@smartscm.io',
  password: 'Password123!'
};

async function runE2E() {
  console.log('========================================================================');
  console.log(' 🚀 RUNNING PHASE 10 E2E AUTOMATED BROWSER VERIFICATION');
  console.log('========================================================================\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1366, height: 850 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    // 1. Visit Login Page
    console.log('1. Navigating to Login page...');
    await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle0' });
    console.log('   ✅ Login page rendered successfully');

    // 2. Perform Login
    console.log('2. Entering credentials for Lead PM...');
    await page.waitForSelector('#login-email', { timeout: 5000 });
    await page.type('#login-email', testUser.email);
    await page.type('#login-password', testUser.password);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('button[type="submit"]')
    ]);
    console.log('   ✅ Authenticated and navigated to:', page.url());

    // 3. Verify Navbar has "Version Control" link
    console.log('3. Checking "Version Control" navigation item in Navbar...');
    await page.waitForSelector('#nav-link-uvcs', { timeout: 10000 });
    const uvcsNavLink = await page.$('#nav-link-uvcs');
    if (!uvcsNavLink) {
      throw new Error('Version Control link (#nav-link-uvcs) was not found in the Navbar');
    }
    const navText = await page.evaluate(el => el.textContent, uvcsNavLink);
    console.log(`   ✅ Found Navbar item: "${navText.trim()}"`);

    // 4. Click "Version Control" and navigate to /uvcs
    console.log('4. Navigating to /uvcs via Navbar click...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      uvcsNavLink.click()
    ]);
    console.log('   ✅ Arrived at URL:', page.url());

    // 5. Verify UVCS Dashboard Elements
    console.log('5. Verifying UVCS Dashboard live data from real Unity Version Control...');
    await page.waitForSelector('#card-uvcs-status', { timeout: 10000 });
    await page.waitForSelector('#card-uvcs-repo', { timeout: 10000 });
    await page.waitForSelector('#card-uvcs-workspace', { timeout: 10000 });

    const cliVersion = await page.$eval('#uvcs-cli-version', el => el.textContent.trim());
    const workspaceName = await page.$eval('#uvcs-workspace-name', el => el.textContent.trim());
    const currentBranch = await page.$eval('#uvcs-current-branch', el => el.textContent.trim());
    const headChangeset = await page.$eval('#uvcs-head-changeset', el => el.textContent.trim());

    console.log(`      * CLI Version: ${cliVersion}`);
    console.log(`      * Workspace: ${workspaceName}`);
    console.log(`      * Branch: ${currentBranch}`);
    console.log(`      * Head Changeset: ${headChangeset}`);

    if (!cliVersion.includes('11.0')) throw new Error(`Unexpected CLI version: ${cliVersion}`);
    if (workspaceName !== 'smart_scm_wk') throw new Error(`Unexpected workspace: ${workspaceName}`);
    if (currentBranch !== '/main') throw new Error(`Unexpected branch: ${currentBranch}`);
    if (!headChangeset.includes('cs:0')) throw new Error(`Unexpected head changeset: ${headChangeset}`);
    console.log('   ✅ Real UVCS environment connection details confirmed');

    // 6. Check Branches Table
    console.log('6. Verifying Repository Branches Table...');
    await page.waitForSelector('#branches-table tbody tr');
    const branchRows = await page.$$eval('#branches-table tbody tr', rows =>
      rows.map(r => r.textContent.trim())
    );
    console.log(`   ✅ Found ${branchRows.length} branch rows. First row summary: ${branchRows[0]?.split('\n')[0]}`);
    const hasMainBranch = branchRows.some(r => r.includes('/main'));
    if (!hasMainBranch) throw new Error('Repository branches table does not list /main');

    // 7. Check Changesets Table
    console.log('7. Verifying Changeset History Table...');
    await page.waitForSelector('#changesets-table tbody tr');
    const csRows = await page.$$eval('#changesets-table tbody tr', rows =>
      rows.map(r => r.textContent.trim())
    );
    console.log(`   ✅ Found ${csRows.length} changeset rows. First row: ${csRows[0]?.split('\n')[0]}`);
    const hasCs0 = csRows.some(r => r.includes('cs:0'));
    if (!hasCs0) throw new Error('Changeset table does not list cs:0');

    // 8. Open Changeset Details Modal
    console.log('8. Testing Changeset Details modal for cs:0...');
    const viewBtn = await page.$('#btn-view-cs-0');
    if (!viewBtn) throw new Error('Button #btn-view-cs-0 was not found');
    await viewBtn.click();
    await page.waitForSelector('#changeset-modal', { timeout: 5000 });
    const modalTitle = await page.$eval('#changeset-modal h3', el => el.textContent.trim());
    console.log(`   ✅ Opened Changeset Modal: "${modalTitle}"`);
    await page.click('#btn-close-cs-modal');
    await page.waitForSelector('#changeset-modal', { hidden: true });
    console.log('   ✅ Closed Changeset Modal successfully');

    // 9. Navigate to Projects to verify Version baseline linking
    console.log('9. Navigating to Projects to test entity baseline linking...');
    await page.goto(`${APP_URL}/projects`, { waitUntil: 'networkidle0' });

    // Click on the project
    await page.waitForSelector('.project-title-link', { timeout: 10000 });
    const firstProjLink = await page.$('.project-title-link');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      firstProjLink.click()
    ]);
    console.log('   ✅ On Project Details page:', page.url());

    // Click on the first Version in this project
    console.log('10. Navigating to Version Details...');
    await page.waitForSelector('.version-title-link', { timeout: 10000 });
    const versionLink = await page.$('.version-title-link');
    if (!versionLink) throw new Error('No version link (.version-title-link) found in project');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      versionLink.click()
    ]);
    console.log('   ✅ On Version Details page:', page.url());

    // 11. Check Unity VCS Baseline Card and Modal on Version
    console.log('11. Testing Unity VCS Baseline Card & Modal on Version Details...');
    await page.waitForSelector('#card-version-uvcs-baseline', { timeout: 10000 });
    console.log('   ✅ Found Unity VCS Baseline card on Version Details');

    // Open link modal
    await page.waitForSelector('#btn-open-link-version-uvcs, #btn-change-version-uvcs', { timeout: 5000 });
    const openVerLinkBtn = await page.$('#btn-open-link-version-uvcs, #btn-change-version-uvcs');
    if (!openVerLinkBtn) throw new Error('Could not find button to open Version UVCS modal');
    await openVerLinkBtn.click();
    await page.waitForSelector('#modal-link-uvcs', { timeout: 5000 });
    console.log('   ✅ Opened Link UVCS Baseline Modal on Version Details');

    // Select changeset 0 and submit
    await page.waitForSelector('#select-changeset option', { timeout: 5000 });
    await page.select('#select-changeset', '0');
    await page.click('#btn-submit-link-uvcs');

    // Wait for modal to close and badge to update
    await page.waitForSelector('#modal-link-uvcs', { hidden: true });
    await page.waitForSelector('#badge-uvcs-linked', { timeout: 10000 });
    const verCsText = await page.$eval('#version-uvcs-changeset', el => el.textContent.trim());
    console.log(`   ✅ Version successfully linked to: ${verCsText}`);

    // 12. Verify Student Footer on /uvcs
    console.log('12. Verifying Student Attribution Footer...');
    await page.goto(`${APP_URL}/uvcs`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.app-footer');
    const footerText = await page.$eval('.app-footer', el => el.textContent);
    if (!footerText.includes('Thirukumaran K — 24MIS0471') ||
        !footerText.includes('Keerthivarman G — 24MIS0456') ||
        !footerText.includes('Azhagiri C — 24MIS0540')) {
      throw new Error('Footer missing required student details');
    }
    console.log('   ✅ Student Attribution Footer verified on /uvcs');

    console.log('\n========================================================================');
    console.log(' 🎉 ALL PHASE 10 END-TO-END BROWSER TESTS PASSED 100%!');
    console.log('========================================================================\n');
  } catch (err) {
    console.error('\n❌ E2E TEST RUN FAILED:', err);
    throw err;
  } finally {
    await browser.close();
  }
}

runE2E().catch(err => {
  process.exit(1);
});
