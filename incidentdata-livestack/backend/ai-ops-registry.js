'use strict';
// Code-owned inventory, not a claim that every invocation has token telemetry.
// IDs stay stable when UI wording changes. No source contents belong here.
const operation=(id,feature,kind,coverage,extra={})=>Object.freeze({id,feature,kind,coverage,...extra});
const OPERATIONS=Object.freeze([
 operation('cdr.transcribe','Audio transcription','llm','OCI audio-input transcription attempts and returned provider usage'),
 operation('cdr.describe','Identify & Describe','llm','Provider usage when returned; each validation retry'),
 operation('cdr.people.mentioned','People mentioned','llm','Source-linked text-only person acknowledgements; each validation attempt and provider usage'),
 operation('cdr.people.outcome','People mentioned run outcome','workflow','End-to-end extraction outcome; child LLM attempts and provider-reported tokens counted separately'),
 operation('cdr.board.suggestions','Private board relationship suggestions','llm','Structured source-supported suggestions; each validation attempt and provider usage'),
 operation('cdr.brief','Batch Brief','llm','Provider usage when returned; each validation retry'),
 operation('cdr.describe.outcome','Description run outcome','workflow','Run outcome including source, validation and persistence failures'),
 operation('cdr.brief.outcome','Batch Brief outcome','workflow','Run outcome including source freshness and persistence checks'),
 operation('cdr.connections','Connections AI review','native','Invocation only; internal calls/tokens unavailable'),
 operation('cdr.chat','Batch Assistant','native','Invocation only; internal calls/tokens unavailable'),
 operation('cdr.money','Money Flow AI review','native','Invocation only; internal calls/tokens unavailable'),
 operation('cdr.expert','Ask Detective','native','Invocation and citation validation; tokens unavailable'),
 operation('cdr.first-cut','Detective first-cut hunch','native','Invocation and citation validation; tokens unavailable'),
 operation('room.extract','Detective Room source analysis','llm','Each source chunk and corrective retry; provider usage', {process:'detective-worker'}),
 operation('room.image','Detective Room image description','llm','Each image and corrective retry; no image bytes stored', {process:'detective-worker'}),
 operation('room.overview','Detective Room overview','llm','Each overview attempt and corrective retry; provider usage', {process:'detective-worker'}),
 operation('room.speech','Detective Room speech synthesis','workflow','Local Kokoro process duration, text/scene counts; tokens not applicable', {process:'detective-worker'}),
 operation('room.publish','Detective Room publication outcome','workflow','End-to-end outcome; includes child operations, not another model call', {process:'detective-worker'}),
 operation('vector.image','Visual vector creation','embedding','Local inputs, dimensions, valid vectors and duration; no cloud tokens'),
 operation('vector.text','Text vector creation','embedding','Local inputs, dimensions, valid vectors and duration; no cloud tokens'),
 operation('vector.oci.query','Semantic-search query vector','embedding','OCI usage when returned, valid vectors and duration'),
 operation('vector.oci.document','Document vector creation','embedding','OCI usage when returned, valid vectors and duration'),
 operation('ask.sql','Ask IncidentData V2 SQL generation','native','Invocation and explicit SQL correction retry; tokens unavailable'),
 operation('agent.native','Native Agent V2','native','Invocation only; internal calls/tokens unavailable'),
 operation('evidence.select-ai','Evidence Intelligence select-ai','native','Invocation and citation validation; tokens unavailable'),
 operation('evidence.agent','Evidence Intelligence agent','native','Invocation and citation validation; internal calls/tokens unavailable'),
 operation('incident.local','Incident local LLM','llm','Local inference tokens; SQL/answer stages and correction retries'),
 operation('incident.oci','Incident OCI GenAI','llm','Provider usage when returned; SQL/answer stages and correction retries'),
 operation('guided.ask','Guided Ask','workflow','Reviewed SQL/template; no generative model'),
 operation('guided.agent','Guided agent','workflow','Reviewed SQL/template; no generative model'),
 operation('guided.readiness','Case-readiness review (retired)','workflow','Historical records only; this guided console workflow has been retired'),
 operation('guided.incident','Guided incident question','workflow','Reviewed SQL/template; no generative model'),
 operation('request.outcome','AI request outcome','workflow','HTTP outcome including validation/retrieval; child model calls counted separately'),
 operation('cdr.workspace.outcome','Data Room workspace outcome','workflow','Background run outcome; child models/vectors counted separately'),
 operation('cdr.money.outcome','Money Flow review outcome','workflow','Background run outcome including required tools and validation'),
]);
const byId=new Map(OPERATIONS.map(o=>[o.id,o])),byFeature=new Map(OPERATIONS.map(o=>[o.feature,o]));
function identify(meta){return byId.get(meta.operationId)||byFeature.get(meta.feature);}
const GUIDED={'/ask':'guided.ask','/agents/run':'guided.agent','/incidents/ask':'guided.incident'};
function requestOperation(method,path){
 if(method==='POST'&&/^\/data-room\/batches\/[^/]+\/people-mentioned$/.test(path))return byId.get('cdr.people.outcome');
 if(method==='POST'&&GUIDED[path])return byId.get(GUIDED[path]);
 const aiPost=/^\/(?:ask-v2|agent-v2\/run|incidents\/ask-(?:llm(?:-v2)?|oci)|(?:watched-patterns|patterns)\/semantic-search|persons\/search\/(?:narrative|visual)|evidence-intelligence\/(?:search|review)|data-room\/batches\/[^/]+\/(?:expert\/(?:assistant|first-cut)|items\/[^/]+\/(?:poi-candidates|photo-comparisons)))$/;
 if(method==='POST'&&aiPost.test(path)||method==='GET'&&path==='/persons/similar')return byId.get('request.outcome');
 return null;
}
module.exports={OPERATIONS,identify,requestOperation};
