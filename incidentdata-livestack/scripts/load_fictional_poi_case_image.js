#!/usr/bin/env node
require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const oracledb = require('oracledb');
const { IMAGE_MODEL, embedImage, vectorLiteral } = require('../backend/embeddings');

const projectRoot = path.resolve(__dirname, '..');

function argumentsFrom(commandLine) {
  const values = {};
  for (let index = 0; index < commandLine.length; index += 1) {
    const item = commandLine[index];
    if (!item.startsWith('--')) continue;
    const key = item.slice(2);
    const next = commandLine[index + 1];
    values[key] = next && !next.startsWith('--') ? commandLine[++index] : true;
  }
  return values;
}

function safeAssetName(assetRef) {
  return String(assetRef || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function main() {
  const args = argumentsFrom(process.argv.slice(2));
  const personRef = String(args['person-ref'] || '').trim().toUpperCase();
  const assetRef = String(args['asset-ref'] || '').trim().toUpperCase();
  const sourcePath = path.resolve(String(args.image || ''));
  const caption = String(args.caption || 'Generated fictional case image retained for visual comparison.').trim();
  if (!personRef || !assetRef || !args.image) throw new Error('--person-ref, --asset-ref, and --image are required.');
  if (args['confirm-generated-fictional'] !== true) throw new Error('Add --confirm-generated-fictional. Real-person images are not accepted by this demo loader.');

  const extension = path.extname(sourcePath).toLowerCase();
  const mimeTypes = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
  if (!mimeTypes[extension]) throw new Error('Case image must be PNG, JPEG, or WebP.');
  const bytes = await fs.readFile(sourcePath);
  if (!bytes.length || bytes.length > 8 * 1024 * 1024) throw new Error('Case image must be between 1 byte and 8 MB.');

  const destinationDirectory = path.join(projectRoot, 'frontend', 'public', 'poi', 'nbynw', 'case-images');
  await fs.mkdir(destinationDirectory, { recursive: true });
  const destinationName = `${safeAssetName(assetRef)}${extension === '.jpeg' ? '.jpg' : extension}`;
  const destinationPath = path.join(destinationDirectory, destinationName);
  await fs.copyFile(sourcePath, destinationPath);
  const embedding = await embedImage(destinationPath);

  const connection = await oracledb.getConnection({
    user: process.env.ORACLE_USER || 'ADELAIDE_CRIME',
    password: process.env.APP_SCHEMA_PASSWORD || 'crime-demo-only',
    connectString: process.env.ORACLE_CONNECTION_STRING || '127.0.0.1:1533/FREEPDB1',
  });
  try {
    const person = await connection.execute(
      `SELECT person_id,JSON_VALUE(profile_attributes,'$.generated_fictional') generated_fictional
       FROM persons_of_interest WHERE person_ref=:personRef`,
      { personRef },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (!person.rows.length) throw new Error(`Unknown POI reference: ${personRef}`);
    if (String(person.rows[0].GENERATED_FICTIONAL).toLowerCase() !== 'true') throw new Error('The selected POI is not marked as a generated fictional identity.');
    const assetUri = `/poi/nbynw/case-images/${destinationName}`;
    const assetSha = crypto.createHash('sha256').update(bytes).digest('hex');
    await connection.execute(
      `MERGE INTO person_visual_embeddings e
       USING (SELECT :personId person_id,:assetRef asset_ref FROM dual) s
       ON (e.person_id=s.person_id AND e.asset_ref=s.asset_ref)
       WHEN MATCHED THEN UPDATE SET e.asset_kind='case_image',e.asset_uri=:assetUri,
         e.mime_type=:mimeType,e.asset_sha256=:assetSha,e.asset_caption=:caption,
         e.embedding_model=:model,e.embedding=TO_VECTOR(:embedding),e.created_at=SYSTIMESTAMP
       WHEN NOT MATCHED THEN INSERT(
         person_id,asset_ref,asset_kind,asset_uri,mime_type,asset_sha256,
         asset_caption,embedding_model,embedding)
         VALUES(:personId,:assetRef,'case_image',:assetUri,:mimeType,:assetSha,
         :caption,:model,TO_VECTOR(:embedding))`,
      {
        personId: person.rows[0].PERSON_ID,
        assetRef,
        assetUri,
        mimeType: mimeTypes[extension],
        assetSha,
        caption,
        model: IMAGE_MODEL,
        embedding: vectorLiteral(embedding),
      }
    );
    await connection.commit();
    console.log(JSON.stringify({ personRef, assetRef, assetUri, model: IMAGE_MODEL, dimensions: embedding.length }, null, 2));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
