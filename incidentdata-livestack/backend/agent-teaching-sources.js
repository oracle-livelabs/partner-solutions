'use strict';
// Metadata only. Source excerpts are retrieved by the registered native PL/SQL tool.
async function teachingCases(c){
 const result=await c.execute(`SELECT pattern_code,case_code,case_title,teaching_question,
   COUNT(*) source_count FROM secure_agent_demo_sources_v
   GROUP BY pattern_code,case_code,case_title,teaching_question ORDER BY case_title`);
 return result.rows;
}
function registerTeachingCases(app,db){
 app.get('/api/agent-v2/teaching-cases',async(req,res)=>{
  try{res.json(await db(req.demoUser,teachingCases));}
  catch(e){console.error('Agent teaching catalogue:',e.message);res.status(503).json({error:'Teaching cases are unavailable.'});}
 });
}
module.exports={teachingCases,registerTeachingCases};
