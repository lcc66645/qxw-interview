const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:4203/';
const output = '/tmp/qxw-resume-scroll-qa';
fs.mkdirSync(output, { recursive: true });
async function scrollProgress(page, value) {
  await page.evaluate(value => {
    const hero = document.querySelector('.portrait-intro');
    const start = Number(hero.dataset.resumeStartScroll), end = Number(hero.dataset.resumeEndScroll);
    scrollTo({ top: start + (end - start) * value + (value === 1 ? 2 : 0), behavior: 'instant' });
  }, value);
  await page.waitForFunction(value => Math.abs(Number(document.querySelector('.creator-about').dataset.resumeProgress) - value) < .01, value);
}
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ reducedMotion: 'no-preference' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    for (const [width, height] of [[1920,1080], [1440,900], [768,1024], [390,844], [320,568]]) {
      await page.setViewportSize({ width, height });
      await page.goto(new URL('index.html', base).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.querySelector('.portrait-stage').dataset.status === 'webgl');
      const size = await page.evaluate(() => {
        const hero = document.querySelector('.portrait-intro').getBoundingClientRect();
        const art = document.querySelector('.portrait-image').getBoundingClientRect();
        return { art: art.height, hero: hero.height, top: art.top - hero.top, bottom: art.bottom - hero.top };
      });
      const mobile = width <= 640;
      const previousHeight = mobile ? Math.max(300, Math.min(560, height - 235)) : Math.min(780, height - 220);
      const scale = mobile ? height <= 650 ? 1.4 : 1.12 : width <= 900 ? 1.18 : 1.48;
      assert(Math.abs(size.art - (previousHeight - (mobile ? 88 : 0)) * scale) < 1, 'Preserve previous character size');
      assert(size.top >= 17 && size.bottom <= size.hero - 17, 'Full image and foreground resume fit in the taller section');
      assert.equal(await page.locator('.resume-history article').count(), 2);
      assert(await page.locator('.portrait-next').evaluate(element => {
        const rect = element.getBoundingClientRect(); return rect.top > 0 && rect.bottom < innerHeight;
      }), 'A resume preview/entry must be visible in the first viewport');
      const matrixStart = await page.locator('.creator-about').evaluate(element => new DOMMatrix(getComputedStyle(element).transform).a);
      assert(matrixStart > 0 && matrixStart < .7);
      await page.screenshot({ path: `${output}/start-${width}.png` });
      await scrollProgress(page, .5);
      const matrixMiddle = await page.locator('.creator-about').evaluate(element => new DOMMatrix(getComputedStyle(element).transform).a);
      assert(matrixMiddle > matrixStart && matrixMiddle < 1);
      await page.screenshot({ path: `${output}/middle-${width}.png` });
      await scrollProgress(page, 1);
      assert(await page.locator('.creator-about').evaluate(element => {
        const matrix = new DOMMatrix(getComputedStyle(element).transform), rect = element.getBoundingClientRect();
        return Math.abs(matrix.a - 1) < .001 && Math.abs(matrix.d - 1) < .001 && rect.left >= 0 && rect.right <= innerWidth + 1;
      }));
      assert(await page.locator('#about-title').evaluate(element => {
        const rect = element.getBoundingClientRect(); return rect.top >= document.querySelector('.header').getBoundingClientRect().bottom && rect.bottom < innerHeight;
      }));
      assert(await page.locator('.resume-history h4, .resume-history p, .about-name').evaluateAll(elements => elements.every(element => element.scrollWidth <= element.clientWidth + 1)));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `${output}/resume-${width}.png` });
      await scrollProgress(page, .25);
      assert(await page.locator('.creator-about').evaluate(element => new DOMMatrix(getComputedStyle(element).transform).a < 1), 'Reverse scrolling must reverse the transition');
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      await page.locator('.portrait-next').click();
      await page.waitForFunction(() => Number(document.querySelector('.creator-about').dataset.resumeProgress) > .995);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => !document.querySelector('.creator-about').classList.contains('resume-sheet'));
      assert.equal(await page.locator('.creator-about').evaluate(element => getComputedStyle(element).transform), 'none');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      console.log(`PASS preserved character size, full-height frame, reversible book-to-resume, resume link and reduced motion at ${width}x${height}`);
    }
    await page.goto(new URL('index.html', base).href);
    await page.locator('nav [data-page-link="experience"]').click(); await page.locator('#experience').waitFor();
    assert.equal(await page.locator('.resume-sheet').count(), 0);
    await page.locator('nav [data-page-link="capabilities"]').click(); await page.locator('.portrait-intro').waitFor();
    await page.waitForFunction(() => !!document.querySelector('.portrait-intro').dataset.resumeEndScroll);
    await scrollProgress(page, 1);
    await page.locator('#edit-profile').click();
    const download = page.waitForEvent('download'); await page.locator('#export-site').click();
    const file = `${output}/resume-offline.html`; await (await download).saveAs(file);
    const context = await browser.newContext({ offline: true, viewport: { width: 390, height: 844 } });
    await context.route('https://resume.test/portfolio.html', route => route.fulfill({ contentType: 'text/html', body: fs.readFileSync(file) }));
    const offline = await context.newPage(); const failed = [];
    offline.on('requestfailed', request => failed.push(request.url())); offline.on('pageerror', error => errors.push(error.message));
    await offline.goto('https://resume.test/portfolio.html');
    await offline.waitForFunction(() => !!document.querySelector('.portrait-intro').dataset.resumeEndScroll);
    await scrollProgress(offline, .5); await scrollProgress(offline, 1);
    assert.equal(await offline.locator('.resume-history article').count(), 2);
    assert.deepEqual(failed, []); assert.deepEqual(errors, []);
    await context.close();
    console.log('PASS offline scroll resume, route teardown/remount, no script errors or external resources.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
