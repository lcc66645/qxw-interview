const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const data = require('../data/portfolio.json');
const base = process.env.BASE_URL || 'http://127.0.0.1:4211/';
const output = process.env.QA_OUTPUT || '/tmp/qxw-three-dimensions-qa';
fs.mkdirSync(output, { recursive: true });
const ids = Object.keys(data.pages);
const route = id => new URL(`index.html${data.pages[id].route}`, base).href;
async function checkCampaignEvidence(page) {
  await page.locator('[data-section-target="case-growth"]').click();
  assert.deepEqual(await page.locator('.campaign-metrics dd').allTextContents(), ['119条', '3,690万', '238人', '2,443人']);
  for (const [groupIndex, indices] of [[0, 1], [2, 5, 6]].entries()) {
    const points = indices.map(i => data.campaignReview.points[i]);
    const values = [points.reduce((n,p) => n + p.vv, 0) / data.campaignReview.overview.vv * 100, points.reduce((n,p) => n + p.acquisitions, 0) / data.campaignReview.overview.acquisitions * 100];
    const group = page.locator('.share-group').nth(groupIndex);
    assert.deepEqual(await group.locator('strong').allTextContents(), values.map(v => `${v.toFixed(1)}%`));
    assert(await group.locator('.share-track').evaluateAll((tracks, values) => tracks.every((track, i) => Math.abs(track.firstElementChild.getBoundingClientRect().width / track.getBoundingClientRect().width * 100 - values[i]) < .15), values));
  }
  assert.equal(await page.locator('.focus-table tbody tr').count(), 3);
  await page.locator('#selling-point-data > summary').click();
  assert.equal(await page.locator('.selling-point-table tbody tr').count(), 9);
  for (const [i, point] of data.campaignReview.points.entries()) {
    const cells = await page.locator('.selling-point-table tbody tr').nth(i).locator('th,td').allTextContents();
    assert.deepEqual(cells.slice(0, 6), [point.name, String(point.videos), `${point.vv / 10000}万`, `${point.acquisitions}人`, `${point.reactivations}人`, point.acquisitionsPerMillion.toFixed(1)]);
    assert(cells[6].length > 0, 'Each selling point exposes a concrete operating judgment');
  }
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.locator('#selling-point-data > summary').click(); await page.locator('#case-growth > summary').click();
  await page.locator('[data-section-target="case-results"]').click();
}
async function check(page, id) {
  await page.locator(`main > #${id}`).waitFor();
  assert.equal(await page.locator('body').getAttribute('data-page'), id);
  assert.equal(await page.locator('nav [aria-current]').getAttribute('data-page-link'), id);
  assert.equal(await page.locator('main h1').count(), 1);
  assert((await page.title()).startsWith(data.pages[id].title));
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert(await page.locator('nav a').evaluateAll(items => items.every(item => { const r = item.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1; })));
  const identifiers = await page.locator('[id]').evaluateAll(items => items.map(item => item.id));
  assert.equal(identifiers.length, new Set(identifiers).size);
  assert.equal(await page.locator('.experience-tabs, .practice-point, .case-stage, .growth-operation-loop, .decision-timeline, .role-mapping').count(), 0);
  const copy = await page.locator('main').textContent();
  if (id !== 'skills') {
    for (const phrase of ['小懂', '119条', 'TOP13', '3,690万', '64.3%']) assert(!copy.includes(phrase), `Case leaked into ${id}: ${phrase}`);
    assert.equal(await page.locator('#growth-evidence, .selling-point-table, #matrix-budget-control').count(), 0);
  }
  for (const phrase of ['简单有为', 'UWANT', '郝家豁', '千川', '来源', '口径', '待补', '稳定水位', '保证打正', '贡献了65%', '企业付费转化提升', 'Agent配置上线']) assert(!copy.includes(phrase), phrase);
}

(async () => {
  assert.deepEqual(data.campaignReview, require('../data/campaign-review.json'));
  assert.deepEqual(data.presentation.dimensions.map(item => item.title), ['用户增长思维', '团队管理执行', '个人AIGC创作能力']);
  assert(data.presentation.dimensions.every(item => item.points.length === 3));
  assert.equal((153 / 238 * 100).toFixed(1), '64.3');
  assert.equal(data.presentation.productionCost.durationSeconds, 15);
  assert.deepEqual(data.presentation.productionCost.segments.map(item => item.tokens), [495, 135]);
  assert(!fs.existsSync('interview-growth-answers.md'));
  const attachment = data.attachments[0];
  const promptBytes = fs.readFileSync(attachment.path); const promptText = promptBytes.toString('utf8');
  assert.equal(createHash('sha256').update(promptBytes).digest('hex'), attachment.sha256);
  assert.equal([...promptText.matchAll(/^## ENV-\d{2}｜/gm)].length, 12);
  assert.equal([...promptText.matchAll(/^## CH-\d{2}｜/gm)].length, 5);
  assert.equal([...promptText.matchAll(/^### V\d{2}-[A-Z]｜/gm)].length, 23);
  data.presentation.evidenceBoards.creation.representative.samples.forEach(sample => sample.fields.forEach(([, quote]) => assert(promptText.includes(quote), sample.id)));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage(); const errors = [], failures = [], documents = [], evidence = new Set();
    page.on('pageerror', error => errors.push(error.message)); page.on('response', response => { if (response.status() >= 400) failures.push(response.url()); });
    page.on('request', request => { if (request.isNavigationRequest()) documents.push(request.url()); });
    for (const [width, height] of [[1920,1080], [1440,900], [768,1024], [390,844], [320,568]]) {
      await page.setViewportSize({ width, height });
      for (const id of ids) {
        await page.goto(route(id), { waitUntil: 'networkidle' }); await check(page, id);
        for (const href of await page.locator('main a[href^="https:"]').evaluateAll(items => items.map(item => item.href))) evidence.add(href);
        if (id === 'capabilities') {
          assert.equal(await page.locator('.capability-case').count(), 3);
          assert.equal(await page.locator('.portrait-history article').count(), 1);
          assert(await page.locator('#about-title').isVisible());
        }
        if (['experience', 'methods', 'insights'].includes(id)) {
          const dimension = data.presentation.dimensions.find(item => item.page === id);
          assert.equal(await page.locator('.dimension-point').count(), id === 'insights' ? 3 : 0);
          assert.equal(await page.locator('.dimension-thesis').textContent(), dimension.thesis);
          assert.deepEqual(await page.locator('.dimension-evidence').allTextContents(), id === 'insights' ? dimension.points.map(item => item.evidence) : []);
          assert.deepEqual(await page.locator('.dimension-metrics dd').allTextContents(), id === 'methods' ? dimension.metrics.map(item => item.value) : []);
          assert.equal(await page.locator('.page-outline a').count(), 3);
          if (id === 'insights') assert((await page.locator('.dimension-points').innerText()).length < 650);
          assert((await page.locator('main').innerText()).length < ({ experience: 2600, methods: 2800, insights: 2600 }[id]), 'Numbered sections keep bounded copy; detailed prompts remain collapsed');
        }
        if (id === 'experience') {
          assert.equal(await page.locator('.growth-krs > div').count(), 1);
          assert.equal(await page.locator('.growth-krs dd').first().textContent(), '300人 / 人 / 月');
          assert((await page.locator('.growth-krs p').first().textContent()).includes('规划'));
          assert.deepEqual(await page.locator('.policy-content-types dt').allTextContents(), ['品宣型', '效果型']);
          assert((await page.locator('.policy-labels').innerText()).includes('至少80%'));
          assert((await page.locator('.growth-policy').innerText()).includes('排期要求'));
          await page.locator('[data-section-target="growth-budget"]').click();
          await page.locator('#production-cost-control > summary').click();
          assert.deepEqual(await page.locator('.cost-segment strong').allTextContents(), ['495 token', '约135 token']);
          assert.deepEqual(await page.locator('.cost-policy tbody tr td:first-of-type').allTextContents(), ['Seedance 2.5', 'Seedance 2.0', '禁用2.5']);
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          await page.locator('#production-cost-control > summary').click();
          await page.locator('[data-section-target="growth-goal"]').click();
        }
        if (id === 'methods') {
          assert.equal(await page.locator('.okr-row, .okr-results, #production-cost-control').count(), 0);
          assert.equal(await page.locator('#team-review [data-visual="review"]').count(), 1);
          assert.equal(await page.locator('[data-visual="team"]').count(), 1);
          assert.deepEqual(await page.locator('#team-analysis > h2, #team-review > h2, #team-execution > h2').allTextContents(), ['01 / 数据分析：从作品明细到管理决策', '02 / 内容×业务复盘', '03 / 团队管理与交付']);
          assert.equal(await page.locator('main details[open]').count(), 0);
          assert.equal(await page.locator('.management-table tbody tr').count(), 4);
          assert.equal(await page.locator('.demo-pivot-table tbody tr').count(), 3);
          assert((await page.locator('#analysis-demo').innerText()).includes('匿名演示数据'));
        }
        if (id === 'insights') {
          assert.equal(await page.locator('.creation-stage[open], #creator-case-detail[open], .creation-stages, details#creation-tools').count(), 0);
          assert(await page.locator('.stage-content').evaluateAll(items => items.every(el => !el.checkVisibility())));
          assert(await page.locator('#creation-tools').evaluate(el => el.closest('section').id === 'creation-workflow'));
          assert(await page.locator('#dimension-content').evaluate(el => {
            const children = [...el.children];
            return children.indexOf(el.querySelector('.dimension-points')) < children.indexOf(el.querySelector('#creation-workflow')) && children.indexOf(el.querySelector('#creation-workflow')) < children.indexOf(el.querySelector('.authored-work'));
          }));
          assert.equal(await page.locator('.dimension-point:not([open])').count(), 3);
          const copy = await page.locator('.dimension-points').textContent();
          for (const value of ['4个账号', '1000万', '抖音自然流拉新50+', '月均涨粉3万+']) assert(copy.includes(value));
          await page.locator('[data-section-target="featured-evidence"]').click();
          assert(await page.locator('.representative-link').evaluateAll(items => items.every((item, i) => !i || (item.getBoundingClientRect().top >= items[i - 1].getBoundingClientRect().bottom && Math.abs(item.getBoundingClientRect().left - items[i - 1].getBoundingClientRect().left) < 1))));
          await page.locator('#creator-case-detail > summary').click();
          assert.deepEqual(await page.locator('.creator-case-metrics dd').allTextContents(), ['1天', '1–2次', '23条']);
          assert((await page.locator('.creator-case-metrics dt').nth(1).textContent()).includes('每30秒'));
          assert.equal(await page.locator('#creator-xiaolaoban .creator-decisions > div').count(), 4);
          assert.equal(await page.locator('.prompt-sample[open]').count(), 0);
          const download = page.locator('[data-attachment="xiaolaoban-prompts"]');
          assert.equal(await download.getAttribute('href'), attachment.path);
          assert.equal(await download.getAttribute('download'), attachment.filename);
          for (const sample of data.presentation.evidenceBoards.creation.representative.samples) {
            await page.locator(`#${sample.id} > summary`).click();
            assert.deepEqual(await page.locator(`#${sample.id} blockquote`).allTextContents(), sample.fields.map(([,quote]) => quote));
            assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            await page.locator(`#${sample.id} > summary`).click();
          }
          assert.equal(await page.locator('.representative-link, .account-links a').count(), 9);
          assert.equal(await page.locator('.creation-step-link').count(), 9);
          assert.equal(await page.locator('.creation-stage').count(), 9);
          assert.equal(await page.locator('.creation-stage[open]').count(), 0);
          assert.equal(await page.locator('.creation-failure-table tbody tr').count(), 3);
          await page.locator('#creator-case-detail > summary').click();
          await page.locator('[data-section-target="creation-workflow"]').click();
          for (const [i, stage] of data.presentation.evidenceBoards.creation.stages.entries()) {
            const detail = page.locator('.creation-stage').nth(i); await detail.locator('summary').click();
            assert.deepEqual(await detail.locator('.stage-content dd').allTextContents(), [stage.tools, stage.action, stage.output, stage.check, stage.example]);
            await detail.locator('summary').click();
          }
          await page.locator('.creation-step-link').nth(4).click();
          await page.waitForFunction(() => document.querySelector('#creation-step-5')?.open);
          assert.equal(await page.locator('#creation-step-5').evaluate(el => el.open), true);
          assert(page.url().endsWith('#/insights/creation-step-5'));
          await page.reload(); assert(await page.locator('#creation-step-5').evaluate(el => el.open));
          await page.goto(route('insights')); await check(page, id);
        }
        if (id === 'skills') {
          assert(await page.locator('#business-review').isVisible());
          assert.equal(await page.locator('.case-perspective').count(), 4); assert.equal(await page.locator('.case-perspective[open]').count(), 0);
          await checkCampaignEvidence(page);
          assert.deepEqual(await page.locator('.case-results .metric-list dd').allTextContents(), ['119条', '3,690万', '238人', '2,443人']);
          assert.equal(await page.locator('.review-table tbody tr').count(), 4); assert.equal(await page.locator('.badcase-item').count(), 3);
          for (const [row, index] of [0, 1, 2, 4].entries()) {
            const point = data.campaignReview.points[index];
            assert.deepEqual(await page.locator('.review-table tbody tr').nth(row).locator('th,td').allTextContents(), [point.name, `${point.vv / 10000}万`, `${point.acquisitions}人`, `${point.reactivations}人`]);
          }
          for (const item of data.presentation.casePerspectives) {
            await page.goto(new URL(`index.html#/skills/${item.id}`, base).href);
            assert((await page.locator(`#${item.id}`).innerText()).includes(item.action));
            await page.locator(`#${item.id} > summary`).click();
          }
          await page.locator('[data-section-target="case-results"]').click();
        }
        if ([1440,390,320].includes(width)) {
          await page.mouse.move(0, 0); await page.evaluate(() => { document.activeElement?.blur(); scrollTo({ top: 0, behavior: 'instant' }); });
          await page.waitForFunction(() => scrollY === 0);
          await page.screenshot({ path: `${output}/${id}-${width}.png`, fullPage: id !== 'capabilities' });
        }
      }
      console.log(`PASS three dimensions + real case at ${width}x${height}`);
    }
    data.source.links.forEach(link => assert(evidence.has(link.url), link.title));
    await page.goto(route('capabilities')); const documentCount = documents.length;
    await page.evaluate(() => { window.sharedHeader = document.querySelector('.header'); });
    for (const id of ids.slice(1)) { await page.locator(`nav [data-page-link="${id}"]`).click(); await check(page, id); assert(await page.evaluate(() => window.sharedHeader === document.querySelector('.header'))); }
    assert.equal(documents.length, documentCount); assert.equal(context.pages().length, 1);
    await page.goBack(); await check(page, 'insights'); await page.goForward(); await check(page, 'skills'); await page.reload(); await check(page, 'skills');
    for (const [hash, expected, target] of [
      ['#/experience/competence-0-0', 'methods', 'production-workflow'], ['#/experience/competence-0-4', 'insights', ''],
      ['#/experience/growth-goal', 'experience', ''], ['#/experience/case-stage-3', 'skills', 'case-growth'],
      ['#/experience/case-stage-4', 'skills', 'case-team'], ['#/experience/pitfall-review', 'skills', 'pitfall-review'],
      ['#/experience/production-cost-control', 'experience', 'production-cost-control'], ['#competence-0-2', 'experience', ''],
      ['#/methods/team-okr', 'methods', 'team-analysis'], ['#/methods/okr-2', 'methods', 'team-execution'],
      ['#/experience/matrix-budget-control', 'skills', 'matrix-budget-control'], ['#/experience/growth-evidence', 'skills', 'growth-evidence']
    ]) {
      await page.goto(new URL(`index.html${hash}`, base).href); await check(page, expected);
      if (target) { assert(await page.locator(`#${target}`).isVisible()); assert(await page.locator(`#${target}`).evaluate(el => el.tagName !== 'DETAILS' || el.open)); }
    }
    await page.goto(route('skills')); await page.locator('#case-detail-evidence > summary').click(); await page.locator('[data-enlarge="growth"]').click();
    await page.locator('[aria-label="图像缩放"]').fill('300');
    assert(await page.locator('.visual-dialog-scroll').evaluate(el => el.scrollWidth > el.clientWidth)); await page.keyboard.press('Escape');
    const opened = await page.locator('main details').evaluateAll(items => items.map(item => item.open));
    await page.evaluate(() => { window.print = () => { window.printComplete = [...document.querySelectorAll('main details')].every(el => el.open); dispatchEvent(new Event('afterprint')); }; });
    await page.locator('#print-journey').click(); assert(await page.evaluate(() => window.printComplete));
    assert.deepEqual(await page.locator('main details').evaluateAll(items => items.map(item => item.open)), opened);
    await page.locator('#contact-action').click(); assert.equal(await page.locator('#project-detail a[href^="mailto:"]').getAttribute('href'), `mailto:${data.profile.email}`); await page.keyboard.press('Escape');
    await page.locator('#edit-profile').click();
    await page.locator('[data-media-key="team"]').setInputFiles({ name: 'invalid.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
    assert(await page.locator('[data-media-key="team"]').evaluate(el => el.previousElementSibling.textContent.includes('请选择')));
    await page.locator('[name="name"]').fill('跨页验证'); await page.locator('[name="project-title-0"]').fill('案例编辑验证');
    await page.locator('[data-media-key="production"]').setInputFiles(path.resolve('assets/qxw-production.png'));
    await page.waitForFunction(() => document.querySelector('[data-media-key="production"]').previousElementSibling.textContent.includes('已选择'));
    await page.locator('#profile-form button[type="submit"]').click(); await page.reload();
    assert.equal(await page.locator('.tip-project-title').textContent(), '案例编辑验证');
    await page.locator('nav [data-page-link="methods"]').click(); assert.equal(await page.locator('.header [data-bind="name"]').textContent(), '跨页验证');
    assert((await page.locator('[data-enlarge="production"] img').getAttribute('src')).startsWith('data:image/png'));
    await page.locator('#edit-profile').click(); const download = page.waitForEvent('download'); await page.locator('#export-site').click();
    const file = `${output}/offline.html`; await (await download).saveAs(file); const html = fs.readFileSync(file, 'utf8');
    for (const javaScriptEnabled of [true, false]) {
      const offlineContext = await browser.newContext({ offline: true, javaScriptEnabled, reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
      await offlineContext.route('https://portfolio.test/offline.html', request => request.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
      const offline = await offlineContext.newPage(); offline.on('pageerror', error => errors.push(error.message));
      const failed = []; offline.on('requestfailed', request => failed.push(request.url()));
      await offline.goto('https://portfolio.test/offline.html'); assert(await offline.locator('#methods').isVisible());
      if (javaScriptEnabled) for (const id of ids) { await offline.locator(`nav [data-page-link="${id}"]`).click(); await check(offline, id); }
      else {
        assert(await offline.locator('.demo-pivot-table').isVisible());
        assert(await offline.locator('.management-table').isVisible());
        assert.equal(await offline.locator('.cost-policy').count(), 0);
        assert.equal(await offline.locator('.analysis-steps, .analysis-controls').count(), 0, 'Static first paint must not show dead tab/filter controls');
        assert((await offline.locator('#analysis-demo').innerText()).includes('演示周 · D1–D4 · 全部小组'));
      }
      assert.deepEqual(failed, []); await offlineContext.close();
    }
    const clean = await browser.newContext({ reducedMotion: 'reduce' }); const preview = await clean.newPage(); await preview.goto(route('capabilities'));
    await preview.locator('#edit-profile').click(); const final = preview.waitForEvent('download'); await preview.locator('#export-site').click();
    await (await final).saveAs(process.env.PREVIEW_PATH || `${output}/portfolio-final.html`); await clean.close();
    assert.deepEqual(errors, []); assert.deepEqual(failures, []);
    console.log('PASS 25 view/size combinations, one growth goal/budget owner, anonymous analysis workflow and management tables, source-derived share bars/9-row table, 9 creation steps and reload links, unchanged campaign, 12 evidence links, legacy routes, editing/uploads, print, viewer and offline export.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
