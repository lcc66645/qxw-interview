const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:4217/';
const output = '/tmp/qxw-transparent-qa';
fs.mkdirSync(output, { recursive: true });
const expected = { capabilities: ['capabilities'], experience: ['growth','budget'], methods: ['team'], insights: ['creation'], skills: ['case'] };
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  const errors = [], failures = [];
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) failures.push(response.url()); });
    for (const [width,height] of [[1440,1000],[768,1024],[390,844],[320,568]]) {
      await page.setViewportSize({ width,height });
      for (const [id,keys] of Object.entries(expected)) {
        await page.goto(`${base}#/${id}`, { waitUntil: 'networkidle' });
        assert.deepEqual(await page.locator('[data-visual]').evaluateAll(items => items.map(item => item.dataset.visual)), keys);
        assert.equal(await page.locator('img[src*="visual-"], .infographic-figure').count(), 0);
        assert(await page.locator('.native-visual').evaluateAll(items => items.every(el => getComputedStyle(el).backgroundColor === 'rgba(0, 0, 0, 0)' && !el.querySelector(':scope > img'))));
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.equal(await page.locator('#studio-backdrop img').count(), 1);
        if (id === 'capabilities') {
          assert.equal(await page.locator('.capability-value').count(), 3);
          assert.equal(await page.locator('.capability-case a').count(), 3);
          await page.locator('#capabilities').scrollIntoViewIfNeeded();
        }
        if (id === 'experience') {
          assert.equal(await page.locator('.growth-krs > div').count(), 1);
          assert.equal(await page.locator('#growth-channels .evidence-flow').count(), 1);
          assert.equal(await page.locator('.cost-comparison').count(), 1);
          await page.locator('#growth-goal-detail > summary').click();
          assert((await page.locator('.growth-policy').innerText()).includes('不等同于80/20'));
          await page.locator('#growth-goal-detail > summary').click();
        }
        if (id === 'methods') {
          assert.equal(await page.locator('.dimension-metrics').count(), 1);
          assert.equal(await page.locator('.okr-row, #production-cost-control').count(), 0);
          const scroll = page.locator('.demo-pivot-table').locator('..');
          assert(await scroll.evaluate(el => {
            const style = getComputedStyle(el);
            return style.backgroundColor === 'rgba(0, 0, 0, 0)' && style.backdropFilter === 'none';
          }));
          assert(await page.locator('#analysis-demo').evaluate(el => getComputedStyle(el).backdropFilter.includes('blur')));
          assert.equal(await page.locator('#demo-group, .analysis-steps').count(), 0);
          assert.equal(await page.locator('.demo-pivot-table tbody tr').count(), 3);
          assert.equal(await page.locator('.demo-metrics dd').nth(2).textContent(), '89人');
          await page.locator('[data-section-target="team-review"]').click();
          assert.equal(await page.locator('.review-action-table tbody tr').count(), 3);
          await page.locator('#team-review').scrollIntoViewIfNeeded();
        }
        if (id === 'insights') {
          assert.equal(await page.locator('.dimension-point[open], .creation-stage[open]').count(), 0);
          assert.equal(await page.locator('.dimension-point').count(), 3);
          assert.equal(await page.locator('.creation-stage').count(), 9);
        }
        if (id === 'skills') {
          assert.equal(await page.locator('.campaign-metrics').count(), 1);
          assert(await page.locator('.campaign-metrics').isVisible());
          assert.equal(await page.locator('.case-delivery-table tbody tr').count(), 2);
          assert((await page.locator('#case-results').innerText()).includes('仍需后续验证'));
          assert.equal(await page.locator('#case-team #matrix-budget-control').count(), 0);
          await page.locator('[data-section-target="case-growth"]').click();
          assert.equal(await page.locator('#case-growth #matrix-budget-control').count(), 1);
          assert.equal(await page.locator('.case-budget-table tbody tr').count(), 4);
          await page.locator('#case-growth > summary').click();
        }
        await page.screenshot({ path: path.join(output, `${id}-${width}.png`) });
      }
      console.log(`PASS native transparent layers, logical ownership, disclosure and responsive layout at ${width}px`);
    }
    assert.deepEqual(errors, []); assert.deepEqual(failures, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
