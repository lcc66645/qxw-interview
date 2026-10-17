const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const data = require('../data/portfolio.json');
const base = process.env.BASE_URL || 'http://127.0.0.1:4213/';
const attachment = data.attachments[0];
const expected = fs.readFileSync(attachment.path);

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
    await page.goto(new URL('index.html#/insights/prompt-performance', base).href);
    assert(await page.locator('#prompt-performance').evaluate(el => el.open));
    await page.reload(); assert(await page.locator('#prompt-performance').evaluate(el => el.open));
    await page.locator('#edit-profile').click();
    const exported = page.waitForEvent('download'); await page.locator('#export-site').click();
    const file = await exported; const html = fs.readFileSync(await file.path(), 'utf8');
    const payload = JSON.parse(html.match(/<script id="portfolio-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
    assert.equal(payload.attachments[0].sha256, attachment.sha256);
    for (const javaScriptEnabled of [false, true]) {
      const context = await browser.newContext({ offline: true, javaScriptEnabled, reducedMotion: 'reduce', viewport: { width: 320, height: 568 } });
      const errors = [], failed = [];
      await context.route('https://portfolio.test/creator.html', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
      const copy = await context.newPage(); copy.on('pageerror', error => errors.push(error.message)); copy.on('requestfailed', request => failed.push(request.url()));
      await copy.goto('https://portfolio.test/creator.html');
      if (javaScriptEnabled) await copy.locator('#creator-case-detail > summary').click();
      await copy.locator('#creator-xiaolaoban').waitFor();
      assert.deepEqual(await copy.locator('.creator-case-metrics dd').allTextContents(), ['1天', '1–2次', '23条']);
      assert.equal(await copy.locator('.prompt-sample').count(), 3);
      const link = copy.locator('[data-attachment]'); const url = await link.getAttribute('href');
      assert(url.startsWith('data:text/markdown;'));
      assert(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64').equals(expected));
      const downloaded = copy.waitForEvent('download'); await link.click(); const result = await downloaded;
      assert.equal(result.suggestedFilename(), attachment.filename);
      assert(fs.readFileSync(await result.path()).equals(expected));
      if (!javaScriptEnabled) assert.equal(await copy.locator('.prompt-sample[open]').count(), 3);
      else {
        await copy.locator('#prompt-brand > summary').click();
        assert((await copy.locator('#prompt-brand').innerText()).includes('后期合成'));
      }
      assert(await copy.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(errors, []); assert.deepEqual(failed, []); await context.close();
    }
    console.log('PASS original prompt attachment embedded byte-for-byte, offline downloads with JS on/off, static prompt excerpts, creator deep-link refresh, and 320px layout.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
