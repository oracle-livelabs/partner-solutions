#!/usr/bin/env node
require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const oracledb = require('oracledb');
const {
  IMAGE_MODEL,
  NARRATIVE_MODEL,
  embedImage,
  embedNarrative,
  vectorLiteral,
} = require('../backend/embeddings');

const projectRoot = path.resolve(__dirname, '..');
const profiles = [
  {
    key: 'george',
    personRef: 'POI-NBNW-GEORGE',
    displayName: 'George Kaplan',
    aliasName: 'Kaplan',
    status: 'person_of_interest',
    summary: 'Gallery director under review after irregular art-market payments, rapid resales, and transfers involving connected entities and a charitable foundation.',
    image: 'george-kaplan.png',
    caption: 'Generated reference portrait of George Kaplan.',
  },
  {
    key: 'clara',
    personRef: 'POI-NBNW-CLARA',
    displayName: 'Clara Thornhill',
    aliasName: 'Thornhill',
    status: 'associate',
    summary: 'Foundation director whose donor network and governance role are relevant to a review of payments moving through charitable and art-market entities.',
    image: 'clara-thornhill.png',
    caption: 'Generated reference portrait of Clara Thornhill.',
  },
  {
    key: 'eve',
    personRef: 'POI-NBNW-EVE',
    displayName: 'Eve Kendall',
    aliasName: 'Kendall',
    status: 'person_of_interest',
    summary: 'Art consultant linked to gallery clients, former resource-sector entities, travel activity, and transactions requiring financial and provenance review.',
    image: 'eve-kendall.png',
    caption: 'Generated reference portrait of Eve Kendall.',
  },
  {
    key: 'philip',
    personRef: 'POI-NBNW-PHILIP',
    displayName: 'Philip Vandamm',
    aliasName: 'Vandamm',
    status: 'person_of_interest',
    summary: 'International financier connected to high-value art purchases, layered company structures, and transaction sequences selected for comparative review.',
    image: 'philip-vandamm.png',
    caption: 'Generated reference portrait of Philip Vandamm.',
  },
];

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function loadProfile(connection, profile) {
  const narrativePath = path.join(projectRoot, 'case_nbynw', `poi_${profile.key}.txt`);
  const imagePath = path.join(projectRoot, 'frontend', 'public', 'poi', 'nbynw', profile.image);
  const [narrativeBuffer, imageBuffer] = await Promise.all([fs.readFile(narrativePath), fs.readFile(imagePath)]);
  const narrative = narrativeBuffer.toString('utf8').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
  const [narrativeVector, imageVector] = await Promise.all([
    embedNarrative(narrative),
    embedImage(imagePath),
  ]);
  const attributes = JSON.stringify({
    scenario: 'NBNW_FINANCIAL_REVIEW',
    generated_fictional: true,
    source_narrative: path.basename(narrativePath),
    portrait_policy: 'generated_fictional_only',
  });

  await connection.execute(
    `MERGE INTO persons_of_interest p
     USING (SELECT :personRef person_ref FROM dual) s
     ON (p.person_ref=s.person_ref)
     WHEN MATCHED THEN UPDATE SET
       p.display_name=:displayName,p.alias_name=:aliasName,p.person_status=:status,
       p.portrait_variant='generated-photo',p.portrait_asset_uri=:assetUri,
       p.portrait_alt_text=:portraitAlt,p.narrative_summary=:summary,
       p.narrative_text=:narrative,p.profile_attributes=JSON(:attributes),
       p.owning_patrol_area_id=(SELECT patrol_area_id FROM patrol_areas WHERE area_code='CENTRAL')
     WHEN NOT MATCHED THEN INSERT(
       person_ref,display_name,alias_name,person_status,portrait_variant,
       portrait_asset_uri,portrait_alt_text,narrative_summary,narrative_text,
       profile_attributes,owning_patrol_area_id)
     VALUES(
       :personRef,:displayName,:aliasName,:status,'generated-photo',:assetUri,
       :portraitAlt,:summary,:narrative,JSON(:attributes),
       (SELECT patrol_area_id FROM patrol_areas WHERE area_code='CENTRAL'))`,
    {
      personRef: profile.personRef,
      displayName: profile.displayName,
      aliasName: profile.aliasName,
      status: profile.status,
      assetUri: `/poi/nbynw/${profile.image}`,
      portraitAlt: profile.caption,
      summary: profile.summary,
      narrative: { val: narrative, type: oracledb.CLOB },
      attributes,
    }
  );

  await connection.execute(
    `MERGE INTO person_narrative_embeddings e
     USING (SELECT person_id FROM persons_of_interest WHERE person_ref=:personRef) p
     ON (e.person_id=p.person_id)
     WHEN MATCHED THEN UPDATE SET e.embedding_model=:model,e.source_sha256=:sourceSha,
       e.embedding=TO_VECTOR(:embedding),e.created_at=SYSTIMESTAMP
     WHEN NOT MATCHED THEN INSERT(person_id,embedding_model,source_sha256,embedding)
       VALUES(p.person_id,:model,:sourceSha,TO_VECTOR(:embedding))`,
    {
      personRef: profile.personRef,
      model: NARRATIVE_MODEL,
      sourceSha: sha256(narrativeBuffer),
      embedding: vectorLiteral(narrativeVector),
    }
  );

  await connection.execute(
    `MERGE INTO person_visual_embeddings e
     USING (SELECT person_id FROM persons_of_interest WHERE person_ref=:personRef) p
     ON (e.person_id=p.person_id AND e.asset_ref=:assetRef)
     WHEN MATCHED THEN UPDATE SET e.asset_kind='reference_portrait',e.asset_uri=:assetUri,
       e.mime_type='image/png',e.asset_sha256=:assetSha,e.asset_caption=:caption,
       e.embedding_model=:model,e.embedding=TO_VECTOR(:embedding),e.created_at=SYSTIMESTAMP
     WHEN NOT MATCHED THEN INSERT(
       person_id,asset_ref,asset_kind,asset_uri,mime_type,asset_sha256,
       asset_caption,embedding_model,embedding)
       VALUES(p.person_id,:assetRef,'reference_portrait',:assetUri,'image/png',
       :assetSha,:caption,:model,TO_VECTOR(:embedding))`,
    {
      personRef: profile.personRef,
      assetRef: `NBNW-${profile.key.toUpperCase()}-REFERENCE`,
      assetUri: `/poi/nbynw/${profile.image}`,
      assetSha: sha256(imageBuffer),
      caption: profile.caption,
      model: IMAGE_MODEL,
      embedding: vectorLiteral(imageVector),
    }
  );

  return { personRef: profile.personRef, narrativeDimensions: narrativeVector.length, imageDimensions: imageVector.length };
}

async function main() {
  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
  const connection = await oracledb.getConnection({
    user: process.env.ORACLE_USER || 'ADELAIDE_CRIME',
    password: process.env.APP_SCHEMA_PASSWORD || 'crime-demo-only',
    connectString: process.env.ORACLE_CONNECTION_STRING || '127.0.0.1:1533/FREEPDB1',
  });
  try {
    const loaded = [];
    for (const profile of profiles) loaded.push(await loadProfile(connection, profile));
    await connection.commit();
    console.log(JSON.stringify({ loaded, imageModel: IMAGE_MODEL, narrativeModel: NARRATIVE_MODEL }, null, 2));
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
