const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const base = process.env.BASE_URL || 'http://127.0.0.1:4201/';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
    await page.goto(base, { waitUntil: 'networkidle' });
    for (const extension of ['html', 'zip']) {
      const filename = `portfolio-final.${extension}`;
      const link = page.locator(`.published-downloads a[download="${filename}"]`);
      assert.equal(await link.getAttribute('href'), `downloads/${filename}`);
      const response = await page.request.get(new URL(`downloads/${filename}`, base).href);
      assert.equal(response.status(), 200);
      assert(response.headers()['content-type'].includes(extension === 'html' ? 'text/html' : 'application/zip'));
      const downloaded = page.waitForEvent('download'); await link.click();
      const file = await downloaded; assert.equal(file.suggestedFilename(), filename);
      assert.equal(await file.failure(), null);
      assert(fs.readFileSync(await file.path()).equals(fs.readFileSync(path.join(root, 'downloads', filename))));
    }
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    console.log('PASS both public same-origin download links, correct MIME types/filenames, real browser downloads and byte integrity on mobile.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
