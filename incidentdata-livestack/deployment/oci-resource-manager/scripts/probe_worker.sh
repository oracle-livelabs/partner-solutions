#!/usr/bin/env bash
set -euo pipefail
node <<'JS'
(async()=>{
 const {chromium}=require('playwright'),sharp=require('sharp');
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{const page=await browser.newPage();await page.setContent('<h1>IncidentData portable worker</h1>');if(await page.locator('h1').textContent()!=='IncidentData portable worker')throw Error('Browser probe failed');await page.screenshot({path:'/tmp/worker-probe.png'});}finally{await browser.close();}
 await sharp('/tmp/worker-probe.png').metadata();console.log('Browser and image processing passed');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
JS
python <<'PY'
from kokoro_onnx import Kokoro
import soundfile as sf
k=Kokoro('/models/kokoro-v1.0.onnx','/models/voices-v1.0.bin')
samples,rate=k.create('This is a synthetic teaching demonstration.',voice='bf_emma',speed=1.0,lang='en-gb')
assert len(samples)>0
sf.write('/tmp/worker-probe.wav',samples,rate)
print('Speech synthesis passed',rate,len(samples))
PY
ffmpeg -v error -i /tmp/worker-probe.wav -f null -
echo 'Portable runtime component checks passed'
