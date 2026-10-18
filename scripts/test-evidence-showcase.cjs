const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const source = require('../data/evidence-showcase.json');
const campaign = require('../data/campaign-review.json');
const base = process.env.BASE_URL || 'http://127.0.0.1:4244/';
const output = '/tmp/qxw-evidence-showcase-qa';
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    for (const [width, height] of [[1440, 1050], [768, 1024], [390, 844], [320, 568]]) {
      await page.setViewportSize({ width, height });
      await page.goto(`${base}portfolio-light.html#/methods/team-analysis`, { waitUntil: 'networkidle' });
      assert.deepEqual(await page.locator('.infrastructure-card summary strong').allTextContents(), source.infrastructure.map(item => item.title));
      assert.equal(await page.locator('.infrastructure-card').count(), 7);
      for (let i = 0; i < source.infrastructure.length; i++) {
        const card = page.locator('.infrastructure-card').nth(i);
        await card.locator('summary').click();
        assert.deepEqual(await card.locator('dd').allTextContents(), [source.infrastructure[i].purpose, source.infrastructure[i].action, source.infrastructure[i].fields]);
        assert(await card.locator('dl').isVisible());
        await card.locator('summary').click();
      }
      await page.locator('#data-infrastructure').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${output}/data-library-${width}.png` });
      await page.locator('[data-section-target="team-review"]').click();
      assert.equal(await page.locator('.management-node').count(), 8);
      assert.equal(await page.locator('.management-branch .management-node').count(), 2);
      assert(await page.locator('.review-action-table').isVisible());
      await page.locator('.management-loop').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${output}/management-loop-${width}.png` });
      await page.locator('[data-section-target="team-execution"]').click();
      assert.deepEqual(await page.locator('.organization-roles h3').allTextContents(), source.organization.map(item => item[0]));
      const front = await page.locator('main').textContent();
      for (const phrase of ['小懂', 'TOP13', '119条', '64.3%']) assert(!front.includes(phrase), `Case must stay in case view: ${phrase}`);
      await page.goto(`${base}portfolio-light.html#/skills/case-growth`, { waitUntil: 'networkidle' });
      assert(await page.locator('.selling-point-table').isVisible());
      assert.equal(await page.locator('.selling-point-table tbody tr').count(), 9);
      assert.equal(await page.locator('.selling-point-table thead th').count(), 7);
      for (let i = 0; i < campaign.points.length; i++) {
        const cells = await page.locator('.selling-point-table tbody tr').nth(i).locator('th,td').allTextContents();
        assert.equal(cells[3], `${campaign.points[i].acquisitions}人`);
        assert.equal(cells[4], `${campaign.points[i].reactivations}人`);
        assert.equal(cells[5], campaign.points[i].acquisitionsPerMillion.toFixed(1));
      }
      await page.locator('.decision-table-layout').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${output}/selling-point-table-${width}.png` });
      await page.goto(`${base}portfolio-light.html#/skills/case-team`, { waitUntil: 'networkidle' });
      assert.deepEqual(await page.locator('.template-card h4').allTextContents(), source.templateCards.map(item => item.title));
      assert.equal(await page.locator('.template-card ol li').count(), 12);
      await page.locator('#case-template-library').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${output}/templates-${width}.png` });
      await page.goto(`${base}portfolio-light.html#/skills/case-creation`, { waitUntil: 'networkidle' });
      assert.equal(await page.locator('.script-verdict').count(), 2);
      assert.equal(await page.locator('.script-verdict li').count(), 8);
      assert.equal(await page.locator('.script-sample-table tbody tr').count(), 5);
      assert((await page.locator('.script-sample-table').innerText()).includes('375万VV / 2人拉新'));
      assert((await page.locator('.script-sample-table').innerText()).includes('59万VV / 17人拉新'));
      await page.locator('#case-script-comparison').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${output}/script-comparison-${width}.png` });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert(await page.locator('.script-verdict, .template-card').evaluateAll(items => items.every(el => !el.checkVisibility() || el.scrollWidth <= el.clientWidth + 1)));
      console.log(`PASS seven data assets, management loop, organization, visible nine-row decisions, templates and positive/negative sample table at ${width}px`);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
