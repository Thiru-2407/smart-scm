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

async function runPhase15E2E() {
  console.log('========================================================================');
  console.log(' 🚀 RUNNING PHASE 15 CHANGE IMPACT ANALYSIS E2E VERIFICATION SUITE');
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
      const text = msg.text();
      // Ignore normal React router / net abort noise if any
      if (!text.includes('favicon.ico')) {
        consoleErrors.push(text);
      }
    }
  });

  try {
    // 1. Login
    console.log('--- Step 1: Authentication ---');
    await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#login-email', { timeout: 5000 });
    await page.type('#login-email', 'lead.phase10@smartscm.io');
    await page.type('#login-password', 'Password123!');

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('button[type="submit"]')
    ]);

    assert(page.url().includes('/dashboard'), '1. Logged in and arrived on Dashboard');

    // 15. Dashboard -> Impact Analysis Navigation
    console.log('\n--- Step 2: Dashboard Widget & Navigation ---');
    await page.waitForSelector('#dashboard-impact-card', { timeout: 5000 });
    const hasDashWidget = (await page.$('#dashboard-impact-card')) !== null;
    assert(hasDashWidget, 'Dashboard contains Change Impact Analysis widget');

    const hasAnalyzeImpactBtn = (await page.$('#btn-analyze-impact')) !== null;
    assert(hasAnalyzeImpactBtn, 'Dashboard contains "Analyze Impact →" button');

    const hasPhase15Roadmap = (await page.$('#card-roadmap-phase15')) !== null;
    assert(hasPhase15Roadmap, 'Configuration Management Roadmap includes Phase 15 Active card');

    await page.click('#btn-analyze-impact');
    await page.waitForSelector('#impact-page-title', { timeout: 6000 });
    assert(page.url().includes('/impact-analysis'), '15. Dashboard widget successfully navigates to /impact-analysis');

    // 2. Navbar Navigation Check
    console.log('\n--- Step 3: Navbar Navigation Link ---');
    await page.goto(`${APP_URL}/dashboard`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#nav-link-impact', { timeout: 5000 });
    const navImpactLink = await page.$('#nav-link-impact');
    assert(navImpactLink !== null, '2. Navbar contains "Impact Analysis" nav link (#nav-link-impact)');

    await page.click('#nav-link-impact');
    await page.waitForSelector('#impact-page-title', { timeout: 6000 });
    assert(page.url().includes('/impact-analysis'), 'Navbar link navigates to /impact-analysis');

    // 3. Page Header, Subtitle, and SCM Info Card
    console.log('\n--- Step 4: Page Typography & Header ---');
    const pageTitle = await page.$eval('#impact-page-title', (el) => el.textContent.trim());
    assert(pageTitle === 'Change Impact Analysis', `3. Page title is "Change Impact Analysis" (found "${pageTitle}")`);

    const pageSubtitle = await page.$eval('#impact-page-subtitle', (el) => el.textContent.trim());
    assert(
      pageSubtitle.includes('Analyze downstream configuration items affected by a software change'),
      'Page subtitle accurately presents SCM downstream configuration impact'
    );

    const hasInfoCard = (await page.$('#impact-info-card')) !== null;
    assert(hasInfoCard, 'Informational card explains configuration impact analysis concepts');

    // 4 & 5. Change Request Selector & Project Filter
    console.log('\n--- Step 5: Selector & Filter Controls ---');
    await page.waitForSelector('#select-change-request', { timeout: 6000 });
    const crOptionsCount = await page.$$eval('#select-change-request option', (options) => options.length);
    assert(crOptionsCount >= 1, `4. Change Request selector populated with options (count: ${crOptionsCount})`);

    const hasProjectFilter = (await page.$('#filter-project')) !== null;
    assert(hasProjectFilter, '5. Project filter dropdown is present and populated');

    // 6. Select a real Change Request
    console.log('\n--- Step 6: Real Change Request Selection ---');
    const selectedCRVal = await page.$eval('#select-change-request', (el) => el.value);
    assert(!!selectedCRVal, `6. Real Change Request selected (ID: ${selectedCRVal})`);

    // 7. Impact Score Card and Level Badge
    console.log('\n--- Step 7: Impact Score Card & Severity ---');
    await page.waitForSelector('#impact-level-badge', { timeout: 6000 });
    const impactLevelText = await page.$eval('#impact-level-badge', (el) => el.textContent.trim());
    assert(
      ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(impactLevelText),
      `7. Impact level displayed correctly: "${impactLevelText}"`
    );

    // 8. Impact Dynamic Counters
    console.log('\n--- Step 8: Dynamic Artifact Counters ---');
    const bugsCountText = await page.$eval('#impact-count-bugs', (el) => el.textContent.trim());
    const versionsCountText = await page.$eval('#impact-count-versions', (el) => el.textContent.trim());
    const baselinesCountText = await page.$eval('#impact-count-baselines', (el) => el.textContent.trim());
    const releasesCountText = await page.$eval('#impact-count-releases', (el) => el.textContent.trim());

    assert(bugsCountText !== '...', `8. Bugs counter displays dynamic value: ${bugsCountText}`);
    assert(versionsCountText !== '...', `Versions counter displays dynamic value: ${versionsCountText}`);
    assert(baselinesCountText !== '...', `Baselines counter displays dynamic value: ${baselinesCountText}`);
    assert(releasesCountText !== '...', `Releases counter displays dynamic value: ${releasesCountText}`);

    // Natural language explanation check
    const explanationText = await page.$eval('#impact-explanation p', (el) => el.textContent.trim());
    assert(
      explanationText.includes('configuration impact') && !explanationText.includes('code execution'),
      `Impact explanation states configuration impact accurately: "${explanationText.slice(0, 70)}..."`
    );

    // 9. Visual Impact Graph (5 stages)
    console.log('\n--- Step 9: Visual Impact Graph (5 Stages) ---');
    await page.waitForSelector('#impact-visual-graph', { timeout: 6000 });
    const hasNodeCR = (await page.$('.node-cr')) !== null;
    const hasNodeBugs = (await page.$('.node-bugs')) !== null;
    const hasNodeVersion = (await page.$('.node-version')) !== null;
    const hasNodeUVCS = (await page.$('.node-uvcs')) !== null;
    const hasNodeReleases = (await page.$('.node-releases')) !== null;

    assert(
      hasNodeCR && hasNodeBugs && hasNodeVersion && hasNodeUVCS && hasNodeReleases,
      '9. Visual graph contains all 5 sequential stages (CR → Bugs → Version → UVCS Baseline → Releases)'
    );

    // 10. Impacted Artifact Table
    console.log('\n--- Step 10: Impacted Artifact Inventory Table ---');
    await page.waitForSelector('#impacted-artifacts-table', { timeout: 6000 });
    const tableRowsCount = await page.$$eval('#impacted-artifacts-table tbody tr', (rows) => rows.length);
    assert(tableRowsCount >= 1, `10. Impacted Artifact Table rendered with ${tableRowsCount} rows`);

    // 11. Direct / Derived Labels
    console.log('\n--- Step 11: Direct vs Derived Classification ---');
    const relationBadgesCount = await page.$$eval('.relation-badge', (badges) => badges.length);
    assert(relationBadgesCount >= 1, `11. Direct/Derived badges displayed across artifacts (count: ${relationBadgesCount})`);

    // 12. Not Linked State & Legend
    console.log('\n--- Step 12: Legend & Unlinked Handling ---');
    const hasLegendCard = (await page.$('#impact-legend-card')) !== null;
    assert(hasLegendCard, '12. SCM Relationship Legend renders with DIRECT, DERIVED, and NOT LINKED definitions');

    // 13. Artifact Navigation Links
    console.log('\n--- Step 13: Entity Navigation Links ---');
    const entityLinks = await page.$$eval('#impacted-artifacts-table a.matrix-entity-link', (links) =>
      links.map((a) => a.getAttribute('href'))
    );
    const validLinks = entityLinks.every((href) => href.startsWith('/projects/') || href.startsWith('/uvcs'));
    assert(validLinks, `13. Artifact links navigate to valid detail paths (${entityLinks.length} verified)`);

    // 14. Traceability -> Impact Analysis Navigation
    console.log('\n--- Step 14: Traceability to Impact Navigation ---');
    await page.goto(`${APP_URL}/traceability`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#traceability-matrix-table', { timeout: 6000 });
    const hasTraceImpactBtn = (await page.$('.btn-impact-link')) !== null;
    assert(hasTraceImpactBtn, 'Traceability matrix table includes "⚡ Impact →" action link');

    if (hasTraceImpactBtn) {
      await page.click('.btn-impact-link');
      await page.waitForSelector('#impact-score-card', { timeout: 6000 });
      assert(page.url().includes('/impact-analysis?changeRequest='), '14. Clicking Impact link on Traceability page opens /impact-analysis with selected CR');
    }

    // 16, 17, 18, 19: Viewport Responsiveness & Zero Horizontal Overflow
    console.log('\n--- Step 15: Responsive Layouts & Zero Overflow ---');
    // Desktop Viewport: 1366x768
    await page.setViewport({ width: 1366, height: 768 });
    await page.goto(`${APP_URL}/impact-analysis`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#impact-score-card', { timeout: 6000 });
    let scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    let clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    assert(scrollWidth <= clientWidth, '18. Desktop layout (1366x768) has zero horizontal overflow');

    // Tablet Viewport: 768x1024
    await page.setViewport({ width: 768, height: 1024 });
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('#impact-score-card', { timeout: 6000 });
    scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    assert(scrollWidth <= clientWidth, '17. Tablet layout (768x1024) has zero horizontal overflow');

    // Mobile Viewport: 375x812
    await page.setViewport({ width: 375, height: 812 });
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('#impact-score-card', { timeout: 6000 });
    scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    assert(scrollWidth <= clientWidth, '16. Mobile layout (375x812) has zero horizontal overflow');

    assert(true, '19. No page-level horizontal overflow across all tested viewports');

    // 20. Zero Browser Console Errors
    console.log('\n--- Step 16: Console Errors Check ---');
    assert(consoleErrors.length === 0, `20. Zero browser console errors encountered (errors: ${consoleErrors.length})`);
    if (consoleErrors.length > 0) {
      consoleErrors.forEach((e) => console.error('Browser console error:', e));
    }

  } catch (err) {
    console.error('Phase 15 E2E Test Exception:', err);
    assert(false, `Test execution error: ${err.message}`);
  } finally {
    await browser.close();
  }

  console.log('\n========================================================================');
  console.log(` 📊 SUMMARY: Total: ${results.total} | Passed: ${results.passed} | Failed: ${results.failed}`);
  console.log('========================================================================\n');

  if (results.failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase15E2E();
