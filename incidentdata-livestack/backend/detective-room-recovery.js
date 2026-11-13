'use strict';
const assert=require('node:assert/strict');
function validateRecovery({job,previous,failure,verification,analysis,normal,archiveSHA256,files,analysisFingerprint}){
 assert.equal(previous.state,'FAILED','Recovery requires a failed run');
 assert.equal(failure.stage,'Checking room controls, evidence links and mobile layouts','Only completed-analysis layout failures can be recovered');
 for(const key of ['owner','batchId','engine'])assert.equal(previous[key],job[key],'Recovery source context changed: '+key);
 assert(previous.fingerprint===job.fingerprint||(analysisFingerprint&&[previous.analysisFingerprint,previous.fingerprint].includes(analysisFingerprint)),'Recovery source context changed: fingerprint');
 assert.equal(verification.batch_id,job.batchId);assert.equal(verification.archive_sha256,archiveSHA256,'Recovery archive changed');
 assert(Array.isArray(analysis.facts)&&analysis.facts.length>0);assert(Array.isArray(analysis.people));assert(Array.isArray(analysis.images));assert(Array.isArray(analysis.scenes)&&analysis.scenes.length>0);
 const texts=new Map(normal.texts.map(s=>[s.path,s]));
 function quote(source,start,value){assert(source&&Number.isSafeInteger(start)&&start>=0&&typeof value==='string'&&value.length>0&&source.text.slice(start,start+value.length)===value,'Recovered quote no longer matches original source');}
 for(const fact of analysis.facts){const source=texts.get(fact.path);assert.equal(source?.sourceId,fact.sourceId);quote(source,fact.start,fact.quote);assert(Array.isArray(fact.anchors)&&fact.anchors.length>0&&fact.anchors.length<=32);for(const anchor of fact.anchors){quote(source,anchor.start,anchor.quote);assert.equal(anchor.id,source.sourceId+'-U'+anchor.start);}}
 for(const person of analysis.people){quote(texts.get(person.source),person.start,person.quote);assert(typeof person.name==='string'&&person.name.length>0&&person.quote.includes(person.name),'Recovered person is not named in original quote');}
 const facts=new Set(analysis.facts.map(f=>f.id));assert.equal(facts.size,analysis.facts.length);
 for(const section of [analysis.overview,analysis.questions]){assert(Array.isArray(section)&&section.length>0);for(const item of section)assert(Array.isArray(item.factIds)&&item.factIds.length>0&&item.factIds.every(id=>facts.has(id)),'Recovered statement has unknown fact references');}
 for(const scene of analysis.scenes)assert(Array.isArray(scene.factIds)&&scene.factIds.every(id=>facts.has(id)),'Recovered scene has unknown fact references');
 if(files)assert.deepEqual(analysis.scenes,require('./detective-room-script').buildScript(normal,files,analysis),'Saved narration differs from the source-grounded template');
 for(const image of analysis.images)assert(normal.photos.some(p=>p.path===image.path&&p.sourceId===image.sourceId),'Recovered image is outside the original batch');
 assert.equal(analysis.images.length,normal.photos.length);assert.equal(analysis.narrationMode,'source-grounded-template');
 return analysis;
}
module.exports={validateRecovery};
