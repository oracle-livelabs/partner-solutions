export const NOTIFICATION_DELAY=10000;
export const PERMISSION_DURATION=2*60*60*1000;
function randomIndex(length){
 const limit=Math.floor(0x100000000/length)*length,value=new Uint32Array(1);
 do{crypto.getRandomValues(value);}while(value[0]>=limit);
 return value[0]%length;
}
export function permissionCode(){
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ',digits='0123456789';
 const parts=[...Array.from({length:4},()=>alphabet[randomIndex(alphabet.length)]),...Array.from({length:2},()=>digits[randomIndex(digits.length)])];
 for(let i=parts.length-1;i>0;i--){const j=randomIndex(i+1);[parts[i],parts[j]]=[parts[j],parts[i]];}
 return parts.join('');
}
export function createNotification(people,now=Date.now()){
 const photographed=people.filter(p=>p.PERSON_REF&&p.PORTRAIT_ASSET_URI);
 const connected=photographed.filter(p=>Number(p.SCOPED_INCIDENT_COUNT)>0),pool=connected.length?connected:photographed;
 if(!pool.length)return null;
 return {person:pool[randomIndex(pool.length)],code:permissionCode(),issuedAt:now,expiresAt:now+PERMISSION_DURATION};
}
export function permissionRemaining(expiresAt,now=Date.now()){
 return Math.max(0,Math.ceil((expiresAt-now)/60000));
}
