// Convert only the selected batch's authorised Money Flows API result.
// Pair edges aggregate recorded transfers exactly as the other graph views do.
const text=value=>typeof value==='string'?value:typeof value==='number'&&Number.isFinite(value)?String(value):'';
export function oracleMoneyGraph(accounts,summary){
 if(!Array.isArray(accounts)||!Array.isArray(summary?.pairs))throw Error('The money-flow network is not available.');
 const accountByGraphId=new Map(),pairByGraphId=new Map(),seenAccounts=new Set();
 const vertices=accounts.map(account=>{
  const ref=text(account?.id);
  if(!ref||seenAccounts.has(ref)||!Array.isArray(account.labels))throw Error('The money-flow network contains an invalid or duplicate account.');
  seenAccounts.add(ref);
  const id=`account:${ref}`;accountByGraphId.set(id,account);
  return {id,labels:['Account / party'],properties:{name:account.labels.filter(x=>typeof x==='string'&&x.trim()).join(' / ')||ref,account_ref:ref,kind:'Account / party'},style:{color:'#d9ece6',size:28,shape:'circle',border:{width:2,color:'#397b78'}}};
 });
 const edges=summary.pairs.map(pair=>{
  const ref=text(pair?.id),from=text(pair?.from),to=text(pair?.to),amount=text(pair?.amount);
  if(!ref||pairByGraphId.has(`pair:${ref}`)||!seenAccounts.has(from)||!seenAccounts.has(to)||!/^\d+(?:\.\d{1,6})?$/.test(amount)||!Array.isArray(pair.transferIds)||!pair.transferIds.length)throw Error('The money-flow network contains an invalid payment pair.');
  const id=`pair:${ref}`;pairByGraphId.set(id,pair);
  return {id,source:`account:${from}`,target:`account:${to}`,labels:['Recorded payments'],properties:{relationship:`${text(summary.currency)||'Currency not recorded'} ${amount}`,amount,record_count:pair.transferIds.length,selection_id:id},style:{color:'#a56d43',width:2}};
 });
 return {data:{vertices,edges,numResults:vertices.length,isLastResultSet:true},accountByGraphId,pairByGraphId};
}
