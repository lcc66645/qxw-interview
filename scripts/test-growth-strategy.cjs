const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const data = require('../data/portfolio.json');
const campaign = require('../data/campaign-review.json');
const base = process.env.BASE_URL || 'http://127.0.0.1:4209/';
const output = '/tmp/qxw-growth-strategy-qa';
fs.mkdirSync(output, { recursive: true });

(async () => {
  const strategy = data.presentation.growthStrategy;
  assert.deepEqual(data.campaignReview, campaign);
  assert.equal(strategy.goal.hitsPerMonth * strategy.goal.acquisitionsPerHit, 300);
  assert.equal(strategy.goal.daysPerHit * strategy.goal.hitsPerMonth, 30);
  assert.equal((112 / 305 * 100).toFixed(1), '36.7');
  assert.equal((strategy.channels.douyinVv / strategy.channels.totalVv * 100).toFixed(1), '36.7');
  assert.equal((campaign.points.slice(0, 2).reduce((sum, row) => sum + row.acquisitions, 0) / campaign.overview.acquisitions * 100).toFixed(1), '64.3');
  const answers = fs.readFileSync('interview-growth-answers.md', 'utf8');
  assert.deepEqual([...answers.matchAll(/^## (\d+)\./gm)].map(match => Number(match[1])), Array.from({ length: 13 }, (_, index) => index + 1));
  for (const term of ['目标，不是个人已完成业绩', '播放份额，不是拉新份额', '规划参数', '汽车资讯', '瑞幸', '3,690万', '64.3%']) assert(answers.includes(term), term);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    for (const [width, height] of [[1920,1080], [1440,900], [768,1024], [390,844], [320,568]]) {
      await page.setViewportSize({ width, height }); await page.goto(`${base}#/experience`);
      assert.equal(await page.locator('.experience-panel:visible').count(), 0);
      assert.equal(await page.locator('.okr-row[open], .case-stage[open], .work-decision[open]').count(), 0);
      await page.locator('[data-experience-tab="competence-0-1"]').click();
      assert.equal(await page.locator('#growth-strategy').evaluate(el => el.open), false);
      await page.locator('#growth-strategy > summary').click();
      assert.deepEqual(await page.locator('.goal-formula dd').allTextContents(), ['10', '30', '300']);
      assert((await page.locator('#growth-goal').innerText()).includes('规划参数'));
      assert.deepEqual(await page.locator('.goal-progress-row strong').allTextContents(), ['55%', '8.71%']);
      assert((await page.locator('.channel-snapshot').innerText()).includes('6月底日VV快照：全平台305万、抖音112万；抖音日VV份额36.7%'));
      assert.equal(await page.locator('#growth-channels .strategy-table tbody tr').count(), 4);
      assert(await page.locator('.strategy-table').evaluateAll(tables => tables.every(table => table.scrollWidth <= table.clientWidth + 1)));
      await page.goto(`${base}#/experience/growth-goal`); assert(await page.locator('#growth-strategy').evaluate(el => el.open));
      assert.equal(await page.locator('.experience-panel:visible').getAttribute('data-experience-panel'), 'competence-0-1');
      await page.screenshot({ path: `${output}/goal-${width}.png` });
      await page.goto(`${base}#/experience/growth-channels`); assert(await page.locator('#growth-channels').isVisible());
      await page.screenshot({ path: `${output}/channels-${width}.png` });
      await page.goto(`${base}#/experience/case-stage-2`);
      assert.equal(await page.locator('[data-stage="2"] > summary').evaluate(el => getComputedStyle(el, '::after').content), 'none');
      assert.deepEqual(await page.locator('.user-growth-path li').allTextContents(), strategy.userPath);
      assert.equal(await page.locator('.user-growth-path svg').count(), 4);
      assert.equal(await page.locator('.growth-operation-loop li').count(), 6);
      assert.equal(await page.locator('.experience-panel:visible').count(), 1);
      await page.screenshot({ path: `${output}/loop-${width}.png` });
      await page.goto(`${base}#/experience/case-stage-3`);
      assert.equal(await page.locator('.growth-diagnostics > div').count(), 3);
      assert.equal(await page.locator('[data-stage="3"] .script-examples article').count(), 2);
      assert.equal(await page.locator('[data-stage="3"] .case-workflow').count(), 0);
      await page.screenshot({ path: `${output}/diagnosis-${width}.png` });
      await page.goto(`${base}#/experience/case-stage-4`);
      assert.equal(await page.locator('[data-stage="4"] .case-workflow').count(), 1);
      assert.equal(await page.locator('[data-stage="4"] .case-anchor').count(), 2);
      assert.deepEqual(await page.locator('.case-stage > summary h4').allTextContents(), [...strategy.caseStages.map(stage => stage.title), '活动整体表现与个人交付', '反例诊断与下一轮验证']);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const copy = await page.locator('main').textContent();
      for (const forbidden of ['稳定水位', '贡献了65%', '保证打正', '得物', '只敢露', '3-7倍', '14天跑了', '500粉就能投']) assert(!copy.includes(forbidden), forbidden);
    }
    await page.goto(`${base}#/experience/growth-strategy`);
    await page.locator('#edit-profile').click();
    const download = page.waitForEvent('download'); await page.locator('#export-site').click();
    const file = `${output}/growth-offline.html`; await (await download).saveAs(file);
    const html = fs.readFileSync(file, 'utf8');
    for (const javaScriptEnabled of [true, false]) {
      const context = await browser.newContext({ offline: true, javaScriptEnabled, reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
      await context.route('https://growth.test/portfolio.html', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
      const offline = await context.newPage(); const failures = [];
      offline.on('pageerror', error => errors.push(error.message)); offline.on('requestfailed', request => failures.push(request.url()));
      await offline.goto('https://growth.test/portfolio.html#/experience/growth-goal');
      assert(await offline.locator('.goal-formula').isVisible());
      if (javaScriptEnabled) await offline.goto('https://growth.test/portfolio.html#/experience/case-stage-2');
      assert(await offline.locator('.growth-operation-loop').isVisible());
      assert.deepEqual(failures, []); await context.close();
    }
    if (process.env.HTML_PATH) {
      const final = fs.readFileSync(process.env.HTML_PATH, 'utf8');
      const embedded = final.match(/<script id="portfolio-data" type="application\/json">([\s\S]*?)<\/script>/);
      assert(embedded); assert.deepEqual(JSON.parse(embedded[1]).presentation.growthStrategy, strategy);
    }
    assert.deepEqual(errors, []);
    console.log('PASS 13 interview answers, target/actual and historical exposure share math, unchanged campaign, six reordered case stages, user path vs operational loop, five responsive sizes, exclusive panels/deep links and readable offline/script-disabled export.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
