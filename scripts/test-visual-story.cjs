const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:4216/';
const output='/tmp/qxw-visual-story-qa';
const library=require('../data/visual-library.json');
fs.mkdirSync(output,{recursive:true});
const expected={capabilities:['capabilities'],experience:['growth','budget'],methods:['team','review'],insights:['creation'],skills:['case']};
const baselineCommit=process.env.BASELINE_COMMIT||'85b0089';
(async()=>{
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
  const errors=[],requests=[];
  try{
    const context=await browser.newContext({reducedMotion:'reduce'});
    const page=await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    page.on('response',response=>{if(response.status()>=400)requests.push(response.url());});
    const words={};
    for(const [width,height] of [[1440,1000],[768,1024],[390,844],[320,568]]){
      await page.setViewportSize({width,height});
      for(const [id,keys] of Object.entries(expected)){
        await page.goto(`${base}#/${id}`,{waitUntil:'networkidle'});
        const region=id==='capabilities'?'#capabilities':'#dimension-content';
        if(width===1440)words[id]={after:(await page.locator(region).innerText()).length};
        assert.deepEqual(await page.locator('.infographic-figure').evaluateAll(items=>items.map(item=>item.dataset.visual)),keys);
        for(const key of keys){
          const figure=page.locator(`[data-visual="${key}"]`);
          const mobile=width<=900;
          const image=figure.locator(mobile?'.infographic-mobile':'.infographic-desktop');
          assert(await image.isVisible());
          assert(await image.evaluate(el=>el.complete&&el.naturalWidth>0));
          assert.equal(await image.getAttribute('alt'),library[key].alt);
          assert.equal(await figure.locator(mobile?'.infographic-desktop':'.infographic-mobile').isVisible(),false);
          await figure.locator('button').click();
          assert.equal(await page.locator('.expanded-visual').getAttribute('src'),await image.getAttribute('src'));
          assert.equal(await page.locator('#detail-title').textContent(),library[key].title);
          await page.locator('[aria-label="图像缩放"]').fill('300');
          assert(await page.locator('.visual-dialog-scroll').evaluate(el=>el.scrollWidth>el.clientWidth));
          await page.keyboard.press('Escape');
          assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        }
        if(id==='insights'){
          assert.equal(await page.locator('.dimension-point[open], .creation-stage[open]').count(),0);
          await page.locator('.dimension-point > summary').first().click();
          assert(await page.locator('.account-links').isVisible());
          assert.equal(await page.locator('.account-links a').count(),4);
          await page.locator('.dimension-point > summary').first().click();
        }
        if(id==='skills'){
          assert.equal(await page.locator('#case-detail-evidence').evaluate(el=>el.open),false);
          await page.locator('#case-detail-evidence > summary').click();
          assert(await page.locator('[data-enlarge="growth"]').isVisible());
          await page.locator('#case-detail-evidence > summary').click();
        }
        await page.evaluate(()=>{document.activeElement.blur();scrollTo(0,0);});
        if(id==='capabilities')await page.locator('#capabilities').scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(output,`${id}-${width}.png`),fullPage:id!=='capabilities'});
      }
      console.log(`PASS visual assets, mobile variants, 300% image viewer, disclosure states and layout at ${width}px`);
    }
    const oldContext=await browser.newContext({reducedMotion:'reduce',viewport:{width:1440,height:1000}});
    for(const file of ['app.js','studio.css']){
      const body=execFileSync('git',['show',`${baselineCommit}:${file}`],{encoding:'utf8',maxBuffer:8*1024*1024});
      await oldContext.route(`**/${file}`,route=>route.fulfill({body,contentType:file.endsWith('js')?'application/javascript':'text/css'}));
    }
    const old=await oldContext.newPage();
    for(const id of Object.keys(expected)){
      await old.goto(`${base}#/${id}`,{waitUntil:'networkidle'});
      words[id].before=(await old.locator(id==='capabilities'?'#capabilities':'#dimension-content').innerText()).length;
      words[id].reduction=Number(((1-words[id].after/words[id].before)*100).toFixed(1));
      assert(words[id].reduction>10,`${id} should replace default prose, not add images above the same text`);
    }
    fs.writeFileSync(path.join(output,'text-comparison.json'),JSON.stringify(words,null,2)+'\n');
    console.log(JSON.stringify(words));
    assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
    await context.close();await oldContext.close();
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
