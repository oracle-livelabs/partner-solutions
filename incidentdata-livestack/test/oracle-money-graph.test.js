const test=require('node:test'),assert=require('node:assert/strict');
const adapter=import('../frontend/src/oracle-money-graph.mjs');
const accounts=[{id:'001',labels:['Aster Account']},{id:'002',labels:['Meridian Account']}];
const summary={currency:'EUR',pairs:[{id:'p-1',from:'001',to:'002',amount:'52000.00',transferIds:['t-1','t-2']} ]};

test('Oracle Money Flows keeps the scoped accounts, directed pairs and source selection keys',async()=>{
 const {oracleMoneyGraph}=await adapter,before=JSON.stringify({accounts,summary});
 const {data,accountByGraphId,pairByGraphId}=oracleMoneyGraph(accounts,summary);
 assert.equal(JSON.stringify({accounts,summary}),before);
 assert.deepEqual(data.vertices.map(v=>v.id),['account:001','account:002']);
 assert.deepEqual(data.edges.map(e=>[e.source,e.target]),[['account:001','account:002']]);
 assert.equal(data.edges[0].properties.relationship,'EUR 52000.00');
 assert.equal(data.edges[0].properties.selection_id,'pair:p-1');
 assert.equal(data.edges[0].properties.record_count,2);
 assert.strictEqual(accountByGraphId.get('account:001'),accounts[0]);
 assert.strictEqual(pairByGraphId.get('pair:p-1'),summary.pairs[0]);
 assert.equal(data.isLastResultSet,true);
});

test('Oracle Money Flows rejects duplicate or dangling source relationships',async()=>{
 const {oracleMoneyGraph}=await adapter;
 assert.throws(()=>oracleMoneyGraph([...accounts,accounts[0]],summary));
 assert.throws(()=>oracleMoneyGraph(accounts,{...summary,pairs:[{...summary.pairs[0],to:'missing'}]}));
 assert.throws(()=>oracleMoneyGraph(accounts,{...summary,pairs:[...summary.pairs,summary.pairs[0]]}));
 assert.throws(()=>oracleMoneyGraph(accounts,{...summary,pairs:[{...summary.pairs[0],transferIds:[]}]}));
});
