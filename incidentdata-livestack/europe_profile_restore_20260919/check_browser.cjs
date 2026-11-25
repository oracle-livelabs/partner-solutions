'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync,spawn}=require('node:child_process');
const {chromium}=require('/tmp/crimedata-graph-browser.Sdn124/node_modules/playwright');
const live=process.argv.includes('--live'),BASE=live?'http://127.0.0.1:8706':'http://127.0.0.1:18709';
const PROJECT=path.dirname(__dirname),targets=[['ADELAIDE_DATA_V2','Adelaide',21532,true],['PERTH_DATA','Perth',33511,true],['BRISBANE_DATA','Brisbane',42317,true],['AMSTERDAM_DATA_V1','Amsterdam',14467,false],['BRUSSELS_DATA_V1','Brussels',25691,false],['DUBLIN_CITY_DATA_V1','Dublin',17817,false]];
async function healthy(){for(let attempt=0;attempt<40;attempt++){try{const r=await fetch(BASE+'/api/health',{signal:AbortSignal.timeout(1000)});if(r.ok)return;}catch{}await new Promise(resolve=>setTimeout(resolve,500));}throw Error('Preview health timeout');}
(async()=>{let preview,browser;const errors=[],intercepted=[],unexpectedWrites=[],checks=[];try{
  if(!live){
    const [app]=JSON.parse(execFileSync('podman',['inspect','policeadelaide_app-fu40_1'],{encoding:'utf8'}));
    const settings=Object.fromEntries(app.Config.Env.map(value=>{const i=value.indexOf('=');return[value.slice(0,i),value.slice(i+1)];}));
    preview=spawn(process.execPath,['backend/server.js'],{cwd:PROJECT,stdio:'ignore',env:{...process.env,...settings,PORT:'18709',ORACLE_WALLET_LOCATION:'/home/opc/wallet',CRIMEDATA_READ_ONLY_REVIEW:'1',CRIMEDATA_BIND_HOST:'127.0.0.1',CRIMEDATA_FRONTEND_DIST:path.join(__dirname,'dist')}});
  }
  await healthy();
  const mapping=[];
  for(const[code,city,count,nrt]of targets){
    const response=await fetch(BASE+'/api/setup/profiles?profileCode='+code);assert.equal(response.status,200);const data=await response.json();
    assert.equal(data.profile.PROFILE_CODE,code);assert.equal(data.backup.INCIDENTS,count);assert.equal(data.activeProfileCode,'DUBLIN_CITY_DATA_V1');
    assert.equal(data.capabilities.restore,true);assert.equal(data.capabilities.nrtRestore,nrt);assert.equal(data.profiles.length,7);mapping.push({code,city,count,nrt});
  }
  checks.push('All six catalogue targets and restore capabilities verified; Dublin stays active.');
  browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1600,height:1200}});page.on('pageerror',error=>errors.push(error.message));
  let mismatch=false;
  await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(['GET','HEAD'].includes(request.method())){
      if(mismatch&&url.pathname==='/api/setup/profiles'&&url.searchParams.get('profileCode')==='AMSTERDAM_DATA_V1'){
        mismatch=false;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({profile:{PROFILE_CODE:'ADELAIDE_DATA'}})});
      }
      return route.continue();
    }
    if(request.method()==='POST'&&['/api/setup/load','/api/setup/load-nrt'].includes(url.pathname)){
      intercepted.push({path:url.pathname,payload:request.postDataJSON(),sent_to_server:false});
      return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'Verification only: restore intercepted. No dataset changed.'})});
    }
    unexpectedWrites.push({method:request.method(),path:url.pathname});return route.abort();
  });
  await page.goto(BASE,{waitUntil:'networkidle'});await page.getByRole('button',{name:/Data Foundation/}).click();
  await page.waitForFunction(()=>document.querySelector('[data-testid="active-profile-code"]')?.textContent==='DUBLIN_CITY_DATA_V1');
  const tiles=page.locator('.crimedata-setup__profiles button');assert.deepEqual(await tiles.evaluateAll(nodes=>nodes.map(node=>node.dataset.profileCode)),targets.map(row=>row[0]));
  const layout=await tiles.evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width};}));
  assert(layout.slice(0,3).every(r=>Math.abs(r.y-layout[0].y)<1));assert(layout.slice(3).every(r=>Math.abs(r.y-layout[3].y)<1));assert(layout[3].y>layout[0].y);
  const activeBox=await page.locator('[data-testid="active-profile-code"]').boundingBox();assert(activeBox.y+activeBox.height<layout[0].y,'Active-profile label must not overlap tiles');
  await page.locator('.crimedata-setup').screenshot({path:path.join(__dirname,live?'live_tiles.png':'preview_tiles.png')});
  for(const[code,city,,nrt]of targets){
    await page.locator(`[data-profile-code="${code}"]`).click();
    const restore=page.getByRole('button',{name:'Restore '+city,exact:true});await restore.waitFor();assert(await restore.isDisabled());
    assert.equal(await page.locator('.crimedata-setup__actions .nrt').count(),nrt?1:0);
    for(const action of nrt?['load','load-nrt']:['load']){
      await page.getByLabel('Global replacement confirmation').fill('ACTIVATE '+code);
      const count=intercepted.length;
      await page.getByRole('button',{name:'Restore '+city+(action==='load-nrt'?' NRT':''),exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('.crimedata-setup .pattern-error')?.textContent.includes('restore intercepted'));
      assert.equal(intercepted.length,count+1);assert.deepEqual(intercepted.at(-1).payload,{profileCode:code,confirmation:'ACTIVATE '+code,expectedActiveProfileCode:'DUBLIN_CITY_DATA_V1'});
      assert.equal(intercepted.at(-1).path,'/api/setup/'+action);assert(await restore.isDisabled());
    }
  }
  assert.equal(intercepted.length,9);checks.push('Nine standard/NRT requests confirmed and intercepted; zero restores sent to server.');
  await page.getByText('Other saved profiles (1)',{exact:true}).click();
  await page.locator('.crimedata-setup__additional button').click();
  await page.waitForFunction(()=>document.querySelector('.profile-activation-confirmation input')?.placeholder==='ACTIVATE ADELAIDE_DATA');
  checks.push('Adelaide V1 remains available separately; six-city grid is not displaced.');
  mismatch=true;await page.locator('[data-profile-code="AMSTERDAM_DATA_V1"]').click();
  await page.waitForFunction(()=>document.querySelector('.crimedata-setup .pattern-error')?.textContent.includes('different dataset profile'));
  assert.equal(await page.locator('.crimedata-setup__actions .restore').count(),0);checks.push('Mismatched profile response prevents restore.');
  await page.locator('[data-profile-code="DUBLIN_CITY_DATA_V1"]').click();
  await page.getByRole('button',{name:'Restore Dublin',exact:true}).waitFor();
  await page.setViewportSize({width:390,height:1000});
  const mobile=await tiles.evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y};}));
  assert(mobile.every(r=>Math.abs(r.x-mobile[0].x)<1));assert(mobile.every((r,i)=>!i||r.y>mobile[i-1].y));
  await page.locator('.crimedata-setup__profiles').screenshot({path:path.join(__dirname,live?'live_tiles_mobile.png':'preview_tiles_mobile.png')});
  await page.getByLabel('Demo user').selectOption('read_only_viewer');
  await page.waitForFunction(()=>document.querySelector('.crimedata-setup')?.textContent.includes('restricted to Statewide Admin'));
  assert.equal(await page.locator('.crimedata-setup__actions .restore').count(),0);checks.push('Mobile tile order and non-admin restrictions checked.');
  assert.deepEqual(errors,[]);assert.deepEqual(unexpectedWrites,[]);
  const active=await(await fetch(BASE+'/api/setup/profiles')).json();assert.equal(active.activeProfileCode,'DUBLIN_CITY_DATA_V1');assert.equal(active.live.INCIDENTS,17817);assert.equal(active.live.PERSONS,13);
  fs.writeFileSync(path.join(__dirname,live?'live_browser.json':'preview_browser.json'),JSON.stringify({status:'passed',at:new Date().toISOString(),checks,mapping,layout,mobile,intercepted,page_errors:errors,unexpected_write_requests:unexpectedWrites,restore_requests_sent_to_server:0},null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({status:'passed',mode:live?'live':'preview',checks},null,2));
}finally{if(browser)await browser.close();if(preview){preview.kill('SIGTERM');await new Promise(resolve=>preview.exitCode!==null?resolve():preview.once('exit',resolve));}}})().catch(error=>{console.error(error.stack);process.exitCode=1;});
