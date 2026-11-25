'use strict';
async function signalVectorReadiness(c,pid,activeProfileCode,model) {
 const row=(await c.execute(`SELECT
  (SELECT COUNT(DISTINCT i.incident_ref) FROM secure_crime_incidents_v i JOIN secure_incident_reports_v r ON r.incident_id=i.incident_id) live_reports,
  (SELECT COUNT(DISTINCT n.incident_ref) FROM incident_narrative_embeddings_v4 n JOIN secure_crime_incidents_v i ON i.incident_ref=n.incident_ref JOIN secure_incident_reports_v r ON r.incident_id=i.incident_id WHERE n.profile_code=:activeCode AND n.embedding_model=:model AND n.embedding IS NOT NULL) live_report_vectors,
  (SELECT COUNT(*) FROM watched_crime_patterns WHERE active=1 AND activate_ui='Y') live_watches,
  (SELECT COUNT(*) FROM watched_crime_patterns w JOIN watched_pattern_embeddings e ON e.pattern_code=w.pattern_code WHERE w.active=1 AND w.activate_ui='Y' AND e.embedding_model=:model AND e.embedding IS NOT NULL) live_watch_vectors,
  (SELECT COUNT(DISTINCT i.incident_ref) FROM z_base_crime_incidents i JOIN z_base_incident_reports r ON r.dataset_profile_id=i.dataset_profile_id AND r.incident_id=i.incident_id WHERE i.dataset_profile_id=:pid) saved_reports,
  (SELECT COUNT(DISTINCT n.incident_ref) FROM z_base_incident_narrative_vec n JOIN z_base_crime_incidents i ON i.dataset_profile_id=n.dataset_profile_id AND i.incident_ref=n.incident_ref JOIN z_base_incident_reports r ON r.dataset_profile_id=i.dataset_profile_id AND r.incident_id=i.incident_id WHERE n.dataset_profile_id=:pid AND n.embedding_model=:model AND n.embedding IS NOT NULL) saved_report_vectors,
  (SELECT COUNT(*) FROM z_base_watched_crime_patterns WHERE dataset_profile_id=:pid AND active=1 AND activate_ui='Y') saved_watches,
  (SELECT COUNT(*) FROM z_base_watched_crime_patterns w JOIN z_base_watched_pattern_vec e ON e.dataset_profile_id=w.dataset_profile_id AND e.pattern_code=w.pattern_code WHERE w.dataset_profile_id=:pid AND w.active=1 AND w.activate_ui='Y' AND e.embedding_model=:model AND e.embedding IS NOT NULL) saved_watch_vectors
  FROM dual`,{pid,activeCode:activeProfileCode,model})).rows[0];
 const coverage=prefix=>{
  const reports=Number(row[prefix+'_REPORTS'])||0,reportVectors=Number(row[prefix+'_REPORT_VECTORS'])||0,watches=Number(row[prefix+'_WATCHES'])||0,watchVectors=Number(row[prefix+'_WATCH_VECTORS'])||0;
  const ready=reports>0&&reportVectors===reports&&watches>0&&watchVectors===watches;
  return {reports,reportVectors,watches,watchVectors,ready};
 };
 const saved=coverage('SAVED'),live=coverage('LIVE');
 return {model,activeProfileCode,live,saved,notice:saved.ready?null:
  `Semantic-search coverage in this saved profile: ${saved.reportVectors} of ${saved.reports} reports and ${saved.watchVectors} of ${saved.watches} visible watches have compatible vectors. Core-data restoration does not create missing vectors.`};
}
module.exports={signalVectorReadiness};
