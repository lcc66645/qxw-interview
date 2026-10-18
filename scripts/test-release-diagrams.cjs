const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:4240/';
const output = '/tmp/qxw-diagram-release-qa';
fs.mkdirSync(output, { recursive: true });

(async () => {
  assert(fs.readFileSync('index.html').equals(fs.readFileSync('portfolio-light.html')));
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    const staleRequests = [], errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (/\.(css|js|png)$/.test(url.pathname) && !url.searchParams.has('v')) {
        staleRequests.push(url.pathname);
        return route.fulfill({ contentType: 'text/plain', body: 'STALE ASSET' });
      }
      return route.continue();
    });
    for (const [width, height] of [[1440, 1000], [768, 1024], [390, 844], [320, 568]]) {
      await page.setViewportSize({ width, height });
      await page.goto(`${base}portfolio-light.html#/capabilities/capabilities`, { waitUntil: 'networkidle' });
      const version = await page.locator('meta[name="portfolio-release"]').getAttribute('content');
      assert.match(version, /^[a-f0-9]{12}$/);
      assert.equal(await page.evaluate(() => window.portfolioData.release.id), version);
      assert.equal(await page.locator('.capability-core').count(), 1);
      assert.equal(await page.locator('#capability-grid article').count(), 3);
      if (width > 900) {
        const tops = await page.locator('#capability-grid article').evaluateAll(items => items.map(el => el.getBoundingClientRect().top));
        assert(Math.max(...tops) - Math.min(...tops) < 1, 'Three capability branches must share one row');
      }
      await page.screenshot({ path: path.join(output, `capability-tree-${width}.png`) });
      await page.goto(`${base}portfolio-light.html#/experience`, { waitUntil: 'networkidle' });
      assert.equal(await page.locator('.goal-drivers strong').count(), 2);
      assert.deepEqual(await page.locator('.goal-drivers strong').allTextContents(), ['10条', '30人']);
      assert((await page.locator('.growth-krs p').innerText()).includes('不是已达业绩'));
      assert.equal(await page.locator('.allocation-ring').evaluate(el => getComputedStyle(el).getPropertyValue('--allocation').trim()), '80%');
      await page.locator('.goal-map').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `growth-map-${width}.png`) });
      await page.locator('[data-section-target="growth-channels"]').click();
      assert.equal(await page.locator('#growth-channels .flow-return').count(), 1);
      await page.goto(`${base}portfolio-light.html#/methods`, { waitUntil: 'networkidle' });
      assert(await page.locator('.column-plot').isVisible());
      assert(!await page.locator('.demo-pivot-table').isVisible());
      await page.locator('#demo-group').selectOption('小组B');
      assert.deepEqual(await page.locator('.daily-column > strong').allTextContents(), ['12.0万', '16.0万', '19.0万', '23.0万']);
      await page.locator('#analysis-member-detail > summary').click();
      assert(await page.locator('.demo-pivot-table').isVisible());
      assert.equal(await page.locator('.cell-meter').count(), 2);
      await page.locator('#analysis-member-detail > summary').click();
      await page.locator('.analysis-charts').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `analysis-charts-${width}.png`) });
      await page.goto(`${base}portfolio-light.html#/skills/case-growth`, { waitUntil: 'networkidle' });
      assert.equal(await page.locator('.efficiency-row').count(), 9);
      const points = await page.evaluate(() => window.portfolioData.campaignReview.points);
      const max = Math.max(...points.map(point => point.acquisitionsPerMillion));
      for (let i = 0; i < points.length; i++) {
        const mark = page.locator('.efficiency-track > span').nth(i);
        const percent = await mark.evaluate(el => Number.parseFloat(el.style.width));
        assert(Math.abs(percent - points[i].acquisitionsPerMillion / max * 100) < .001);
      }
      await page.locator('.selling-efficiency-chart').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `selling-efficiency-${width}.png`) });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      console.log(`PASS versioned fresh entry, capability tree, planning diagram, filtered chart-first analysis and nine-point efficiency at ${width}px`);
    }
    assert.deepEqual(staleRequests, [], 'No request may fall back to a stale unversioned asset');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
