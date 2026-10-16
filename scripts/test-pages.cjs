const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data/portfolio.json'), 'utf8'));
const base = process.env.BASE_URL || 'http://127.0.0.1:4193/';
const output = process.env.QA_OUTPUT || '/tmp/qxw-pages-qa';
fs.mkdirSync(output, { recursive: true });
const definitions = Object.entries(data.pages);
const routeUrl = id => new URL(`index.html${data.pages[id].route}`, base).href;

async function checkPage(page, id) {
  const definition = data.pages[id];
  await page.locator(`main > #${id}`).waitFor();
  assert.equal(await page.locator('body').getAttribute('data-page'), id);
  assert.equal(await page.locator('main > .section').count(), 1);
  assert.equal(await page.locator('main h1').count(), 1);
  assert.equal(await page.locator('nav [aria-current="page"]').getAttribute('data-page-link'), id);
  assert((await page.title()).startsWith(definition.title));
  for (const [key] of definitions) if (key !== id) assert.equal(await page.locator(`main > #${key}`).count(), 0);
  assert.equal(await page.locator('.role-transfer, .role-mapping, #role-mapping-list').count(), 0);
  assert.equal(await page.locator('.fit-index, .creator-hero, .work-marquee, .project-grid, .project-card, .filters, #work-template').count(), 0);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const ids = await page.locator('[id]').evaluateAll(els => els.map(el => el.id));
  assert.equal(ids.length, new Set(ids).size);
  assert(await page.locator('nav a').evaluateAll(els => els.every(el => {
    const rect = el.getBoundingClientRect(); return rect.width > 0 && rect.left >= 0 && rect.right <= innerWidth + 1;
  })));
  const copy = await page.locator('main').textContent();
  for (const forbidden of ['可迁移能力', '目标岗位能力', '非实时官方 JD', '来源', '口径', '原文', '待补', '独立审计']) assert(!copy.includes(forbidden), forbidden);
}

(async () => {
  assert.equal(definitions.length, 5);
  assert(!Object.hasOwn(data.extensions, 'roleMappings'));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage(); const errors = []; const failed = []; const documents = [];
    page.on('request', request => { if (request.isNavigationRequest() && request.resourceType() === 'document') documents.push(request.url()); });
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) failed.push(response.url()); });
    await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { window.copiedEmail = text; } } }));
    for (const [width, height] of [[1920,1080], [1440,900], [768,1024], [390,844], [320,568]]) {
      await page.setViewportSize({ width, height });
      for (const [id, definition] of definitions) {
        await page.goto(routeUrl(id), { waitUntil: 'networkidle' });
        await checkPage(page, id);
        assert.deepEqual(await page.locator('nav a').evaluateAll(els => els.map(el => el.getAttribute('href'))), definitions.map(([, value]) => value.route));
        if (id === 'experience') {
          await page.evaluate(() => document.querySelectorAll('main details').forEach(el => el.open = true));
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          assert.equal(await page.locator('.review-table').count(), 1);
          assert.equal(await page.locator('.review-table tbody tr').count(), 4);
          for (const [row, index] of [0, 1, 2, 4].entries()) {
            const point = data.campaignReview.points[index];
            assert.deepEqual(await page.locator('.review-table tbody tr').nth(row).locator('th, td').allTextContents(), [point.name, `${point.vv / 10000}万`, `${point.acquisitions}人`, `${point.reactivations}人`]);
          }
          assert.equal(await page.locator('.review-chart').count(), 1);
          assert.equal(await page.locator('.job-okr .okr-row').count(), 3);
          assert.equal(await page.locator('.job-okr .okr-results li').count(), 8);
          for (const item of data.source.jobs[0].okr) {
            for (const result of item.results) assert((await page.locator('.job-okr').innerText()).includes(result.slice(result.indexOf('：') + 1)));
          }
          assert.deepEqual(await page.locator('#employer-0 > .practice-point').evaluateAll(elements => elements.map(element => element.id)), data.presentation.practiceOrder.map(index => `competence-0-${index}`));
          assert.equal(await page.locator('.practice-deliverable').count(), 5);
          for (const fragment of ['TOP13', 'P0–P3', '830万VV', '691万VV', '团队→小组→个人']) assert((await page.locator('#employer-0').innerText()).includes(fragment), fragment);
          assert.equal(await page.locator('.project-visual:visible').count(), 5);
          assert.equal(await page.locator('.weekly-comparison .comparison-row').count(), 2);
          assert.equal(await page.locator('.practice-point:visible').count(), 7);
          assert.equal(await page.locator('.case-stage').count(), 6);
          assert.equal(await page.locator('.review-actions > div').count(), 3);
          assert(await page.locator('#experience-list').evaluate(el => el.lastElementChild.id === 'business-review' && el.children[1].id === 'employer-1'));
          const links = new Set(await page.locator('main a[href^="https://"]').evaluateAll(els => els.map(el => el.href)));
          data.source.links.forEach(link => assert(links.has(link.url), link.title));
          assert(await page.locator('main img').evaluateAll(els => els.every(el => el.complete && el.naturalWidth > 0)));
          assert(await page.locator('.project-visual img').evaluateAll(images => images.every(image => {
            const canvas = document.createElement('canvas'); canvas.width = 60; canvas.height = 40;
            const context = canvas.getContext('2d'); context.drawImage(image, 0, 0, 60, 40);
            const pixels = context.getImageData(0, 0, 60, 40).data; let dark = 0;
            for (let index = 0; index < pixels.length; index += 4) if ((pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3 < 110) dark++;
            return dark / (60 * 40) > .65;
          })), 'Every evidence graphic must use a dark presentation');
          await page.evaluate(() => document.querySelectorAll('main details').forEach(el => el.open = el.id === 'business-review'));
        }
        if ([1440,390].includes(width)) await page.screenshot({ path: path.join(output, `${id}-${width}.png`) });
      }
      console.log(`PASS five secondary views at ${width}x${height}`);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(new URL('index.html', base).href);
    const documentCount = documents.length;
    await page.evaluate(() => { window.routeSession = 'same-portfolio'; window.sharedHeader = document.querySelector('.header'); });
    for (const [id, definition] of definitions.slice(1)) {
      await page.locator(`nav [data-page-link="${id}"]`).click();
      await page.waitForURL(routeUrl(id));
      await checkPage(page, id);
      assert.equal(await page.evaluate(() => scrollY), 0);
      assert(await page.evaluate(() => window.routeSession === 'same-portfolio' && window.sharedHeader === document.querySelector('.header')));
    }
    assert.equal(documents.length, documentCount, 'Top navigation must not load another HTML document');
    assert.equal(context.pages().length, 1, 'Navigation must stay in the same tab');
    await page.goBack(); await checkPage(page, 'insights');
    await page.goForward(); await checkPage(page, 'skills');
    for (const [id] of definitions) { await page.goto(routeUrl(id)); await page.reload({ waitUntil: 'networkidle' }); await checkPage(page, id); }
    await page.goto(new URL('index.html', base).href);
    assert.equal(await page.locator('main h1').textContent(), data.profile.name);
    assert(await page.locator('.portrait-image').evaluate(el => el.complete && el.naturalWidth > 0));
    assert(await page.locator('#main').evaluate(el => el.firstElementChild.classList.contains('portrait-intro') && el.children[1].classList.contains('creator-about')));
    await page.goto(routeUrl('methods'));
    for (let index = 0; index < data.extensions.methodApplications.length; index++) {
      const target = data.extensions.methodApplications[index].href;
      await page.locator('.method-application').nth(index).click();
      await page.waitForURL(`**/index.html#/experience/${target.slice(1)}`);
      await page.locator(target).waitFor({ state: 'visible' });
      assert(await page.locator(target).isVisible());
      assert(await page.locator(target).evaluate(el => el.tagName !== 'DETAILS' || el.open));
      await page.waitForFunction(selector => { const y = document.querySelector(selector).getBoundingClientRect().y; return y >= 70 && y < 180; }, target);
      await page.goBack(); await checkPage(page, 'methods');
    }
    await page.goto(new URL('index.html#methods', base).href); await page.waitForURL('**/index.html#/methods'); await checkPage(page, 'methods');
    await page.goto(new URL('index.html#competence-0-2', base).href); await page.waitForURL('**/index.html#/experience/competence-0-2');
    assert(await page.locator('#competence-0-2').isVisible());
    await page.goto(routeUrl('skills'));
    await page.locator('#edit-profile').click();
    await page.locator('[data-media-key="team"]').setInputFiles({ name: 'invalid.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
    assert(await page.locator('[data-media-key="team"]').evaluate(el => el.previousElementSibling.textContent.includes('请选择')));
    await page.locator('[name="name"]').fill('跨页验证'); await page.locator('[name="project-title-0"]').fill('增长复盘验证');
    await page.locator('[data-media-key="portrait"]').setInputFiles(path.join(root, 'assets/concept-1.png'));
    await page.waitForFunction(() => document.querySelector('[data-media-key="portrait"]').previousElementSibling.textContent.includes('已选择'));
    await page.locator('[data-media-key="production"]').setInputFiles(path.join(root, 'assets/qxw-production.png'));
    await page.waitForFunction(() => document.querySelector('[data-media-key="production"]').previousElementSibling.textContent.includes('已选择'));
    await page.locator('#profile-form button[type="submit"]').click();
    await page.locator('nav [data-page-link="capabilities"]').click();
    await page.locator('.portrait-image').waitFor({ state: 'attached' });
    assert.equal(await page.locator('.portrait-kind').textContent(), 'PORTRAIT');
    assert(await page.locator('.portrait-image').getAttribute('src').then(src => src.startsWith('data:image/png')));
    await page.locator('nav [data-page-link="experience"]').click(); await page.waitForURL('**/index.html#/experience');
    assert.equal(await page.locator('.header [data-bind="name"]').textContent(), '跨页验证');
    assert.equal(await page.locator('.tip-project-title').textContent(), '增长复盘验证');
    await page.reload({ waitUntil: 'networkidle' }); assert.equal(await page.locator('.tip-project-title').textContent(), '增长复盘验证');
    assert.equal(await page.locator('.practice-point:visible').count(), 7);
    assert.equal(await page.locator('#business-review').evaluate(el => el.open), true);
    await page.locator('#business-review > summary').click();
    assert.equal(await page.locator('#business-review').evaluate(el => el.open), false);
    await page.locator('#business-review > summary').click();
    assert(await page.locator('.case-stage').last().isVisible());
    assert(await page.locator('.case-workflow img').evaluate(el => el.complete && el.naturalWidth > 0));
    assert(await page.locator('.practice-point [data-enlarge="production"] img').getAttribute('src').then(src => src.startsWith('data:image/png')));
    await page.locator('.practice-point [data-enlarge="growth"]').click();
    assert(await page.locator('#project-dialog').evaluate(el => el.open));
    assert(await page.locator('.expanded-visual').evaluate(el => el.complete && el.naturalWidth > 0));
    assert.equal(await page.locator('#project-dialog').evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(23, 27, 28)');
    await page.locator('[aria-label="图像缩放"]').fill('200');
    assert.equal(await page.locator('.expanded-visual').evaluate(el => el.style.width), '200%');
    assert(await page.locator('.visual-dialog-scroll').evaluate(el => el.scrollWidth > el.clientWidth));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.keyboard.press('Escape');
    const states = await page.locator('main details').evaluateAll(els => els.map(el => el.open));
    await page.evaluate(() => { window.print = () => { window.printExpanded = [...document.querySelectorAll('main details')].every(el => el.open); window.dispatchEvent(new Event('afterprint')); }; });
    await page.locator('#print-journey').click(); assert(await page.evaluate(() => window.printExpanded));
    assert.deepEqual(await page.locator('main details').evaluateAll(els => els.map(el => el.open)), states);
    await page.locator('#contact-action').click(); assert.equal(await page.locator('#project-detail a[href^="mailto:"]').getAttribute('href'), `mailto:${data.profile.email}`); await page.keyboard.press('Escape');
    await page.locator('#copy-email').click(); assert.equal(await page.evaluate(() => window.copiedEmail), data.profile.email);
    await page.goto(routeUrl('methods'));
    await page.locator('#edit-profile').click(); const exported = page.waitForEvent('download'); await page.locator('#export-site').click();
    const offlineFile = path.join(output, 'offline.html'); await (await exported).saveAs(offlineFile);
    const offlineHtml = fs.readFileSync(offlineFile, 'utf8');
    const offlineContext = await browser.newContext({ offline: true, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await offlineContext.route('https://portfolio.test/offline.html', route => route.fulfill({ contentType: 'text/html', body: offlineHtml }));
    const offline = await offlineContext.newPage(); offline.on('pageerror', error => errors.push(error.message));
    offline.on('requestfailed', request => failed.push(request.url()));
    await offline.goto('https://portfolio.test/offline.html'); await checkPage(offline, 'methods');
    for (const [id] of definitions) {
      await offline.locator(`nav [data-page-link="${id}"]`).click(); await checkPage(offline, id);
      assert.equal(await offline.evaluate(() => scrollY), 0);
      await offline.waitForFunction(() => [...document.querySelectorAll('main img')].every(el => el.complete && el.naturalWidth > 0 && el.src.startsWith('data:')));
      if (id === 'capabilities') assert.equal(await offline.locator('.portrait-kind').textContent(), 'PORTRAIT');
      await offline.reload(); await checkPage(offline, id);
    }
    await offline.goBack(); await checkPage(offline, 'insights'); await offline.goForward(); await checkPage(offline, 'skills');
    await offline.locator('nav [data-page-link="methods"]').click(); await offline.locator('.method-application').nth(1).click();
    await offline.locator('#business-review').waitFor(); assert(await offline.locator('#business-review').evaluate(el => el.open));
    assert.equal(await offline.locator('.tip-project-title').textContent(), '增长复盘验证');
    await offline.locator('#edit-profile').click(); const again = offline.waitForEvent('download'); await offline.locator('#export-site').click();
    const repeatedFile = path.join(output, 'offline-again.html'); await (await again).saveAs(repeatedFile);
    const repeated = await offlineContext.newPage(); await repeated.setContent(fs.readFileSync(repeatedFile, 'utf8'), { waitUntil: 'load' });
    await checkPage(repeated, 'experience'); assert.equal(await repeated.locator('.case-stage').count(), 6);
    await repeated.locator('nav [data-page-link="methods"]').click(); await checkPage(repeated, 'methods'); assert.equal(await repeated.locator('.method-item').count(), 4);
    const cleanContext = await browser.newContext(); const clean = await cleanContext.newPage(); await clean.goto(new URL('index.html', base).href, { waitUntil: 'networkidle' });
    await clean.locator('#edit-profile').click(); const preview = clean.waitForEvent('download'); await clean.locator('#export-site').click();
    await (await preview).saveAs(process.env.PREVIEW_PATH || path.join(output, 'portfolio-preview.html'));
    await clean.keyboard.press('Escape');
    await clean.locator('nav [data-page-link="experience"]').click();
    await clean.locator('#business-review').waitFor();
    const captureStyle = '.header, .toast, .skip { visibility: hidden !important; }';
    await clean.locator('#competence-0-0').scrollIntoViewIfNeeded();
    await clean.waitForFunction(() => getComputedStyle(document.querySelector('#competence-0-0')).opacity === '1');
    await clean.locator('#competence-0-0').screenshot({ path: path.join(output, 'production-dark-desktop.png'), style: captureStyle });
    await clean.locator('#business-review').screenshot({ path: path.join(output, 'case-fullflow-desktop.png'), style: captureStyle });
    await clean.setViewportSize({ width: 390, height: 844 });
    await clean.locator('#competence-0-0').scrollIntoViewIfNeeded();
    await clean.waitForFunction(() => getComputedStyle(document.querySelector('#competence-0-0')).opacity === '1');
    await clean.locator('#competence-0-0').screenshot({ path: path.join(output, 'production-dark-mobile.png'), style: captureStyle });
    await clean.locator('#business-review').screenshot({ path: path.join(output, 'case-fullflow-mobile.png'), style: captureStyle });
    assert.deepEqual(errors, []); assert.deepEqual(failed, []);
    console.log('PASS portrait-before-About, visible project visuals/data table, image upload/persistence/enlargement, seven work points, six-stage case, same-document routes, original links, edit/contact/print, offline navigation/re-export, and default preview.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
