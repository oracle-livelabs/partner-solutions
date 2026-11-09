'use strict';
const {parse}=require('csv-parse/sync');
const {createHash}=require('node:crypto');
const VERSION='cdr-money-v4';
const LIMITS={csvBytes:2*1024*1024,transfers:500,accounts:100,maxHops:4,routes:100};
const digest=value=>createHash('sha256').update(value).digest('hex');
const fail=(status,message)=>Object.assign(Error(message),{status});
// Six decimal places, using integer arithmetic throughout. No binary-float sums.
const SCALE=1000000n;
function units(value){
 const text=String(value).trim();
 if(!/^\d{1,24}(?:\.\d{1,6})?$/.test(text))throw Error('Amount must be an unsigned decimal with at most 24 whole digits and 6 decimal places (no separators or exponent).');
 const [whole,part='']=text.split('.');return BigInt(whole)*SCALE+BigInt(part.padEnd(6,'0'));
}
function decimal(value){
 const negative=value<0n;if(negative)value=-value;
 const part=String(value%SCALE).padStart(6,'0').replace(/0+$/,'').padEnd(2,'0');
 return `${negative?'-':''}${value/SCALE}.${part}`;
}
function day(value){
 let text=String(value||'').trim(),match=text.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
 if(/^\d{4}-\d{2}-\d{2}T/.test(text)){const parsed=new Date(text);if(!Number.isFinite(parsed.getTime()))throw Error('Date must be a valid ISO timestamp.');text=text.slice(0,10);}
 if(match){const month=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'].indexOf(match[2].toUpperCase())+1;text=`${match[3]}-${String(month).padStart(2,'0')}-${match[1]}`;}
 if(!/^\d{4}-\d{2}-\d{2}$/.test(text)||text<'0001-01-01'||!Number.isFinite(Date.parse(text+'T00:00:00Z'))||new Date(text+'T00:00:00Z').toISOString().slice(0,10)!==text)throw Error('Date must be a valid YYYY-MM-DD or DD-MON-YYYY calendar date.');
 return text;
}
const aliases={
 from:['SENDER_ACCOUNT','SENDER_ACCOUNT_REF','FROM_ACCOUNT','PAYER_ACCOUNT','PAYOR_ACCOUNT','DEBTOR_ACCOUNT','CUSTOMER_ACCOUNT','BUYER_ACCOUNT','DEBIT_ACCOUNT','DEBIT_ACCOUNT_NUMBER','ORIGINATOR_ACCOUNT','SOURCE_ACCOUNT','SENDER_ID','FROM_ID','PAYER_ID','PAYOR_ID','DEBTOR_ID','CUSTOMER_ID','BUYER_ID','DEBITOR_ID','ORIGINATOR_ID','SENDER_NAME','PAYER_NAME','PAYOR_NAME','CUSTOMER_NAME','BUYER_NAME','PAID_BY_NAME','DEBITOR_NAME','ORIGINATOR_NAME','SENDER','FROM','FROM_PARTY','PAYER','PAYOR','PAID_BY','DEBTOR','CUSTOMER','BUYER','DEBITOR','ORIGINATOR'],
 to:['RECEIVER_ACCOUNT','RECIPIENT_ACCOUNT_REF','TO_ACCOUNT','PAYEE_ACCOUNT','CREDITOR_ACCOUNT','MERCHANT_ACCOUNT','VENDOR_ACCOUNT','BENEFICIARY_ACCOUNT','SELLER_ACCOUNT','CREDIT_ACCOUNT','CREDIT_ACCOUNT_NUMBER','DESTINATION_ACCOUNT','RECIPIENT_ACCOUNT','RECEIVER_ID','TO_ID','PAYEE_ID','CREDITOR_ID','MERCHANT_ID','VENDOR_ID','BENEFICIARY_ID','SELLER_ID','CREDITEE_ID','RECIPIENT_ID','RECEIVER_NAME','PAYEE_NAME','MERCHANT_NAME','VENDOR_NAME','BENEFICIARY_NAME','SELLER_NAME','PAID_TO_NAME','RECEIVED_BY_NAME','CREDITOR_NAME','RECIPIENT_NAME','RECEIVER','RECEIVED_BY','TO','TO_PARTY','PAYEE','PAID_TO','CREDITOR','MERCHANT','VENDOR','BENEFICIARY','SELLER','RECIPIENT'],
 amount:['AMOUNT','AMOUNT_AUD','TOTAL','TOTAL_AMOUNT','TRANSACTION_AMOUNT','TRANSACTION_VALUE','PAYMENT_AMOUNT','PAYMENT_VALUE','AMOUNT_PAID','PAID_AMOUNT','RECEIVED_AMOUNT','RECEIPT_AMOUNT','RECEIPT_TOTAL','GROSS_AMOUNT','VALUE','DEBIT_AMOUNT','CREDIT_AMOUNT'],
 date:['TDATE','DATE','TIMESTAMP','BOOKED_AT','TRANSACTION_TIMESTAMP','TRANSACTION_DATE','PAYMENT_DATE','PAYMENT_TIMESTAMP','DATE_PAID','RECEIPT_DATE','RECEIPT_ISSUED_DATE','RECEIVED_DATE','PAID_DATE','ISSUED_DATE','POSTING_DATE','VALUE_DATE','BOOKING_DATE','PAID_AT','RECEIVED_AT','TRANSACTION_AT'],
 currency:['CURRENCY','CURRENCY_CODE'],
 fromLabel:['SENDER','FROM','PAYER','PAYOR','PAID_BY','DEBTOR','CUSTOMER','BUYER'],
 toLabel:['RECEIVER','TO','PAYEE','PAID_TO','CREDITOR','MERCHANT','VENDOR','BENEFICIARY','SELLER'],
 tx:['TRANSACTION_ID','PAYMENT_ID','RECEIPT_ID','REFERENCE','INVOICE_ID','ID'],
 description:['DESCRIPTION','REFERENCE','MEMO','NARRATIVE','DETAILS','PURPOSE']
};
const choose=(keys,names)=>names.find(n=>keys.includes(n));
function columnsFor(keys){
 const columns=Object.fromEntries(Object.entries(aliases).map(([name,names])=>[name,choose(keys,names)]));
 if(!columns.from||!columns.to||!columns.amount||!columns.date)return null;
 return columns;
}
function eventType(keys){
 if(keys.some(k=>/RECEIPT/.test(k)))return 'receipt';
 if(keys.some(k=>/PAY(?:MENT|EE|ER|OR)|MERCHANT|VENDOR|INVOICE/.test(k)))return 'payment';
 return 'transfer';
}
function recordTransfer({item,headers,keys,row,index,columns,type}){
 try{
  const get=name=>String(row[columns[name]]??'').trim();
  const from=get('from'),to=get('to');
  for(const party of [from,to])if(!party||Buffer.byteLength(party)>200||/[\x00-\x1f\x7f]/.test(party))throw Error('Both payer/sender and payee/recipient identifiers must be non-empty, at most 200 bytes, without control characters.');
  const amount=units(get('amount'));if(amount===0n)throw Error('Money amount must be greater than zero.');
  const currency=get('currency').toUpperCase()||(columns.amount==='AMOUNT_AUD'?'AUD':'UNKNOWN');
  if(currency!=='UNKNOWN'&&!/^[A-Z]{3}$/.test(currency))throw Error('Currency must be a three-letter code or blank.');
  if(columns.amount==='AMOUNT_AUD'&&currency!=='AUD')throw Error('AMOUNT_AUD conflicts with the currency column.');
  const fromLabel=get('fromLabel')||from,toLabel=get('toLabel')||to;
  if([fromLabel,toLabel].some(v=>Buffer.byteLength(v)>1000))throw Error('Party label exceeds 1,000 bytes.');
  return {id:digest(`${item.ITEM_ID}:${index+1}`),from,to,fromLabel,toLabel,amount:decimal(amount),currency,date:day(get('date')),transactionId:get('tx')||null,description:get('description'),eventType:type,source:{itemId:item.ITEM_ID,path:item.ORIGINAL_PATH,sha256:item.SHA256,record:index+1},raw:headers?Object.fromEntries(headers.map((h,i)=>[h,row[keys[i]]])):row};
 }catch(e){throw fail(422,`${item.ORIGINAL_PATH}, data record ${index+1}: ${e.message}`);}
}
function parseCsv(item){
 if(item.CONTENT_BLOB.length>LIMITS.csvBytes)throw fail(422,`${item.ORIGINAL_PATH}: CSV exceeds the 2 MiB money-flow limit.`);
 if(digest(item.CONTENT_BLOB)!==item.SHA256)throw fail(409,`${item.ORIGINAL_PATH}: source checksum mismatch.`);
 let records;try{records=parse(new TextDecoder('utf-8',{fatal:true}).decode(item.CONTENT_BLOB),{bom:true,skip_empty_lines:true,max_record_size:64000});}catch(e){throw fail(422,`${item.ORIGINAL_PATH}: invalid CSV (${e.message}).`);}
 if(!records.length)return {unsupported:true,reason:'Empty CSV'};
 const headers=records.shift(),keys=headers.map(h=>h.trim().toUpperCase());
 const columns=columnsFor(keys);
 if(!columns)return {unsupported:true,reason:'No supported payer/payee, amount and date column set'};
 if(new Set(keys).size!==keys.length)throw fail(422,`${item.ORIGINAL_PATH}: duplicate column names.`);
 if(records.length>LIMITS.transfers)throw fail(422,`${item.ORIGINAL_PATH}: more than ${LIMITS.transfers} transfers. Split the test batch; no rows have been imported.`);
 const type=eventType(keys),transfers=records.map((cells,index)=>recordTransfer({item,headers,keys,row:Object.fromEntries(keys.map((k,i)=>[k,cells[i]])),index,columns,type}));
 return {transfers};
}
function jsonRecords(value){
 return Array.isArray(value)?value:Array.isArray(value?.payments)?value.payments:Array.isArray(value?.paymentTransactions)?value.paymentTransactions:Array.isArray(value?.payment_transactions)?value.payment_transactions:Array.isArray(value?.paymentTransactions?.items)?value.paymentTransactions.items:Array.isArray(value?.receipts)?value.receipts:Array.isArray(value?.transactions)?value.transactions:Array.isArray(value?.transactionRecords)?value.transactionRecords:Array.isArray(value?.transaction_records)?value.transaction_records:Array.isArray(value?.records)?value.records:[value];
}
function parseJson(item){
 if(item.CONTENT_BLOB.length>LIMITS.csvBytes)throw fail(422,`${item.ORIGINAL_PATH}: JSON exceeds the 2 MiB money-flow limit.`);
 if(digest(item.CONTENT_BLOB)!==item.SHA256)throw fail(409,`${item.ORIGINAL_PATH}: source checksum mismatch.`);
 let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(item.CONTENT_BLOB));}catch(e){throw fail(422,`${item.ORIGINAL_PATH}: invalid JSON (${e.message}).`);}
 const records=jsonRecords(value);
 if(!records.length||!records.every(r=>r&&typeof r==='object'&&!Array.isArray(r)))return {unsupported:true,reason:'No supported money-record array'};
 if(records.length>LIMITS.transfers)throw fail(422,`${item.ORIGINAL_PATH}: more than ${LIMITS.transfers} money records. Split the test batch; no rows have been imported.`);
 const keys=[...new Set(records.flatMap(r=>Object.keys(r).map(k=>k.trim().toUpperCase())))],columns=columnsFor(keys);
 if(!columns)return {unsupported:true,reason:'No supported payer/payee, amount and date property set'};
 const type=eventType(keys),transfers=records.map((record,index)=>{const row=Object.fromEntries(Object.entries(record).map(([k,v])=>[k.trim().toUpperCase(),v==null?'':typeof v==='object'?JSON.stringify(v):String(v)]));return recordTransfer({item,keys,row,index,columns,type});});
 return {transfers};
}
function parseSource(item){return item.CONTENT_TYPE==='json'||/\.json$/i.test(item.ORIGINAL_PATH)?parseJson(item):parseCsv(item);}
function normalize(items){
 const transfers=[],sources=[],skipped=[];
 for(const item of items){const parsed=parseSource(item);if(parsed.unsupported){skipped.push({itemId:item.ITEM_ID,path:item.ORIGINAL_PATH,reason:parsed.reason});continue;}transfers.push(...parsed.transfers);sources.push({itemId:item.ITEM_ID,path:item.ORIGINAL_PATH,sha256:item.SHA256,records:parsed.transfers.length});}
 if(!transfers.length)throw fail(422,'No money records found. Supported records provide payer/sender and payee/recipient, amount and date (including payment and receipt fields).');
 if(transfers.length>LIMITS.transfers)throw fail(422,`This first money-flow view supports ${LIMITS.transfers} transfers per batch; no rows were imported.`);
 const map=new Map();
 for(const t of transfers)for(const [id,label] of [[t.from,t.fromLabel],[t.to,t.toLabel]]){if(!map.has(id))map.set(id,{id,labels:[],sources:new Map()});const account=map.get(id);if(!account.labels.includes(label))account.labels.push(label);account.sources.set(t.source.itemId,{itemId:t.source.itemId,path:t.source.path});}
 if(map.size>LIMITS.accounts)throw fail(422,`This first money-flow view supports ${LIMITS.accounts} accounts per batch; no rows were imported.`);
 const accounts=[...map.values()].map(a=>({id:a.id,labels:a.labels,sources:[...a.sources.values()].sort((x,y)=>x.path.localeCompare(y.path))})).sort((a,b)=>a.id.localeCompare(b.id));
 return {version:VERSION,accounts,transfers,sources,skipped,limits:LIMITS};
}
function summarize(transfers){
 const currencies=[...new Set(transfers.map(t=>t.currency))].sort();
 return currencies.map(currency=>{
  const selected=transfers.filter(t=>t.currency===currency),accounts=new Map(),pairs=new Map();
  const ensure=id=>{if(!accounts.has(id))accounts.set(id,{id,in:0n,out:0n,senders:new Set(),receivers:new Set()});return accounts.get(id);};
  for(const t of selected){const a=ensure(t.from),b=ensure(t.to),amount=units(t.amount);a.out+=amount;a.receivers.add(t.to);b.in+=amount;b.senders.add(t.from);const key=JSON.stringify([t.from,t.to]);if(!pairs.has(key))pairs.set(key,{id:digest(key+currency),from:t.from,to:t.to,amount:0n,transferIds:[]});const p=pairs.get(key);p.amount+=amount;p.transferIds.push(t.id);}
  const nodes=[...accounts.values()],roots=nodes.filter(n=>n.senders.size===0),sinks=nodes.filter(n=>n.receivers.size===0);
  const active=new Set(),visited=new Set();
  const cycle=id=>{if(active.has(id))return true;if(visited.has(id))return false;visited.add(id);active.add(id);for(const next of accounts.get(id).receivers)if(cycle(next))return true;active.delete(id);return false;};
  const hasCycle=nodes.some(n=>cycle(n.id));
  return {currency,transferCount:selected.length,accountCount:nodes.length,pairCount:pairs.size,grossVolume:decimal(selected.reduce((v,t)=>v+units(t.amount),0n)),rootOutflow:decimal(roots.reduce((v,n)=>v+n.out,0n)),sinkInflow:decimal(sinks.reduce((v,n)=>v+n.in,0n)),roots:roots.map(n=>n.id),sinks:sinks.map(n=>n.id),hasCycle,
   split: nodes.filter(n=>n.receivers.size>1).map(n=>n.id),convergence:nodes.filter(n=>n.senders.size>1).map(n=>n.id),onward:nodes.filter(n=>n.senders.size&&n.receivers.size).map(n=>n.id),equalIntermediates:nodes.filter(n=>n.senders.size&&n.receivers.size&&n.in===n.out).map(n=>n.id),repeatedPairs:[...pairs.values()].filter(p=>p.transferIds.length>1).length,
   accounts:nodes.map(n=>({id:n.id,inflow:decimal(n.in),outflow:decimal(n.out),netMovement:decimal(n.in-n.out),senders:n.senders.size,receivers:n.receivers.size})),pairs:[...pairs.values()].map(p=>({...p,amount:decimal(p.amount)})),dateFrom:selected.map(t=>t.date).sort()[0],dateTo:selected.map(t=>t.date).sort().at(-1)};
 });
}
function filters(query={}){
 const currency=String(query.currency||'');let from=String(query.dateFrom||''),to=String(query.dateTo||'');
 if(currency&&!/^(?:[A-Z]{3}|UNKNOWN)$/.test(currency))throw fail(400,'Invalid currency filter.');
 try{if(from)from=day(from);if(to)to=day(to);}catch(e){throw fail(400,e.message);}
 if(from&&to&&from>to)throw fail(400,'The start date must not be after the end date.');
 return {currency,dateFrom:from,dateTo:to};
}
function filtered(transfers,f){return transfers.filter(t=>(!f.currency||t.currency===f.currency)&&(!f.dateFrom||t.date>=f.dateFrom)&&(!f.dateTo||t.date<=f.dateTo));}
module.exports={VERSION,LIMITS,digest,fail,units,decimal,day,columnsFor,jsonRecords,parseSource,normalize,summarize,filters,filtered};
