const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const data = require('../data/portfolio.json');
const base = process.env.BASE_URL || 'http://127.0.0.1:4208/';
const output = '/tmp/qxw-cost-qa';
fs.mkdirSync(output, { recursive: true });

(async () => {
  const cost = data.presentation.productionCost;
  assert.equal(cost.durationSeconds, 15);
  assert.equal(cost.model, 'Seedance 2.0 VIP');
  assert.deepEqual(cost.segments, [
    { resolution: '1080p', tokens: 495, approximate: false },
    { resolution: '720p', tokens: 135, approximate: true }
  ]);
  assert.deepEqual(cost.rules.map(rule => rule.model), ['Seedance 2.5', 'Seedance 2.0', '禁用2.5']);
  assert.deepEqual(data.campaignReview, require('../data/campaign-review.json'));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    for (const [width, height] of [[1920,1080], [1440,900], [768,1024], [390,844], [320,568]]) {
      await page.setViewportSize({ width, height });
      await page.goto(`${base}#/experience`);
      assert.equal(await page.locator('.experience-panel:visible').count(), 0);
      assert.equal(await page.locator('.work-decision[open]').count(), 0);
      await page.locator('[data-experience-tab="competence-0-0"]').click();
      const detail = page.locator('#production-cost-control');
      assert.equal(await detail.evaluate(el => el.open), false);
      await detail.locator('summary').click();
      assert(await page.locator('.cost-policy').isVisible());
      assert.equal(await detail.locator('summary').evaluate(el => getComputedStyle(el, '::after').content), 'none');
      assert.deepEqual(await page.locator('.cost-segment strong').allTextContents(), ['495 token', '约135 token']);
      assert.equal(await page.locator('.cost-policy tbody tr').count(), 3);
      assert((await detail.innerText()).includes('全员确认'));
      assert((await detail.innerText()).includes('9月AI项目管理汇报'));
      assert(await page.locator('.cost-segment .cost-track > span').first().evaluate(el => el.style.width === '100%'));
      assert(await detail.evaluate(el => [...el.querySelectorAll('th, td, .cost-segment strong')].every(child => child.scrollWidth <= child.clientWidth + 1)));
      await detail.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${output}/cost-${width}.png`, fullPage: true });
      await detail.locator('summary').click(); assert(await page.locator('.cost-policy').isHidden());
      await page.goto(`${base}#/experience/production-cost-control`);
      assert(await detail.evaluate(el => el.open));
      assert.equal(await page.locator('.experience-panel:visible').getAttribute('data-experience-panel'), 'competence-0-0');
      await page.waitForFunction(() => document.querySelector('#production-cost-control > summary').getBoundingClientRect().top >= document.querySelector('.experience-tabs').getBoundingClientRect().bottom - 1);
      await page.screenshot({ path: `${output}/cost-anchor-${width}.png` });
      await page.goto(`${base}#/experience/matrix-budget-control`);
      const budget = page.locator('#matrix-budget-control');
      assert(await budget.evaluate(el => el.open));
      assert.equal(await page.locator('.experience-panel:visible').getAttribute('data-experience-panel'), 'competence-0-3');
      assert.equal(await budget.locator('.decision-timeline li').count(), 4);
      assert.equal(await budget.locator('.budget-steps dt').count(), 4);
      const copy = await budget.innerText();
      for (const fact of ['效果:品宣至少1:2', '申请更多激励', '额度调整至15,000/人', 'CPM 4元/千次', 'T+7', '星图日度追踪']) assert(copy.includes(fact), fact);
      assert(copy.includes('持续推进：星图日度追踪'));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `${output}/budget-${width}.png`, fullPage: true });
      for (const forbidden of ['21,850', '21850', '14,850', '成本下降72', 'CPA降低', '已获批', '127条', '17条待补']) assert(!(await page.locator('main').textContent()).includes(forbidden), forbidden);
    }
    for (const [stage, anchor] of [[4, 'production-cost-control'], [4, 'matrix-budget-control']]) {
      await page.goto(`${base}#/experience/case-stage-${stage}`);
      await page.locator(`[data-stage="${stage}"] .case-anchor[href$="/${anchor}"]`).click();
      assert.equal(await page.evaluate(() => location.hash), `#/experience/${anchor}`);
      await page.waitForFunction(id => document.getElementById(id)?.open, anchor);
      assert(await page.locator(`#${anchor}`).evaluate(el => el.open));
    }
    await page.goto(`${base}#/experience/production-cost-control`);
    await page.locator('#edit-profile').click();
    const download = page.waitForEvent('download'); await page.locator('#export-site').click();
    const file = `${output}/cost-offline.html`; await (await download).saveAs(file);
    const html = fs.readFileSync(file, 'utf8');
    for (const javaScriptEnabled of [true, false]) {
      const context = await browser.newContext({ offline: true, javaScriptEnabled, reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
      await context.route('https://cost.test/portfolio.html', route => route.fulfill({ contentType: 'text/html', body: html }));
      const offline = await context.newPage(); const failures = [];
      offline.on('requestfailed', request => failures.push(request.url()));
      offline.on('pageerror', error => errors.push(error.message));
      await offline.goto('https://cost.test/portfolio.html#/experience/production-cost-control');
      assert(await offline.locator('.cost-policy').isVisible());
      assert.deepEqual(await offline.locator('.cost-segment strong').allTextContents(), ['495 token', '约135 token']);
      if (javaScriptEnabled) {
        await offline.goto('https://cost.test/portfolio.html#/experience/matrix-budget-control');
        assert(await offline.locator('.budget-steps').isVisible());
      } else assert(await offline.locator('.budget-steps').isVisible());
      assert.deepEqual(failures, []); await context.close();
    }
    assert.deepEqual(errors, []);
    console.log('PASS measured 15-second consumption units, three model rules, actual management deliverables, resource-request/credit-limit boundaries, unchanged campaign, five responsive sizes, closed disclosures/deep links, case links, offline and script-disabled reading.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
