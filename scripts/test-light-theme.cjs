const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:4236/';
const output = '/tmp/qxw-light-theme-qa';
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const [width, height] of [[1440, 1000], [768, 1024], [390, 844], [320, 568]]) {
      await page.setViewportSize({ width, height });
      for (const id of ['capabilities', 'experience', 'methods', 'insights', 'skills']) {
        await page.goto(`${base}#/${id}`, { waitUntil: 'networkidle' });
        assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme), 'light');
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        const tabs = page.locator('.page-outline a');
        const count = await tabs.count();
        for (let i = 0; i < Math.max(1, count); i++) {
          if (count) await tabs.nth(i).click();
          const paleText = await page.locator('main *').evaluateAll(elements => elements.filter(el =>
            el.checkVisibility() && [...el.childNodes].some(node => node.nodeType === 3 && node.textContent.trim())
          ).filter(el => {
            const channels = getComputedStyle(el).color.match(/[\d.]+/g).map(Number);
            return channels.slice(0, 3).every(value => value > 140);
          }).map(el => el.textContent.slice(0, 100)));
          assert.deepEqual(paleText, [], `${id}/${i}: dark-theme text leaked`);
          const panel = page.locator('[data-subsection-panel]:visible');
          if (await panel.count()) await panel.scrollIntoViewIfNeeded();
          await page.screenshot({ path: path.join(output, `${id}-${i}-${width}.png`) });
        }
        if (id === 'methods') {
          await page.locator('[data-section-target="team-analysis"]').click();
          assert.equal(await page.locator('#demo-group, .analysis-steps').count(), 0);
          assert.equal(await page.locator('.demo-metrics dd').nth(2).textContent(), '89人');
        }
        if (id === 'insights') {
          await page.locator('[data-section-target="creation-workflow"]').click();
          await page.locator('.creation-stage > summary').first().click();
          assert.equal(await page.locator('.creation-stage[open]').count(), 1);
        }
        if (id === 'capabilities') {
          await page.locator('#capabilities').scrollIntoViewIfNeeded();
          await page.screenshot({ path: path.join(output, `capability-map-${width}.png`) });
        }
      }
      console.log(`PASS light palette, all subpages, no pale body text, no overflow and interactions at ${width}px`);
    }
    await page.locator('#edit-profile').click();
    assert.equal(await page.locator('#edit-dialog').evaluate(el => getComputedStyle(el).colorScheme), 'light');
    await page.keyboard.press('Escape');
    await page.emulateMedia({ media: 'print' });
    assert.equal(await page.locator('#studio-backdrop').evaluate(el => getComputedStyle(el).display), 'none');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
