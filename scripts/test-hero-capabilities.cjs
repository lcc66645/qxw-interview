const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:4193/';
const output = '/tmp/qxw-hero-qa';
fs.mkdirSync(output, { recursive: true });

async function regions(page, compare = false) {
  return page.evaluate(compare => {
    const canvas = document.querySelector('.portrait-stage canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const pixels = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const image = document.querySelector('.portrait-image').getBoundingClientRect();
    const stage = canvas.getBoundingClientRect(), ratio = canvas.width / stage.width;
    const boxes = { hair: [.32,.81,.65,.96], eyebrows: [.42,.628,.58,.718], eyes: [.445,.555,.56,.619], mouth: [.49,.485,.54,.52], collar: [.43,.39,.58,.44], torso: [.39,.20,.60,.39], book: [.12,.03,.52,.19], heldBook: [.63,.18,.69,.48] };
    const result = {};
    for (const [key, [left, bottom, right, top]] of Object.entries(boxes)) {
      let changed = 0, total = 0;
      const x0 = Math.max(0, Math.ceil((image.left - stage.left + left * image.width) * ratio));
      const x1 = Math.min(canvas.width, Math.floor((image.left - stage.left + right * image.width) * ratio));
      const y0 = Math.max(0, Math.ceil((stage.bottom - image.bottom + bottom * image.height) * ratio));
      const y1 = Math.min(canvas.height, Math.floor((stage.bottom - image.bottom + top * image.height) * ratio));
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = (y * canvas.width + x) * 4; total++;
        if (compare && window.regionPixels && Math.abs(pixels[i] - window.regionPixels[i]) + Math.abs(pixels[i+1] - window.regionPixels[i+1]) + Math.abs(pixels[i+2] - window.regionPixels[i+2]) > 8) changed++;
      }
      result[key] = { changed, total };
    }
    if (!compare) window.regionPixels = pixels;
    return result;
  }, compare);
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('.portrait-stage').dataset.status === 'webgl');
    await regions(page);
    let hair = 0, brows = 0;
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(250);
      const sample = await regions(page, true);
      hair = Math.max(hair, sample.hair.changed); brows = Math.max(brows, sample.eyebrows.changed);
      for (const key of ['eyes', 'mouth', 'collar', 'torso', 'book', 'heldBook']) assert.equal(sample[key].changed, 0, `${key} must remain stationary: ${JSON.stringify(sample)}`);
    }
    assert(hair > 50 && brows > 20, `Hair and eyebrows need actual local motion: ${hair}/${brows}`);
    for (const [width, height] of [[1920,1080], [1440,900], [1280,720], [1024,768], [768,1024], [390,844], [320,568]]) {
      await page.setViewportSize({ width, height }); await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(250);
      assert.equal(await page.locator('.resume-trigger, .resume-sheet, .creator-about').count(), 0);
      assert(await page.locator('.about-copy').isVisible());
      assert(await page.locator('.portrait-copy h1, .portrait-history p, .profile-description').evaluateAll(elements => elements.every(el => el.scrollWidth <= el.clientWidth + 1)));
      assert(await page.evaluate(() => {
        const image = document.querySelector('.portrait-image').getBoundingClientRect();
        const art = document.querySelector('.portrait-art').getBoundingClientRect();
        return image.top >= art.top && image.bottom <= art.bottom && !document.querySelector('.capability-entry, .capability-jump, .capability-halo') && document.documentElement.scrollWidth <= innerWidth;
      }), 'Full image must fit without a capability entry or reserved spacer');
      // Sample alpha behind every introduction text rectangle, not the transparent image box.
      const overlaps = await page.evaluate(() => {
        const image = document.querySelector('.portrait-image');
        const rect = image.getBoundingClientRect();
        const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const conflicts = [];
        for (const el of document.querySelectorAll('.portrait-copy h1, .about-copy > *, .portrait-bio h3, .portrait-bio article, .portrait-bio .hero-metrics, .portrait-email')) {
          const box = el.getBoundingClientRect(); let opaque = 0, total = 0;
          for (let y = box.top; y < box.bottom; y += 4) for (let x = box.left; x < box.right; x += 4) {
            const ix = Math.floor((x - rect.left) / rect.width * canvas.width), iy = Math.floor((y - rect.top) / rect.height * canvas.height);
            if (ix < 0 || iy < 0 || ix >= canvas.width || iy >= canvas.height) continue;
            total++; if (pixels[(iy * canvas.width + ix) * 4 + 3] > 128) opaque++;
          }
          if (total && opaque / total > .01) conflicts.push({ text: el.textContent.slice(0, 30), ratio: opaque / total });
        }
        return conflicts;
      });
      assert.deepEqual(overlaps, [], `${width}x${height}: introduction must not cover the character`);
      await page.screenshot({ path: `${output}/hero-${width}.png` });
      await page.goto(`${base}#/capabilities/capabilities`);
      await page.waitForURL('**#/capabilities/capabilities');
      await page.waitForFunction(() => document.querySelector('#capabilities').getBoundingClientRect().top < 200);
      assert.equal(await page.locator('.capability-case').count(), 3);
      await page.locator('.capability-item').first().waitFor();
      await page.goto(base);
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.querySelector('[data-toggle-portrait]').disabled);
    assert.equal(await page.locator('.capability-entry, .capability-jump, .capability-halo').count(), 0);
    await page.goto(`${base}#/capabilities/home`);
    assert(await page.locator('.about-copy').isVisible());
    assert.deepEqual(errors, []);
    console.log(`PASS local hair/brow pixels (${hair}/${brows}), stationary eyes/body/book, seven responsive alpha-overlap checks, removed particle entry, retained capability deep links, and reduced motion.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
