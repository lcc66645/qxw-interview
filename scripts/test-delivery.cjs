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
  for (const removed of ['简单有为', 'UWANT', '友望', '郝家豁', '千川', '线索成本', 'CTR 5%']) assert(!visible.includes(removed), removed);
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
    const unexpected = [], errors = [], evidence = new Set();
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
        for (const href of await page.locator('main a[href^="https:"]').evaluateAll(items => items.map(item => item.href))) evidence.add(href);
        if (['experience', 'methods', 'insights'].includes(id)) assert.equal(await page.locator('.dimension-point').count(), 3);
        if (id === 'experience') {
          assert.deepEqual(await page.locator('.share-row strong').allTextContents(), ['32.2%', '64.3%', '46.5%', '19.3%']);
          await page.locator('#selling-point-data > summary').click();
          assert.equal(await page.locator('.selling-point-table tbody tr').count(), 9);
          await page.locator('#selling-point-data > summary').click();
        }
        if (id === 'methods') {
          assert.equal(await page.locator('#dimension-content').evaluate(el => el.firstElementChild.id), 'team-okr');
          assert.equal(await page.locator('.job-okr .okr-row').count(), 3);
          assert.equal(await page.locator('.job-okr .okr-results li').count(), 8);
          assert.equal(await page.locator('.management-table tbody tr').count(), 8);
        }
        if (id === 'insights') {
          const attachment = data.attachments[0]; const url = await page.locator('[data-attachment]').getAttribute('href');
          assert(url.startsWith('data:text/markdown;'));
          assert(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64').equals(fs.readFileSync(attachment.path)));
          assert.equal(await page.locator('.creation-stage').count(), 9);
          await page.locator('.creation-step-link').last().click();
          await page.waitForFunction(() => document.querySelector('#creation-step-9')?.open);
          assert(await page.locator('#creation-step-9').evaluate(el => el.open));
          assert((await page.locator('#creation-step-9').innerText()).includes('Excel'));
          await page.locator('nav [data-page-link="insights"]').click();
        }
        if (id === 'skills') {
          assert.equal(await page.locator('.badcase-item').count(), 3);
          assert.equal(await page.locator('#business-review').count(), 1);
          assert.equal(await page.locator('.case-perspective').count(), 4);
          assert.deepEqual(await page.locator('.case-results .metric-list dd').allTextContents(), ['119条', '3,690万', '238人', '2,443人']);
        }
        if (width === 390) await page.screenshot({ path: path.join(output, `${id}-mobile.png`) });
      }
      console.log(`PASS extracted delivery: five views at ${width}x${height}`);
    }
    data.source.links.forEach(link => assert(evidence.has(link.url)));
    await page.locator('nav [data-page-link="skills"]').click(); await page.locator('#skills').waitFor();
    await page.locator('[data-enlarge="growth"]').click();
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
      await copy.goto('https://portfolio.test/re-export.html'); await copy.locator('#skills').waitFor();
      await assertReadable(copy);
      assert.equal(await copy.locator('.header [data-bind="name"]').textContent(), '离线导出验证');
      assert.equal(await copy.locator('.review-table tbody tr').count(), 4);
      if (javaScriptEnabled) {
        await copy.locator('nav [data-page-link="capabilities"]').click(); await copy.locator('.portrait-intro').waitFor(); await assertReadable(copy);
        await copy.locator('nav [data-page-link="insights"]').click(); await copy.locator('[data-attachment]').waitFor();
        const attachment = data.attachments[0]; const url = await copy.locator('[data-attachment]').getAttribute('href');
        assert(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64').equals(fs.readFileSync(attachment.path)));
        const downloaded = copy.waitForEvent('download'); await copy.locator('[data-attachment]').click();
        const file = await downloaded; assert.equal(file.suggestedFilename(), attachment.filename);
        assert(fs.readFileSync(await file.path()).equals(fs.readFileSync(attachment.path)));
      }
      await offline.close();
    }
    assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
    console.log('PASS actual ZIP extraction and HTTP MIME, no code/encoding leaks across 25 combinations, images/data/12 links, 300% viewer, contact, editing, and second export with scripts on/off; no external requests.');
  } finally {
    await browser?.close(); await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
