const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:8706/',{waitUntil:'networkidle'});
    await page.getByRole('button',{name:/Data Room/}).click();
    const row=page.locator('.cdr-history tbody tr').filter({hasText:'DR-20260912-38be78f8-7a8c-448a'});
    await row.getByRole('button',{name:'Open batch',exact:true}).click();
    await page.locator('.cdr-graph-canvas').waitFor();
    assert.equal(await page.locator('.cdr-pipeline .cdr-stage--complete').count(),7);
    await page.locator('.cdr-graph select').first().selectOption('declared_cast');
    assert.equal(await page.locator('.cdr-graph tbody tr').count(),4);
    await page.locator('.cdr-graph tbody button').first().click();
    await page.locator('.cdr-preview .cdr-ai-detail').waitFor();
    await page.getByRole('button',{name:'Close details',exact:true}).click();
    await page.locator('.cdr-graph select').first().selectOption('all');
    await page.locator('.cdr-chat-turn').first().waitFor();
    assert.equal(await page.locator('.cdr-chat-turn').count(),2);
    await page.screenshot({path:'/tmp/crimedata-workspace-desktop.png',fullPage:true});
    for(const width of [760,600]){
      await page.setViewportSize({width,height:1000});
      const sizes=await page.locator('.cdr-page').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));
      assert(sizes.scroll<=sizes.client+2,JSON.stringify({width,...sizes}));
    }
    await page.screenshot({path:'/tmp/crimedata-workspace-narrow.png',fullPage:true});
    await page.setViewportSize({width:1500,height:1100});
    await page.reload({waitUntil:'networkidle'});
    await page.getByRole('button',{name:/Data Room/}).click();
    await page.locator('.cdr-history tbody tr').filter({hasText:'DR-20260912-38be78f8-7a8c-448a'}).getByRole('button',{name:'Open batch',exact:true}).click();
    await page.locator('.cdr-chat-turn').first().waitFor();assert.equal(await page.locator('.cdr-chat-turn').count(),2);
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({stages:7,castLinks:4,sourceNavigation:'passed',savedConversationAfterReload:'passed',responsiveWidths:[760,600],browserErrors:errors}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
