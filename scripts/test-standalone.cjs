const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const artifact = path.resolve(process.env.HTML_PATH || '/workspace/portfolio-final.html');
const output = '/tmp/qxw-standalone-qa';
fs.mkdirSync(output, { recursive: true });

(async () => {
  const html = fs.readFileSync(artifact, 'utf8');
  assert(html.startsWith('\uFEFF<!doctype html>'));
  assert(html.includes('<meta charset="UTF-8">'));
  assert.equal((html.match(/<script[ >]/gi) || []).length, 5);
  assert.equal((html.match(/<\/script[ >]/gi) || []).length, 5);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  try {
    for (const javaScriptEnabled of [false, true]) {
      const context = await browser.newContext({ offline: true, javaScriptEnabled, viewport: { width: 1440, height: 900 } });
      await context.route('https://portfolio.test/final.html', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
      const page = await context.newPage(); const errors = [], failed = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('requestfailed', request => failed.push(request.url()));
      await page.goto('https://portfolio.test/final.html', { waitUntil: 'load' });
      await page.locator('main h1').waitFor();
      assert.equal(await page.locator('main h1').textContent(), '仇熙雯');
      assert.equal(await page.locator('main > #capabilities').count(), 1);
      assert(await page.locator('#about-title').isVisible());
      const body = await page.locator('body').innerText();
      assert(body.includes('关于我') && body.includes('AIGC 用户增长运营 TL'));
      assert(!body.includes('打开简历'));
      for (const code of ['const initial =', 'function renderPage', '<!doctype html>', 'window.portfolioData', 'data:image/png;base64,', 'uniform sampler2D']) assert(!body.includes(code), `Code leaked into body: ${code}`);
      assert(await page.locator('script, style').evaluateAll(elements => elements.every(element => getComputedStyle(element).display === 'none')));
      assert(await page.locator('img').evaluateAll(images => images.every(image => image.src.startsWith('data:') && image.complete && image.naturalWidth > 0)));
      if (javaScriptEnabled) {
        await page.waitForFunction(() => document.querySelector('.portrait-stage')?.dataset.status === 'webgl');
        const before = await page.locator('.portrait-stage').getAttribute('data-time');
        await page.waitForTimeout(300); assert(Number(await page.locator('.portrait-stage').getAttribute('data-time')) > Number(before));
        await page.locator('.capability-jump').click();
        await page.waitForURL('**#/capabilities/capabilities');
        await page.waitForFunction(() => document.querySelector('#capabilities').getBoundingClientRect().top < 200);
        assert(await page.locator('#about-title').isVisible());
        assert((await page.locator('.about-copy').innerText()).includes('AIGC 用户增长运营 TL'));
        for (const id of ['experience', 'methods', 'insights', 'skills', 'capabilities']) {
          await page.locator(`nav [data-page-link="${id}"]`).click();
          await page.locator(`main > #${id}`).waitFor(); assert.equal(await page.locator('main h1').count(), 1);
        }
        await page.waitForFunction(() => document.querySelector('.portrait-stage')?.dataset.status === 'webgl');
      }
      await page.screenshot({ path: path.join(output, javaScriptEnabled ? 'final-desktop.png' : 'static-first-paint.png') });
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(150);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: path.join(output, javaScriptEnabled ? 'final-mobile.png' : 'static-mobile.png') });
      assert.deepEqual(errors, []); assert.deepEqual(failed, []);
      await context.close();
    }
    const zipPath = artifact.replace(/\.html$/, '.zip');
    const zipped = execFileSync('zip', ['-j', '-', artifact], { maxBuffer: 64 * 1024 * 1024 });
    fs.writeFileSync(zipPath, zipped);
    const entries = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' }).trim().split('\n');
    assert.deepEqual(entries, [path.basename(artifact)]);
    assert(fs.readFileSync(artifact).equals(execFileSync('unzip', ['-p', zipPath, entries[0]], { maxBuffer: 64 * 1024 * 1024 })));
    console.log('PASS UTF-8 standalone HTML, rendered content/no visible code, static first paint with JS blocked, five offline routes, animated portrait, mobile layout, and ZIP round trip.');
    console.log(`HTML: ${artifact}\nZIP: ${zipPath}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
