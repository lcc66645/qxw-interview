const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:4217/';
const out = '/tmp/qxw-section-framework-qa'; fs.mkdirSync(out, { recursive: true });
const routes = {
  experience: ['growth-goal','growth-channels','growth-budget'],
  methods: ['team-analysis','team-review','team-execution'],
  insights: ['creation-abilities','creation-workflow','featured-evidence'],
  skills: ['case-results','case-growth','pitfall-review']
};
async function assertActive(page, target) {
  assert.equal(await page.locator('[data-subsection-panel]:visible').count(), 1);
  const tab = page.locator('.page-outline [aria-selected="true"]');
  assert.equal(await tab.getAttribute('data-section-target'), target);
  const panel = page.locator(`#${await tab.getAttribute('aria-controls')}`);
  assert(await panel.isVisible());
  assert.equal(await panel.getAttribute('aria-labelledby'), await tab.getAttribute('id'));
  assert.equal(await page.locator('.page-outline [tabindex="0"]').count(), 1);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
}
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  const errors = [];
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    page.on('pageerror', error => errors.push(error.message));
    for (const [width,height] of [[1440,1000],[768,1024],[390,844],[320,568]]) {
      await page.setViewportSize({ width,height });
      for (const [route,targets] of Object.entries(routes)) {
        await page.goto(`${base}#/${route}`, { waitUntil: 'networkidle' });
        await assertActive(page, targets[0]);
        for (const [index,target] of targets.entries()) {
          await page.locator(`[data-section-target="${target}"]`).click();
          await assertActive(page, target);
          assert(page.url().endsWith(`/${target}`));
          const panel = page.locator('[data-subsection-panel]:visible');
          if (route !== 'skills' || index !== 2) {
            assert.equal(await panel.locator('.contribution-lead').count(), route === 'skills' && index === 0 ? 0 : 1);
            const labels = await panel.locator('.contribution-lead dt').allTextContents();
            if (labels.length) assert.deepEqual(labels, ['我的作用','关键动作','交付 / 证据']);
          }
          assert(await page.locator('.page-outline a').evaluateAll(items => items.every(el => el.scrollWidth <= el.clientWidth + 1)));
          if (route === 'insights' && index === 1) {
            assert.equal(await page.locator('.creation-phase').count(), 3);
            assert.equal(await page.locator('.creation-stage').count(), 9);
            assert.equal(await page.locator('.creation-stage[open]').count(), 0);
            assert(await page.locator('.creation-stage-name').evaluateAll(items => items.every(el => el.getBoundingClientRect().width >= 25)));
            await page.locator('.creation-step-link').nth(4).click();
            await page.reload(); await assertActive(page, target);
            assert(await page.locator('#creation-step-5').evaluate(el => el.open));
            await page.waitForFunction(() => document.querySelector('#creation-step-5').getBoundingClientRect().top >= document.querySelector('.page-outline').getBoundingClientRect().bottom - 1);
            await page.locator('.creation-step-link').nth(4).click();
            await page.reload(); await assertActive(page, target);
            assert.equal(await page.locator('.creation-stage[open]').count(), 0);
          }
          if (route === 'skills' && index === 2) {
            assert.equal(await page.locator('.badcase-item:not([open])').count(), 3);
            assert(await page.locator('.badcase-preview').first().isVisible());
            await page.locator('.badcase-item > summary').first().click();
            assert(await page.locator('.badcase-diagnosis').first().isVisible());
          }
          await page.screenshot({ path: `${out}/${route}-${index}-${width}.png` });
        }
        await page.locator('.page-outline a').first().focus();
        await page.keyboard.press('ArrowRight'); await assertActive(page, targets[1]);
        await page.keyboard.press('End'); await assertActive(page, targets[2]);
        await page.keyboard.press('Home'); await assertActive(page, targets[0]);
        await page.reload(); await assertActive(page, targets[0]);
      }
      console.log(`PASS three-subsection framework, contribution labels, keyboard, reload, disclosure and layout at ${width}px`);
    }
    await page.goto(`${base}#/methods`);
    await page.locator('#demo-group').selectOption('小组B');
    await page.locator('[data-section-target="team-review"]').click();
    await page.locator('[data-section-target="team-analysis"]').click();
    assert.equal(await page.locator('#demo-group').inputValue(), '小组B');
    assert.equal(await page.locator('.demo-metrics dd').nth(2).textContent(), '34人');
    await page.locator('[data-section-target="team-execution"]').click();
    await page.locator('[data-section-target="team-review"]').click();
    await page.goBack(); await assertActive(page, 'team-execution');
    await page.goForward(); await assertActive(page, 'team-review');
    const before = await page.locator('[data-subsection-panel]').evaluateAll(items => items.map(el => el.hidden));
    await page.evaluate(() => { window.print = () => { window.allSectionsPrinted = [...document.querySelectorAll('[data-subsection-panel]')].every(el => !el.hidden); dispatchEvent(new Event('afterprint')); }; });
    await page.locator('#print-journey').click();
    assert(await page.evaluate(() => window.allSectionsPrinted));
    assert.deepEqual(await page.locator('[data-subsection-panel]').evaluateAll(items => items.map(el => el.hidden)), before);
    await page.locator('#edit-profile').click();
    const downloaded = page.waitForEvent('download'); await page.locator('#export-site').click();
    const file = await downloaded; const html = fs.readFileSync(await file.path(), 'utf8');
    for (const javaScriptEnabled of [false,true]) {
      const context = await browser.newContext({ javaScriptEnabled, offline: true, reducedMotion: 'reduce', viewport: { width: 320,height:568 } });
      await context.route('https://portfolio.test/framework.html', route => route.fulfill({ contentType: 'text/html; charset=utf-8',body:html }));
      const copy = await context.newPage(); await copy.goto('https://portfolio.test/framework.html');
      if (javaScriptEnabled) {
        await assertActive(copy, 'team-analysis');
        await copy.locator('[data-section-target="team-execution"]').click(); await assertActive(copy, 'team-execution');
      } else {
        assert.equal(await copy.locator('[data-subsection-panel]:visible').count(), 3);
        assert.equal(await copy.locator('.page-outline [role="tab"]').count(), 0);
        assert(await copy.locator('.page-outline a').evaluateAll(items => items.every(el => el.getAttribute('href').startsWith('#team-'))));
        assert(await copy.locator('.management-table').isVisible());
      }
      await context.close();
    }
    assert.deepEqual(errors, []);
    console.log('PASS filter preservation, history, print state restore and offline JS on/off section navigation');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
