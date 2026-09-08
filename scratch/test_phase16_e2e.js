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

async function runPhase16E2E() {
  console.log('========================================================================');
  console.log(' 🚀 RUNNING PHASE 16 RELEASE READINESS & GOVERNANCE E2E VERIFICATION');
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
      if (!text.includes('favicon.ico')) {
        consoleErrors.push(text);
      }
    }
  });

  try {
    // 1. Authentication
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

    // 2. Dashboard Widgets & Roadmap
    console.log('\n--- Step 2: Dashboard Widgets & Roadmap Integration ---');
    await page.waitForSelector('#dashboard-readiness-card', { timeout: 5000 });
    const hasDashWidget = (await page.$('#dashboard-readiness-card')) !== null;
    assert(hasDashWidget, '2. Dashboard contains Release Readiness & Governance widget (#dashboard-readiness-card)');

    const hasCheckReadinessBtn = (await page.$('#btn-check-readiness')) !== null;
    assert(hasCheckReadinessBtn, '3. Dashboard contains "#btn-check-readiness" CTA');

    const hasPhase16Roadmap = (await page.$('#card-roadmap-phase16')) !== null;
    assert(hasPhase16Roadmap, '4. Configuration Management Roadmap includes Phase 16 Active card (#card-roadmap-phase16)');

    // 3. Navigation from Dashboard CTA
    console.log('\n--- Step 3: Navigation to Release Readiness ---');
    await page.click('#btn-check-readiness');
    await page.waitForSelector('#readiness-page-title', { timeout: 6000 });
    assert(page.url().includes('/release-readiness'), '5. Dashboard widget successfully navigates to /release-readiness');

    // 4. Navbar Link
    console.log('\n--- Step 4: Navbar Navigation Item ---');
    const navLink = await page.$('#nav-link-readiness');
    assert(navLink !== null, '6. Navbar contains "#nav-link-readiness" link');

    const navClasses = await page.$eval('#nav-link-readiness', (el) => el.className);
    assert(navClasses.includes('active'), '7. "#nav-link-readiness" has active styling class');

    // 5. Header and Informational Banner
    console.log('\n--- Step 5: Page Header & Informational Context ---');
    const pageTitle = await page.$eval('#readiness-page-title', (el) => el.textContent.trim());
    assert(pageTitle.includes('Release Readiness & Governance'), '8. Page title matches SCM Release Readiness & Governance');

    const hasInfoCard = (await page.$('#readiness-info-card')) !== null;
    assert(hasInfoCard, '9. SCM Configuration Readiness informational banner is visible');

    // 6. Selector Controls
    console.log('\n--- Step 6: Release Selector Controls ---');
    await page.waitForSelector('#select-readiness-release', { timeout: 5000 });
    await page.waitForFunction(
      () => document.querySelectorAll('#select-readiness-release option').length > 1,
      { timeout: 8000 }
    );
    const releaseOptions = await page.$$eval('#select-readiness-release option', (opts) =>
      opts.map((o) => ({ value: o.value, text: o.textContent.trim() }))
    );
    assert(releaseOptions.length > 1, `10. Release selector populated with ${releaseOptions.length - 1} releases`);

    // Pick first non-empty release
    const validRel = releaseOptions.find((o) => o.value !== '');
    if (validRel) {
      await page.select('#select-readiness-release', validRel.value);
    }

    // 7. Score Card & Level Badge
    console.log('\n--- Step 7: Readiness Score Card & Classification ---');
    await page.waitForSelector('#readiness-score-card', { timeout: 5000 });
    const scoreVal = await page.$eval('#readiness-score-value', (el) => el.textContent.trim());
    assert(scoreVal.includes('/ 100'), `11. Readiness score rendered: ${scoreVal}`);

    const levelBadge = await page.$eval('#readiness-level-badge', (el) => ({
      text: el.textContent.trim(),
      className: el.className
    }));
    const hasValidLevel =
      levelBadge.className.includes('level-ready') ||
      levelBadge.className.includes('level-conditional') ||
      levelBadge.className.includes('level-not-ready');
    assert(hasValidLevel, `12. Readiness level pill styled correctly: ${levelBadge.text}`);

    const summaryCounts = await page.$eval('#readiness-summary-counts', (el) => el.textContent);
    assert(
      summaryCounts.includes('Passed') && summaryCounts.includes('Warnings'),
      `13. Summary count badges rendered: ${summaryCounts.replace(/\s+/g, ' ').trim()}`
    );

    // 8. Blocking Conditions Callout
    console.log('\n--- Step 8: Blocking Conditions Callout ---');
    const hasBlockersSection = (await page.$('#readiness-blockers-section')) !== null;
    assert(hasBlockersSection, '14. Blocking conditions section rendered (#readiness-blockers-section)');

    // 9. Governance Pipeline Visual Flow
    console.log('\n--- Step 9: Governance Pipeline Visual Flow ---');
    await page.waitForSelector('#governance-pipeline', { timeout: 5000 });
    const stages = await page.$$eval('.pipeline-stage-box', (boxes) =>
      boxes.map((b) => b.textContent.replace(/\s+/g, ' ').trim())
    );
    assert(stages.length === 7, `15. Governance pipeline renders all 7 stages (found: ${stages.length})`);

    // 10. Quality Metrics Summary
    console.log('\n--- Step 10: Quality Metrics Summary ---');
    const openBugs = await page.$eval('#metric-open-bugs', (el) => el.textContent.trim());
    const critBugs = await page.$eval('#metric-crit-bugs', (el) => el.textContent.trim());
    const highBugs = await page.$eval('#metric-high-bugs', (el) => el.textContent.trim());
    const pendingCRs = await page.$eval('#metric-pending-crs', (el) => el.textContent.trim());
    const traceGaps = await page.$eval('#metric-trace-gaps', (el) => el.textContent.trim());
    const uvcsStatus = await page.$eval('#metric-uvcs-status', (el) => el.textContent.trim());

    assert(
      openBugs !== '' && critBugs !== '' && highBugs !== '' && pendingCRs !== '' && traceGaps !== '' && uvcsStatus !== '',
      `16. All 6 quality metric cards populated (Bugs: ${openBugs}, Crit: ${critBugs}, UVCS: ${uvcsStatus})`
    );

    // 11. SCM Governance Checklist Table
    console.log('\n--- Step 11: SCM Governance Checklist Table ---');
    await page.waitForSelector('#readiness-checklist-table', { timeout: 5000 });
    const checkRows = await page.$$eval('#readiness-checklist-table tbody tr', (rows) =>
      rows.map((r) => r.cells[1]?.querySelector('strong')?.textContent.trim())
    );
    assert(checkRows.length === 8, `17. Checklist table displays all 8 governance checks (found: ${checkRows.length})`);

    // 12. Release Metadata & Cross-SCM Navigation
    console.log('\n--- Step 12: Release Metadata & Cross Navigation ---');
    const hasReleaseDetails = (await page.$('#readiness-release-details')) !== null;
    assert(hasReleaseDetails, '18. Release metadata details card rendered (#readiness-release-details)');

    const hasNavTrace = (await page.$('#btn-nav-traceability')) !== null;
    assert(hasNavTrace, '19. Traceability cross-navigation button present (#btn-nav-traceability)');

    // 13. Deep linking to Traceability
    console.log('\n--- Step 13: Cross Navigation into Traceability ---');
    await page.click('#btn-nav-traceability');
    await page.waitForSelector('#traceability-page-title', { timeout: 6000 });
    assert(page.url().includes('/traceability'), '20. Successfully navigated to /traceability from Release Readiness');

    // 14. Deep linking from Release Details back to Readiness
    console.log('\n--- Step 14: Navigation from Release Details Hub ---');
    await page.goto(`${APP_URL}/release-readiness`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#btn-nav-release-details', { timeout: 5000 });
    await page.click('#btn-nav-release-details');
    await page.waitForSelector('#btn-release-readiness-link', { timeout: 6000 });
    assert(page.url().includes('/releases/'), '21. Arrived on Release Details page with "#btn-release-readiness-link"');

    await page.click('#btn-release-readiness-link');
    await page.waitForSelector('#readiness-page-title', { timeout: 6000 });
    assert(page.url().includes('/release-readiness?release='), '22. Deep link back to /release-readiness preserves release parameter');

    // 15. Responsive Mobile Viewport
    console.log('\n--- Step 15: Responsive Mobile Viewport ---');
    await page.setViewport({ width: 375, height: 667 });
    await page.waitForSelector('#readiness-score-value', { timeout: 8000 });
    const mobileScoreVisible = await page.$eval('#readiness-score-value', (el) => el.offsetWidth > 0);
    assert(mobileScoreVisible, '23. Mobile viewport (375px) renders readiness score correctly without layout collapse');

    // 16. Console Error Audit
    console.log('\n--- Step 16: Console Errors Audit ---');
    assert(consoleErrors.length === 0, `24. Zero uncaught console errors detected (errors: ${consoleErrors.length})`);
    if (consoleErrors.length > 0) {
      console.error('Console errors logged:', consoleErrors);
    }
  } catch (err) {
    console.error('Test execution exception:', err);
    assert(false, `Unexpected exception: ${err.message}`);
  } finally {
    await browser.close();
  }

  console.log('\n========================================================================');
  console.log(` 📊 PHASE 16 E2E RESULTS: ${results.passed}/${results.total} PASSED (${Math.round((results.passed / results.total) * 100)}%)`);
  console.log('========================================================================\n');

  if (results.failed > 0) {
    process.exit(1);
  }
}

runPhase16E2E();
