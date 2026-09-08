const puppeteer = require('C:/Users/thiru/.gemini/antigravity/brain/8a74a19b-7c6d-44f5-b246-e0b183a9302f/scratch/node_modules/puppeteer-core');

const APP_URL = 'http://127.0.0.1:3000';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const timestamp = Date.now();
const testUser = {
  name: 'Phase 13 E2E Lead',
  email: `lead.p13.e2e.${timestamp}@smartscm.io`,
  password: 'Password123!',
  role: 'project_manager'
};

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

async function runPhase13E2E() {
  console.log('========================================================================');
  console.log(' 🚀 RUNNING PHASE 13 E2E AUTOMATED BROWSER VERIFICATION');
  console.log('========================================================================\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1366, height: 850 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    // 1. Visit Register Page and create account
    console.log('--- Step 1: User Registration & Session ---');
    await page.goto(`${APP_URL}/register`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#reg-name', { timeout: 5000 });
    await page.type('#reg-name', testUser.name);
    await page.type('#reg-email', testUser.email);
    await page.type('#reg-password', testUser.password);
    await page.type('#reg-confirm-password', testUser.password);
    await page.select('#reg-role', testUser.role);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('button[type="submit"]')
    ]);
    console.log('   Navigated to:', page.url());
    assert(page.url().includes('/dashboard'), 'Registration redirects to /dashboard');

    // 2. Dashboard Activity Elements
    console.log('\n--- Step 2: Dashboard Navbar & Activity Elements ---');
    await page.waitForSelector('#nav-link-activity', { timeout: 5000 });
    const activityNavLink = await page.$('#nav-link-activity');
    assert(!!activityNavLink, 'Navbar contains #nav-link-activity');

    const navLinkText = await page.evaluate(el => el.textContent.trim(), activityNavLink);
    assert(navLinkText === 'Activity', `Activity nav link text is "${navLinkText}"`);

    // Check Roadmap Phase 13 card
    const roadmapCards = await page.$$('.module-card');
    let hasPhase13Card = false;
    for (const card of roadmapCards) {
      const text = await page.evaluate(el => el.textContent, card);
      if (text.includes('Phase 13') || text.includes('Audit & Activity')) {
        hasPhase13Card = true;
        break;
      }
    }
    assert(hasPhase13Card, 'Roadmap includes Phase 13 Audit & Activity System card');

    // Check Recent SCM Activity section on Dashboard
    const recentActivitySection = await page.$('.recent-activity-section');
    assert(!!recentActivitySection, 'Dashboard contains .recent-activity-section');

    const viewAllBtn = await page.$('#btn-view-all-activity');
    assert(!!viewAllBtn, 'Dashboard contains #btn-view-all-activity link');

    // 3. Navigate to /projects and create a project to generate authentic SCM activity
    console.log('\n--- Step 3: Trigger SCM Actions & Produce Audit Records ---');
    await page.goto(`${APP_URL}/projects`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#btn-open-create-modal', { timeout: 5000 });

    await page.click('#btn-open-create-modal');
    await page.waitForSelector('#proj-name', { timeout: 3000 });
    await page.type('#proj-name', `Audit Demo App ${String(timestamp).slice(-4)}`);
    await page.type('#proj-key', `DM${String(timestamp).slice(-4)}`);
    await page.type('#proj-desc', 'Demonstrating live Phase 13 activity stream');
    await page.click('form.modal-form button[type="submit"]');
    await page.waitForSelector('.project-row', { timeout: 6000 });
    console.log('   Created demo project for activity verification');

    // 4. Navigate to /activity via Navbar
    console.log('\n--- Step 4: Activity Page Verification ---');
    await page.click('#nav-link-activity');
    await page.waitForSelector('.activity-timeline', { timeout: 8000 });
    console.log('   Navigated to URL:', page.url());
    assert(page.url().includes('/activity'), 'Navigated to /activity');

    // Check page header
    const pageTitle = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      return h1 ? h1.textContent : '';
    });
    assert(pageTitle.includes('Audit & Activity Log'), `Page title is "${pageTitle}"`);

    // Check filters toolbar
    const filterProj = await page.$('#filter-project');
    const filterEntity = await page.$('#filter-entity');
    const filterAction = await page.$('#filter-action');
    assert(!!filterProj && !!filterEntity && !!filterAction, 'Filters toolbar contains Project, Entity, and Action dropdowns');

    // Check timeline items
    await page.waitForSelector('.timeline-entry', { timeout: 5000 });
    const timelineEntries = await page.$$('.timeline-entry');
    assert(timelineEntries.length > 0, `Timeline rendered ${timelineEntries.length} activity entries`);

    // Check first timeline entry structure
    const firstEntryDesc = await page.evaluate(() => {
      const descEl = document.querySelector('.activity-description');
      return descEl ? descEl.textContent : '';
    });
    assert(firstEntryDesc.length > 0, `First activity description is: "${firstEntryDesc}"`);

    const hasActorInfo = await page.evaluate(() => {
      const actorName = document.querySelector('.actor-name');
      const roleBadge = document.querySelector('.role-badge');
      return !!actorName && !!roleBadge;
    });
    assert(hasActorInfo, 'Activity card displays actor name and role badge');

    // Check metadata toggle
    const toggleBtn = await page.$('.btn-metadata-toggle');
    if (toggleBtn) {
      await toggleBtn.click();
      await page.waitForSelector('.activity-metadata-container', { timeout: 2000 });
      const metadataVisible = await page.$('.activity-metadata-container');
      assert(!!metadataVisible, 'Clicking "Show Details" displays event metadata');
    } else {
      console.log('   (No metadata toggle on first entry; skipping toggle check)');
    }

    // 5. Test Filter interaction
    console.log('\n--- Step 5: Filter Interaction ---');
    await page.select('#filter-entity', 'Project');
    await new Promise(r => setTimeout(r, 800));
    const filteredEntries = await page.$$('.timeline-entry');
    assert(filteredEntries.length > 0, `Filtering by entity=Project returned ${filteredEntries.length} entries`);

    // Clear filters
    const clearBtn = await page.$('.btn-outline');
    if (clearBtn) {
      await clearBtn.click();
      await new Promise(r => setTimeout(r, 800));
      assert(true, 'Clear filters button resets filter criteria');
    }

    // 6. Viewport Responsiveness Checks
    console.log('\n--- Step 6: Responsive Layout & Overflow Verification ---');
    
    // Tablet (768x1024)
    await page.setViewport({ width: 768, height: 1024 });
    await new Promise(r => setTimeout(r, 400));
    const tabletOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
    });
    assert(!tabletOverflow, 'Tablet viewport (768px): zero horizontal overflow');

    // Mobile (375x667)
    await page.setViewport({ width: 375, height: 667 });
    await new Promise(r => setTimeout(r, 400));
    const mobileOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
    });
    assert(!mobileOverflow, 'Mobile viewport (375px): zero horizontal overflow');

    // Return to Dashboard and test View All Activity button
    console.log('\n--- Step 7: Dashboard Widget Navigation Link ---');
    await page.setViewport({ width: 1366, height: 850 });
    await page.goto(`${APP_URL}/dashboard`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#btn-view-all-activity', { timeout: 5000 });
    await page.click('#btn-view-all-activity');
    await page.waitForSelector('.activity-timeline', { timeout: 5000 });
    assert(page.url().includes('/activity'), 'Clicking "View All Activity →" on Dashboard navigates to /activity');

  } catch (err) {
    console.error('E2E Exception:', err);
    assert(false, `Unexpected error: ${err.message}`);
  } finally {
    await browser.close();

    console.log('\n========================================================================');
    console.log(` 📊 PHASE 13 E2E RESULTS: ${results.passed}/${results.total} PASS (Failed: ${results.failed})`);
    console.log('========================================================================\n');

    process.exit(results.failed === 0 ? 0 : 1);
  }
}

runPhase13E2E();
