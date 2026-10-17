const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const demo = require('../data/management-demo.json');
const actual = require('../data/campaign-review.json');
const portfolio = require('../data/portfolio.json');
const base = process.env.BASE_URL || 'http://127.0.0.1:4215/';
const out = '/tmp/qxw-management-qa';
fs.mkdirSync(out, {recursive:true});
assert.deepEqual(portfolio.campaignReview, actual, 'Historical campaign evidence must not be rewritten by demo data');
assert.equal(new Set(demo.rows.map(row => row.work)).size, demo.rows.length);
for (const row of demo.rows) {
  assert.match(row.member, /^成员\d{2}$/);
  assert.match(row.group, /^小组[A-Z]$/);
  assert.match(row.work, /^作品\d{3}$/);
  assert.deepEqual(Object.keys(row).sort(), ['day','group','member','work','type','method','vv','newUsers','followers'].sort());
  for (const key of ['vv','newUsers','followers']) assert(Number.isInteger(row[key]) && row[key] >= 0);
}
for (const row of demo.production) {
  assert.match(row.member, /^成员\d{2}$/); assert.match(row.group, /^小组[A-Z]$/);
  assert.equal(demo.rows.find(item => item.member === row.member).group, row.group);
  assert(Number.isInteger(row.produced) && row.produced >= 0);
}
const sum = (rows,key) => rows.reduce((n,row) => n + row[key],0);
const wan = value => `${(value/10000).toFixed(1)}万`;
const efficiency = rows => `${(sum(rows,'newUsers')/sum(rows,'vv')*1000000).toFixed(1)}人`;
(async () => {
  const browser = await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
  const errors = [];
  try {
    const page = await browser.newPage({reducedMotion:'reduce'});
    page.on('pageerror', error => errors.push(error.message));
    for (const [width,height] of [[1440,1000],[390,844],[320,568]]) {
      await page.setViewportSize({width,height});
      await page.goto(`${base}#/methods`, {waitUntil:'networkidle'});
      assert.equal(await page.locator('.okr-row, #production-cost-control').count(),0);
      for (const group of ['', '小组A', '小组B']) {
        await page.locator('#demo-group').selectOption(group);
        const rows = demo.rows.filter(row => !group || row.group === group);
        for (let stage=0;stage<4;stage++) {
          await page.locator(`#analysis-tab-${stage+1}`).click();
          assert.equal(await page.locator('[role="tab"][aria-selected="true"]').count(),1);
          assert.equal(await page.locator('[role="tabpanel"]').getAttribute('aria-labelledby'),`analysis-tab-${stage+1}`);
          assert.deepEqual(await page.locator('.demo-metrics dd').allTextContents(), [`${rows.length}条`,wan(sum(rows,'vv')),`${sum(rows,'newUsers')}人`,efficiency(rows)]);
          if (stage === 0) assert.deepEqual(await page.locator('.demo-detail-table tbody tr th').allTextContents(),rows.map(row => row.day));
          if (stage === 1) {
            const members = [...new Set(rows.map(row => row.member))];
            const expected = members.map(member => {
              const selected=rows.filter(row => row.member===member);
              return [member,selected[0].group,`${selected.length} / ${demo.production.find(row=>row.member===member).produced}`,wan(sum(selected,'vv')),String(sum(selected,'followers')),`${sum(selected,'newUsers')}人`,efficiency(selected)];
            });
            assert.deepEqual(await page.locator('.demo-pivot-table tbody tr').evaluateAll(rows => rows.map(row => [...row.cells].map(cell => cell.textContent))),expected);
            const daily = ['D1','D2','D3','D4'].map(day => sum(rows.filter(row=>row.day===day),'vv'));
            const widths = await page.locator('.demo-bars').first().locator('.demo-bar-track').evaluateAll(tracks => tracks.map(track=>track.firstElementChild.getBoundingClientRect().width/(track.clientWidth)*100));
            widths.forEach((value,index)=>assert(Math.abs(value-daily[index]/Math.max(...daily)*100)<.4));
          }
          if (stage === 2) assert.equal(await page.locator('.demo-diagnosis-table tbody tr').count(),new Set(rows.map(row=>row.type)).size);
          if (stage === 3) assert.equal(await page.locator('.demo-actions-table tbody tr').count(),4);
          assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Only dense tables may scroll, not the page');
          assert(await page.locator('#analysis-demo button').evaluateAll(buttons=>buttons.every(el=>el.scrollWidth<=el.clientWidth+1)));
        }
      }
      await page.locator('#demo-group').selectOption('');
      await page.locator('#analysis-tab-1').focus(); await page.keyboard.press('ArrowRight');
      assert.equal(await page.locator('[role="tab"][aria-selected="true"]').getAttribute('id'),'analysis-tab-2');
      await page.keyboard.press('End'); assert.equal(await page.locator('[role="tab"][aria-selected="true"]').getAttribute('id'),'analysis-tab-4');
      await page.keyboard.press('Home'); assert.equal(await page.locator('[role="tab"][aria-selected="true"]').getAttribute('id'),'analysis-tab-1');
      await page.locator('#analysis-tab-2').click();
      await page.evaluate(() => { document.activeElement.blur(); window.scrollTo(0,0); });
      await page.screenshot({path:`${out}/team-${width}.png`,fullPage:true});
      for (const id of ['experience','insights','skills']) {
        await page.goto(`${base}#/${id}`,{waitUntil:'networkidle'});
        assert.equal(await page.locator('.page-outline a').count(),3);
        if (id === 'experience') {
          assert.equal(await page.locator('#growth-budget #production-cost-control').count(),1);
          assert.equal(await page.locator('.growth-krs > div').count(),1);
        }
        if (id === 'skills') assert.equal(await page.locator('#case-growth #matrix-budget-control').count(),1);
        await page.evaluate(() => { document.activeElement.blur(); window.scrollTo(0,0); });
        await page.screenshot({path:`${out}/${id}-${width}.png`,fullPage:true});
      }
      for (const id of ['methods','experience','insights','skills']) {
        await page.goto(`${base}#/${id}`,{waitUntil:'networkidle'});
        const links = await page.locator('.page-outline a').evaluateAll(items=>items.map(item=>item.getAttribute('href')));
        for (const href of links) {
          await page.locator(`.page-outline a[href="${href}"]`).click();
          const anchor = href.split('/').pop();
          await page.waitForFunction(anchor=>document.getElementById(anchor)?.getBoundingClientRect().top >= document.querySelector('.header').getBoundingClientRect().bottom-1,anchor);
          assert(await page.locator(`#${anchor}`).isVisible());
        }
      }
      console.log(`PASS analysis workflow, filters, exact totals, weighted efficiencies, charts and page outlines at ${width}px`);
    }
    assert.deepEqual(errors,[]);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
