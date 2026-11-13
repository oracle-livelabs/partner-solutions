const crypto = require('crypto');
const ops = require('./ai-ops-telemetry');
const common = require('oci-common');
const generativeAiInference = require('oci-generativeaiinference');

const PATTERN_EMBEDDING_MODEL = process.env.WATCH_PATTERN_EMBEDDING_MODEL || 'cohere.embed-v4.0';
const PATTERN_EMBEDDING_DIMENSIONS = Number(process.env.WATCH_PATTERN_EMBEDDING_DIMENSIONS || 1536);
let cachedEmbeddingClient;

async function embeddingClient() {
  if (cachedEmbeddingClient) return cachedEmbeddingClient;
  cachedEmbeddingClient=(async()=>{
    const provider=await require('./oci-auth-provider').authenticationProvider();
    const client=new generativeAiInference.GenerativeAiInferenceClient({authenticationDetailsProvider:provider});
    client.regionId=process.env.OCI_GENAI_REGION||'us-chicago-1';
    return {client,compartmentId:process.env.OCI_COMPARTMENT_ID||provider.getTenantId()};
  })();
  try{return await cachedEmbeddingClient;}catch(e){cachedEmbeddingClient=undefined;throw e;}
}

function patternEmbeddingText(pattern) {
  return [
    `Watched crime pattern: ${pattern.PATTERN_NAME || pattern.pattern_name}`,
    `Description: ${pattern.PATTERN_SUMMARY || pattern.pattern_summary}`,
    `Indicators: ${pattern.WHY_WATCH || pattern.why_watch}`,
    'This is a synthetic demonstration monitoring definition. Semantic relevance requires analyst review and is not a finding, prediction, or evidence of a connection.',
  ].join('\n');
}

function textHash(text) { return crypto.createHash('sha256').update(text).digest('hex'); }
function vectorLiteral(values) { return `[${values.map((value) => Number(value).toFixed(8)).join(',')}]`; }

async function embedPatternTexts(inputs, inputType, injected) {
  if (!inputs.length) return [];
  ops.enableBackground();
  const response = await ops.track({kind:'embedding',provider:'OCI GenAI',model:PATTERN_EMBEDDING_MODEL,
    region:process.env.OCI_GENAI_REGION||'us-chicago-1',feature:inputType==='SEARCH_QUERY'?'Semantic-search query vector':'Document vector creation',dimensions:PATTERN_EMBEDDING_DIMENSIONS,inputCount:inputs.length,inputCharacters:inputs.reduce((n,s)=>n+s.length,0)},async()=>{const {client,compartmentId}=injected||await embeddingClient();return client.embedText({ embedTextDetails: {
    compartmentId,
    servingMode: { servingType: 'ON_DEMAND', modelId: PATTERN_EMBEDDING_MODEL },
    inputs,
    inputType,
    outputDimensions: PATTERN_EMBEDDING_DIMENSIONS,
    truncate: 'END',
  } });},r=>({usage:r.embedTextResult?.usage,requestId:r.opcRequestId,vectors:(r.embedTextResult?.embeddings||[]).filter(v=>Array.isArray(v)&&v.length===PATTERN_EMBEDDING_DIMENSIONS&&v.every(Number.isFinite)).length,
    note:'Provider-reported embedding usage when available. SDK-internal retries are not separately observed; only valid returned vectors are counted.'}),r=>{
      const values=r.embedTextResult?.embeddings;
      if(!Array.isArray(values)||values.length!==inputs.length||values.some(v=>!Array.isArray(v)||v.length!==PATTERN_EMBEDDING_DIMENSIONS||!v.every(Number.isFinite)))throw Error(`Unexpected ${PATTERN_EMBEDDING_MODEL} embedding response.`);
    });
  const embeddings = response.embedTextResult.embeddings;
  if (embeddings.length !== inputs.length || embeddings.some((vector) => vector.length !== PATTERN_EMBEDDING_DIMENSIONS)) throw new Error(`Unexpected ${PATTERN_EMBEDDING_MODEL} embedding response.`);
  return embeddings;
}

module.exports = { PATTERN_EMBEDDING_MODEL, PATTERN_EMBEDDING_DIMENSIONS, embedPatternTexts, patternEmbeddingText, textHash, vectorLiteral };
