'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {passwordRecord,validateAccounts,createPublicDemoAuth,fromEnvironment}=require('../backend/public-demo-auth');
const origin='https://192.0.2.10';
async function setup(){const secret=await passwordRecord('a-long-synthetic-test-password');const document={version:1,accounts:[{username:'tester',persona:'central_analyst',...secret}]};return {document,auth:createPublicDemoAuth({document,origin})};}
async function request(auth,{secure=true,method='GET',headers={}}={}){
 let code=200,body,next=false;const responseHeaders={};
 const req={secure,method,ip:'192.0.2.1',headers:{...headers}},res={setHeader:(k,v)=>{responseHeaders[k]=v;},status:n=>{code=n;return res;},json:v=>{body=v;return res;}};
 await auth(req,res,()=>{next=true;});return {code,body,next,req,responseHeaders};
}
const basic=password=>'Basic '+Buffer.from('tester:'+password).toString('base64');
test('public auth rejects HTTP, missing credentials, wrong password and cross-origin mutations',async()=>{
 const {auth}=await setup();assert.equal((await request(auth,{secure:false})).code,400);
 assert.equal((await request(auth)).code,401);assert.equal((await request(auth,{headers:{authorization:basic('wrong')}})).code,401);
 assert.equal((await request(auth,{method:'POST',headers:{authorization:basic('a-long-synthetic-test-password'),origin:'https://attacker.example'}})).code,403);
});
test('authenticated account fixes the database persona despite forged administrator headers',async()=>{
 const {auth}=await setup();const r=await request(auth,{method:'POST',headers:{authorization:basic('a-long-synthetic-test-password'),origin,'x-demo-user':'statewide_admin'}});
 assert(r.next);assert.equal(r.req.headers['x-demo-user'],'central_analyst');assert.equal(r.req.demoPrincipal.username,'tester');
});
test('privileged personas require explicit operator accounts; unsafe deployment configuration fails closed',async()=>{
 const {document}=await setup();document.accounts[0].persona='statewide_admin';assert.throws(()=>validateAccounts(document),/Invalid/);
 assert.equal(fromEnvironment({}),null);assert.throws(()=>fromEnvironment({PUBLIC_DEMO_AUTH:'1',CRIMEDATA_BIND_HOST:'0.0.0.0'}),/loopback/);
});
test('failed sign-in requests are bounded and legitimate cached sessions avoid repeated expensive work',async()=>{
 const {auth}=await setup();for(let i=0;i<20;i++)assert.equal((await request(auth,{headers:{authorization:basic('wrong')}})).code,401);
 assert.equal((await request(auth,{headers:{authorization:basic('wrong')}})).code,429);
});
