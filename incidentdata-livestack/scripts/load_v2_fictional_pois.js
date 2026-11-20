'use strict';
// Registers the four user-confirmed fictional DB26ai demonstration profiles.
// Run in the FU40 app container with --apply; it never creates incident links.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const oracledb = require('oracledb');
const { embedImage, embedNarrative, vectorLiteral, IMAGE_MODEL, NARRATIVE_MODEL } = require('../backend/embeddings');

const SCENARIO = 'FICTIONAL_NETWORK_V2_20260914';
const ASSET_DIR = path.resolve(__dirname, '../frontend/dist/poi/v2');
const profiles = [
  { key: 'VIVIENNE', ref: 'POI-V2-VIVIENNE', name: 'Vivienne Hartley', alias: 'Vivienne', file: 'vivienne-hartley.png', status: 'associate', description: 'Business adviser and mentor who supports emerging entrepreneurs through a boutique consultancy. This fictional profile is included for relationship, narrative-vector, visual-vector, JSON and graph demonstrations.' },
  { key: 'JULIAN', ref: 'POI-V2-JULIAN', name: 'Julian Cross', alias: 'Julian', file: 'julian-cross.png', status: 'person_of_interest', description: 'Amsterdam-based technology-consultancy executive in a fictional demonstration scenario. Scenario material describes unverified possible links to counterfeit-goods activity; it is not evidence, attribution or a finding.' },
  { key: 'TONY', ref: 'POI-V2-TONY', name: 'Tony Kapoor', alias: 'Skids', file: 'tony-kapoor.png', status: 'person_of_interest', description: 'Former mathematician and fictional logistics broker who operates a film-vehicle maintenance business. Scenario material describes unverified possible logistics links; it is not evidence, attribution or a finding.' },
  { key: 'GEORGE', ref: 'POI-V2-GEORGE', name: 'George Horner', alias: 'The Architect', file: 'george-horner.png', status: 'person_of_interest', description: 'Fictional applied-mathematics and sports-data figure. Scenario material describes unverified possible sports-data and synthetic-drug network links; it is not evidence, attribution or a finding.' },
];

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const narrativeFor = profile => `Fictional DB26ai demonstration profile. ${profile.description}\nUser-authored fictional scenario hypothesis. Portrait similarity, semantic ranking, graph proximity, or a registered relationship does not establish identity, conduct, intent, ownership, parcel contents, or culpability.`;

async function prepare(profile) {
  const imagePath = path.join(ASSET_DIR, profile.file);
  const image = await fs.readFile(imagePath);
  if (image.length < 8 || image.length > 8 * 1024 * 1024 || !image.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) throw Error(`Invalid PNG: ${profile.file}`);
  const narrative = narrativeFor(profile);
  return { ...profile, imagePath, imageSha: sha256(image), narrative, textSha: sha256(narrative), uri: `/poi/v2/${profile.file}`, assetRef: `V2-${profile.key}-REFERENCE` };
}

async function main() {
  if (!process.argv.includes('--apply')) throw Error('Use --apply to register the four confirmed fictional profiles.');
  if (process.env.ORACLE_USER !== 'CRIME_DATA' || !process.env.APP_SCHEMA_PASSWORD || !process.env.ORACLE_WALLET_PASSWORD) throw Error('Run with the existing FU40 CRIME_DATA application environment.');
  const prepared = await Promise.all(profiles.map(prepare));
  if (new Set(prepared.map(p => p.imageSha)).size !== prepared.length) throw Error('Each fictional profile must have a distinct portrait.');
  const c = await oracledb.getConnection({ user: process.env.ORACLE_USER, password: process.env.APP_SCHEMA_PASSWORD, connectString: process.env.ORACLE_CONNECTION_STRING, walletLocation: process.env.ORACLE_WALLET_LOCATION, walletPassword: process.env.ORACLE_WALLET_PASSWORD, configDir: process.env.ORACLE_WALLET_LOCATION });
  c.clientId = 'statewide_admin';
  try {
    await c.execute('ALTER SESSION DISABLE PARALLEL QUERY');
    await c.execute('ALTER SESSION DISABLE PARALLEL DML');
    const area = await c.execute("SELECT patrol_area_id FROM patrol_areas WHERE area_code='CENTRAL'");
    if (area.rows.length !== 1) throw Error('Expected one CENTRAL demonstration patrol area.');
    for (const p of prepared) {
      const existing = await c.execute(`SELECT JSON_VALUE(profile_attributes,'$.scenario') scenario, JSON_VALUE(profile_attributes,'$.portrait_sha256') portrait_sha, narrative_summary FROM persons_of_interest WHERE person_ref=:ref`, { ref: p.ref }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      if (existing.rows.length && (existing.rows[0].SCENARIO !== SCENARIO || existing.rows[0].PORTRAIT_SHA !== p.imageSha || existing.rows[0].NARRATIVE_SUMMARY !== `Fictional scenario: ${p.description}`)) throw Error(`Existing profile conflict: ${p.ref}`);
      p.skip = existing.rows.length > 0;
    }
    for (const p of prepared.filter(p => !p.skip)) {
      console.log(`Preparing vectors: ${p.name}`);
      [p.text, p.visual] = await Promise.all([embedNarrative(p.narrative), embedImage(p.imagePath)]);
      if (p.text.length !== 384 || p.visual.length !== 512) throw Error(`Unexpected embedding dimensions for ${p.name}.`);
    }
    for (const p of prepared.filter(p => !p.skip)) {
      const attributes = JSON.stringify({ scenario: SCENARIO, generated_fictional: true, portrait_policy: 'generated_fictional_only', provenance: 'User-confirmed fictional demo portrait stored from /home/opc/scratch/photos/v2/', identity_basis: 'explicit_user_assignment', narrative_basis: 'user_authored_fictional_scenario_hypothesis', portrait_sha256: p.imageSha, source_filename: p.file, association_is_not_evidence: true });
      await c.execute(`INSERT INTO persons_of_interest(person_ref,display_name,alias_name,person_status,portrait_variant,portrait_asset_uri,portrait_alt_text,narrative_summary,narrative_text,profile_attributes,owning_patrol_area_id) VALUES(:ref,:name,:alias,:status,'generated-photo',:uri,:alt,:summary,:narrative,JSON(:attributes),:area)`, { ref: p.ref, name: p.name, alias: p.alias, status: p.status, uri: p.uri, alt: `Generated fictional reference portrait of ${p.name}; identity assigned by the scenario author.`, summary: `Fictional scenario: ${p.description}`, narrative: { val: p.narrative, type: oracledb.CLOB }, attributes, area: area.rows[0][0] });
      await c.execute(`INSERT INTO person_narrative_embeddings(person_id,embedding_model,source_sha256,embedding) SELECT person_id,:model,:sha,TO_VECTOR(:embedding) FROM persons_of_interest WHERE person_ref=:ref`, { ref: p.ref, model: NARRATIVE_MODEL, sha: p.textSha, embedding: vectorLiteral(p.text) });
      await c.execute(`INSERT INTO person_visual_embeddings(person_id,asset_ref,asset_kind,asset_uri,mime_type,asset_sha256,asset_caption,embedding_model,embedding) SELECT person_id,:assetRef,'reference_portrait',:uri,'image/png',:sha,:caption,:model,TO_VECTOR(:embedding) FROM persons_of_interest WHERE person_ref=:ref`, { ref: p.ref, assetRef: p.assetRef, uri: p.uri, sha: p.imageSha, caption: `Generated fictional reference portrait of ${p.name}.`, model: IMAGE_MODEL, embedding: vectorLiteral(p.visual) });
    }
    const verification = await c.execute(`SELECT p.person_ref,p.display_name,VECTOR_DIMENSION_COUNT(n.embedding) narrative_dimensions,VECTOR_DIMENSION_COUNT(v.embedding) visual_dimensions FROM persons_of_interest p JOIN person_narrative_embeddings n ON n.person_id=p.person_id JOIN person_visual_embeddings v ON v.person_id=p.person_id WHERE JSON_VALUE(p.profile_attributes,'$.scenario')=:scenario ORDER BY p.person_ref`, { scenario: SCENARIO }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    if (verification.rows.length !== 4 || verification.rows.some(r => r.NARRATIVE_DIMENSIONS !== 384 || r.VISUAL_DIMENSIONS !== 512)) throw Error('Registration verification failed.');
    await c.commit();
    console.log(JSON.stringify({ registered: prepared.filter(p => !p.skip).length, alreadyRegistered: prepared.filter(p => p.skip).length, profiles: verification.rows }, null, 2));
  } catch (error) { await c.rollback(); throw error; } finally { await c.close(); }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { profiles, narrativeFor };
