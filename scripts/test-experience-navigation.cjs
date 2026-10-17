const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:4207/';
const output = '/tmp/qxw-experience-qa';
fs.mkdirSync(output, { recursive: true });
const keys = ['competence-0-1', 'competence-0-2', 'competence-0-4', 'competence-0-0', 'competence-0-3', 'business-review'];

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    for (const [width, height] of [[1920,1080], [1440,900], [768,1024], [390,844], [320,568]]) {
      await page.setViewportSize({ width, height }); await page.goto(`${base}#/experience`);
      assert.deepEqual(await page.locator('[data-experience-tab]').evaluateAll(elements => elements.map(el => el.dataset.experienceTab)), keys);
      assert.equal(await page.locator('.experience-panel:visible').count(), 0);
      assert.equal(await page.locator('.okr-row[open], .case-stage[open]').count(), 0);
      assert.equal(await page.locator('.job').count(), 1);
      for (let index = 0; index < 3; index++) {
        await page.locator('.okr-row > summary').nth(index).click();
        assert(await page.locator('.okr-results').nth(index).isVisible());
        await page.locator('.okr-row > summary').nth(index).click();
        assert(await page.locator('.okr-results').nth(index).isHidden());
      }
      assert(await page.locator('.experience-tabs').evaluate(el => {
        const rect = el.getBoundingClientRect(), okr = document.querySelector('.job-okr').getBoundingClientRect();
        const buttons = [...el.children].map(button => button.getBoundingClientRect());
        return rect.top >= okr.bottom - 1 && buttons.every(button => Math.abs(button.top - buttons[0].top) < 1);
      }), 'All six controls belong in one horizontal row below OKRs');
      await page.screenshot({ path: `${output}/collapsed-${width}.png` });
      for (const key of keys) {
        const button = page.locator(`[data-experience-tab="${key}"]`);
        await button.click();
        assert.equal(await button.getAttribute('aria-expanded'), 'true');
        assert.equal(await page.locator('.experience-panel:visible').count(), 1);
        assert.equal(await page.locator('[data-experience-tab][aria-expanded="true"]').count(), 1);
        assert.equal(await page.locator('.experience-panel:visible').getAttribute('data-experience-panel'), key);
        assert.equal(await page.evaluate(() => location.hash), `#/experience/${key}`);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      }
      assert.equal(await page.locator('.case-stage[open]').count(), 0);
      for (let index = 0; index < 6; index++) {
        await page.locator('.case-stage > summary').nth(index).click();
        assert(await page.locator('.case-stage-capability').nth(index).isVisible());
        await page.locator('.case-stage > summary').nth(index).click();
      }
      await page.screenshot({ path: `${output}/case-${width}.png` });
      await page.locator('[data-experience-tab="business-review"]').click();
      assert.equal(await page.locator('.experience-panel:visible').count(), 0);
      await page.locator('[data-experience-tab]').first().focus();
      await page.keyboard.press('End');
      assert.equal(await page.locator('[data-experience-tab]').last().evaluate(el => document.activeElement === el), true);
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('.experience-panel:visible').getAttribute('data-experience-panel'), 'business-review');
      await page.reload(); assert.equal(await page.locator('.experience-panel:visible').getAttribute('data-experience-panel'), 'business-review');
    }
    await page.goto(`${base}#/experience/competence-0-0`);
    assert(await page.locator('#competence-0-0').isVisible());
    await page.locator('[data-experience-tab="competence-0-2"]').click();
    await page.goBack(); assert(await page.locator('#competence-0-0').isVisible());
    await page.goto(`${base}#/experience/pitfall-review`);
    assert(await page.locator('#pitfall-review').evaluate(el => el.open));
    assert.equal(await page.locator('.experience-panel:visible').getAttribute('data-experience-panel'), 'business-review');
    const before = await page.locator('.experience-panel').evaluateAll(elements => elements.map(el => el.hidden));
    const details = await page.locator('main details').evaluateAll(elements => elements.map(el => el.open));
    await page.evaluate(() => { window.print = () => {
      window.printComplete = [...document.querySelectorAll('main details')].every(el => el.open) && [...document.querySelectorAll('.experience-panel')].every(el => !el.hidden);
      window.dispatchEvent(new Event('afterprint'));
    }; });
    await page.locator('#print-journey').click(); assert(await page.evaluate(() => window.printComplete));
    assert.deepEqual(await page.locator('.experience-panel').evaluateAll(elements => elements.map(el => el.hidden)), before);
    assert.deepEqual(await page.locator('main details').evaluateAll(elements => elements.map(el => el.open)), details);
    await page.locator('#edit-profile').click();
    const downloaded = page.waitForEvent('download'); await page.locator('#export-site').click();
    const file = `${output}/experience-offline.html`; await (await downloaded).saveAs(file);
    const html = fs.readFileSync(file, 'utf8');
    for (const removed of ['简单有为', 'UWANT', '郝家豁', '千川', '线索成本']) assert(!html.includes(removed), `Export retains ${removed}`);
    for (const javaScriptEnabled of [false, true]) {
      const context = await browser.newContext({ offline: true, javaScriptEnabled, reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
      await context.route('https://experience.test/portfolio.html', route => route.fulfill({ contentType: 'text/html', body: html }));
      const offline = await context.newPage(); const failures = [];
      offline.on('requestfailed', request => failures.push(request.url())); offline.on('pageerror', error => errors.push(error.message));
      await offline.goto('https://experience.test/portfolio.html');
      if (javaScriptEnabled) {
        assert.equal(await offline.locator('.experience-panel:visible').count(), 0);
        await offline.locator('[data-experience-tab="competence-0-4"]').click(); assert(await offline.locator('#featured-evidence').isVisible());
        await offline.locator('[data-experience-tab="business-review"]').click();
        await offline.locator('[data-stage="5"] > summary').click(); assert(await offline.locator('.review-table').isVisible());
      } else {
        assert.equal(await offline.locator('.experience-panel:visible').count(), 6);
        assert(await offline.locator('.review-table').isVisible());
      }
      assert.deepEqual(failures, []); await context.close();
    }
    assert.deepEqual(errors, []);
    console.log('PASS five responsive sizes, three collapsed OKRs, six horizontal exclusive disclosures, six case-stage accordions, keyboard, deep links/back/reload, complete print/restoration, no removed employer in export, offline switching and readable script-disabled fallback.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
