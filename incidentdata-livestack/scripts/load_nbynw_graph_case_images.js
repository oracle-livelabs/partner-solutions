#!/usr/bin/env node
require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const oracledb = require('oracledb');
const { IMAGE_MODEL, embedImage, vectorLiteral } = require('../backend/embeddings');

const projectRoot = path.resolve(__dirname, '..');
const generatedAssetRoot = path.join(projectRoot, 'frontend', 'public', 'poi', 'nbynw', 'case-images');

const scenes = [
  {
    filename: 'george-eve-coffee.png',
    uri: '/poi/nbynw/case-images/george-eve-coffee.png',
    caption: 'George Kaplan and Eve Kendall at an Adelaide cafe.',
    people: [
      ['POI-NBNW-GEORGE', 'NBNW-COFFEE-GEORGE'],
      ['POI-NBNW-EVE', 'NBNW-COFFEE-EVE'],
    ],
  },
  {
    filename: 'clara-philip-shopping.png',
    uri: '/poi/nbynw/case-images/clara-philip-shopping.png',
    caption: 'Clara Thornhill and Philip Vandamm in an Adelaide shopping precinct.',
    people: [
      ['POI-NBNW-CLARA', 'NBNW-SHOPPING-CLARA'],
      ['POI-NBNW-PHILIP', 'NBNW-SHOPPING-PHILIP'],
    ],
  },
  {
    filename: 'george-clara-theatre.png',
    uri: '/poi/nbynw/case-images/george-clara-theatre.png',
    caption: 'George Kaplan and Clara Thornhill at an Adelaide theatre entrance.',
    people: [
      ['POI-NBNW-GEORGE', 'NBNW-THEATRE-GEORGE'],
      ['POI-NBNW-CLARA', 'NBNW-THEATRE-CLARA'],
    ],
  },
  {
    filename: 'eve-philip-gallery.png',
    uri: '/poi/nbynw/case-images/eve-philip-gallery.png',
    caption: 'Eve Kendall and Philip Vandamm at an Adelaide art gallery.',
    people: [
      ['POI-NBNW-EVE', 'NBNW-GALLERY-EVE'],
      ['POI-NBNW-PHILIP', 'NBNW-GALLERY-PHILIP'],
    ],
  },
];

async function main() {
  if (!process.argv.includes('--confirm-generated-fictional')) {
    throw new Error('Add --confirm-generated-fictional. This loader accepts generated fictional images only.');
  }

  const prepared = [];
  for (const scene of scenes) {
    const imagePath = path.join(generatedAssetRoot, scene.filename);
    const bytes = await fs.readFile(imagePath);
    if (!bytes.length || bytes.length > 8 * 1024 * 1024) {
      throw new Error(`${scene.filename} must be between 1 byte and 8 MB.`);
    }
    prepared.push({
      ...scene,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      embedding: await embedImage(imagePath),
    });
  }

  const connection = await oracledb.getConnection({
    user: process.env.ORACLE_USER || 'ADELAIDE_CRIME',
    password: process.env.APP_SCHEMA_PASSWORD || 'crime-demo-only',
    connectString: process.env.ORACLE_CONNECTION_STRING || '127.0.0.1:1533/FREEPDB1',
  });

  const loaded = [];
  try {
    for (const scene of prepared) {
      for (const [personRef, assetRef] of scene.people) {
        const person = await connection.execute(
          `SELECT person_id,JSON_VALUE(profile_attributes,'$.generated_fictional') generated_fictional
           FROM persons_of_interest WHERE person_ref=:personRef`,
          { personRef },
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (!person.rows.length) throw new Error(`Unknown POI reference: ${personRef}`);
        if (String(person.rows[0].GENERATED_FICTIONAL).toLowerCase() !== 'true') {
          throw new Error(`${personRef} is not marked as a generated fictional identity.`);
        }

        await connection.execute(
          `MERGE INTO person_visual_embeddings e
           USING (SELECT :personId person_id,:assetRef asset_ref FROM dual) s
           ON (e.person_id=s.person_id AND e.asset_ref=s.asset_ref)
           WHEN MATCHED THEN UPDATE SET e.asset_kind='case_image',e.asset_uri=:assetUri,
             e.mime_type='image/png',e.asset_sha256=:assetSha,e.asset_caption=:caption,
             e.embedding_model=:model,e.embedding=TO_VECTOR(:embedding),e.created_at=SYSTIMESTAMP
           WHEN NOT MATCHED THEN INSERT(
             person_id,asset_ref,asset_kind,asset_uri,mime_type,asset_sha256,
             asset_caption,embedding_model,embedding)
             VALUES(:personId,:assetRef,'case_image',:assetUri,'image/png',:assetSha,
             :caption,:model,TO_VECTOR(:embedding))`,
          {
            personId: person.rows[0].PERSON_ID,
            assetRef,
            assetUri: scene.uri,
            assetSha: scene.sha256,
            caption: scene.caption,
            model: IMAGE_MODEL,
            embedding: vectorLiteral(scene.embedding),
          }
        );
        loaded.push({ personRef, assetRef, assetUri: scene.uri });
      }
    }
    await connection.commit();
    console.log(JSON.stringify({
      model: IMAGE_MODEL,
      dimensions: prepared[0].embedding.length,
      uniqueImages: prepared.length,
      personImageLinks: loaded.length,
      loaded,
    }, null, 2));
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
