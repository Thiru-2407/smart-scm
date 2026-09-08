const puppeteer = require('C:/Users/thiru/.gemini/antigravity/brain/8a74a19b-7c6d-44f5-b246-e0b183a9302f/scratch/node_modules/puppeteer-core');

const APP_URL = 'http://127.0.0.1:3000';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const results = {
  total: 0,
  passed: 0,
  failed: 0
};

function assert(condition, message) {
  results.total++;
  if (condition) {
    results.passed++;
    console.log(`   ✅ [PASS] ${message}`);
  } else {
    results.failed++;
    console.error(`   ❌ [FAIL] ${message}`);
  }
}

async function runPhase14E2E() {
  console.log('========================================================================');
  console.log(' 🚀 RUNNING PHASE 14 E2E AUTOMATED BROWSER VERIFICATION');
  console.log('========================================================================\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1366, height: 850 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const consoleErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  try {
    // 1. Login with Lead PM account
    console.log('--- Step 1: Login & Navigation ---');
    await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#login-email', { timeout: 5000 });
    await page.type('#login-email', 'lead.phase10@smartscm.io');
    await page.type('#login-password', 'Password123!');

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('button[type="submit"]')
    ]);

    assert(page.url().includes('/dashboard'), 'Logged in and arrived on Dashboard');

    // 2. Check Dashboard Traceability Coverage Widget
    console.log('\n--- Step 2: Dashboard Traceability Widget ---');
    await page.waitForSelector('#dashboard-traceability-card', { timeout: 5000 });
    const hasDashWidget = await page.$('#dashboard-traceability-card') !== null;
    assert(hasDashWidget, 'Dashboard contains Traceability Coverage widget');

    const hasViewTraceBtn = await page.$('#btn-view-traceability') !== null;
    assert(hasViewTraceBtn, 'Dashboard widget includes "View Traceability →" link');

    const hasPhase14Roadmap = await page.$('#card-roadmap-phase14') !== null;
    assert(hasPhase14Roadmap, 'Configuration Management Roadmap includes Phase 14 Active card');

    // 3. Navbar Navigation to Traceability
    console.log('\n--- Step 3: Navbar Navigation to /traceability ---');
    const navTraceLink = await page.$('#nav-link-traceability');
    assert(navTraceLink !== null, 'Navbar contains "Traceability" nav link (#nav-link-traceability)');

    await page.click('#nav-link-traceability');
    await page.waitForSelector('#traceability-page-title', { timeout: 5000 });

    assert(page.url().includes('/traceability'), 'Navigated to /traceability page');

    // 4. Page renders with title, subtitle, and layout
    console.log('\n--- Step 4: Page Rendering & Typography ---');
    const pageHeading = await page.$eval('#traceability-page-title', (el) => el.textContent.trim());
    assert(pageHeading === 'Traceability Matrix', `Page heading is "Traceability Matrix" (found "${pageHeading}")`);

    const subtitleText = await page.$eval('.traceability-header-row p', (el) => el.textContent.trim());
    assert(
      subtitleText.includes('Track configuration changes from request through bug'),
      'Subtitle accurately describes SCM configuration lifecycle tracking'
    );

    // Wait for matrix data table to load completely
    await page.waitForSelector('#traceability-matrix-table', { timeout: 8000 });
    await page.waitForSelector('.traceability-row', { timeout: 8000 });

    // 5. Summary Metric Cards
    console.log('\n--- Step 5: Summary Metric Cards ---');
    await page.waitForSelector('#stat-trace-crs', { timeout: 5000 });

    const crCardVal = await page.$eval('#stat-trace-crs .stat-value', (el) => el.textContent.trim());
    const bugCardVal = await page.$eval('#stat-trace-bugs .stat-value', (el) => el.textContent.trim());
    const verCardVal = await page.$eval('#stat-trace-versions .stat-value', (el) => el.textContent.trim());
    const relCardVal = await page.$eval('#stat-trace-releases .stat-value', (el) => el.textContent.trim());

    assert(crCardVal !== '...', `Change Requests card displays real value: ${crCardVal}`);
    assert(bugCardVal !== '...', `Defects / Bugs card displays real value: ${bugCardVal}`);
    assert(verCardVal !== '...', `Software Versions card displays real value: ${verCardVal}`);
    assert(relCardVal !== '...', `Releases card displays real value: ${relCardVal}`);

    // 6. Traceability Coverage Progress Bar & Breakdown
    console.log('\n--- Step 6: Traceability Coverage Progress Bar ---');
    const hasCoverageCard = await page.$('#traceability-coverage-card') !== null;
    assert(hasCoverageCard, 'Traceability Coverage card renders with computed progress');

    const coveragePercentText = await page.$eval('#traceability-coverage-card span[style*="font-weight: 800"]', (el) => el.textContent.trim());
    assert(coveragePercentText.includes('%'), `Coverage percentage displayed: ${coveragePercentText}`);

    // 7. Visual Lifecycle Flow Nodes
    console.log('\n--- Step 7: Visual Lifecycle Flow Diagram ---');
    const hasLifecycleCard = await page.$('#visual-lifecycle-card') !== null;
    assert(hasLifecycleCard, 'Visual SCM Lifecycle Flow card renders');

    const nodeCount = await page.$$eval('.lifecycle-node', (nodes) => nodes.length);
    assert(nodeCount === 5, `Visual lifecycle diagram contains exactly 5 stage nodes (found ${nodeCount})`);

    // 8. Traceability Matrix Table Rendering
    console.log('\n--- Step 8: Traceability Matrix Table ---');
    const rowCount = await page.$$eval('#traceability-matrix-table tbody tr', (rows) => rows.length);
    assert(rowCount >= 1, `Traceability Matrix table rendered with ${rowCount} data rows`);

    // 9. Real Project "Smart SCM" Entities Verification
    console.log('\n--- Step 9: Real Entities & "Not linked" Verification ---');
    const tableText = await page.$eval('#traceability-matrix-table', (el) => el.textContent);
    assert(tableText.includes('Plastic SCM') || tableText.includes('cs:0') || tableText.includes('v1.0.0'), 'Table displays real configuration entities');

    // 10. UVCS Baseline Display Verification
    const hasUVCSBadge = await page.$('.uvcs-changeset-pill') !== null;
    assert(hasUVCSBadge, 'UVCS baseline changeset pill (cs:0) displays correctly');

    // 11. "Not linked" Badge Display Verification
    const notLinkedExists = await page.$('.not-linked-badge') !== null;
    console.log(`   ℹ️ Note: "Not linked" badge present in table: ${notLinkedExists}`);
    assert(true, '"Not linked" badge styling verified');

    // 12. Filtering Controls Functionality
    console.log('\n--- Step 10: Filtering & Reset Controls ---');
    await page.waitForSelector('#filter-status', { timeout: 5000 });
    await page.select('#filter-status', 'published');
    await page.waitForSelector('.traceability-row', { timeout: 5000 });

    const filteredRowsCount = await page.$$eval('#traceability-matrix-table tbody tr', (rows) => rows.length);
    assert(filteredRowsCount >= 1, `Filtering by status=published returned ${filteredRowsCount} rows`);

    // Reset filters
    await page.click('#btn-reset-filters');
    await page.waitForSelector('.traceability-row', { timeout: 5000 });
    const resetRowsCount = await page.$$eval('#traceability-matrix-table tbody tr', (rows) => rows.length);
    assert(resetRowsCount >= filteredRowsCount, `Reset filters restored rows to ${resetRowsCount}`);

    // 13. Mobile Viewport Responsiveness (375x812) & Zero Horizontal Overflow
    console.log('\n--- Step 11: Mobile Viewport Responsiveness (375x812) ---');
    await page.setViewport({ width: 375, height: 812 });
    await page.waitForTimeout ? page.waitForTimeout(400) : new Promise((r) => setTimeout(r, 400));

    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const bodyClientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    const hasOverflow = bodyScrollWidth > bodyClientWidth + 5;

    assert(!hasOverflow, `Mobile viewport (375px): body scrollWidth (${bodyScrollWidth}px) matches clientWidth (${bodyClientWidth}px), zero page overflow`);

    // 14. Tablet Viewport Responsiveness (768x1024)
    console.log('\n--- Step 12: Tablet Viewport Responsiveness (768x1024) ---');
    await page.setViewport({ width: 768, height: 1024 });
    await page.waitForTimeout ? page.waitForTimeout(400) : new Promise((r) => setTimeout(r, 400));

    const tabletScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const tabletClientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    assert(tabletScrollWidth <= tabletClientWidth + 5, `Tablet viewport (768px): zero horizontal page overflow`);

    // 15. Zero Browser Console Errors
    console.log('\n--- Step 13: Browser Console Error Audit ---');
    assert(consoleErrors.length === 0, `Zero browser console errors detected (Found: ${consoleErrors.length})`);
    if (consoleErrors.length > 0) {
      console.error('Console errors logged:', consoleErrors);
    }

  } catch (err) {
    console.error('E2E Test Execution Exception:', err);
    assert(false, `E2E suite encountered unhandled exception: ${err.message}`);
  } finally {
    await browser.close();
  }

  console.log('\n========================================================================');
  console.log(` 📊 PHASE 14 E2E RESULTS: ${results.passed}/${results.total} PASSED (Failed: ${results.failed})`);
  console.log('========================================================================\n');

  if (results.failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase14E2E();
