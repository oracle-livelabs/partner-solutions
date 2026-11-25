const path = require('path');
const ops = require('./ai-ops-telemetry');

const IMAGE_MODEL = process.env.POI_IMAGE_EMBEDDING_MODEL || 'Xenova/clip-vit-base-patch32';
const NARRATIVE_MODEL = process.env.POI_NARRATIVE_EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2';
const IMAGE_DIMENSIONS = 512;
const NARRATIVE_DIMENSIONS = 384;

let runtimePromise;
let imageExtractorPromise;
let narrativeExtractorPromise;

async function runtime() {
  if (!runtimePromise) {
    runtimePromise = import('@huggingface/transformers').then((module) => {
      module.env.cacheDir = process.env.TRANSFORMERS_CACHE || path.join(process.cwd(), '.cache', 'transformers');
      module.env.allowLocalModels = true;
      module.env.allowRemoteModels = process.env.TRANSFORMERS_OFFLINE !== 'true';
      return module;
    });
  }
  return runtimePromise;
}

async function imageExtractor() {
  if (!imageExtractorPromise) {
    imageExtractorPromise = runtime().then(({ pipeline }) =>
      pipeline('image-feature-extraction', IMAGE_MODEL, { dtype: 'q8' })
    );
  }
  return imageExtractorPromise;
}

async function narrativeExtractor() {
  if (!narrativeExtractorPromise) {
    narrativeExtractorPromise = runtime().then(({ pipeline }) =>
      pipeline('feature-extraction', NARRATIVE_MODEL, { dtype: 'q8' })
    );
  }
  return narrativeExtractorPromise;
}

function normalise(values) {
  const result = Array.from(values, Number);
  const magnitude = Math.sqrt(result.reduce((sum, value) => sum + value * value, 0));
  return magnitude > 0 ? result.map((value) => value / magnitude) : result;
}

function assertDimensions(values, expected, label) {
  if (values.length !== expected || values.some(v=>!Number.isFinite(v))) {
    throw new Error(`${label} model returned ${values.length} dimensions; expected ${expected}.`);
  }
  return values;
}

async function embedImage(input) {
  ops.enableBackground();
  return ops.track({kind:'embedding',provider:'Local',model:IMAGE_MODEL,feature:'Visual vector creation',dimensions:IMAGE_DIMENSIONS,inputCount:1},async()=>{
    const extractor = await imageExtractor();
    const output = await extractor(input);
    return assertDimensions(normalise(output.data), IMAGE_DIMENSIONS, 'Portrait image');
  },()=>({vectors:1,note:'Local image embedding. No provider-billed tokens. Duration includes model loading when needed.'}));
}

async function embedNarrative(text) {
  const value = String(text || '').trim();
  if (!value) throw new Error('Narrative text is required for embedding.');
  ops.enableBackground();
  return ops.track({kind:'embedding',provider:'Local',model:NARRATIVE_MODEL,feature:'Text vector creation',dimensions:NARRATIVE_DIMENSIONS,inputCount:1,inputCharacters:value.length},async()=>{
    const extractor = await narrativeExtractor();
    const output = await extractor(value, { pooling: 'mean', normalize: true });
    return assertDimensions(Array.from(output.data, Number), NARRATIVE_DIMENSIONS, 'Narrative');
  },()=>({vectors:1,note:'Local text embedding; tokenizer may truncate input. No cloud-provider token meter. Duration includes model loading when needed.'}));
}

function decodeImageDataUrl(dataUrl, maximumBytes = 8 * 1024 * 1024) {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!match) throw new Error('Upload a PNG, JPEG, or WebP image.');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > maximumBytes) throw new Error('Image must be between 1 byte and 8 MB.');
  return new Blob([bytes], { type: match[1] });
}

function vectorLiteral(values) {
  return `[${values.map((value) => Number(value).toFixed(8)).join(',')}]`;
}

module.exports = {
  IMAGE_MODEL,
  NARRATIVE_MODEL,
  IMAGE_DIMENSIONS,
  NARRATIVE_DIMENSIONS,
  embedImage,
  embedNarrative,
  decodeImageDataUrl,
  vectorLiteral,
};
