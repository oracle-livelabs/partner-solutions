'use strict';
const {withCallTimeout,RESTORE_CALL_TIMEOUT_MS}=require('./database-connection');
function createProfileRestorer({db,profileStatus,now=()=>performance.now()}) {
  return async(user,profileCode,expectedActiveProfileCode,nrt=false)=>{
    const started=now();
    await db(user,c=>withCallTimeout(c,RESTORE_CALL_TIMEOUT_MS,()=>c.execute(
      'BEGIN z_base_dataset_admin.restore_profile(:profileCode,:nrt,:expectedActiveProfileCode); END;',
      {profileCode,nrt:nrt?1:0,expectedActiveProfileCode})));
    const restored=now();
    const status=await profileStatus(user,profileCode);
    if(status.profile?.PROFILE_CODE!==profileCode||status.activeProfileCode!==profileCode)
      throw Error('Restore response does not confirm the selected active city. Refresh before retrying.');
    for(const key of ['INCIDENTS','REPORTS','PERSONS','CASES'])
      if(!Number.isSafeInteger(status.live?.[key])||status.live[key]<0||
        !Number.isSafeInteger(status.backup?.[key])||status.live[key]!==status.backup[key])
        throw Error('Restore completed but '+key.toLowerCase()+' counts could not be verified. Refresh before retrying.');
    const verified=now();
    return {...status,restoreTiming:{restoreMs:Math.round(restored-started),verificationMs:Math.round(verified-restored),totalMs:Math.round(verified-started)},restoreVerification:{verified:true,profileCode,mode:nrt?'nrt':'standard',verifiedAt:new Date().toISOString()}};
  };
}
module.exports={createProfileRestorer};
