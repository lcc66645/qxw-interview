const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:4198/';
const output = process.env.QA_OUTPUT || '/tmp/qxw-studio-qa';
fs.mkdirSync(output, { recursive: true });
async function pixels(page, compare = false) {
  return page.locator('.portrait-stage canvas').evaluate((canvas, compare) => {
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const values = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, values);
    let opaque = 0, transparent = 0, soft = 0, changed = 0, lit = 0;
    let left = canvas.width, right = 0, bottom = canvas.height, top = 0;
    for (let i = 0; i < values.length; i += 64) {
      if (values[i + 3] > 128) {
        opaque++;
        const x = (i / 4) % canvas.width, y = Math.floor(i / 4 / canvas.width);
        left = Math.min(left, x); right = Math.max(right, x); bottom = Math.min(bottom, y); top = Math.max(top, y);
      }
      if (values[i + 3] === 0) transparent++;
      if (values[i + 3] > 0 && values[i + 3] < 128) soft++;
      if (values[i] + values[i + 1] + values[i + 2] > 70 && values[i + 3] > 128) lit++;
      if (compare && window.previousPixels && Math.abs(values[i] - window.previousPixels[i]) + Math.abs(values[i + 1] - window.previousPixels[i + 1]) + Math.abs(values[i + 2] - window.previousPixels[i + 2]) > 8) changed++;
    }
    window.previousPixels = values;
    return { opaque, transparent, soft, lit, changed, widthRatio: (right - left) / canvas.width, heightRatio: (top - bottom) / canvas.height };
  }, compare);
}
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(new URL('index.html', base).href, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('.portrait-stage')?.dataset.status === 'webgl');
    const first = await pixels(page); assert(first.opaque > 500 && first.transparent > 500 && first.soft > 100 && first.lit > 300, JSON.stringify(first));
    await page.waitForTimeout(700);
    const wind = await pixels(page, true); assert(wind.changed > 40, 'Local hair wind must change rendered pixels');
    await page.locator('[data-toggle-portrait]').click();
    const paused = await page.locator('.portrait-stage').getAttribute('data-frames');
    await page.waitForTimeout(300); assert.equal(await page.locator('.portrait-stage').getAttribute('data-frames'), paused);
    await pixels(page);
    const bounds = await page.locator('.portrait-art').boundingBox();
    await page.mouse.move(bounds.x + bounds.width * .88, bounds.y + bounds.height * .42);
    await page.waitForTimeout(250); assert.equal((await pixels(page, true)).changed, 0, 'Pointer must not transform the portrait');
    await page.locator('[data-toggle-portrait]').click();
    await page.waitForFunction(value => Number(document.querySelector('.portrait-stage').dataset.frames) > Number(value), paused);
    for (const [width, height] of [[1920,1080], [1440,900], [768,1024], [390,844], [320,568]]) {
      await page.setViewportSize({ width, height }); await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(250);
      const sample = await pixels(page); assert(sample.lit > 100 && sample.transparent > 100, `${width}: ${JSON.stringify(sample)}`);
      assert(sample.widthRatio > (width >= 1000 ? .68 : .80), `Character must fill the hero: ${width}: ${JSON.stringify(sample)}`);
      const expectedHeight = await page.evaluate(() => document.querySelector('.portrait-image').clientHeight / document.querySelector('.portrait-stage').clientHeight);
      assert(sample.heightRatio > expectedHeight * .90, `Full character must fill its measured image area: ${width}: ${JSON.stringify(sample)}`);
      assert(Number(await page.locator('.portrait-stage').getAttribute('data-scale')) > 1, 'Do not restore the undersized .94 scene');
      assert(await page.locator('.portrait-copy').evaluate(copy => {
        const title = copy.getBoundingClientRect(), hero = copy.closest('section').getBoundingClientRect();
        return title.left >= hero.left && title.right <= hero.right && title.bottom < hero.bottom;
      }));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert(await page.locator('.portrait-image').evaluate(el => {
        const image = el.getBoundingClientRect(), hero = el.closest('section').getBoundingClientRect();
        return image.top >= hero.top && image.bottom <= hero.bottom;
      }), 'The image including the foreground resume must fit vertically');
      await page.screenshot({ path: path.join(output, `studio-${width}.png`) });
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.querySelector('[data-toggle-portrait]').disabled);
    assert(await page.locator('[data-toggle-portrait]').isDisabled());
    const reduced = await page.locator('.portrait-stage').getAttribute('data-frames'); await page.waitForTimeout(250);
    assert.equal(await page.locator('.portrait-stage').getAttribute('data-frames'), reduced);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    for (let i = 0; i < 5; i++) {
      await page.locator('nav [data-page-link="experience"]').click(); await page.locator('#experience').waitFor();
      assert.equal(await page.locator('canvas').count(), 0);
      await page.locator('nav [data-page-link="capabilities"]').click();
      await page.waitForFunction(() => document.querySelector('.portrait-stage')?.dataset.status === 'webgl');
      assert.equal(await page.locator('canvas').count(), 1);
    }
    const hidden = await page.locator('.portrait-stage').getAttribute('data-frames');
    await page.locator('#capabilities').scrollIntoViewIfNeeded(); await page.waitForTimeout(250);
    const offscreen = await page.locator('.portrait-stage').getAttribute('data-frames'); await page.waitForTimeout(200);
    assert.equal(await page.locator('.portrait-stage').getAttribute('data-frames'), offscreen);
    assert(Number(offscreen) >= Number(hidden));
    for (const id of ['experience', 'methods', 'insights', 'skills']) {
      await page.locator(`nav [data-page-link="${id}"]`).click(); await page.locator(`#${id}`).waitFor();
      assert(await page.locator('#studio-backdrop img').evaluate(el => el.complete && el.naturalWidth > 0 && getComputedStyle(el).filter.includes('blur')));
      assert.equal(await page.locator('main canvas, main .portrait-image').count(), 0);
      await page.waitForFunction(() => { const item = document.querySelector('main [data-reveal]'); return !item || getComputedStyle(item).opacity === '1'; });
      await page.screenshot({ path: path.join(output, `${id}-mobile.png`) });
    }
    await page.locator('#edit-profile').click();
    const download = page.waitForEvent('download'); await page.locator('#export-site').click();
    const file = path.join(output, 'animated-offline.html'); await (await download).saveAs(file);
    const offlineContext = await browser.newContext({ offline: true, viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
    await offlineContext.route('https://studio.test/portfolio.html', route => route.fulfill({ contentType: 'text/html', body: fs.readFileSync(file, 'utf8') }));
    const offline = await offlineContext.newPage(); const failed = [];
    offline.on('requestfailed', request => failed.push(request.url())); offline.on('pageerror', error => errors.push(error.message));
    await offline.goto('https://studio.test/portfolio.html');
    await offline.locator('nav [data-page-link="capabilities"]').click();
    await offline.waitForFunction(() => document.querySelector('.portrait-stage')?.dataset.status === 'webgl');
    assert((await pixels(offline)).lit > 100);
    const time = await offline.locator('.portrait-stage').getAttribute('data-time'); await offline.waitForTimeout(250);
    assert(Number(await offline.locator('.portrait-stage').getAttribute('data-time')) > Number(time));
    assert(await offline.locator('#studio-backdrop img').evaluate(el => el.src.startsWith('data:') && el.naturalWidth > 0));
    assert.deepEqual(failed, []);
    const fallback = await browser.newPage({ reducedMotion: 'reduce' });
    await fallback.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) { return /webgl/.test(type) ? null : getContext.call(this, type, ...args); };
    });
    await fallback.goto(new URL('index.html', base).href);
    await fallback.waitForFunction(() => document.querySelector('.portrait-stage')?.dataset.status === 'fallback');
    assert(await fallback.locator('.portrait-image').isVisible());
    assert(await fallback.locator('.portrait-image').evaluate(el => el.complete && el.naturalWidth > 0));
    assert.deepEqual(errors, []);
    console.log('PASS nonblank/soft-alpha WebGL pixels at five sizes, hair motion, no pointer transform, pause/reduced-motion/offscreen stop, scene disposal, blurred backgrounds, animated offline export, and WebGL fallback.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
