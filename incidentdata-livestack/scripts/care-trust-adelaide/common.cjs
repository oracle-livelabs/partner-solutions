'use strict';
const path=require('node:path');
const {canonical,sha256,read,save:write}=require('../care-trust/common.cjs');
const ROOT=path.resolve(__dirname,'../..'),DIR=path.join(ROOT,'testdata/evidence-intelligence/care-trust-adelaide-v1'),OUT=path.join(ROOT,'care_trust_adelaide_20260927');
const PROFILE='ADELAIDE_DATA_V2',PID=6,PACK='EI_ADELAIDE_CARE_V1',CASE='CASE-V2-RES-001',PATTERN='RESIDENTIAL_OCCUPANCY_BURGLARY',KNOWLEDGE='KS-CARE-TRUST-001';
const save=(dir,name,value)=>write(dir,name,value,true);
module.exports={ROOT,DIR,OUT,PROFILE,PID,PACK,CASE,PATTERN,KNOWLEDGE,canonical,sha256,read,save};
