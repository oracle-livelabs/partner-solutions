'use strict';
// Configuration-file auth remains the development default. Portable Compute
// deployments opt into instance principals; identity failures never fall back.
const common=require('oci-common');
function createProviderFactory({sdk=common,env=process.env}={}){
 let cachedKey,pending;
 return async function authenticationProvider(){
  const mode=String(env.OCI_AUTH_MODE||'config_file').toLowerCase();
  if(!['config_file','instance_principal','resource_principal'].includes(mode))throw Error('Unsupported OCI_AUTH_MODE');
  if(mode==='config_file')return new sdk.ConfigFileAuthenticationDetailsProvider(env.OCI_CONFIG_FILE||'/home/opc/.oci/config',env.OCI_CONFIG_PROFILE||'DEFAULT');
  if(!env.OCI_COMPARTMENT_ID)throw Error('OCI_COMPARTMENT_ID is required for workload identity');
  if(cachedKey===mode&&pending)return pending;
  cachedKey=mode;
  const request=Promise.resolve().then(()=>mode==='instance_principal'
   ?new sdk.InstancePrincipalsAuthenticationDetailsProviderBuilder().build()
   :sdk.ResourcePrincipalAuthenticationDetailsProvider.builder());
  pending=request;
  try{return await request;}catch(e){if(pending===request){pending=undefined;cachedKey=undefined;}throw e;}
 };
}
const authenticationProvider=createProviderFactory();
module.exports={authenticationProvider,createProviderFactory};
