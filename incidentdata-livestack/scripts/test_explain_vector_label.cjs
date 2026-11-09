'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const {ORACLE_INTERNALS}=await import('../frontend/src/oracle-internals-content.mjs');
 const expected=ORACLE_INTERNALS.signals.examples.find(e=>e.kind==='plsql');
 const preview=process.argv.includes('--preview'),dir=path.join(__dirname,'../explain_vector_label_20261013');
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[],writes=[];
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(30000);
  await page.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(req.method()!=='GET'){writes.push(url.pathname);return route.abort();}
   if(url.origin!=='http://127.0.0.1:8706')return route.abort();
   if(preview&&(url.pathname==='/'||url.pathname.startsWith('/assets/'))){
    const file=path.join(dir,'image/frontend/dist',url.pathname==='/'?'index.html':url.pathname);
    return route.fulfill({body:await fs.readFile(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});
   }
   return route.continue();
  });
  await page.goto('http://127.0.0.1:8706/',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:/Incident Pattern Signals/}).click();
  const panel=page.getByRole('complementary',{name:'Oracle Internals'});
  await panel.getByRole('button',{name:'Show Oracle Internals',exact:true}).click();
  await panel.getByRole('heading',{name:expected.title,exact:true}).waitFor();
  assert.equal(await panel.getByRole('heading',{name:'Inspect available narrative-vector coverage',exact:true}).count(),1);
  const code=panel.getByLabel('PL/SQL: '+expected.title,{exact:true});assert.equal(await code.innerText(),expected.code);
  assert.match(await panel.innerText(),/Expected DBMS Output: Visible report vectors: 21532/);
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copied=text;}}}));
  const copy=panel.getByRole('button',{name:'Copy PL/SQL: '+expected.title,exact:true});
  await copy.click();assert.equal(await page.evaluate(()=>window.__copied),expected.code);
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('Clipboard unavailable');}}}));
  await copy.click();assert.equal(await page.evaluate(()=>window.getSelection().toString()),expected.code);
  await page.screenshot({path:path.join(dir,(preview?'preview':'live')+'_desktop.png')});
  await page.setViewportSize({width:390,height:900});await code.scrollIntoViewIfNeeded();
  assert(await copy.isVisible());
  assert(await panel.evaluate(e=>e.scrollWidth<=e.clientWidth+2));
  await page.screenshot({path:path.join(dir,(preview?'preview':'live')+'_mobile.png')});
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  const receipt={passed:true,mode:preview?'preview':'live',originalSqlRetained:true,plsqlDisplayedExactly:true,clipboardAndFallback:true,mobile:true,errors,writes};
  await fs.writeFile(path.join(dir,(preview?'preview':'live')+'_browser.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1});
