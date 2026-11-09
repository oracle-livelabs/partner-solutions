'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createProviderFactory}=require('../backend/oci-auth-provider');
test('development keeps explicit config-file credentials and profile selection',async()=>{
 const calls=[];const get=createProviderFactory({env:{OCI_CONFIG_FILE:'/protected/config',OCI_CONFIG_PROFILE:'DEMO'},sdk:{ConfigFileAuthenticationDetailsProvider:class{constructor(...a){calls.push(a);}}}});
 await get();assert.deepEqual(calls,[['/protected/config','DEMO']]);
});
test('instance identity is asynchronous, cached across concurrent callers and never opens a key file',async()=>{
 let builds=0;const provider={identity:'instance'};
 const get=createProviderFactory({env:{OCI_AUTH_MODE:'instance_principal',OCI_COMPARTMENT_ID:'target'},sdk:{InstancePrincipalsAuthenticationDetailsProviderBuilder:class{async build(){builds++;await new Promise(r=>setTimeout(r,5));return provider;}},ConfigFileAuthenticationDetailsProvider:class{constructor(){throw Error('Key file must not be read');}}}});
 const values=await Promise.all([get(),get()]);assert.equal(builds,1);assert(values.every(v=>v===provider));
});
test('workload auth requires explicit compartment and does not silently downgrade on failure',async()=>{
 let builds=0;const env={OCI_AUTH_MODE:'instance_principal'};
 const get=createProviderFactory({env,sdk:{InstancePrincipalsAuthenticationDetailsProviderBuilder:class{async build(){builds++;throw Error('metadata denied');}}}});
 await assert.rejects(get(),/COMPARTMENT/);assert.equal(builds,0);env.OCI_COMPARTMENT_ID='target';
 await assert.rejects(get(),/metadata denied/);await assert.rejects(get(),/metadata denied/);assert.equal(builds,2,'Failed initialization must be retryable');
});
test('resource-principal and unknown modes use explicit branches',async()=>{
 const env={OCI_AUTH_MODE:'resource_principal',OCI_COMPARTMENT_ID:'target'},provider={identity:'resource'};
 const get=createProviderFactory({env,sdk:{ResourcePrincipalAuthenticationDetailsProvider:{builder:()=>provider}}});assert.equal(await get(),provider);
 env.OCI_AUTH_MODE='unknown';await assert.rejects(get(),/Unsupported/);
});
