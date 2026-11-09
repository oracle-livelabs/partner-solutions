'use strict';
// Add the five user-confirmed fictional profiles without replacing existing POIs.
// Run inside the FU40 application container with its existing database environment.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const oracledb = require('oracledb');
const {embedImage, embedNarrative, vectorLiteral, IMAGE_MODEL, NARRATIVE_MODEL} = require('../backend/embeddings');
const scenario = 'FICTIONAL_NETWORK_20260912';
const profiles = [
  ['MARA', 'Mara Vega', 'mara-vega', 'Socially confident facilitator who builds relationships across different community and business settings. May be associated with coordinating introductions, meetings, and exchanges for an organised drug network.'],
  ['ELIAS', 'Elias Grant', 'elias-grant', 'Methodical associate with a practical interest in cash flow and personal finances. May be associated with managing informal payments, resource allocation, and financial records connected to drug activity.'],
  ['NOAH', 'Noah Kim', 'noah-kim', 'Lower-visibility associate who maintains a routine public presence and communicates across several social circles. May be associated with logistics, communications, or other support functions rather than direct handling of drugs or cash.'],
  ['TESSA', 'Tessa Rowe', 'tessa-rowe', 'Trusted associate with access to private social and residential settings. May be associated with administration, packaging, storage, or financial reconciliation within a drug-distribution network.'],
  ['DARNELL', 'Darnell Price', 'darnell-price', 'Mobile, well-connected associate who regularly meets people across different locations. May be associated with moving small items, messages, or cash between members of a drug network.'],
];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
async function main() {
  if (!process.argv.includes('--apply')) throw Error('Use --apply to register the five confirmed fictional profiles.');
  if (process.env.ORACLE_USER !== 'CRIME_DATA' || !process.env.APP_SCHEMA_PASSWORD || !process.env.ORACLE_WALLET_PASSWORD) throw Error('Run with the existing FU40 CRIME_DATA application environment.');
  const prepared = [];
  for (const [key, name, slug, description] of profiles) {
    const filename = `${slug}-portrait-sheet.jpeg`;
    const imagePath = path.resolve(__dirname, '../frontend/dist/poi/fnet', filename);
    const bytes = await fs.readFile(imagePath);
    if (bytes.length > 8 * 1024 * 1024 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw Error(`Invalid JPEG: ${filename}`);
    const narrative = `Fictional scenario profile. ${description}\nUser-authored scenario hypothesis; associations and imagery alone do not establish criminal conduct, intent, or parcel contents.`;
    prepared.push({key, name, description, narrative, imagePath, imageSha: hash(bytes), textSha: hash(narrative), uri: `/poi/fnet/${filename}`, ref: `POI-FNET-${key}`, assetRef: `FNET-${key}-REFERENCE`});
  }
  if (new Set(prepared.map(p => p.imageSha)).size !== 5) throw Error('Duplicate portrait files detected.');
  const connection = await oracledb.getConnection({user: process.env.ORACLE_USER, password: process.env.APP_SCHEMA_PASSWORD, connectString: process.env.ORACLE_CONNECTION_STRING, walletLocation: process.env.ORACLE_WALLET_LOCATION, walletPassword: process.env.ORACLE_WALLET_PASSWORD, configDir: process.env.ORACLE_WALLET_LOCATION});
  connection.clientId = 'statewide_admin';
  try {
    // Keep this small atomic registration serial on ADB medium services.
    await connection.execute('ALTER SESSION DISABLE PARALLEL QUERY');
    await connection.execute('ALTER SESSION DISABLE PARALLEL DML');
    const area = await connection.execute("SELECT patrol_area_id FROM patrol_areas WHERE area_code='CENTRAL'");
    if (area.rows.length !== 1) throw Error('Expected one CENTRAL demonstration patrol area.');
    for (const p of prepared) {
      const existing = await connection.execute(`SELECT JSON_VALUE(profile_attributes,'$.scenario'), JSON_VALUE(profile_attributes,'$.portrait_sha256'), narrative_summary FROM persons_of_interest WHERE person_ref=:ref`, {ref:p.ref});
      if (existing.rows.length) {
        const [s, sha, summary] = existing.rows[0];
        if (s !== scenario || sha !== p.imageSha || summary !== `Fictional scenario: ${p.description}`) throw Error(`Existing profile conflict: ${p.ref}`);
        const vectors = await connection.execute(`SELECT (SELECT COUNT(*) FROM person_narrative_embeddings WHERE person_id=p.person_id AND source_sha256=:textSha) + (SELECT COUNT(*) FROM person_visual_embeddings WHERE person_id=p.person_id AND asset_ref=:assetRef AND asset_sha256=:imageSha) FROM persons_of_interest p WHERE person_ref=:ref`, {textSha:p.textSha, assetRef:p.assetRef, imageSha:p.imageSha, ref:p.ref});
        if (vectors.rows[0][0] !== 2) throw Error(`Existing registration incomplete: ${p.ref}`);
        p.skip = true;
      }
    }
    for (const p of prepared.filter(p => !p.skip)) {
      console.log(`Preparing visual and narrative vectors: ${p.name}`);
      p.visual = vectorLiteral(await embedImage(p.imagePath));
      p.text = vectorLiteral(await embedNarrative(p.narrative));
    }
    // Repair this set's initial URI: presentationCopy rewrites 'fictional' in URLs.
    for (const p of prepared.filter(p => p.skip)) {
      await connection.execute('UPDATE persons_of_interest SET portrait_asset_uri=:uri WHERE person_ref=:ref', {uri:p.uri,ref:p.ref});
      await connection.execute('UPDATE person_visual_embeddings SET asset_uri=:uri WHERE asset_ref=:assetRef', {uri:p.uri,assetRef:p.assetRef});
    }
    for (const p of prepared.filter(p => !p.skip)) {
      await connection.execute(`INSERT INTO persons_of_interest(person_ref,display_name,alias_name,person_status,portrait_variant,portrait_asset_uri,portrait_alt_text,narrative_summary,narrative_text,profile_attributes,owning_patrol_area_id)
        VALUES(:ref,:name,:alias,'associate','generated-photo',:uri,:alt,:summary,:narrative,JSON(:attributes),:area)`, {
        ref:p.ref, name:p.name, alias:p.name.split(' ')[0], uri:p.uri, alt:`Generated fictional reference portrait of ${p.name}; identity assigned by the scenario author.`, summary:`Fictional scenario: ${p.description}`, narrative:{val:p.narrative,type:oracledb.CLOB}, area:area.rows[0][0],
        attributes:JSON.stringify({scenario, generated_fictional:true, portrait_policy:'generated_fictional_only', provenance:'User confirmed images generated in ChatGPT; supplied original JPEG files', identity_basis:'explicit_user_assignment', narrative_basis:'user_authored_fictional_scenario_hypothesis', portrait_sha256:p.imageSha, source_filename:path.basename(p.imagePath), association_is_not_evidence:true})
      });
      await connection.execute(`INSERT INTO person_narrative_embeddings(person_id,embedding_model,source_sha256,embedding) SELECT person_id,:model,:sha,TO_VECTOR(:vector) FROM persons_of_interest WHERE person_ref=:ref`, {model:NARRATIVE_MODEL,sha:p.textSha,vector:p.text,ref:p.ref});
      await connection.execute(`INSERT INTO person_visual_embeddings(person_id,asset_ref,asset_kind,asset_uri,mime_type,asset_sha256,asset_caption,embedding_model,embedding) SELECT person_id,:assetRef,'reference_portrait',:uri,'image/jpeg',:sha,:caption,:model,TO_VECTOR(:vector) FROM persons_of_interest WHERE person_ref=:ref`, {assetRef:p.assetRef,uri:p.uri,sha:p.imageSha,caption:`Generated fictional reference portrait of ${p.name}.`,model:IMAGE_MODEL,vector:p.visual,ref:p.ref});
    }
    const result = await connection.execute(`SELECT p.person_ref,p.display_name,VECTOR_DIMENSION_COUNT(n.embedding) narrative_dimensions,VECTOR_DIMENSION_COUNT(v.embedding) visual_dimensions FROM persons_of_interest p JOIN person_narrative_embeddings n ON n.person_id=p.person_id JOIN person_visual_embeddings v ON v.person_id=p.person_id WHERE JSON_VALUE(p.profile_attributes,'$.scenario')=:scenario`, {scenario}, {outFormat:oracledb.OUT_FORMAT_OBJECT});
    if (result.rows.length !== 5 || result.rows.some(r => r.NARRATIVE_DIMENSIONS !== 384 || r.VISUAL_DIMENSIONS !== 512)) throw Error('Registration verification failed.');
    await connection.commit();
    console.log(JSON.stringify({registered:prepared.filter(p=>!p.skip).length,alreadyRegistered:prepared.filter(p=>p.skip).length,profiles:result.rows},null,2));
  } catch (e) {await connection.rollback(); throw e;} finally {await connection.close();}
}
if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode=1; });
module.exports = {profiles};
