// Presentation only: never changes source identities, graph edges or message order.
const key=value=>typeof value==='string'?value.trim().normalize('NFC').toLowerCase():'';
export const messageOrder=mode=>mode==='messaging-space'?'source':mode;
export const senderHue=(participants,id)=>[170,212,34,278,330,95][Math.max(0,participants.findIndex(p=>p.id===id))%6];
export const recordedDay=message=>(message.time?.local||message.time?.original||message.section?.time?.original||'').match(/^\d{4}-\d{2}-\d{2}/)?.[0]||'';
export function cataloguePortrait(participant,profiles=[]){
 if(!participant)return null;
 const declarations=[...new Set((participant.sourceLabels||[]).filter(l=>l.handle===participant.name).map(l=>key(l.name)).filter(Boolean))];
 // Conflicting declarations or multiple matching profiles remain initials.
 if(declarations.length>1)return null;
 const labels=[...new Set([key(participant.name),...declarations].filter(Boolean))];
 const matches=profiles.filter(p=>labels.some(l=>l===key(p.display_name)||l===key(p.alias_name)));
 if(matches.length!==1)return null;
 const p=matches[0],uri=p.portrait_asset_uri;
 // Catalogue assets only: never load arbitrary URLs from conversation content.
 if(typeof uri!=='string'||!/^\/poi\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(png|jpe?g|webp)$/i.test(uri))return null;
 const matchedLabel=labels.find(l=>l===key(p.display_name)||l===key(p.alias_name));
 return {uri,personRef:p.person_ref,displayName:p.display_name,matchedLabel,basis:'Exact catalogue name/alias match; identity unverified'};
}
