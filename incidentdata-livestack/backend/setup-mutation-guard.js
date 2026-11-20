/* Fail closed before setup code can restore a fallback/wrong locality. */
const {activeContext,requireAdmin}=require('./profile-library');
function setupMutationGuard({legacyProfiles,standardOnlyProfiles=[],db}) {
  return async(req,res,next)=>{
    const action=req.path.slice(1);
    if(req.method!=='POST'||!['load','load-nrt','backup','delete'].includes(action))return next();
    try{
      if(req.demoUser!=='statewide_admin')return res.status(403).json({error:'Setup changes require Statewide Admin.'});
      const code=req.body?.profileCode;
      if(typeof code!=='string'||!Object.hasOwn(legacyProfiles,code))return res.status(409).json({error:'This profile is review-only in the application. No fallback, restore, overwrite or active-profile change was performed.'});
      if(standardOnlyProfiles.includes(code)&&action!=='load')return res.status(400).json({error:'This saved profile supports standard restore only. NRT, capture and delete are not enabled.'});
      if(['load','load-nrt'].includes(action)&&req.body?.confirmation!==`ACTIVATE ${code}`)return res.status(400).json({error:`Explicit global-switch confirmation required: ACTIVATE ${code}`});
      if(typeof req.body?.expectedActiveProfileCode!=='string')return res.status(400).json({error:'Refresh the catalogue and explicitly confirm the current global active profile.'});
      const active=await db(req.demoUser,async c=>{await requireAdmin(c,req.demoUser);return activeContext(c);});
      if(active.profileCode!==req.body.expectedActiveProfileCode)return res.status(409).json({error:'The active profile changed. Refresh and review the global replacement before proceeding.'});
      if(['backup','delete'].includes(action)&&active.profileCode!==code)return res.status(409).json({error:'The selected profile is not the active dataset; refusing to overwrite or delete another locality.'});
      next();
    }catch(e){res.status(e.status||500).json({error:e.status?e.message:'Setup preflight failed; no mutation was performed.'});}
  };
}
module.exports={setupMutationGuard};
