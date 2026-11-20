'use strict';
// Replace only the user-supplied fictional Julian Cross reference portrait.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const oracledb = require('oracledb');
const { embedImage, vectorLiteral, IMAGE_MODEL } = require('../backend/embeddings');

const PERSON_REF = 'POI-V2-JULIAN';
const ASSET_REF = 'V2-JULIAN-REFERENCE';
const ASSET_URI = '/poi/v2/julian-cross.png';
const IMAGE_PATH = path.resolve(__dirname, '../frontend/dist/poi/v2/julian-cross.png');
const SCENARIO = 'FICTIONAL_NETWORK_V2_20260914';
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

async function main() {
  if (!process.argv.includes('--apply')) throw Error('Use --apply to replace the confirmed fictional Julian Cross portrait.');
  if (process.env.ORACLE_USER !== 'CRIME_DATA' || !process.env.APP_SCHEMA_PASSWORD || !process.env.ORACLE_WALLET_PASSWORD) throw Error('Run with the existing FU40 CRIME_DATA application environment.');
  const bytes = await fs.readFile(IMAGE_PATH);
  if (bytes.length < 8 || bytes.length > 8 * 1024 * 1024 || !bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) throw Error('The replacement must be a PNG up to 8 MiB.');
  const assetSha = sha256(bytes);
  const imageVector = await embedImage(IMAGE_PATH);
  if (imageVector.length !== 512) throw Error('Unexpected visual embedding dimensions.');
  const c = await oracledb.getConnection({ user: process.env.ORACLE_USER, password: process.env.APP_SCHEMA_PASSWORD, connectString: process.env.ORACLE_CONNECTION_STRING, walletLocation: process.env.ORACLE_WALLET_LOCATION, walletPassword: process.env.ORACLE_WALLET_PASSWORD, configDir: process.env.ORACLE_WALLET_LOCATION });
  c.clientId = 'statewide_admin';
  try {
    await c.execute('ALTER SESSION DISABLE PARALLEL QUERY');
    await c.execute('ALTER SESSION DISABLE PARALLEL DML');
    const profile = await c.execute(`SELECT person_id,profile_attributes FROM persons_of_interest WHERE person_ref=:ref AND JSON_VALUE(profile_attributes,'$.scenario')=:scenario FOR UPDATE`, { ref: PERSON_REF, scenario: SCENARIO }, { outFormat: oracledb.OUT_FORMAT_OBJECT, fetchInfo: { PROFILE_ATTRIBUTES: { type: oracledb.STRING } } });
    if (profile.rows.length !== 1) throw Error('The expected fictional Julian Cross profile was not found.');
    const attributes = JSON.parse(profile.rows[0].PROFILE_ATTRIBUTES);
    attributes.portrait_sha256 = assetSha;
    attributes.source_filename = 'julian-cross.png';
    attributes.portrait_replaced_at = new Date().toISOString();
    attributes.portrait_replacement_basis = 'user-confirmed fictional replacement portrait';
    await c.execute(`UPDATE persons_of_interest SET portrait_asset_uri=:uri,portrait_alt_text=:alt,profile_attributes=JSON(:attributes) WHERE person_id=:id`, { id: profile.rows[0].PERSON_ID, uri: ASSET_URI, alt: 'Generated fictional replacement reference portrait of Julian Cross; identity assigned by the scenario author.', attributes: JSON.stringify(attributes) });
    const updated = await c.execute(`UPDATE person_visual_embeddings SET asset_uri=:uri,mime_type='image/png',asset_sha256=:sha,asset_caption=:caption,embedding_model=:model,embedding=TO_VECTOR(:embedding),created_at=SYSTIMESTAMP WHERE person_id=:id AND asset_ref=:assetRef`, { id: profile.rows[0].PERSON_ID, assetRef: ASSET_REF, uri: ASSET_URI, sha: assetSha, caption: 'Generated fictional replacement reference portrait of Julian Cross.', model: IMAGE_MODEL, embedding: vectorLiteral(imageVector) });
    if (updated.rowsAffected !== 1) throw Error('Expected exactly one Julian visual embedding to update.');
    const check = await c.execute(`SELECT p.person_ref,v.asset_sha256,VECTOR_DIMENSION_COUNT(v.embedding) visual_dimensions FROM persons_of_interest p JOIN person_visual_embeddings v ON v.person_id=p.person_id WHERE p.person_ref=:ref AND v.asset_ref=:assetRef`, { ref: PERSON_REF, assetRef: ASSET_REF }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    if (check.rows.length !== 1 || check.rows[0].ASSET_SHA256 !== assetSha || check.rows[0].VISUAL_DIMENSIONS !== 512) throw Error('Replacement verification failed.');
    await c.commit();
    console.log(JSON.stringify({ replaced: true, personRef: PERSON_REF, assetSha, visualDimensions: check.rows[0].VISUAL_DIMENSIONS }, null, 2));
  } catch (error) { await c.rollback(); throw error; } finally { await c.close(); }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
