'use strict';
// Read-only application requests. No credential discovery or database writes.
const fs = require('node:fs');
const path = require('node:path');
const out = path.resolve(__dirname, '../../testdata/evidence-intelligence/v1/anchors.json');
const base = 'http://127.0.0.1:8706';
async function get(route, user='statewide_admin') {
  const r = await fetch(base+route,{headers:{'X-Demo-User':user},signal:AbortSignal.timeout(30000)});
  if(!r.ok) throw Error(`${route}: HTTP ${r.status}`);
  return r.json();
}
async function main() {
  const profile = await get('/api/profile-context');
  if(profile.profileCode!=='AMSTERDAM_DATA_V1') throw Error('Expected Amsterdam; no profile switch is performed');
  const cases=[],incidents=[],links=[],evidence=[];
  for(const caseRef of ['CASE-AMS-2026-02','CASE-AMS-2026-05']) {
    const graph=await get('/api/graph/network?caseRef='+caseRef+'&depth=2');
    cases.push(graph.center);
    for(const n of graph.nodes.filter(n=>n.type==='incident')) {
      const detail=await get('/api/incidents/'+n.INCIDENT_REF);
      incidents.push({...detail.incident,CASE_REF:caseRef});
      for(const person of detail.people)links.push({...person,INCIDENT_REF:n.INCIDENT_REF});
      for(const item of detail.evidence)evidence.push({...item,INCIDENT_REF:n.INCIDENT_REF});
    }
  }
  const scope=[];
  for(const user of ['statewide_admin','central_analyst','northern_analyst','southern_analyst','read_only_viewer']) {
    const visibleCases=await get('/api/graph/cases',user), visibleIncidents=[];
    for(const cf of cases.filter(cf=>visibleCases.some(v=>v.CASE_REF===cf.CASE_REF))) {
      const graph=await get('/api/graph/network?caseRef='+cf.CASE_REF+'&depth=2',user);
      visibleIncidents.push(...graph.nodes.filter(n=>n.type==='incident').map(n=>n.INCIDENT_REF));
    }
    scope.push({user,incidents:visibleIncidents.sort(),people:(await get('/api/persons',user)).map(p=>p.PERSON_REF)});
  }
  const people=await get('/api/persons');
  const after=await get('/api/profile-context');
  if(after.profileCode!==profile.profileCode)throw Error('Active profile changed during capture');
  if(incidents.length!==12||links.length!==12)throw Error('Expected twelve incidents and twelve existing person links');
  const result={formatVersion:1,capturedAt:new Date().toISOString(),source:base+' read-only HTTP; application display-copy transformation applies',profile,timeZone:profile.timeZone,cases,incidents,links,evidence,people,scope,
    nativeDatabaseValidation:'pending; no direct database connection used'};
  fs.mkdirSync(path.dirname(out),{recursive:true});
  fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({output:out,profile:profile.profileCode,incidents:incidents.length,linkedPeople:new Set(links.map(x=>x.PERSON_REF)).size,evidence:evidence.length,scope:scope.map(s=>({user:s.user,incidents:s.incidents.length,people:s.people.length}))}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
