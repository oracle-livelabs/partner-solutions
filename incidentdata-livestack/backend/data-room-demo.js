'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const yazl = require('yazl');

async function demoArchive() {
  const zip = new yazl.ZipFile();
  const text = (name, body) => zip.addBuffer(Buffer.from(body), name);
  text('narrative.txt', 'SYNTHETIC TRAINING DATA — Gallery payment review\nAll people, transactions and events in this bundle are fictional.\nA fictional gallery reports that an invoice bank account changed before a payment was made. The bundle contains a narrative, sample transactions, travel records, messages and staged images for an analyst to inventory. A shared date or appearance is not proof of an incident relationship.\nNo real evidence or biometric identification is included.\n');
  text('incident.json', JSON.stringify({ synthetic_record: true, reference: 'DEMO-ROOM-001', title: 'Gallery invoice account change', date: '2026-09-10', location: 'Fictional Adelaide gallery', status: 'training scenario', note: 'Staged photos are context only; no person-photo associations have been inferred.' }, null, 2));
  text('records/bank-transactions.csv', 'transaction_id,date,from_account,to_account,amount_aud,reference\nDEMO-T01,2026-09-10,DEMO-AC01,DEMO-AC02,2450,Gallery invoice 104\nDEMO-T02,2026-09-11,DEMO-AC02,DEMO-AC03,1200,Training transfer\n');
  text('records/travel.csv', 'record_id,date,traveller_ref,origin,destination,mode\nDEMO-R01,2026-09-10,DEMO-P01,Adelaide station,Gallery precinct,tram\nDEMO-R02,2026-09-11,DEMO-P02,Gallery precinct,City cafe,walk\n');
  text('records/messages.csv', 'message_id,sent_at,sender_ref,recipient_ref,message\nDEMO-M01,2026-09-09T10:00:00Z,DEMO-P01,DEMO-P02,Please confirm the invoice account details.\nDEMO-M02,2026-09-10T11:30:00Z,DEMO-P02,DEMO-P01,The payment reference is invoice 104.\n');
  text('records/receipt.json', JSON.stringify({ synthetic_record: true, receipt_id: 'DEMO-REC01', date: '2026-09-10', merchant: 'Fictional City Cafe', total_aud: 18.5 }, null, 2));
  for (const [source, target] of [['eve-philip-gallery.png', 'photos/gallery-01.png'], ['george-eve-coffee.png', 'photos/cafe-01.png']]) {
    let content;
    for (const root of ['dist', 'public']) {
      try { content = await fs.readFile(path.join(__dirname, '../frontend', root, 'poi/nbynw/case-images', source)); break; }
      catch (e) { if (e.code !== 'ENOENT') throw e; }
    }
    if (!content) throw new Error('The staged sample photos are unavailable.');
    zip.addBuffer(content, target);
  }
  const result = new Promise((resolve, reject) => {
    const chunks = [];
    zip.outputStream.on('data', chunk => chunks.push(chunk));
    zip.outputStream.on('error', reject); zip.on('error', reject);
    zip.outputStream.on('end', () => resolve(Buffer.concat(chunks)));
  });
  zip.end();
  return result;
}
module.exports = { demoArchive };
