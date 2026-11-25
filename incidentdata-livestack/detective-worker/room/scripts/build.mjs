import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const args=Object.fromEntries(process.argv.slice(2).reduce((a,x,i,v)=>i%2===0?[...a,[x,v[i+1]]]:a,[]));
for(const k of ['--batch','--case','--out','--runtime-package'])assert(args[k],`Missing ${k}`);
const batch=args['--batch'];assert(/^DR-[0-9]{8}-[a-f0-9-]+$/.test(batch),'Invalid BATCH_ID');
const C=JSON.parse(fs.readFileSync(args['--case'],'utf8'));assert.equal(C.batch_id,batch,'Input batch mismatch');
for(const k of ['title','subtitle','focus','disclaimer','snapshot','version'])assert(typeof C[k]==='string'&&C[k].trim(),`Missing ${k}`);
assert.equal(typeof C.synthetic,'boolean');
for(const k of ['notes','people','photos','conversations','messages','records','panels'])assert(Array.isArray(C[k]),`Expected ${k} array`);
const out=path.resolve(args['--out']);assert(!fs.existsSync(out),'Use a fresh output folder; completed rooms are not overwritten');
assert(path.isAbsolute(C.evidence_dir)&&path.isAbsolute(C.header_file),'Use absolute input paths');
const evidence=C.evidence_dir,source=path.join(evidence,'source');
const V=JSON.parse(fs.readFileSync(path.join(evidence,'verification.json'),'utf8'));
const H=JSON.parse(fs.readFileSync(C.header_file,'utf8')).results[0].items[0];
assert.equal(V.batch_id,batch);assert.equal(H.batch_id,batch);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const archive=fs.readFileSync(path.join(evidence,'batch.zip'));
assert.equal(sha(archive),H.archive_sha256);assert.equal(sha(archive),V.archive_sha256);assert.equal(archive.length,H.archive_bytes);assert.equal(V.verified_files.length,H.file_count);
const safeRelative=s=>typeof s==='string'&&s&&!path.isAbsolute(s)&&!s.includes('\\')&&!s.includes(':')&&!/[\x00-\x1f]/.test(s)&&!s.split('/').some(x=>!x||x==='.'||x==='..');
const derived=V.derived_transcripts||[];
for(const f of derived){assert(V.verified_files.some(o=>o.path===f.derivedFrom?.path&&o.sha256===f.derivedFrom.sha256),'Derived transcript has no verified original');assert.equal(f.sha256,f.derivedFrom.transcriptSha256,'Transcript hash mismatch');assert.equal(f.derivedFrom.reviewStatus,'unreviewed_machine_transcript');}
const files=[...V.verified_files,...derived].map(f=>{
 assert(safeRelative(f.path),'Unsafe source path');const p=path.join(source,f.path);
 assert(fs.realpathSync(p).startsWith(fs.realpathSync(source)+path.sep),'Source symlink escapes root');
 const b=fs.readFileSync(p);assert.equal(sha(b),f.sha256,`Hash mismatch ${f.path}`);assert.equal(b.length,f.bytes);
 return {...f,text:/\.(txt|json|csv|tsv|md)$/i.test(f.path)?b.toString('utf8'):null};
});
assert.equal(new Set(files.map(f=>f.path)).size,files.length);
const require=createRequire(path.resolve(args['--runtime-package'])),sharp=require('sharp');
const jpeg=async(p,width)=>'data:image/jpeg;base64,'+(await sharp(p).resize({width,withoutEnlargement:true}).jpeg({quality:86}).toBuffer()).toString('base64');
const unique=(xs,k,label)=>{assert(xs.every(x=>typeof x[k]==='string'&&x[k].length),`Missing ${label} ID`);assert.equal(new Set(xs.map(x=>x[k])).size,xs.length,`Duplicate ${label}`);};
unique(C.people,'id','person');unique(C.photos,'path','photo');unique(C.conversations,'id','conversation');unique(C.messages,'id','message');unique(C.records,'id','record');unique(C.panels,'id','panel');
const people=[];
for(const p of C.people){assert(p.name&&p.detail&&Array.isArray(p.sourceRefs));let image=null;if(p.portrait){assert(path.isAbsolute(p.portrait.path));const b=fs.readFileSync(p.portrait.path);assert.equal(sha(b),p.portrait.sha256,`Portrait mismatch ${p.name}`);image=await jpeg(p.portrait.path,520);}people.push({id:p.id,name:p.name,detail:p.detail,sourceRefs:p.sourceRefs,sha256:p.portrait?.sha256??null,image});}
const photos=[];
for(const p of C.photos){assert(p.title&&p.note);const f=files.find(f=>f.path===p.path);assert(f,`Unregistered photo ${p.path}`);photos.push({...f,title:p.title,note:p.note,image:await jpeg(path.join(source,p.path),1280)});}
for(const c of C.conversations)assert(c.title&&c.summary&&Array.isArray(c.participants)&&Array.isArray(c.sourceRefs));
for(const m of C.messages){assert(C.conversations.some(c=>c.id===m.conversation),`Unknown conversation ${m.id}`);for(const k of ['sender','text','timeLabel','timeBasis','source'])assert(typeof m[k]==='string'&&m[k].length,`Missing message ${k}`);assert(C.conversations.find(c=>c.id===m.conversation).participants.includes(m.sender),`Sender missing from participants: ${m.id}`);}
for(const r of C.records)assert(r.title&&r.source&&r.note&&r.fields&&typeof r.fields==='object'&&!Array.isArray(r.fields));
const reserved=['room','board','messages','gallery','sources','briefing'];
const checkHTML=html=>{assert(typeof html==='string');assert(!/<\s*(script|iframe|object|embed|form|link|meta|style)\b|\bon\w+\s*=|\b(?:href|src)\s*=|javascript\s*:|url\s*\(|@import/i.test(html),'Panel HTML must be static, local and source-escaped');};
for(const p of C.panels){assert(/^[a-z][a-z0-9-]*$/.test(p.id)&&!reserved.includes(p.id));assert(p.label&&p.title&&typeof p.intro==='string');checkHTML(p.html);}
assert(C.notes.every(n=>typeof n==='string'),'Notes must be strings');
assert(C.leftWall&&C.panels.some(p=>p.id===C.leftWall.view),'Left wall must link to an analytical panel');for(const k of ['title','subtitle','footnote'])assert(typeof C.leftWall[k]==='string'&&C.leftWall[k].length,`Missing leftWall.${k}`);checkHTML(C.leftWall.html);assert(!/<button\b/i.test(C.leftWall.html),'Left preview cannot nest interactive buttons');
const board=C.board;for(const k of ['people','photos','conversations','links'])assert(Array.isArray(board?.[k]),`Missing board.${k}`);
for(const [key,items,id] of [['people',people,'id'],['photos',photos,'path'],['conversations',C.conversations,'id']]){assert.equal(new Set(board[key]).size,board[key].length);for(const ref of board[key])assert(items.some(x=>x[id]===ref),`Unknown board ${key}: ${ref}`);}
const pins=new Set(['source:images',...board.people.map(x=>'person:'+x),...board.photos.map(x=>'photo:'+x),...board.conversations.map(x=>'conversation:'+x)]);
for(const link of board.links){assert(pins.has(link.from)&&pins.has(link.to),'Cord endpoint absent');assert(['blue','gold','red'].includes(link.color)&&link.label,'Cord needs category and source basis');}
const allHtml=[...C.panels.map(p=>p.html),C.leftWall.html].join('\n');
const actionRefs={record:C.records.map(x=>x.id),file:files.map(x=>x.path),person:people.map(x=>x.id),photo:photos.map(x=>x.path),conversation:C.conversations.map(x=>x.id),view:['room','board','sources',...(C.messages.length?['messages']:[]),...(photos.length?['gallery']:[]),...(C.briefing?['briefing']:[]),...C.panels.map(x=>x.id)]};
const unescape=s=>s.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
for(const match of allHtml.matchAll(/data-(record|file|person|photo|conversation|view)=["']([^"']+)["']/g))assert(actionRefs[match[1]].includes(unescape(match[2])),`Bad panel action: ${match[0]}`);
let briefing=null,briefingFiles=[];
if(C.briefing){assert.equal(C.briefing.batch_id,batch,'Briefing batch mismatch');assert(path.isAbsolute(C.briefing.directory));const dir=C.briefing.directory;
 for(const file of ['Case-Overview.html','Case-Overview-Transcript.md'])assert(fs.readFileSync(path.join(dir,file),'utf8').includes(batch),`Briefing ${file} batch mismatch`);
 const validation=JSON.parse(fs.readFileSync(path.join(dir,'validation.json'),'utf8'));assert.equal(validation.width,1920);assert.equal(validation.height,1080);assert.equal(validation.audioTracks,1);
 briefing={durationLabel:C.briefing.durationLabel,durationSeconds:validation.durationSeconds,videoSHA256:sha(fs.readFileSync(path.join(dir,'Case-Overview.mp4')))};
 briefingFiles=['Case-Overview.html','Case-Overview.mp4','Case-Overview-Poster.jpg','Case-Overview-Transcript.md','Case-Overview-Voiceover.m4a','Case-Overview.en.srt','Case-Overview.en.vtt','Evidence-Register.html','Voice-Production.json','validation.json','player-validation.json','QA-Notes.md','README.md'].filter(f=>fs.existsSync(path.join(dir,f)));
}
const D={batch_id:batch,title:C.title,subtitle:C.subtitle,focus:C.focus,disclaimer:C.disclaimer,synthetic:C.synthetic,snapshot:C.snapshot,version:C.version,notes:C.notes,people,photos,conversations:C.conversations,messages:C.messages,records:C.records,panels:C.panels,leftWall:C.leftWall,board,briefing,files,archive:{filename:H.filename,sha256:H.archive_sha256,bytes:H.archive_bytes},excludedMetadata:V.excluded_os_metadata??[]};
const dir=path.dirname(fileURLToPath(import.meta.url));
const html=fs.readFileSync(path.join(dir,'../assets/room.html'),'utf8').replace('/*__ROOM_CSS__*/',fs.readFileSync(path.join(dir,'../assets/industrial.css'),'utf8')).replace('/*__ROOM_DATA__*/',JSON.stringify(D).replace(/</g,'\\u003c'));
fs.mkdirSync(path.join(out,'evidence'),{recursive:true});
for(const f of files){const target=path.join(out,'evidence',f.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(source,f.path),target);assert.equal(sha(fs.readFileSync(target)),f.sha256);}
if(briefing){fs.mkdirSync(path.join(out,'briefing'));for(const f of briefingFiles)fs.copyFileSync(path.join(C.briefing.directory,f),path.join(out,'briefing',f));const player=path.join(out,'briefing/Case-Overview.html');fs.writeFileSync(player,fs.readFileSync(player,'utf8').replace('<div class="links">','<div class="links"><a href="../Virtual-Detective-Room.html">← Enter detective room</a>'));assert.equal(sha(fs.readFileSync(path.join(out,'briefing/Case-Overview.mp4'))),briefing.videoSHA256);}
fs.writeFileSync(path.join(out,'Virtual-Detective-Room.html'),html);
const report={batch_id:batch,archiveVerified:true,verifiedFiles:files.length,portraitsVerified:people.filter(p=>p.image).length,photos:photos.length,messages:C.messages.length,conversations:C.conversations.length,records:C.records.length,briefing,htmlSHA256:sha(Buffer.from(html)),htmlBytes:Buffer.byteLength(html)};
fs.writeFileSync(path.join(out,'build-validation.json'),JSON.stringify(report,null,2));
fs.writeFileSync(path.join(out,'README.md'),`# ${C.title} — Virtual Detective Room ${C.version}\n\nBatch: ${batch}\n\n${C.subtitle}\n\n${C.focus}\n\nOpen Virtual-Detective-Room.html in a browser. No login or server is needed. Keep this folder together for original evidence downloads and any included video.\n\n${C.disclaimer}\n\nSnapshot: ${C.snapshot}. Archive and all ${files.length} source files verified by SHA-256 and size. ${people.filter(p=>p.image).length} supplemental portraits verified. Original source files remain unchanged; embedded display images are resized.\n\nThis is a local, offline evidence room, not hosted, shared, synchronized or live-connected to the database. No credentials or wallet are included.\n\n## Evidence notes\n\n${C.notes.join('\n\n')}\n`);
console.log(JSON.stringify({out,...report},null,2));
