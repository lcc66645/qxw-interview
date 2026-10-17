const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:4196/';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const add = window.addEventListener.bind(window); const remove = window.removeEventListener.bind(window);
      window.motionListeners = { scroll: new Set(), resize: new Set() };
      window.addEventListener = (name, listener, ...options) => { window.motionListeners[name]?.add(listener); add(name, listener, ...options); };
      window.removeEventListener = (name, listener, ...options) => { window.motionListeners[name]?.delete(listener); remove(name, listener, ...options); };
      const Observer = window.IntersectionObserver;
      window.activeObservers = new Set();
      window.IntersectionObserver = class extends Observer {
        constructor(...args) { super(...args); window.activeObservers.add(this); }
        disconnect() { window.activeObservers.delete(this); super.disconnect(); }
      };
    });
    await page.goto(new URL('index.html', base).href, { waitUntil: 'networkidle' });
    assert(await page.locator('.creator-about').isHidden());
    await page.locator('.resume-trigger').click();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.about-copy')).opacity === '1');
    assert.equal(await page.locator('main h1').textContent(), '仇熙雯');
    assert.equal(await page.locator('.creator-hero, .work-marquee, .fit-index, #toggle-motion').count(), 0);
    await page.locator('.capability-item').last().scrollIntoViewIfNeeded();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.capability-item:last-child')).opacity === '1');
    for (let index = 0; index < 15; index++) {
      await page.locator('nav [data-page-link="experience"]').click();
      await page.locator('main > #experience').waitFor();
      await page.locator('nav [data-page-link="methods"]').click();
      await page.locator('main > #methods').waitFor();
    }
    assert.equal(await page.evaluate(() => window.activeObservers.size), 1);
    assert.deepEqual(await page.evaluate(() => Object.fromEntries(Object.entries(window.motionListeners).map(([key, set]) => [key, set.size]))), { scroll: 0, resize: 0 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('nav [data-page-link="capabilities"]').click();
    await page.locator('.portrait-stage').waitFor({ state: 'attached' });
    assert.equal(await page.evaluate(() => window.activeObservers.size), 2);
    assert(await page.locator('.about-copy, .capability-item').evaluateAll(els => els.every(el => getComputedStyle(el).opacity === '1')));
    for (const [width, height] of [[1920,1080], [1440,900], [768,1024], [390,844], [320,568]]) {
      await page.setViewportSize({ width, height }); await page.evaluate(() => scrollTo(0, 0));
      assert(await page.evaluate(() => {
        const hero = document.querySelector('.portrait-intro').getBoundingClientRect();
        const art = document.querySelector('.portrait-image').getBoundingClientRect();
        return document.querySelector('.creator-about').hidden && art.top >= hero.top && art.bottom <= hero.bottom;
      }));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `/tmp/qxw-portrait-final-${width}.png` });
    }
    await page.locator('#edit-profile').click();
    await page.locator('[name="name"]').fill('这是用于验证长姓名排版的测试内容');
    await page.locator('#profile-form button[type="submit"]').click();
    await page.locator('.resume-trigger').click();
    await page.locator('.creator-about').waitFor();
    assert(await page.locator('.about-name').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
    assert(await page.locator('.portrait-copy h1').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
    await page.emulateMedia({ media: 'print' });
    assert(await page.locator('.capability-item').evaluateAll(els => els.every(el => getComputedStyle(el).opacity === '1')));
    assert.deepEqual(errors, []);
    console.log('PASS taller portrait then resume, full image height, entry fades, listener disposal after 30 view switches, reduced motion, five viewport sizes, long edited name, and print visibility.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
