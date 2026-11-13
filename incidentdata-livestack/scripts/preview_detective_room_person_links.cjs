'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),o=require('oracledb');
const {snapshot}=require('../backend/detective-room-source'),{normalize}=require('../backend/detective-room-normalize'),{addNamedPeople,portraits,compose}=require('../backend/detective-room-compose'),{applyPersonLinks}=require('../backend/detective-room-associations');
(async()=>{const previous=process.argv[2],directory=process.argv[3];assert(previous&&directory);const root=process.env.CDR_ROOM_ROOT,old=path.join(root,'jobs',previous),job=JSON.parse(await fs.readFile(path.join(old,'job.json')));
 const w=process.env.ORACLE_WALLET_LOCATION,c=await o.getConnection({user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,connectString:process.env.ORACLE_CONNECTION_STRING,walletLocation:w,configDir:w,walletPassword:process.env.ORACLE_WALLET_PASSWORD});c.callTimeout=30000;
 try{await c.execute("BEGIN DBMS_SESSION.SET_IDENTIFIER(:u); END;",{u:job.owner});await c.execute('SET TRANSACTION READ ONLY');
  const data=await snapshot(c,job.batchId),normal=normalize(data.analysisFiles),authored=JSON.parse(await fs.readFile(path.join(old,'authoring.json')));
  addNamedPeople(normal,authored);applyPersonLinks(normal,data.associations);
  await fs.mkdir(directory,{recursive:true,mode:0o700});await fs.cp(path.join(old,'evidence'),path.join(directory,'evidence'),{recursive:true});await fs.copyFile(path.join(old,'header.json'),path.join(directory,'header.json'));
  await portraits(c,normal.people,process.env.CDR_ROOM_PUBLIC_ROOT||'/public',path.join(directory,'portraits'));
  const {room}=compose({job:{...job,id:path.basename(directory)},snapshot:data,normal,authored,directory,briefingDir:path.join(old,'briefing')});
  const selected=room.people.filter(p=>room.board.people.includes(p.id));assert.equal(selected.filter(p=>p.handles?.length&&p.portrait).length,4);assert.equal(data.associations.links.length,4);assert(room.panels.some(p=>p.id==='person-links'));
  await fs.writeFile(path.join(directory,'room-case.json'),JSON.stringify(room,null,2));
  console.log(JSON.stringify({caseFile:path.join(directory,'room-case.json'),board:selected.map(p=>({name:p.name,portrait:!!p.portrait,handles:p.handles})),photoComparisons:data.associations.photoComparisons.length,photoLinks:room.board.links.filter(l=>l.to.startsWith('photo:')&&l.from.startsWith('person:')).map(l=>l.label),originalMessagesUnchanged:normal.messages.every(m=>room.messages.some(r=>r.id===m.id&&r.sender===m.sender&&r.text===m.text))},null,2));
 }finally{await c.rollback();await c.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
