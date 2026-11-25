const {chromium}=require('playwright'),assert=require('node:assert/strict');
const batchId='DR-20260914-13f650e8-dfa8-450e';
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8706/',{waitUntil:'networkidle'});await page.getByRole('button',{name:/Data Room/}).click();const row=page.locator('.cdr-history tbody tr').filter({hasText:batchId});await row.waitFor();if(await row.getByRole('button',{name:'Open',exact:true}).count())await row.getByRole('button',{name:'Open',exact:true}).click();
 await page.getByRole('button',{name:'Explore Money Flows',exact:true}).click();const panel=page.locator('.cdr-money');await panel.locator('.cdr-money-node').nth(7).waitFor();const agent=panel.locator('.cdr-money-agent');await agent.locator(':scope>summary').click();await agent.locator('.cdr-money-agent-answer').waitFor();
 assert.match(await agent.locator('.cdr-money-agent-answer').innerText(),/Hartley/);assert.equal(await agent.getByRole('navigation',{name:'Agent-supported graph routes'}).count(),0);assert.equal(await agent.locator('[aria-label="Agent-supported graph routes"] button').count(),4);
 await agent.getByRole('button',{name:'Show route 1 · 3 hops',exact:true}).click();assert.equal(await panel.locator('.cdr-money-edge:not(.is-dim)').count(),3);assert.equal(await panel.locator('.cdr-money-route-steps li').count(),3);
 await agent.getByRole('button',{name:'[T009]',exact:true}).first().click();await panel.getByRole('region',{name:'Original transaction record'}).waitFor();assert.match(await panel.getByRole('region',{name:'Original transaction record'}).innerText(),/SUGA-TX-009/);
 await agent.screenshot({path:'/tmp/crimedata-suga-money-agent.png'});
 await panel.getByLabel('Maximum route hops').selectOption('2');await agent.getByText('This saved answer belongs to a different selection', {exact:false}).waitFor();assert.equal(await agent.locator('[aria-label="Agent-supported graph routes"] button').count(),0);await panel.getByLabel('Maximum route hops').selectOption('4');
 if(process.argv.includes('--new')){
  await agent.getByLabel('Money Flow agent question').fill('How does money reach Hartley? Explain all four supported routes and cite the original transaction records, distinguishing gross volume from final receipts.');
  const posted=page.waitForResponse(r=>r.url().endsWith('/money-agent')&&r.request().method()==='POST');await agent.getByRole('button',{name:'Explain selected flows',exact:true}).click();assert.equal((await posted).status(),202);
  await agent.locator('.cdr-money-agent-answer').waitFor({state:'hidden'});await page.getByRole('button',{name:'Close workspace',exact:true}).click();await page.getByRole('button',{name:'Explore Money Flows',exact:true}).click();await agent.locator('.cdr-money-agent-answer').waitFor({timeout:240000});
  assert.equal(await agent.locator('[aria-label="Agent-supported graph routes"] button').count(),4);assert.equal(await agent.getByRole('alert').count(),0);
 }
 const denied=await page.request.get(`http://127.0.0.1:8706/api/data-room/batches/${batchId}/money-agent`,{headers:{'X-Demo-User':'northern_analyst'}});assert.equal(denied.status(),404);
 await page.keyboard.press('Escape');await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:/Data Room/}).click();await page.getByRole('button',{name:'Explore Money Flows',exact:true}).click();await page.locator('.cdr-money-agent>summary').click();await page.locator('.cdr-money-agent-answer').waitFor();assert.deepEqual(errors,[]);
 console.log(JSON.stringify({savedNativeReview:'visible',routeLinks:'four, highlight three hops',citation:'opens exact SUGA-TX-009',changedScope:'warned and links suppressed',backgroundReview:process.argv.includes('--new')?'new native call completed':'not requested',persistence:'passed',hiddenUser:'denied',browserErrors:errors}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
