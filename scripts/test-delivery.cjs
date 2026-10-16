const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const artifact = process.env.HTML_PATH || '/workspace/portfolio-final.html';
const output = '/tmp/qxw-delivery-qa';
const data = require('../data/portfolio.json');
fs.mkdirSync(output, { recursive: true });
const forbidden = ['const initial =', 'function renderPage', '<!doctype html>', 'window.portfolioData', 'data:image/png;base64,', 'uniform sampler2D', '\uFFFD'];
async function assertReadable(page) {
  const visible = await page.locator('body').innerText();
  for (const code of forbidden) assert(!visible.includes(code), `Unexpected visible code/encoding: ${code}`);
  assert.equal(await page.evaluate(() => document.characterSet), 'UTF-8');
  assert.equal(await page.locator('main h1').count(), 1);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0 && image.src.startsWith('data:')));
  assert(await page.locator('script, style').evaluateAll(elements => elements.every(element => getComputedStyle(element).display === 'none')));
}

(async () => {
  const zip = artifact.replace(/\.html$/, '.zip');
  const entries = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).trim().split('\n');
  assert.deepEqual(entries, [path.basename(artifact)]);
  const bytes = execFileSync('unzip', ['-p', zip, entries[0]], { maxBuffer: 64 * 1024 * 1024 });
  assert(bytes.equals(fs.readFileSync(artifact)));
  const extracted = path.join(output, entries[0]); fs.writeFileSync(extracted, bytes);
  const server = http.createServer((request, response) => {
    if (request.url.split('?')[0] !== '/portfolio.html') { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
    response.end(fs.readFileSync(extracted));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/portfolio.html`;
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const unexpected = [], errors = [];
    await context.route('**/*', route => {
      if (route.request().url() === url) return route.continue();
      unexpected.push(route.request().url()); return route.abort();
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    const response = await page.goto(url, { waitUntil: 'load' });
    assert(response.headers()['content-type'].includes('text/html'));
    for (const [width, height] of [[1920,1080], [1440,900], [768,1024], [390,844], [320,568]]) {
      await page.setViewportSize({ width, height });
      for (const [id] of Object.entries(data.pages)) {
        await page.locator(`nav [data-page-link="${id}"]`).click(); await page.locator(`main > #${id}`).waitFor();
        await assertReadable(page);
        assert.equal(await page.locator('nav [aria-current="page"]').getAttribute('data-page-link'), id);
        if (id === 'experience') {
          assert.equal(await page.locator('.practice-point').count(), 7);
          assert.equal(await page.locator('.job-okr .okr-row').count(), 3);
          assert.equal(await page.locator('.job-okr .okr-results li').count(), 8);
          assert.equal(await page.locator('.practice-deliverable').count(), 5);
          assert.equal(await page.locator('.project-visual').count(), 5);
          assert.equal(await page.locator('.case-stage').count(), 6);
          assert.deepEqual(await page.locator('.case-stage[data-stage="5"] .metric-list dd').allTextContents(), ['119条', '3,690万', '238人', '2,443人']);
          const links = new Set(await page.locator('main a[href^="https://"]').evaluateAll(elements => elements.map(element => element.href)));
          data.source.links.forEach(link => assert(links.has(link.url)));
        }
        if (width === 390) await page.screenshot({ path: path.join(output, `${id}-mobile.png`) });
      }
      console.log(`PASS extracted delivery: five views at ${width}x${height}`);
    }
    await page.locator('nav [data-page-link="experience"]').click(); await page.locator('#experience').waitFor();
    await page.locator('.practice-point [data-enlarge="growth"]').click();
    await page.locator('[aria-label="图像缩放"]').fill('300');
    assert(await page.locator('.visual-dialog-scroll').evaluate(element => element.scrollWidth > element.clientWidth));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.keyboard.press('Escape');
    await page.locator('#contact-action').click();
    assert.equal(await page.locator('#project-detail a[href^="mailto:"]').getAttribute('href'), `mailto:${data.profile.email}`);
    await page.keyboard.press('Escape');
    await page.locator('#edit-profile').click();
    await page.locator('[name="name"]').fill('离线导出验证');
    const download = page.waitForEvent('download'); await page.locator('#export-site').click();
    const exported = path.join(output, 're-export.html'); await (await download).saveAs(exported);
    const second = fs.readFileSync(exported, 'utf8'); assert(second.startsWith('\uFEFF<!doctype html>'));
    for (const javaScriptEnabled of [true, false]) {
      const offline = await browser.newContext({ offline: true, javaScriptEnabled, reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
      await offline.route('https://portfolio.test/re-export.html', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: second }));
      const copy = await offline.newPage(); copy.on('pageerror', error => errors.push(error.message));
      await copy.goto('https://portfolio.test/re-export.html'); await copy.locator('#experience').waitFor();
      await assertReadable(copy);
      assert.equal(await copy.locator('.header [data-bind="name"]').textContent(), '离线导出验证');
      assert.equal(await copy.locator('.review-table tbody tr').count(), 4);
      if (javaScriptEnabled) { await copy.locator('nav [data-page-link="capabilities"]').click(); await copy.locator('.portrait-intro').waitFor(); await assertReadable(copy); }
      await offline.close();
    }
    assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
    console.log('PASS actual ZIP extraction and HTTP MIME, no code/encoding leaks across 25 combinations, images/data/12 links, 300% viewer, contact, editing, and second export with scripts on/off; no external requests.');
  } finally {
    await browser?.close(); await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
