const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const source = require('../data/evidence-showcase.json');
const base = process.env.BASE_URL || 'http://127.0.0.1:4250/';
const output = '/tmp/qxw-role-workflow-qa';
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  const errors = [];
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    page.on('pageerror', error => errors.push(error.message));
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const [route, key] of [['experience', 'growth'], ['methods', 'team'], ['insights', 'creation'], ['skills', 'case']]) {
        await page.goto(`${base}portfolio-light.html#/${route}`, { waitUntil: 'networkidle' });
        assert.equal(await page.locator('.page-workflow').count(), 1);
        assert.deepEqual(await page.locator('.workflow-rail strong').allTextContents(), source.pageWorkflows[key].steps.map(step => step[0]));
        assert.equal(await page.locator('.workflow-feedback').textContent(), source.pageWorkflows[key].feedback);
        assert.equal(await page.locator('.north-star').count(), route === 'experience' ? 1 : 0);
        assert(await page.locator('.workflow-rail li').evaluateAll(items => items.every(el => el.scrollWidth <= el.clientWidth + 1)));
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        if (route === 'methods') {
          assert.equal(await page.locator('#analysis-demo select, .analysis-steps, .management-loop, .demo-detail-table').count(), 0);
          const visibleMemberCells = await page.locator('.demo-pivot-table tbody tr').first().locator('th,td').evaluateAll(cells => cells.filter(el => getComputedStyle(el).display !== 'none').map(el => ({text:el.textContent, left:el.getBoundingClientRect().left, right:el.getBoundingClientRect().right})));
          if (width <= 640) {
            assert.deepEqual(visibleMemberCells.map(cell => cell.text), ['成员01', '90.0万', '45人', '50.0人']);
            assert(visibleMemberCells.every(cell => cell.left >= 0 && cell.right <= width));
          }
          await page.locator('#analysis-demo').scrollIntoViewIfNeeded();
          await page.screenshot({ path: `${output}/direct-analysis-${width}.png` });
          await page.locator('[data-section-target="team-review"]').click();
          assert(await page.locator('.review-action-table').isVisible());
          await page.locator('[data-section-target="team-execution"]').click();
          assert(await page.locator('.management-table').isVisible());
          assert((await page.locator('#team-execution').textContent()).includes('结果回传'));
          await page.screenshot({ path: `${output}/execution-${width}.png`, fullPage: true });
        }
        if (route === 'skills') assert.equal(await page.locator('.review-table, .focus-table, .selling-efficiency-chart').count(), 0);
      }
      console.log(`PASS four closed workflows, north-star ownership, direct evidence and mobile core measures at ${width}px`);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
