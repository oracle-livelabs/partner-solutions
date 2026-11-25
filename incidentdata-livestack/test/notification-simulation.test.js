'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
test('simulation generates mixed six-character codes and selects only photographed scoped profiles',async()=>{
 const {permissionCode,createNotification,permissionRemaining,PERMISSION_DURATION,NOTIFICATION_DELAY}=await import('../frontend/src/notification-simulation.mjs');
 assert.equal(NOTIFICATION_DELAY,10000);
 for(let i=0;i<100;i++){const code=permissionCode();assert.match(code,/^[A-Z0-9]{6}$/);assert.match(code,/[A-Z]/);assert.match(code,/\d/);}
 const selected={PERSON_REF:'P1',PORTRAIT_ASSET_URI:'/poi/p1.png',SCOPED_INCIDENT_COUNT:1};
 const notification=createNotification([{PERSON_REF:'no-photo'},selected,{PERSON_REF:'P2',PORTRAIT_ASSET_URI:'/poi/p2.png',SCOPED_INCIDENT_COUNT:0}],1000);
 assert.equal(notification.person,selected);assert.equal(notification.issuedAt,1000);assert.equal(notification.expiresAt,1000+PERMISSION_DURATION);
 assert.equal(permissionRemaining(notification.expiresAt,1000),120);assert.equal(permissionRemaining(notification.expiresAt,notification.expiresAt),0);assert.equal(permissionRemaining(notification.expiresAt,notification.expiresAt+10),0);
 assert.equal(createNotification([]),null);assert.equal(createNotification([{PERSON_REF:'no-photo'}]),null);
});
