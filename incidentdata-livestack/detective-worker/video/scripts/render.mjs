import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';
const args=Object.fromEntries(process.argv.slice(2).reduce((a,x,i,v)=>i%2===0?[...a,[x,v[i+1]]]:a,[]));
for(const k of ['--case','--build','--runtime-package'])if(!args[k])throw Error('Missing '+k);
const require=createRequire(path.resolve(args['--runtime-package']));const {chromium}=require('playwright');
const dir=path.dirname(fileURLToPath(import.meta.url)),build=path.resolve(args['--build']);fs.mkdirSync(build,{recursive:true});
const C=JSON.parse(fs.readFileSync(args['--case'],'utf8'));
const html=fs.readFileSync(path.join(dir,'../assets/frames.html'),'utf8').replace('/*__CASE__*/',JSON.stringify(C).replace(/</g,'\\u003c'));
fs.writeFileSync(path.join(build,'frames.html'),html);
const browser=await chromium.launch({headless:true});
try{const page=await browser.newPage({viewport:{width:1920,height:1080}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('file://'+path.join(build,'frames.html'));await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
for(const s of C.scenes){await page.evaluate(id=>window.showScene(id),s.id);await page.screenshot({path:path.join(build,s.id+'.png')});const overflow=await page.locator('.scene.active .body').evaluate(e=>e.scrollHeight>e.clientHeight+2||e.scrollWidth>e.clientWidth+2);if(overflow)throw Error('Scene overflow: '+s.id);console.log('Rendered '+s.id);}
if(errors.length)throw Error(errors.join('\n'));}finally{await browser.close();}
