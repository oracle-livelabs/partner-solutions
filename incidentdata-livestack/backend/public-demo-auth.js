'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),{promisify}=require('node:util');
const scrypt=promisify(crypto.scrypt),{DEMO_USERS}=require('./demo-identity');
async function passwordRecord(password){
 if(typeof password!=='string'||password.length<16||password.length>256)throw Error('Demo passwords require 16–256 characters');
 const salt=crypto.randomBytes(16).toString('hex');return {salt,hash:(await scrypt(password,salt,32)).toString('hex')};
}
function validateAccounts(document){
 if(document.version!==1||!Array.isArray(document.accounts)||!document.accounts.length||document.accounts.length>100)throw Error('Invalid public-demo account file');
 const accounts=new Map();
 for(const a of document.accounts){
  if(!/^[a-z][a-z0-9_.-]{1,63}$/.test(a.username)||accounts.has(a.username)||!DEMO_USERS.has(a.persona)||a.persona==='statewide_admin'&&a.operator!==true||!/^[0-9a-f]{32}$/.test(a.salt)||!/^[0-9a-f]{64}$/.test(a.hash))throw Error('Invalid public-demo account');
  accounts.set(a.username,{...a});
 }
 return accounts;
}
function createPublicDemoAuth({document,origin,clock=Date.now,verify=scrypt}={}){
 const url=new URL(origin);if(url.protocol!=='https:'||url.origin!==origin||url.username||url.password)throw Error('Public demo requires an HTTPS origin');
 const accounts=validateAccounts(document),attempts=new Map(),mutations=new Map(),cache=new Map();let active=0;
 function limited(map,key,maximum){const now=clock(),prior=map.get(key),value=prior&&now-prior.start<60000?prior:{start:now,count:0};value.count++;map.set(key,value);if(map.size>4096)for(const [k,v]of map){if(now-v.start>=60000||map.size>4096)map.delete(k);}return value.count>maximum;}
 const middleware=async(req,res,next)=>{
  res.setHeader('Cache-Control','no-store');
  const reject=(status,message)=>{if(status===401)res.setHeader('WWW-Authenticate','Basic realm="IncidentData walkthrough", charset="UTF-8"');return res.status(status).json({error:message});};
  if(!req.secure)return reject(400,'HTTPS is required');
  // Browsers attach Basic credentials automatically, so reject cross-origin writes.
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin!==origin)return reject(403,'Same-origin request required');
  const authorization=req.headers.authorization||'';if(authorization.length>2048||!/^Basic [A-Za-z0-9+/]+=*$/.test(authorization))return reject(401,'Sign in required');
  const encoded=authorization.slice(6),decoded=Buffer.from(encoded,'base64').toString('utf8'),separator=decoded.indexOf(':');
  if(separator<1)return reject(401,'Sign in required');
  const username=decoded.slice(0,separator),password=decoded.slice(separator+1),account=accounts.get(username);
  const key=crypto.createHash('sha256').update(authorization).digest('hex');
  let valid=cache.get(key);if(!valid||clock()-valid.at>60000){
   if(limited(attempts,req.ip||'unknown',20)||active>=8)return reject(429,'Too many sign-in attempts; try again shortly');
   if(password.length>256)return reject(401,'Sign in required');
   active++;
   try{
    const computed=await verify(password,account?.salt||'0'.repeat(32),32);
    if(!account||!crypto.timingSafeEqual(computed,Buffer.from(account.hash,'hex')))return reject(401,'Sign in required');
    valid={account,at:clock()};if(cache.size>=256)cache.delete(cache.keys().next().value);cache.set(key,valid);
   }catch{return reject(503,'Sign-in service unavailable');}finally{active--;}
  }
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&limited(mutations,username,20))return reject(429,'Walkthrough request limit reached; try again shortly');
  req.headers['x-demo-user']=valid.account.persona;
  req.demoPrincipal={username:valid.account.username,persona:valid.account.persona,fixedPersona:true};next();
 };
 return middleware;
}
function fromEnvironment(env=process.env){
 if(env.PUBLIC_DEMO_AUTH!=='1')return null;
 if(env.CRIMEDATA_BIND_HOST!=='127.0.0.1')throw Error('Public demo backend must bind to loopback behind the HTTPS gateway');
 if(!env.PUBLIC_DEMO_ACCOUNTS_FILE)throw Error('Public demo account file is required');
 const stat=fs.statSync(env.PUBLIC_DEMO_ACCOUNTS_FILE);if(!stat.isFile()||stat.mode&0o077)throw Error('Public demo account file must be private (0600)');
 return createPublicDemoAuth({document:JSON.parse(fs.readFileSync(env.PUBLIC_DEMO_ACCOUNTS_FILE,'utf8')),origin:env.PUBLIC_DEMO_ORIGIN});
}
module.exports={passwordRecord,validateAccounts,createPublicDemoAuth,fromEnvironment};
