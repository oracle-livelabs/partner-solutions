// Runs read-only ADB searches using the app's OCI environment.
const assert = require('node:assert/strict');
const oracledb = require('oracledb');
const { parseSearch, searchReports } = require(process.argv[2] || '../backend/incident-semantic-search');
const embedding = require('../backend/pattern-embeddings');
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
(async () => {
 const c=await oracledb.getConnection({user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,connectString:process.env.ORACLE_CONNECTION_STRING,walletLocation:process.env.ORACLE_WALLET_LOCATION,walletPassword:process.env.ORACLE_WALLET_PASSWORD,configDir:process.env.ORACLE_WALLET_LOCATION});
 try {
  const cache = new Map();
  const cached = {...embedding,embedPatternTexts:async (inputs,type)=>{const key=JSON.stringify([inputs,type]);if(!cache.has(key))cache.set(key,await embedding.embedPatternTexts(inputs,type));return cache.get(key);}};
  for(const user of ['statewide_admin','read_only_viewer','northern_analyst','southern_analyst']) {
   await c.execute('BEGIN DBMS_SESSION.SET_IDENTIFIER(:usr); END;',{usr:user});
   const r=await searchReports(c,parseSearch({query:'payment diversion'}),cached);
   assert.equal(r.dimensions,1536); assert(r.results.length>0);
   assert(r.results.every(row=>row.SIMILARITY_SCORE>=0.4 && row.SIMILARITY_SCORE<1));
   assert(new Set(r.results.map(row=>row.SIMILARITY_SCORE)).size>1);
   assert(r.results.every((row,i)=>!i||row.SIMILARITY_SCORE<=r.results[i-1].SIMILARITY_SCORE));
   const refs=r.results.map(row=>row.INCIDENT_REF);
   const count=(await c.execute(`SELECT COUNT(*) total FROM secure_crime_incidents_v WHERE incident_ref IN (SELECT ref FROM JSON_TABLE(:refs,'$[*]' COLUMNS(ref VARCHAR2(120) PATH '$')))`,{refs:JSON.stringify(refs)})).rows[0].TOTAL;
   assert.equal(Number(count),refs.length);
   console.log(JSON.stringify({user,profile:r.profile,coverage:r.coverage,results:r.results.length,topScore:r.results[0].SIMILARITY_SCORE,lowestScore:r.results.at(-1).SIMILARITY_SCORE,authorisation:'passed'}));
  }
  await c.execute('BEGIN DBMS_SESSION.SET_IDENTIFIER(:usr); END;',{usr:'statewide_admin'});
  const strict=await searchReports(c,parseSearch({query:'payment diversion',minSimilarity:1}),cached);
  assert.equal(strict.results.length,0);
  const unrelated=await searchReports(c,parseSearch({query:'recipe for baking a chocolate cake'}),cached);
  assert.equal(unrelated.results.length,0);
  console.log('Strict threshold and unrelated-query empty results passed. No database writes.');
 } finally {await c.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
