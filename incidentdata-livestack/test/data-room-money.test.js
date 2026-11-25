'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {digest,normalize,parseSource,summarize,units,decimal,day,filters,filtered}=require('../backend/data-room-money-model');
const {createMoney,pathSql}=require('../backend/data-room-money');
const item=(text,id='csv')=>({ITEM_ID:id,ORIGINAL_PATH:id+'.csv',CONTENT_BLOB:Buffer.from(text),SHA256:digest(Buffer.from(text))});
const header='TRANSACTION_ID,TDATE,SENDER,SENDER_ACCOUNT,RECEIVER,RECEIVER_ACCOUNT,AMOUNT,CURRENCY,DESCRIPTION,STAGE,SYNTHETIC';
const suga=()=>item(header+'\n'+[
 ['001','11','VantaSys Group','001','Larkspur','002','450000',1],['002','11','VantaSys Group','001','Meridian','003','375000',1],['003','11','VantaSys Group','001','Beaconline','004','325000',1],['004','11','VantaSys Group','001','Foundry','005','350000',1],
 ['005','12','Larkspur','002','Briarstone','006','450000',2],['006','12','Meridian','003','Briarstone','006','375000',2],['007','12','Beaconline','004','Civic Reach','007','325000',2],['008','12','Foundry','005','Civic Reach','007','350000',2],
 ['009','14','Briarstone','006','Hartley','008','825000',3],['010','14','Civic Reach','007','Hartley','008','675000',3],
].map(([tx,d,s,sa,r,ra,amount,stage])=>`SUGA-TX-${tx},2026-09-${d},${s},SYN-AUD-${sa},${r},SYN-AUD-${ra},${amount},AUD,Demo,${stage},true`).join('\n'));
test('SUGA exact totals, topology and source provenance reconcile',()=>{
 const model=normalize([suga()]),s=summarize(model.transfers)[0];
 assert.equal(model.accounts.length,8);assert.equal(s.transferCount,10);assert.equal(s.pairCount,10);
 assert.equal(s.rootOutflow,'1500000.00');assert.equal(s.sinkInflow,'1500000.00');assert.equal(s.grossVolume,'4500000.00');
 assert.equal(s.split.length,1);assert.equal(s.convergence.length,3);assert.equal(s.equalIntermediates.length,6);assert.equal(s.hasCycle,false);
 assert.equal(model.transfers[9].source.record,10);assert.equal(model.transfers[9].raw.STAGE,'3');assert.equal(model.transfers[0].source.sha256,suga().SHA256);
});
test('amounts are exact well beyond Number safe integer and reject ambiguous formats',()=>{
 assert.equal(decimal(units('9007199254740993.000001')+units('0.000009')),'9007199254740993.00001');
 assert.equal(decimal(units('0.10')+units('0.20')),'0.30');assert.equal(decimal(-units('1.01')),'-1.01');
 for(const value of ['1e6','1,000','-1','NaN','0.0000001','9'.repeat(25)])assert.throws(()=>units(value));
});
test('calendar adapters reject impossible dates and canonicalize filters',()=>{
 assert.equal(day('14-SEP-2026'),'2026-09-14');assert.equal(day('2024-02-29'),'2024-02-29');
 for(const value of ['2026-02-29','2026-04-31','01-XYZ-2026','2026-13-01','09/11/2026','0000-01-01'])assert.throws(()=>day(value));
 assert.equal(filters({dateFrom:'14-SEP-2026'}).dateFrom,'2026-09-14');assert.throws(()=>filters({dateFrom:'2026-09-15',dateTo:'2026-09-14'}),e=>e.status===400);
});
test('Alice adapter retains unknown currency, missing IDs, source flags and unbalanced flows',()=>{
 const n=normalize([item('TDATE,SENDER,SENDER_ACCOUNT,RECEIVER,RECEIVER_ACCOUNT,AMOUNT,DESCRIPTION,FLAG\n11-SEP-2026,A,0001,B,0002,10,x,suspect\n12-SEP-2026,B,0002,C,0003,20,y,suspect')]);
 assert.equal(n.transfers[0].from,'0001');assert.equal(n.transfers[0].currency,'UNKNOWN');assert.equal(n.transfers[0].transactionId,null);assert.equal(n.transfers[0].raw.FLAG,'suspect');
 const s=summarize(n.transfers)[0];assert.equal(s.accounts.find(a=>a.id==='0002').netMovement,'-10.00');assert.equal(s.equalIntermediates.length,0);
});
test('payment and receipt CSV/JSON records join the same directed money graph with event provenance',()=>{
 const payments=item('payment_id,payer,payee,payment_amount,payment_date,currency,memo\nPAY-1,Asha,North Market,18.50,2026-09-10,AUD,coffee','payment');
 const receipt={receipt_id:'REC-2',paid_by:'North Market',merchant:'City Logistics',receipt_total:'18.50',received_at:'2026-09-11T09:30:00Z',currency_code:'AUD'};
 const json={ITEM_ID:'receipt',ORIGINAL_PATH:'receipt.json',CONTENT_TYPE:'json',CONTENT_BLOB:Buffer.from(JSON.stringify(receipt))};json.SHA256=digest(json.CONTENT_BLOB);
 const n=normalize([payments,json]),s=summarize(n.transfers)[0];
 assert.equal(n.transfers.length,2);assert.deepEqual(n.transfers.map(t=>t.eventType),['payment','receipt']);assert.equal(n.transfers[0].from,'Asha');assert.equal(n.transfers[1].to,'City Logistics');assert.equal(n.transfers[1].date,'2026-09-11');assert.equal(s.grossVolume,'37.00');assert.equal(s.onward.includes('North Market'),true);
});
test('named payment parties and receipt-specific amount/date headers are recognised',()=>{
 const n=normalize([item('payer_name,merchant_name,receipt_amount,receipt_issued_date,currency_code\nAsha,Heritage Hotel,122.00,2026-09-10,AUD')]);
 assert.equal(n.transfers[0].from,'Asha');assert.equal(n.transfers[0].to,'Heritage Hotel');assert.equal(n.transfers[0].amount,'122.00');
});
test('payment transaction exports with debit/credit fields are candidates and retain their records',()=>{
 const n=normalize([item('payment_reference,posting_date,debit_account,credit_account,transaction_amount,currency_code\nPAY-9,2026-09-10,AC-100,AC-200,75.25,AUD','payment-transactions')]);
 assert.equal(n.transfers.length,1);assert.equal(n.transfers[0].from,'AC-100');assert.equal(n.transfers[0].to,'AC-200');assert.equal(n.transfers[0].amount,'75.25');
 const body={paymentTransactions:[{payment_reference:'PAY-10',posting_date:'2026-09-11',originator_account:'AC-200',recipient_account:'AC-300',payment_value:'75.25',currency:'AUD'}]};
 const json={ITEM_ID:'payment-json',ORIGINAL_PATH:'payment-transactions.json',CONTENT_TYPE:'json',CONTENT_BLOB:Buffer.from(JSON.stringify(body))};json.SHA256=digest(json.CONTENT_BLOB);
 assert.equal(normalize([json]).transfers[0].to,'AC-300');
});
test('booked payment transaction extracts with account refs are recognised',()=>{
 const n=normalize([item('transaction_id,booked_at,sender_name,sender_account_ref,recipient_name,recipient_account_ref,amount,currency\nBRU-1,2026-05-14T09:10:00+02:00,Civic Forum,ACCT-CFF-01,Aster Services,ACCT-AST-01,52000.00,EUR','brussels-payments')]);
 assert.equal(n.transfers.length,1);assert.equal(n.transfers[0].from,'ACCT-CFF-01');assert.equal(n.transfers[0].to,'ACCT-AST-01');assert.equal(n.transfers[0].date,'2026-05-14');
});
test('timestamped bank/payment records retain their recorded calendar date',()=>{
 const n=normalize([item('transaction_id,timestamp,sender,sender_account,receiver,receiver_account,amount,currency\nCG-D001,2026-09-04T09:10:00+10:00,Willowmere,SYN-101,Common Ground,SYN-001,45000.00,AUD')]);
 assert.equal(n.transfers[0].date,'2026-09-04');assert.equal(n.transfers[0].from,'SYN-101');assert.equal(n.transfers[0].to,'SYN-001');
});
test('a receipt without a recorded payer does not create an invented graph edge',()=>{
 const receipt={ITEM_ID:'orphan',ORIGINAL_PATH:'receipt.json',CONTENT_TYPE:'json',CONTENT_BLOB:Buffer.from(JSON.stringify({receipt_id:'R-1',merchant:'Cafe',total:'8.00',date:'2026-09-10'}))};receipt.SHA256=digest(receipt.CONTENT_BLOB);
 const n=normalize([suga(),receipt]);assert.equal(n.skipped.length,1);assert.match(n.skipped[0].reason,/payer\/payee/);
});
test('sample amount_aud schema, quoted multiline fields and repeated records keep exact ordinals',()=>{
 const row='T1,2026-09-10,001,002,0.10,"Line one\nLine two"';
 const n=normalize([item('transaction_id,date,from_account,to_account,amount_aud,reference\n'+row+'\n\n'+row)]),s=summarize(n.transfers)[0];
 assert.equal(n.transfers[1].source.record,2);assert.notEqual(n.transfers[0].id,n.transfers[1].id);assert.equal(n.transfers[0].raw.reference,'Line one\nLine two');assert.equal(s.repeatedPairs,1);assert.equal(s.grossVolume,'0.20');assert.equal(s.pairs[0].transferIds.length,2);
});
test('mixed currencies are separated and filters do not invent FX or balances',()=>{
 const csv=suga();csv.CONTENT_BLOB=Buffer.from(csv.CONTENT_BLOB.toString().replace(',AUD,',',USD,'));csv.SHA256=digest(csv.CONTENT_BLOB);
 const n=normalize([csv]),s=summarize(n.transfers);assert.equal(s.length,2);assert.equal(s.find(x=>x.currency==='USD').grossVolume,'450000.00');
 const f=filtered(n.transfers,filters({currency:'AUD',dateFrom:'2026-09-14',dateTo:'2026-09-14'}));assert.equal(f.length,2);assert.equal(summarize(f)[0].grossVolume,'1500000.00');
});
test('malformed recognized sources fail atomically and unsupported CSV coverage is reported',()=>{
 const recognized='date,from_account,to_account,amount';
 for(const row of ['2026-09-10,A,B,0','2026-09-10,,B,1','2026-02-29,A,B,1','2026-09-10,A,B,-1'])assert.throws(()=>normalize([suga(),item(recognized+'\n'+row,'bad')]),e=>e.status===422&&/record 1/.test(e.message));
 assert.throws(()=>parseSource({...suga(),SHA256:'wrong'}),e=>e.status===409);
 assert.throws(()=>normalize([item(recognized+',AMOUNT\n2026-09-10,A,B,1,2')]),/duplicate column/);
 const n=normalize([suga(),item('name,age\nTest,20','roster')]);assert.equal(n.skipped.length,1);assert.equal(n.transfers.length,10);
});
test('cycle detection includes self-loops without conflating them with source/sink funds',()=>{
 for(const text of ['2026-09-10,A,A,1','2026-09-10,A,B,1\n2026-09-10,B,A,1']){const s=summarize(normalize([item('date,from_account,to_account,amount\n'+text)]).transfers)[0];assert.equal(s.hasCycle,true);assert.equal(s.roots.length,0);assert.equal(s.rootOutflow,'0.00');}
});
test('native route SQL constrains every intermediate account/edge, currency and chronology',()=>{
 const sql=pathSql(4);for(let i=0;i<=4;i++)assert(sql.includes(`a${i}.run_id=:rid`));for(let i=0;i<4;i++){assert(sql.includes(`e${i}.run_id=:rid`));assert(sql.includes(`e${i}.currency=:currency`));assert(sql.includes(`e${i}.event_day>=:dateFrom`));}
 assert.match(sql,/e3.event_day>=e2.event_day/);assert.match(sql,/a0.account_key<>a4.account_key/);assert.match(sql,/FETCH FIRST 101 ROWS ONLY/);
 for(const h of [0,5,1.5,'1 OR 1=1'])assert.throws(()=>pathSql(h));
});
test('hidden batches and read-only requests cannot build or obtain graphs/routes',async()=>{
 const calls=[];const db=async(user,fn)=>fn({execute:async(sql)=>{calls.push(sql);return {rows:[]};}}),m=createMoney(db);
 await assert.rejects(()=>m.build('read_only_viewer','B'),e=>e.status===403);assert.equal(calls.length,0);
 await assert.rejects(()=>m.build('northern_analyst','B'),e=>e.status===404);
 await assert.rejects(()=>m.read('northern_analyst','B'),e=>e.status===404);
 await assert.rejects(()=>m.routes('northern_analyst','B',{from:'A',to:'B',currency:'AUD'}),e=>e.status===404);
 assert(calls.every(sql=>sql.includes('secure_cdr_batches_v')));
});
test('late persistence failure rolls back the full snapshot',async()=>{
 let rollback=0,commit=0;const events=[];
 const s=suga(),c={execute:async(sql)=>{
  if(sql.startsWith('MERGE INTO cdr_cap_failures'))events.push('failure metadata');
  if(sql.includes('secure_cdr_batches_v')||sql.includes('FOR UPDATE'))return {rows:[{STATUS:'ready'}]};
  if(sql.includes('secure_cdr_money_runs_v'))return {rows:[]};
  if(sql.startsWith('SELECT content_blob'))return {rows:[{CONTENT_BLOB:s.CONTENT_BLOB}]};
  if(sql.includes('secure_cdr_items_v'))return {rows:[s]};
  return {rows:[]};
 },executeMany:async()=>{throw Error('test insert failure');},rollback:async()=>{rollback++;events.push('rollback snapshot');},commit:async()=>{commit++;events.push('commit metadata');}};
 await assert.rejects(()=>createMoney(async(u,fn)=>fn(c)).build('statewide_admin','B'),/test insert failure/);assert.equal(rollback,1);assert.equal(commit,1);assert.deepEqual(events,['rollback snapshot','failure metadata','commit metadata']);
});
