'use strict';
const {chromium}=require('/tmp/crimedata-graph-browser.Sdn124/node_modules/playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const dir=path.resolve('native_agent_ui_20261015'),base='http://127.0.0.1:8706',preview=process.argv.includes('--preview');
(async()=>{
 const saved=JSON.parse(await fs.readFile('native_agent_trace_20261015/execution.json','utf8'));
 const answer=saved.executions[0].tasks[0].RESULT+'\n\n### Coverage at a glance\n\n| Measure | Recorded value |\n| --- | --- |\n| Incidents | 6 |\n| Evidence items | 0 |\n\n> Review the coverage gap before drawing conclusions.\n\n1. Inspect the report coverage.\n2. Review the evidence register.\n\nUse `CRIMEDATA_READINESS_TOOL` to inspect coverage.\n\n<script>window.agentInjected=true</script>\n<img src=x onerror="window.agentInjected=true">';
 const requests=[],errors=[],writes=[];let failNext=false;
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1450,height:1050}});page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());if(url.origin!==base)return route.abort();
   if(req.method()==='POST'&&url.pathname==='/api/agent-v2/run'){
    requests.push(req.postDataJSON());
    if(failNext){failNext=false;return route.fulfill({status:400,json:{error:'Controlled fixture failure'}});}
    return route.fulfill({json:{team:'CRIMEDATA_PATTERN_INVESTIGATION_TEAM',answer,elapsed:26266,conversationId:'fixture-case-memory',historyThreadId:'fixture-history',layers:['Planning','Controlled tool use','Reflection','Case-scoped memory']}});
   }
   if(req.method()!=='GET'){writes.push(url.pathname);return route.abort();}
   if(preview&&(url.pathname==='/'||url.pathname.startsWith('/assets/'))){const file=path.join(dir,'image/frontend/dist',url.pathname==='/'?'index.html':url.pathname);return route.fulfill({body:await fs.readFile(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});}
   return route.continue();
  });
  await page.goto(base,{waitUntil:'networkidle'});
  await page.getByRole('button',{name:/IncidentData AI Agent Console/}).click();
  await page.getByRole('button',{name:'Run native Agent V2 ↗',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'IncidentData Agent V2',exact:true}),input=dialog.getByLabel('Your question',{exact:true});
  assert.equal(await input.getAttribute('rows'),'3');
  assert(await dialog.locator(':scope > section > header').evaluate(e=>e.scrollHeight<=e.clientHeight+2),'Header contains its subtitle');
  const question='Investigate VEHICLE_PARTS_HARVESTING.\nShow the coverage gaps and supporting tools.';
  await input.fill(question);await input.press('End');await input.press('Enter');assert.equal(requests.length,0);assert((await input.inputValue()).includes('\n'));
  await input.fill(question);await input.press('Control+Enter');
  await dialog.getByRole('heading',{name:'Pattern Definition and Rationale',exact:true}).waitFor();
  assert.equal(requests[0].question,question);assert.equal(requests[0].conversationId,'');
  assert.equal(await dialog.locator('.native-agent__stages article').count(),4);
  assert.equal(await dialog.locator('.agent-brief strong').first().innerText(),'Incident Links:');
  assert.equal(await dialog.locator('.agent-brief table tbody tr').count(),2);
  assert.equal(await dialog.locator('.agent-brief ol li').count(),2);
  assert.equal(await dialog.locator('.agent-brief script,.agent-brief img').count(),0);assert.equal(await page.evaluate(()=>window.agentInjected),undefined);
  assert(await dialog.locator('.agent-brief').innerText().then(t=>t.includes('<script>')));
  await dialog.getByText('View original response text',{exact:true}).click();assert.equal(await dialog.locator('.native-agent__original pre').textContent(),answer);
  await dialog.getByText('View original response text',{exact:true}).click();
  const result=dialog.locator('.native-agent__result'),bounds=await result.boundingBox();assert(bounds.width>1000,'Desktop answer uses available width');
  await dialog.locator('section').first().evaluate(e=>e.scrollTop=0);await page.screenshot({path:dir+'/'+(preview?'preview':'live')+'-desktop.png'});
  await input.fill('Which gap did you identify?');await dialog.getByRole('button',{name:'Run Agent V2',exact:true}).click();await page.waitForTimeout(100);
  assert.equal(requests[1].conversationId,'fixture-case-memory');assert.equal(requests[1].historyThreadId,'fixture-history');
  failNext=true;await dialog.getByRole('button',{name:'Run Agent V2',exact:true}).click();await dialog.getByRole('alert').filter({hasText:'Controlled fixture failure'}).waitFor();assert(await result.isVisible());
  await page.setViewportSize({width:390,height:900});await result.scrollIntoViewIfNeeded();
  assert(await dialog.locator('section').first().evaluate(e=>e.scrollWidth<=e.clientWidth+2));assert(await result.evaluate(e=>e.scrollWidth<=e.clientWidth+2));
  assert.equal(await dialog.locator('.native-agent__stages').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),2);
  await page.screenshot({path:dir+'/'+(preview?'preview':'live')+'-mobile.png'});
  await dialog.getByRole('button',{name:'Start new case memory',exact:true}).click();assert.equal(await result.count(),0);
  await dialog.getByRole('button',{name:'Run Agent V2',exact:true}).click();await dialog.getByRole('heading',{name:'Pattern Definition and Rationale',exact:true}).waitFor();assert.equal(requests.at(-1).conversationId,'');assert.equal(requests.at(-1).historyThreadId,'');
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  const receipt={passed:true,mode:preview?'preview':'live',threeLineInput:true,newlineAndKeyboardSubmit:true,fullWidthBrief:true,headingsListsTablesAndEmphasis:true,rawResponsePreserved:true,modelHtmlEscaped:true,stagesRetained:true,followupMemoryPreserved:true,errorRecovery:true,newMemoryReset:true,mobile:true,realModelCalls:0,errors,writes};
  await fs.writeFile(dir+'/'+(preview?'preview':'live')+'-validation.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
