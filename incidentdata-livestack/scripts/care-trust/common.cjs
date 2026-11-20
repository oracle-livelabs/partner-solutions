'use strict';
const fs=require('node:fs'),path=require('node:path');
const {canonical:canonicalJson,sha256}=require('../evidence-intelligence/contract.cjs');
// Oracle timestamp values arrive as Date objects; fingerprint their ISO values too.
const canonical=value=>canonicalJson(JSON.parse(JSON.stringify(value)));
const ROOT=path.resolve(__dirname,'../..'),DIR=path.join(ROOT,'testdata/evidence-intelligence/care-trust-v1'),OUT=path.join(ROOT,'care_trust_20260925');
const PROFILE='AMSTERDAM_DATA_V1',PACK='EI_AMSTERDAM_CARE_V1',CASE='CASE-AMS-2026-03',KNOWLEDGE='KS-CARE-TRUST-001';
const read=(dir,name)=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
function save(dir,name,value,exclusive=false){fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,name),JSON.stringify(value,null,2)+'\n',{flag:exclusive?'wx':'w'});}
module.exports={ROOT,DIR,OUT,PROFILE,PACK,CASE,KNOWLEDGE,canonical,sha256,read,save};
