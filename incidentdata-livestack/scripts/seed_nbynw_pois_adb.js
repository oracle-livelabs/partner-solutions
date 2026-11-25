#!/usr/bin/env node
/* Seeds the four explicitly fictional NByNW teaching POIs required by the art-market walkthrough. */
const oracledb = require('oracledb');
const people = [
  ['POI-NBNW-GEORGE', 'George Kaplan', 'Kaplan', 'person_of_interest', 'Gallery director under review in a fictional art-market payment comparison.', 'george-kaplan.png'],
  ['POI-NBNW-CLARA', 'Clara Thornhill', 'Thornhill', 'associate', 'Foundation director in a fictional payment and governance comparison.', 'clara-thornhill.png'],
  ['POI-NBNW-EVE', 'Eve Kendall', 'Kendall', 'person_of_interest', 'Art consultant in a fictional provenance and transaction comparison.', 'eve-kendall.png'],
  ['POI-NBNW-PHILIP', 'Philip Vandamm', 'Vandamm', 'person_of_interest', 'Financier in a fictional art-market transaction comparison.', 'philip-vandamm.png'],
];
async function main() {
  for (const key of ['APP_SCHEMA_PASSWORD', 'ADB_WALLET_PASSWORD']) if (!process.env[key]) throw new Error(`${key} must be set.`);
  const walletLocation = process.env.ORACLE_WALLET_LOCATION || '/home/opc/wallet';
  const connection = await oracledb.getConnection({ user: process.env.ORACLE_USER || 'CRIME_DATA', password: process.env.APP_SCHEMA_PASSWORD, connectString: process.env.ADB_CONNECT_STRING || 'fu40_medium', walletLocation, walletPassword: process.env.ADB_WALLET_PASSWORD, configDir: walletLocation });
  try {
    for (const [personRef, displayName, aliasName, status, summary, image] of people) {
      await connection.execute(`MERGE INTO persons_of_interest p USING (SELECT :personRef person_ref FROM dual) s ON (p.person_ref=s.person_ref)
        WHEN MATCHED THEN UPDATE SET p.display_name=:displayName,p.alias_name=:aliasName,p.person_status=:status,p.portrait_variant='generated-photo',p.portrait_asset_uri=:assetUri,p.portrait_alt_text=:altText,p.narrative_summary=:summary,p.narrative_text=:summary,p.profile_attributes=JSON(:attributes),p.owning_patrol_area_id=(SELECT patrol_area_id FROM patrol_areas WHERE area_code='CENTRAL')
        WHEN NOT MATCHED THEN INSERT(person_ref,display_name,alias_name,person_status,portrait_variant,portrait_asset_uri,portrait_alt_text,narrative_summary,narrative_text,profile_attributes,owning_patrol_area_id)
        VALUES(:personRef,:displayName,:aliasName,:status,'generated-photo',:assetUri,:altText,:summary,:summary,JSON(:attributes),(SELECT patrol_area_id FROM patrol_areas WHERE area_code='CENTRAL'))`, {
        personRef, displayName, aliasName, status, summary, assetUri: `/poi/nbynw/${image}`, altText: `Generated fictional reference portrait of ${displayName}.`, attributes: JSON.stringify({ scenario: 'NBNW_FINANCIAL_REVIEW', generated_fictional: true, portrait_policy: 'generated_fictional_only' }),
      });
    }
    await connection.commit();
    console.log(JSON.stringify({ phase: 'complete', seeded: people.length }));
  } catch (error) { await connection.rollback(); throw error; } finally { await connection.close(); }
}
main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
