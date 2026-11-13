export const SYNTHETIC_NOTICE = 'Synthetic demonstration data. These are not actual police incidents.';
export function attributes(record={}) {
  const raw=record.INCIDENT_ATTRIBUTES??record.incident_attributes;
  if(typeof raw==='string'){try{return JSON.parse(raw);}catch{return {};}}
  return raw&&typeof raw==='object'?raw:{};
}
export function physicalCoordinates(record={}) {
  if((record.LOCATION_ROLE??record.location_role??attributes(record).location_role)==='locality_reference')return null;
  const lat=record.LATITUDE??record.latitude,lon=record.LONGITUDE??record.longitude;
  const number=v=>(typeof v==='number'||typeof v==='string'&&v.trim()!=='')?Number(v):NaN;
  const y=number(lat),x=number(lon);
  return Number.isFinite(y)&&Number.isFinite(x)&&y>=-90&&y<=90&&x>=-180&&x<=180?[y,x]:null;
}
export function formatProfileTime(value,context={}) {
  if(!value)return 'Not recorded';
  const date=new Date(value);if(!Number.isFinite(date.getTime()))return 'Invalid timestamp';
  const timeZone=context.timeZone||'UTC';
  try{return new Intl.DateTimeFormat(context.locale||'en-GB',{timeZone,year:'numeric',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',timeZoneName:'longOffset'}).format(date)+` (${timeZone})`;}
  catch{return date.toISOString()+' (UTC; profile time zone unavailable)';}
}
export function boundsFromContext(context={},records=[]) {
  const b=context.bounds;
  if(Array.isArray(b)&&b.length===4&&b.every(Number.isFinite)&&b[0]>=-180&&b[2]<=180&&b[1]>=-90&&b[3]<=90&&b[0]<b[2]&&b[1]<b[3])return [[b[1],b[0]],[b[3],b[2]]];
  const points=records.map(physicalCoordinates).filter(Boolean);
  if(!points.length)return null;
  let south=90,north=-90,west=180,east=-180;for(const [y,x]of points){south=Math.min(south,y);north=Math.max(north,y);west=Math.min(west,x);east=Math.max(east,x);}
  const padding=.002;return [[south-padding,west-padding],[north+padding,east+padding]];
}
