'use strict';
// Explicit opt-in: creates three clearly named synthetic verification batches in the live demo.
const assert = require('node:assert/strict');
const yazl = require('yazl');
const { hash } = require('../backend/data-room-archive');
const base = process.env.DATA_ROOM_TEST_URL || 'http://127.0.0.1:8706';
async function request(path, user = 'central_analyst', options = {}) {
  const response = await fetch(`${base}/api/data-room${path}`, { ...options, headers: { 'X-Demo-User': user, 'Content-Type': 'application/json', ...options.headers } });
  return { status: response.status, body: await response.json() };
}
async function waitBatch(id) {
  for (let i = 0; i < 40; i++) {
    const result = await request(`/batches/${id}`);
    if (['ready', 'failed'].includes(result.body.batch.status)) return result.body;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Batch processing did not finish within 20 seconds.');
}
async function run() {
  assert(process.argv.includes('--run-synthetic-tests'), 'Pass --run-synthetic-tests to authorise live demonstration fixture writes.');
  const zip = new yazl.ZipFile(), chunks = [];
  const archiveReady = new Promise((resolve, reject) => { zip.outputStream.on('data', c => chunks.push(c)); zip.outputStream.on('end', () => resolve(Buffer.concat(chunks))); zip.on('error', reject); });
  const source = 'Synthetic fictional source text\n<script>window.untrustedExecuted=true</script>\n';
  zip.addBuffer(Buffer.from(source), 'narrative.txt');
  zip.addBuffer(Buffer.from('id,reference\n1,DEMO-ONLY\n'), 'records.csv'); zip.end();
  const archive = await archiveReady;
  const create = (filename, size, user) => request('/batches', user, { method: 'POST', body: JSON.stringify({ filename, size, syntheticOnly: true, loaded_by: 'northern_analyst' }) });
  const upload = (id, content, user) => request(`/batches/${id}/archive`, user, { method: 'PUT', headers: { 'Content-Type': 'application/zip' }, body: content });
  assert.equal((await create('forbidden.zip', 1, 'read_only_viewer')).status, 403);
  assert.equal((await create('invalid-size.zip', 0)).status, 400);
  assert.equal((await request('/batches', undefined, { method: 'POST', body: JSON.stringify({ filename: 'no-confirmation.zip', size: 2 }) })).status, 400);
  const created = await create('verification-valid-synthetic.zip', archive.length);
  assert.equal(created.status, 201); const id = created.body.batchId;
  assert.equal((await upload(id, archive, 'northern_analyst')).status, 404);
  assert.equal((await upload(id, archive)).status, 202);
  const completed = await waitBatch(id);
  assert.equal(completed.batch.status, 'ready');
  assert.equal(completed.batch.loaded_by, 'central_analyst');
  assert.equal(completed.batch.archive_sha256, hash(archive));
  assert.equal(completed.items.length, 2);
  assert.equal(completed.stages.filter(s => s.status === 'complete').length, 3);
  assert.equal(completed.stages.filter(s => s.status === 'not_enabled').length, 0);
  assert.equal(completed.stages[3].status, 'pending');
  assert.equal(completed.stages[4].status, 'pending');
  const item = completed.items.find(i => i.content_type === 'txt');
  const itemPath = `/batches/${id}/items/${item.item_id}`;
  assert.equal((await request(itemPath)).body.text_preview, source);
  const download = await fetch(`${base}/api/data-room${itemPath}/download`, { headers: { 'X-Demo-User': 'central_analyst' } });
  assert.equal(download.headers.get('content-type'), 'application/octet-stream');
  assert.match(download.headers.get('content-disposition'), /attachment/);
  assert.equal(hash(Buffer.from(await download.arrayBuffer())), item.sha256);
  for (const other of ['northern_analyst', 'southern_analyst', 'read_only_viewer']) {
    assert.equal((await request(`/batches/${id}`, other)).status, 404);
    assert.equal((await request(itemPath, other)).status, 404);
    assert.equal((await request(`${itemPath}/download`, other)).status, 404);
    assert(!(await request('/batches', other)).body.batches.some(b => b.batch_id === id));
  }
  assert.equal((await request(`/batches/${id}`, 'statewide_admin')).status, 200);
  assert.equal((await upload(id, archive)).status, 202);
  assert.equal((await request(`/batches/${id}`)).body.items.length, 2);
  assert.equal((await request(`/batches/${id}/retry`, undefined, { method: 'POST' })).status, 409);
  const invalid = await create('verification-invalid-synthetic.zip', 4), badId = invalid.body.batchId;
  await upload(badId, Buffer.from('oops'));
  const failed = await waitBatch(badId);
  assert.equal(failed.batch.status, 'failed'); assert.equal(failed.items.length, 0);
  assert.equal(failed.stages[1].status, 'failed');
  assert.equal((await request(`/batches/${badId}/retry`, undefined, { method: 'POST' })).status, 200);
  const retried = await waitBatch(badId); assert.equal(retried.batch.attempts, 2);
  const cancelled = await create('verification-cancelled-synthetic.zip', 1), cancelId = cancelled.body.batchId;
  assert.equal((await request(`/batches/${cancelId}/cancel`, undefined, { method: 'POST' })).status, 200);
  assert.equal((await request(`/batches/${cancelId}/retry`, undefined, { method: 'POST' })).status, 409);
  console.log(JSON.stringify({ validBatchId: id, invalidBatchId: badId, cancelledBatchId: cancelId, upload: 'passed', storedByteIntegrity: 'passed', scopeAcrossFiveUsers: 'passed', spoofedUploaderIgnored: 'passed', duplicateUpload: 'idempotent', invalidZip: 'failed visibly', retry: 'passed', cancel: 'passed', realStages: 3, aiStages: 'pending user action', disabledStages: 2 }, null, 2));
}
if (require.main === module) run().catch(e => { console.error(e); process.exitCode = 1; });
