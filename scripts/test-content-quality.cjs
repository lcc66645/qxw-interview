const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const data = require('../data/portfolio.json');
const campaign = require('../data/campaign-review.json');
const base = process.env.BASE_URL || 'http://127.0.0.1:4206/';
const output = '/tmp/qxw-content-qa';
fs.mkdirSync(output, { recursive: true });

(async () => {
  assert.deepEqual(data.campaignReview, campaign, 'Editing copy must not rewrite the campaign evidence');
  assert.equal(data.source.jobs.length, 1);
  for (const removed of ['简单有为', 'UWANT', '友望', '郝家豁', '千川', '线索成本', 'CTR 5%']) assert(!JSON.stringify(data).includes(removed), removed);
  const main = campaign.points.slice(0, 2);
  assert.equal(main.reduce((sum, point) => sum + point.acquisitions, 0), 153);
  assert.equal((153 / campaign.overview.acquisitions * 100).toFixed(1), '64.3');
  assert.equal((main.reduce((sum, point) => sum + point.vv, 0) / campaign.overview.vv * 100).toFixed(1), '32.2');
  assert.equal(((212 - 71) / 71 * 100).toFixed(1), '198.6');
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    for (const [width, height] of [[1440,900], [768,1024], [390,844], [320,568]]) {
      await page.setViewportSize({ width, height });
      for (const id of Object.keys(data.pages)) {
        await page.goto(`${base}#/${id}`, { waitUntil: 'networkidle' });
        if (id === 'experience') await page.evaluate(() => { document.querySelectorAll('[data-experience-panel]').forEach(el => el.hidden = false); document.querySelectorAll('main details').forEach(el => el.open = true); });
        const content = await page.locator('main').innerText();
        for (const removed of ['简单有为', 'UWANT', '友望', '郝家豁', '千川', '线索成本', 'CTR 5%']) assert(!content.includes(removed), `${id}: ${removed}`);
        for (const forbidden of ['3秒完播', 'ROI 1:3.5', '最高800万', '目标达成率70%', '爆款率最高70%', '调整前', '调整后', '复盘前', '复盘后', '资深专家', '阿里巴巴', '字节跳动', '腾讯', '网易']) assert(!content.includes(forbidden), `${id}: ${forbidden}`);
        assert.equal(await page.locator('.capability-entry, .capability-jump, .capability-halo').count(), 0);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        if (id === 'experience') {
          assert.equal(await page.locator('.okr-results li').count(), 8);
          assert.equal(await page.locator('#employer-0 #business-review').count(), 1);
          assert.equal(await page.locator('.case-deliverables').count(), 1);
          assert((await page.locator('.case-stage[data-stage="5"]').innerText()).includes('活动整体表现与个人交付'));
          assert.equal(await page.locator('.badcase-comparison dt').filter({ hasText: '卖点汇总' }).count(), 2);
          assert.deepEqual(await page.locator('.comparison-row > span:first-child').allTextContents(), ['前一周', '后一周']);
          assert.equal(await page.locator('.job').count(), 1);
          assert.equal(await page.locator('.practice-point').count(), 5);
          assert.equal(await page.locator('#employer-1').count(), 0);
          assert.equal(await page.locator('.case-stage-capability').count(), 6);
        }
        if (id === 'insights') {
          assert.equal(await page.locator('.insight-decision').count(), 4);
          assert.equal(await page.locator('.insight-next').count(), 4);
          assert.equal(await page.locator('.insight-item .case-anchor').count(), 4);
        }
        if (id === 'skills') assert.equal(await page.locator('.tech-application').count(), 3);
        if (width === 1440 || width === 390) await page.screenshot({ path: `${output}/${id}-${width}.png` });
      }
    }
    for (const id of ['insights', 'skills']) {
      await page.goto(`${base}#/${id}`);
      const links = await page.locator('main .case-anchor').evaluateAll(elements => elements.map(el => el.hash));
      for (const hash of links) {
        await page.goto(`${base}${hash}`);
        const anchor = decodeURIComponent(hash.split('/')[2]);
        assert(await page.locator(`#${anchor}`).isVisible());
      }
    }
    await page.goto(base);
    await page.evaluate(old => localStorage.setItem('qxw-portfolio-v2', JSON.stringify(old)), {
      profile: { intro: '3年汽车内容经验，专注 AIGC 创作、内容矩阵与用户增长。' },
      projects: [{ id: 'holiday', description: '拆解9个业务卖点与高拉新脚本，沉淀3套内容模板，推动内容获客。' }]
    });
    await page.reload(); assert.equal(await page.locator('.profile-description').textContent(), data.profile.intro);
    await page.goto(`${base}#/experience`); assert.equal(await page.locator('.review-intro').textContent(), data.projects[0].description);
    await page.evaluate(() => localStorage.setItem('qxw-portfolio-v2', JSON.stringify({ profile: { intro: '我自己的简介修改' } })));
    await page.goto(base); assert.equal(await page.locator('.profile-description').textContent(), '我自己的简介修改');
    assert.deepEqual(errors, []);
    console.log('PASS Dongchedi-only shared data and 20 view/size combinations, unchanged campaign evidence, independent calculations, eight KRs, five practices, six competency-based case stages, personal deliverables, four judgments, three tool applications, deep links and saved-copy migration.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
