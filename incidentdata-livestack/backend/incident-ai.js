'use strict';
const ops=require('./ai-ops-telemetry');
const common=require('oci-common'),{GenerativeAiInferenceClient}=require('oci-generativeaiinference');
async function ociGenAiConfig(){
 const provider=await require('./oci-auth-provider').authenticationProvider();
 return {provider,compartmentId:process.env.OCI_COMPARTMENT_ID||provider.getTenantId(),region:process.env.OCI_GENAI_REGION||'us-chicago-1',model:process.env.OCI_GENAI_MODEL||'meta.llama-3.3-70b-instruct'};
}
function createIncidentAi({fetchImpl=(...args)=>fetch(...args),config=ociGenAiConfig,clientFactory=provider=>new GenerativeAiInferenceClient({authenticationDetailsProvider:provider})}={}){
 async function ollamaGenerate(prompt,system,meta={}){
  const model=process.env.OLLAMA_MODEL||'qwen2.5-coder:14b';
  const result=await ops.track({kind:'llm',provider:'Local',model,feature:'Incident local LLM',stage:'sql',...meta,prompt:{system,prompt}},async()=>{
   const response=await fetchImpl(`${process.env.OLLAMA_BASE_URL||'http://ollama:11434'}/api/generate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,prompt,system,stream:false,options:{temperature:0}})});
   if(!response.ok)throw Error(`Local LLM unavailable (${response.status}).`);
   return response.json();
  },r=>({response:r.response,usage:{promptTokens:r.prompt_eval_count,completionTokens:r.eval_count,totalTokens:Number.isFinite(r.prompt_eval_count)&&Number.isFinite(r.eval_count)?r.prompt_eval_count+r.eval_count:null},note:'Local inference counts, not cloud-billed tokens. SQL and answer are separate operations.'}),r=>{
   if(!String(r.response||'').trim())throw Error('Local LLM returned no text response.');meta.validate?.(r.response);
  });
  return result.response;
 }
 async function ociGenAiGenerate(prompt,maxTokens=1200,meta={}){
  let client;
  const callMeta={kind:'llm',provider:'OCI GenAI',model:process.env.OCI_GENAI_MODEL||'meta.llama-3.3-70b-instruct',region:process.env.OCI_GENAI_REGION||'us-chicago-1',feature:'Incident OCI GenAI',stage:'sql',...meta,prompt};
  const output=r=>(r?.chatResult?.chatResponse?.choices?.[0]?.message?.content||[]).filter(c=>c.type==='TEXT').map(c=>c.text||'').join('').trim();
  try{
   const response=await ops.track(callMeta,async()=>{
    const {provider,compartmentId,region,model}=await config();client=clientFactory(provider);client.regionId=region;
    return client.chat({chatDetails:{compartmentId,servingMode:{servingType:'ON_DEMAND',modelId:model},chatRequest:{apiFormat:'GENERIC',temperature:0,maxTokens,isStream:false,messages:[{role:'USER',content:[{type:'TEXT',text:prompt}]}]}}});
   },r=>({usage:r.chatResult?.chatResponse?.usage,requestId:r.opcRequestId,response:output(r),note:'Direct OCI operation. SDK-internal retries are not individually observable.'}),r=>{
    if(!output(r))throw Error('OCI Generative AI returned no text response.');meta.validate?.(output(r));
   });return output(response);
  }finally{client?.close();}
 }
 return {ollamaGenerate,ociGenAiGenerate};
}
module.exports={createIncidentAi,ociGenAiConfig};
