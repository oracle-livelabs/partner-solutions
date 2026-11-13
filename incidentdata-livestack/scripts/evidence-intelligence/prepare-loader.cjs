'use strict';
// Emits a reviewable, data-only SQL*Plus script. Does not connect to any database.
const fs=require('node:fs'),path=require('node:path');
const {sha256,canonical,validate}=require('./contract.cjs');
const ROOT=path.resolve(__dirname,'../../testdata/evidence-intelligence/v1');
const pack=JSON.parse(fs.readFileSync(path.join(ROOT,'pack.json'))),anchors=JSON.parse(fs.readFileSync(path.join(ROOT,'anchors.json')));
const validation=validate(pack,anchors,p=>fs.readFileSync(path.join(ROOT,p)));
if(!validation.valid)throw Error(validation.errors.join('\n'));
const literal=s=>"'"+String(s).replaceAll("'","''")+"'";
function clob(text) {
  // Each UTF-8 SQL literal stays well below the 4000-byte SQL literal limit.
  const chunks=[];let chunk='';for(const ch of text){if(Buffer.byteLength(chunk+ch)>2500){chunks.push(chunk);chunk='';}chunk+=ch;}if(chunk)chunks.push(chunk);
  return chunks.map(s=>'TO_CLOB('+literal(s)+')').join(' ||\n      ');
}
const checks=anchors.incidents.map(i=>`  assert_anchor(${literal(i.INCIDENT_REF)},${literal(i.CASE_REF)},${literal(anchors.links.find(l=>l.INCIDENT_REF===i.INCIDENT_REF).PERSON_REF)},${literal(i.OCCURRED_AT)},${literal(i.SUBURB)});`).join('\n');
const calls=pack.items.map(e=>{
  const metadata={pack_code:pack.packageCode,profile_code:pack.profileCode,evidence_ref:e.evidenceRef,
    record_sha256:sha256(canonical(e)),synthetic_record:true,observed_detail:e.description,
    shared_marker:e.markers.map(m=>m.namespace+':'+m.value).join(' / ')||null,
    // No public URL until the UI's scoped asset endpoint has been implemented.
    asset_uri:null,asset_caption:e.asset.caption,evidence_intelligence:e};
  return `  put_item(${literal(e.evidenceRef)},${literal(e.incidentRef)},${literal(e.kind)},${literal(metadata.record_sha256)},\n      ${clob(JSON.stringify(metadata))});`;
}).join('\n');
const sql=`-- GENERATED from ${pack.packageCode}; local validation passed, Oracle execution pending.
-- Run in an already authenticated SQL*Plus/SQLcl session as the application schema:
-- @testdata/evidence-intelligence/v1/load.sql CHECK
-- CHECK stages and validates inserts, then ROLLBACKs. Only APPLY commits.
-- Identity sequences can advance even on rollback. No DDL or snapshot recapture.
DEFINE evidence_mode = '&1'
SET DEFINE OFF
SET SERVEROUTPUT ON
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK
DECLARE
  v_profile VARCHAR2(80);
  v_count NUMBER;
  v_before NUMBER;
  v_added NUMBER := 0;
  PROCEDURE assert_anchor(p_ref VARCHAR2,p_case VARCHAR2,p_person VARCHAR2,p_time VARCHAR2,p_suburb VARCHAR2) IS
    n NUMBER;
  BEGIN
    SELECT COUNT(*) INTO n FROM crime_incidents i
    JOIN case_incident_links cl ON cl.incident_id=i.incident_id
    JOIN case_files cf ON cf.case_id=cl.case_id
    JOIN person_incident_links pl ON pl.incident_id=i.incident_id
    JOIN persons_of_interest p ON p.person_id=pl.person_id
    WHERE i.incident_ref=p_ref AND cf.case_ref=p_case AND p.person_ref=p_person
      AND i.suburb=p_suburb
      AND SYS_EXTRACT_UTC(i.occurred_at)=TO_TIMESTAMP(p_time,'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"');
    IF n<>1 THEN RAISE_APPLICATION_ERROR(-20801,'Missing or changed incident/case/person/time anchor: '||p_ref); END IF;
  END;
  PROCEDURE put_item(p_ref VARCHAR2,p_incident VARCHAR2,p_kind VARCHAR2,p_hash VARCHAR2,p_doc CLOB) IS
    n NUMBER; v_hash VARCHAR2(64); v_incident VARCHAR2(80); v_kind VARCHAR2(60); v_equal NUMBER;
  BEGIN
    SELECT COUNT(*) INTO n FROM evidence_items
    WHERE JSON_VALUE(evidence_metadata,'$.evidence_ref')=p_ref;
    IF n>1 THEN RAISE_APPLICATION_ERROR(-20802,'Duplicate stable evidence reference: '||p_ref); END IF;
    IF n=1 THEN
      SELECT JSON_VALUE(e.evidence_metadata,'$.record_sha256'),i.incident_ref,e.evidence_type,
        CASE WHEN JSON_EQUAL(e.evidence_metadata,JSON(p_doc)) THEN 1 ELSE 0 END
      INTO v_hash,v_incident,v_kind,v_equal
      FROM evidence_items e JOIN crime_incidents i ON i.incident_id=e.incident_id
      WHERE JSON_VALUE(e.evidence_metadata,'$.evidence_ref')=p_ref;
      IF v_hash<>p_hash OR v_hash IS NULL OR v_incident<>p_incident OR v_kind<>p_kind OR v_equal<>1 THEN
        RAISE_APPLICATION_ERROR(-20803,'Existing evidence differs; no overwrite: '||p_ref);
      END IF;
    ELSE
      INSERT INTO evidence_items(incident_id,evidence_type,evidence_metadata)
      SELECT incident_id,p_kind,JSON(p_doc) FROM crime_incidents WHERE incident_ref=p_incident;
      IF SQL%ROWCOUNT<>1 THEN RAISE_APPLICATION_ERROR(-20804,'Incident missing: '||p_incident); END IF;
      v_added:=v_added+1;
    END IF;
  END;
BEGIN
  -- Short, exclusive staging transaction; never execute during a profile restore.
  LOCK TABLE crime_incidents,case_incident_links,person_incident_links IN SHARE MODE NOWAIT;
  LOCK TABLE evidence_items IN EXCLUSIVE MODE NOWAIT;
  SELECT p.profile_code INTO v_profile FROM z_base_active_dataset_profile a
    JOIN z_base_dataset_profiles p ON p.dataset_profile_id=a.dataset_profile_id WHERE a.control_id=1;
  IF v_profile<>${literal(pack.profileCode)} THEN RAISE_APPLICATION_ERROR(-20800,'Wrong active profile; no restore or switch is performed'); END IF;
  SELECT COUNT(*) INTO v_before FROM evidence_items;
${checks}
${calls}
  SELECT COUNT(*) INTO v_count FROM evidence_items WHERE JSON_VALUE(evidence_metadata,'$.pack_code')=${literal(pack.packageCode)};
  IF v_count<>32 THEN RAISE_APPLICATION_ERROR(-20805,'Unexpected pack size'); END IF;
  SELECT COUNT(*) INTO v_count FROM evidence_items;
  IF v_count<>v_before+v_added THEN RAISE_APPLICATION_ERROR(-20806,'Unexpected evidence count change'); END IF;
  DBMS_OUTPUT.PUT_LINE('Validated 32 fixture records; newly staged: '||v_added);
END;
/
SET DEFINE ON
BEGIN
  IF UPPER('&&evidence_mode')='APPLY' THEN
    COMMIT;
    DBMS_OUTPUT.PUT_LINE('Committed active-profile additions only; saved snapshot is unchanged.');
  ELSE
    ROLLBACK;
    DBMS_OUTPUT.PUT_LINE('CHECK complete; all staged rows rolled back.');
  END IF;
END;
/
UNDEFINE evidence_mode
`;
fs.writeFileSync(path.join(ROOT,'load.sql'),sql);
console.log(JSON.stringify({output:'testdata/evidence-intelligence/v1/load.sql',records:pack.items.length,databaseApplied:false,nativeValidation:'pending'}));
