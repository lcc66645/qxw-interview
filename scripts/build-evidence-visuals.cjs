const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const portfolio = require('../data/portfolio.json');
const campaign = require('../data/campaign-review.json');
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const css = `
* { box-sizing: border-box; } body { margin: 0; background: transparent; color: #202c29; font-family: 'Noto Sans CJK SC', 'Noto Sans CJK JP', sans-serif; letter-spacing: 0; }
main { width: 1200px; height: 780px; padding: 42px 48px; display: flex; flex-direction: column; }
header { border-top: 1px solid #a6b9af; padding-top: 20px; }
.eyebrow { color: #52615c; font-size: 17px; margin: 0 0 14px; }
h1 { font-size: 42px; font-weight: 500; line-height: 1.4; margin: 0 0 10px; }
.subtitle { color: #52615c; font-size: 22px; margin: 0; line-height: 1.7; }
ol { list-style: none; padding: 0; margin: 28px 0 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
li { background: transparent; border: 1px solid #a6b9af; border-radius: 6px; padding: 16px 18px; min-width: 0; }
.number { font-size: 17px; color: #16705b; margin-right: 12px; }
h2 { display: inline; font-size: 25px; font-weight: 500; line-height: 1.5; }
li p { font-size: 19px; line-height: 1.7; margin: 7px 0 0; color: #52615c; }
li:last-child { border-color: #16705b; }
footer { border-top: 1px solid #a6b9af; padding-top: 20px; margin-top: auto; color: #52615c; font-size: 19px; line-height: 1.8; }
.metrics { display: grid; grid-template-columns: repeat(3, 1fr); margin: 30px 0 4px; }
.metrics > div { padding-left: 22px; border-left: 2px solid #16705b; }
.metrics strong { display: block; font-size: 40px; font-weight: 500; line-height: 1.5; color: #16705b; }
.metrics span { font-size: 19px; color: #52615c; }
.team ol { grid-template-columns: repeat(2, 1fr); }
.team li { padding: 18px 22px; }
.growth .metrics { margin-top: 34px; }
.growth .metrics strong { font-size: 48px; }
.comparison { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin: 38px 0 0; }
.comparison section { border-top: 1px solid #a6b9af; padding-top: 20px; }
.comparison h2 { font-size: 24px; }
.comparison p { color: #52615c; font-size: 21px; margin: 12px 0; line-height: 1.7; }
.comparison strong { color: #16705b; font-size: 27px; font-weight: 500; }
`;
function diagram(key) {
  const visual = portfolio.presentation.visuals[key];
  const metrics = visual.metrics ? `<div class="metrics">${visual.metrics.map(([value, label]) => `<div><strong>${escape(value)}</strong><span>${escape(label)}</span></div>`).join('')}</div>` : '';
  return `<main class="${key}"><header><p class="eyebrow">${escape(visual.eyebrow)}</p><h1>${escape(visual.title)}</h1><p class="subtitle">${escape(visual.subtitle)}</p></header>${metrics}<ol>${visual.steps.map(([title, detail], index) => `<li><span class="number">${String(index + 1).padStart(2, '0')}</span><h2>${escape(title)}</h2><p>${escape(detail)}</p></li>`).join('')}</ol><footer>${escape(visual.footer)}</footer></main>`;
}
function growth() {
  const totals = campaign.overview;
  const main = campaign.points.slice(0, 2).reduce((sum, item) => sum + item.acquisitions, 0);
  const share = (main / totals.acquisitions * 100).toFixed(1);
  return `<main class="growth"><header><p class="eyebrow">AI 小懂 / ${escape(totals.period)}</p><h1>把播放拆开，才能看见增长。</h1><p class="subtitle">${totals.days}天 · ${totals.videos}条视频 · ${totals.sellingPoints}个业务卖点</p></header><div class="metrics"><div><strong>${(totals.vv / 10000).toLocaleString('en-US')}万</strong><span>内容VV</span></div><div><strong>${totals.acquisitions}人</strong><span>拉新</span></div><div><strong>${totals.reactivations.toLocaleString('en-US')}人</strong><span>拉活</span></div></div><div class="comparison"><section><h2>拉新看决策任务</h2><p>帮选车 + 查优惠 / AI语音讲车</p><strong>${main}人拉新 · 占${share}%</strong></section><section><h2>拉活看持续需求</h2><p>智能找二手车</p><strong>${campaign.points[4].reactivations}人拉活</strong></section></div><footer>我的复盘输出：按业务任务分配内容方向，区分高播放、有效拉新与老用户回访。</footer></main>`;
}
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 780 }, deviceScaleFactor: 1 });
    for (const key of ['production', 'team', 'growth']) {
      await page.setContent(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>${css}</style>${key === 'growth' ? growth() : diagram(key)}</html>`);
      await page.evaluate(() => document.fonts.ready);
      assert(await page.evaluate(() => document.documentElement.scrollHeight === 780 && document.documentElement.scrollWidth === 1200));
      assert(await page.locator('header, li, footer').evaluateAll(elements => elements.every(element => element.scrollHeight <= element.clientHeight && element.scrollWidth <= element.clientWidth)));
      const footerTop = await page.locator('footer').evaluate(element => element.getBoundingClientRect().top);
      const contentBottom = await page.locator('ol, .comparison').evaluate(element => element.getBoundingClientRect().bottom);
      assert(footerTop >= contentBottom + 12, `Overlapping ${key} diagram`);
      await page.screenshot({ path: path.join(root, `assets/qxw-${key}.png`), omitBackground: true });
      console.log(`Rendered transparent light ${key} diagram (1200x780)`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
