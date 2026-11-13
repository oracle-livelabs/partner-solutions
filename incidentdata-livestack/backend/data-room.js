'use strict';
const express = require('express');
const crypto = require('node:crypto');
const oracledb = require('oracledb');
const { LIMITS, STAGES, hash, inspectArchive } = require('./data-room-archive');
const { demoArchive } = require('./data-room-demo');
const { createDescriptionWorker, batchDescriptions, itemDescriptions } = require('./data-room-descriptions');
const { createLearningWorker, latestLearningRun, learningDetail } = require('./data-room-learning');

const BATCH_COLUMNS = `batch_id,filename,loaded_by,created_at,uploaded_at,updated_at,status,archive_bytes,
  archive_sha256,file_count,expanded_bytes,headline,error_text,ignored_count,attempts`;
const httpError = (status, message) => Object.assign(new Error(message), { status });
const lower = row => Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
const rows = async (c, sql, binds = {}, options = {}) => (await c.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT, ...options })).rows;

function registerDataRoom(app, db) {
  const descriptions = createDescriptionWorker(db);
  const learning = createLearningWorker(db);
  const router = express.Router();
  const route = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
  require('./detective-room-api').registerRoomPublication(router, db, route);
  const workspace = require('./data-room-workspace').registerWorkspace(router, db, route);
  require('./data-room-poi-candidates').registerCandidates(router, db, route);
  require('./data-room-people-photos').registerPeoplePhotos(router, db, route);
  require('./data-room-money').registerMoney(router, db, route);
  require('./data-room-messages').registerMessages(router, db, route);
  require('./data-room-expert').registerExpert(router, db, route);
  require('./data-room-assistant-guidance').registerGuidance(router, db, route);
  require('./data-room-travel').registerTravel(router, db, route);
  require('./data-room-connections-graph').registerConnectionsGraph(router, db, route);
  require('./data-room-capabilities').registerCapabilities(router, db, route);
  require('./data-room-people-mentioned').registerPeopleMentioned(router, db, route);
  const moneyAgent = require('./data-room-money-agent').registerMoneyAgent(router, db, route);
  const writable = req => { if (req.demoUser === 'read_only_viewer') throw httpError(403, 'The read-only demo user cannot upload or retry batches.'); };
  const visible = async (c, id) => {
    const batch = (await rows(c, `SELECT ${BATCH_COLUMNS} FROM secure_cdr_batches_v WHERE batch_id=:id`, { id }))[0];
    if (!batch) throw httpError(404, 'Batch not found in your authorised scope.');
    return batch;
  };

  router.get('/sample.zip', route(async (req, res) => {
    res.type('application/zip').attachment('crime-data-room-synthetic-sample.zip').send(await demoArchive());
  }));
  router.get('/batches', route(async (req, res) => {
    const batches = await db(req.demoUser, c => rows(c, `SELECT ${BATCH_COLUMNS} FROM secure_cdr_batches_v ORDER BY created_at DESC FETCH FIRST 100 ROWS ONLY`));
    res.json({ batches: batches.map(lower), limits: LIMITS, historyLimit: 100, storage: 'Oracle Autonomous Database · BLOB + relational metadata' });
  }));
  // This is deliberately a Data Room-only lifecycle operation.  It never
  // addresses any of the application's IncidentData LiveStack tables.
  async function removalPreview(c, id) {
    const batch = await visible(c, id);
    const active = (await rows(c, `SELECT 1 FROM (
      SELECT run_id FROM cdr_ai_runs WHERE batch_id=:id AND status IN ('queued','running')
      UNION ALL SELECT run_id FROM cdr_learn_runs WHERE batch_id=:id AND status IN ('queued','running')
      UNION ALL SELECT run_id FROM cdr_workspace_runs WHERE batch_id=:id AND status IN ('queued','running')
      UNION ALL SELECT run_id FROM cdr_money_ai_runs WHERE batch_id=:id AND status IN ('queued','running')
    ) FETCH FIRST 1 ROW ONLY`, { id }))[0];
    if (active || ['queued', 'processing'].includes(batch.STATUS)) throw httpError(409, 'This Data Room batch has work in progress. Wait for it to finish before removing it.');
    return batch;
  }
  router.get('/batches/:id/removal-preview', route(async (req, res) => {
    const batch = await db(req.demoUser, c => removalPreview(c, req.params.id));
    res.json({ batch: lower(batch), scope: 'Data Room only', message: 'Removal deletes this batch’s Data Room archive, items, AI runs, briefs, workspace products and conversations. IncidentData LiveStack incidents, reports and related operational data are not changed.' });
  }));
  router.delete('/batches/:id', route(async (req, res) => {
    writable(req);
    if (req.body?.confirmation !== req.params.id) throw httpError(400, `Confirm removal with the exact Batch ID: ${req.params.id}`);
    await db(req.demoUser, async c => {
      await visible(c, req.params.id);
      // Serialize lifecycle changes for this batch with existing queue operations.
      const lock = await rows(c, 'SELECT batch_id FROM cdr_batches WHERE batch_id=:id FOR UPDATE WAIT 5', { id: req.params.id });
      if (!lock.length) throw httpError(404, 'Batch not found in your authorised scope.');
      await removalPreview(c, req.params.id);
      try {
      // Child rows are removed explicitly because the Data Room schema uses
      // restrictive foreign keys. Keep this list limited to cdr_* tables.
      await c.execute('DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM cdr_cap_failures WHERE batch_id=:id', { id: req.params.id });
      await c.execute('DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM cdr_photo_reviews WHERE candidate_id IN (SELECT a.candidate_id FROM cdr_photo_candidates a JOIN cdr_photo_searches s ON s.search_id=a.search_id WHERE s.batch_id=:id)', { id: req.params.id });
      await c.execute('DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM cdr_photo_candidates WHERE search_id IN (SELECT search_id FROM cdr_photo_searches WHERE batch_id=:id)', { id: req.params.id });
      await c.execute('DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM cdr_photo_searches WHERE batch_id=:id', { id: req.params.id });
      await c.execute('DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM cdr_money_ai_events WHERE run_id IN (SELECT run_id FROM cdr_money_ai_runs WHERE batch_id=:id)', { id: req.params.id });
      await c.execute('DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM cdr_money_ai_runs WHERE batch_id=:id', { id: req.params.id });
      await c.execute('DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM cdr_expert_assistant_runs WHERE batch_id=:id', { id: req.params.id });
      await c.execute('DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM cdr_expert_boards WHERE batch_id=:id', { id: req.params.id });
      await c.execute('DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM cdr_expert_notes WHERE batch_id=:id', { id: req.params.id });
      await c.execute('DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM cdr_expert_theories WHERE batch_id=:id', { id: req.params.id });
      await c.execute('DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM cdr_msg_links WHERE run_id IN (SELECT run_id FROM cdr_msg_runs WHERE batch_id=:id)', { id: req.params.id });
      await c.execute('DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM cdr_msg_records WHERE run_id IN (SELECT run_id FROM cdr_msg_runs WHERE batch_id=:id)', { id: req.params.id });
      await c.execute('DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM cdr_msg_nodes WHERE run_id IN (SELECT run_id FROM cdr_msg_runs WHERE batch_id=:id)', { id: req.params.id });
      await c.execute('DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM cdr_msg_runs WHERE batch_id=:id', { id: req.params.id });
      await c.execute('DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM cdr_money_transfers WHERE run_id IN (SELECT run_id FROM cdr_money_runs WHERE batch_id=:id)', { id: req.params.id });
      await c.execute('DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM cdr_money_accounts WHERE run_id IN (SELECT run_id FROM cdr_money_runs WHERE batch_id=:id)', { id: req.params.id });
      await c.execute('DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM cdr_money_runs WHERE batch_id=:id', { id: req.params.id });
      await c.execute('DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM cdr_data_products WHERE batch_id=:id', { id: req.params.id });
      await c.execute('DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM cdr_agent_tool_events WHERE run_id IN (SELECT run_id FROM cdr_workspace_runs WHERE batch_id=:id)', { id: req.params.id });
      await c.execute('DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM cdr_batch_vectors WHERE run_id IN (SELECT run_id FROM cdr_workspace_runs WHERE batch_id=:id)', { id: req.params.id });
      await c.execute('DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM cdr_workspace_runs WHERE batch_id=:id', { id: req.params.id });
      await c.execute('DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM cdr_chat_threads WHERE batch_id=:id', { id: req.params.id });
      await c.execute('DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM cdr_ai_results WHERE run_id IN (SELECT run_id FROM cdr_ai_runs WHERE batch_id=:id)', { id: req.params.id });
      await c.execute('DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM cdr_ai_runs WHERE batch_id=:id', { id: req.params.id });
      await c.execute('DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM cdr_learn_runs WHERE batch_id=:id', { id: req.params.id });
      await c.execute('DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM cdr_items WHERE batch_id=:id', { id: req.params.id });
      await c.execute('DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM cdr_stages WHERE batch_id=:id', { id: req.params.id });
      const deleted = await c.execute('DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM cdr_batches WHERE batch_id=:id', { id: req.params.id });
      if (!deleted.rowsAffected) throw httpError(404, 'Batch not found in your authorised scope.');
      await c.commit();
      } catch (error) {
        // Release every child-row change immediately on failure.
        await c.rollback();
        throw error;
      }
    });
    res.json({ batchId: req.params.id, removed: true, scope: 'Data Room only' });
  }));
  router.post('/batches', route(async (req, res) => {
    writable(req);
    const { filename, size, syntheticOnly } = req.body || {};
    if (syntheticOnly !== true) throw httpError(400, 'This demonstration accepts synthetic training data only.');
    if (typeof filename !== 'string' || !/\.zip$/i.test(filename) || /[\x00-\x1f\x7f/\\]/.test(filename) || Buffer.byteLength(filename) > 255) throw httpError(400, 'Choose a ZIP filename of at most 255 bytes.');
    if (!Number.isSafeInteger(size) || size < 1 || size > LIMITS.zipBytes) throw httpError(400, 'ZIP must be between 1 byte and 20 MiB.');
    const id = `DR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomUUID().slice(0, 18)}`;
    await db(req.demoUser, async c => {
      // Bound abandoned upload records per user in this demo; they remain visible in history.
      const count = (await rows(c, `SELECT COUNT(*) n FROM cdr_batches WHERE loaded_by=:u AND status IN ('uploading','queued','processing')`, { u: req.demoUser }))[0].N;
      if (count >= 10) throw httpError(409, 'You already have 10 unfinished batches. Finish or cancel an upload first.');
      await c.execute(`INSERT INTO cdr_batches(batch_id,filename,loaded_by,archive_bytes,headline) VALUES(:id,:filename,:u,:archiveBytes,:headline)`, { id, filename, u: req.demoUser, archiveBytes: size, headline: 'Awaiting ZIP upload' });
      for (let i = 0; i < STAGES.length; i++) await c.execute(`INSERT INTO cdr_stages(batch_id,stage_no,stage_name,status,detail) VALUES(:id,:n,:name,:status,:detail)`, {
        id, n: i + 1, name: STAGES[i], status: i === 0 ? 'running' : 'pending',
        detail: i < 3 ? (i === 0 ? 'Waiting for upload bytes' : 'Waiting for previous stage') : i === 3 ? 'Run Identify/Describe after inventory is ready' : i === 4 ? 'Run batch learning after all descriptions are complete' : i === 5 ? 'Run connections after batch learning' : 'Create products after connections complete',
      });
      await c.commit();
    });
    res.status(201).json({ batchId: id });
  }));

  // Check scope before accepting the potentially large body. Never trust a supplied uploader name.
  router.put('/batches/:id/archive', route(async (req, res) => {
    writable(req);
    await db(req.demoUser, c => visible(c, req.params.id));
    if (!req.is('application/zip')) throw httpError(415, 'Upload the archive as application/zip.');
    await new Promise((resolve, reject) => express.raw({ type: 'application/zip', limit: LIMITS.zipBytes })(req, res, error => error ? reject(error) : resolve()));
    if (!Buffer.isBuffer(req.body)) throw httpError(400, 'ZIP bytes are required.');
    const digest = hash(req.body);
    await db(req.demoUser, async c => {
      // The owner/admin predicate is checked again while holding the batch lock.
      await visible(c, req.params.id);
      const b = (await rows(c, `SELECT status,archive_bytes,archive_sha256 FROM cdr_batches WHERE batch_id=:id FOR UPDATE`, { id: req.params.id }))[0];
      if (b.ARCHIVE_SHA256 === digest) return; // Network retry of the same durable upload is idempotent.
      if (b.STATUS !== 'uploading') throw httpError(409, 'This batch already has an archive or was cancelled. Create a new batch for different content.');
      if (req.body.length !== b.ARCHIVE_BYTES) throw httpError(400, 'Uploaded size differs from the declared ZIP size.');
      await c.execute(`UPDATE cdr_batches SET archive_blob=:content,archive_sha256=:digest,status='queued',uploaded_at=SYSTIMESTAMP,updated_at=SYSTIMESTAMP,headline='ZIP stored; awaiting inventory' WHERE batch_id=:id`, {
        content: { val: req.body, type: oracledb.BLOB }, digest, id: req.params.id,
      });
      await c.execute(`UPDATE cdr_stages SET status='complete',started_at=(SELECT created_at FROM cdr_batches WHERE batch_id=:id),finished_at=SYSTIMESTAMP,detail='Original ZIP and SHA-256 stored in ADB' WHERE batch_id=:id AND stage_no=1`, { id: req.params.id });
      await c.commit();
    });
    res.status(202).json({ batchId: req.params.id });
    void tick();
  }));

  router.get('/batches/:id', route(async (req, res) => {
    const result = await db(req.demoUser, async c => {
      const batch = lower(await visible(c, req.params.id));
      const stages = await rows(c, `SELECT stage_no,stage_name,status,detail,started_at,finished_at FROM secure_cdr_stages_v WHERE batch_id=:id ORDER BY stage_no`, { id: req.params.id });
      const items = await rows(c, `SELECT item_id,original_path,content_type,byte_count,sha256,headline,description_source,row_count FROM secure_cdr_items_v WHERE batch_id=:id ORDER BY content_type,original_path`, { id: req.params.id });
      const ai = await batchDescriptions(c, req.params.id);
      const byItem = new Map(ai.descriptions.map(d => [d.item_id,d]));
      return { batch, stages: stages.map(lower), items: items.map(row=>({...lower(row),ai:byItem.get(row.ITEM_ID)||null})), aiRun:ai.aiRun, learningRun:await latestLearningRun(c,req.params.id) };
    });
    res.json(result);
  }));
  router.get('/batches/:id/items/:itemId', route(async (req, res) => {
    const revision=req.query.descriptionRunId;
    if(revision!==undefined && (typeof revision!=='string'||!/^[a-f0-9-]{36}$/i.test(revision)))throw httpError(400,'Invalid description version.');
    const item = await db(req.demoUser, async c => (await rows(c, `SELECT item_id,original_path,content_type,sha256,text_preview FROM secure_cdr_items_v WHERE batch_id=:id AND item_id=:itemId`, { id: req.params.id, itemId: req.params.itemId }, { fetchInfo: { TEXT_PREVIEW: { type: oracledb.STRING } } }))[0]);
    if (!item) throw httpError(404, 'Content item not found in your authorised scope.');
    const attempts = await db(req.demoUser, c => itemDescriptions(c, req.params.itemId, revision));
    if(revision && !attempts.length)throw httpError(404,'Description version not found for this item in your scope.');
    res.json({...lower(item), aiAttempts:attempts});
  }));
  router.get('/batches/:id/items/:itemId/transcript', route(async (req,res)=>{
    const revision=req.query.descriptionRunId;
    if(revision!==undefined&&(typeof revision!=='string'||!/^[a-f0-9-]{36}$/i.test(revision)))throw httpError(400,'Invalid description version.');
    const source=await db(req.demoUser,async c=>{
      const item=(await rows(c,'SELECT original_path,sha256 FROM secure_cdr_items_v WHERE batch_id=:id AND item_id=:itemId',{id:req.params.id,itemId:req.params.itemId}))[0];
      if(!item)throw httpError(404,'Content item not found in your authorised scope.');
      const attempts=await itemDescriptions(c,req.params.itemId,revision);
      const transcript=attempts.map(a=>a.result_json?.transcription).find(t=>require('./data-room-transcription').reusable(t,item.SHA256));
      if(!transcript)throw httpError(404,'No saved transcript is available for this audio or description version. Run Identify/Describe first.');
      return {item,transcript};
    });
    res.attachment(source.item.ORIGINAL_PATH.split('/').pop()+'.transcript.txt').type('text/plain; charset=utf-8').send(source.transcript.text);
  }));
  router.post('/batches/:id/describe', route(async (req,res) => {
    writable(req);
    res.status(202).json(await descriptions.queue(req.params.id,req.demoUser));
  }));
  router.post('/batches/:id/learn',route(async(req,res)=>{
    writable(req);
    res.status(202).json(await learning.queue(req.params.id,req.demoUser));
  }));
  router.get('/batches/:id/learning',route(async(req,res)=>{
    const runId=req.query.runId;
    if(runId!==undefined && (typeof runId!=='string'||!/^[a-f0-9-]{36}$/i.test(runId)))throw httpError(400,'Invalid learning run ID.');
    res.json(await db(req.demoUser,c=>learningDetail(c,req.params.id,runId)));
  }));
  router.get('/batches/:id/items/:itemId/download', route(async (req, res) => {
    const item = await db(req.demoUser, async c => (await rows(c, `SELECT original_path,content_blob FROM secure_cdr_items_v WHERE batch_id=:id AND item_id=:itemId`, { id: req.params.id, itemId: req.params.itemId }, { fetchInfo: { CONTENT_BLOB: { type: oracledb.BUFFER } } }))[0]);
    if (!item) throw httpError(404, 'Content item not found in your authorised scope.');
    res.attachment(item.ORIGINAL_PATH.split('/').pop()).type('application/octet-stream').send(item.CONTENT_BLOB);
  }));
  router.post('/batches/:id/cancel', route(async (req, res) => {
    writable(req);
    await db(req.demoUser, async c => {
      await visible(c, req.params.id);
      const update = await c.execute(`UPDATE cdr_batches SET status='failed',error_text='Upload cancelled by demo user',headline='Upload cancelled',updated_at=SYSTIMESTAMP WHERE batch_id=:id AND status='uploading'`, { id: req.params.id });
      if (!update.rowsAffected) throw httpError(409, 'Only an unfinished upload can be cancelled.');
      await c.execute(`UPDATE cdr_stages SET status='failed',finished_at=SYSTIMESTAMP,detail='Upload cancelled' WHERE batch_id=:id AND stage_no=1`, { id: req.params.id });
      await c.commit();
    });
    res.json({ batchId: req.params.id });
  }));
  router.post('/batches/:id/retry', route(async (req, res) => {
    writable(req);
    await db(req.demoUser, async c => {
      await visible(c, req.params.id);
      const update = await c.execute(`UPDATE cdr_batches SET status='queued',error_text=NULL,updated_at=SYSTIMESTAMP,headline='Retry queued' WHERE batch_id=:id AND status='failed' AND archive_sha256 IS NOT NULL`, { id: req.params.id });
      if (!update.rowsAffected) throw httpError(409, 'Only a failed batch with a stored ZIP can be retried.');
      await c.execute(`UPDATE cdr_stages SET status='pending',detail='Retry queued',started_at=NULL,finished_at=NULL WHERE batch_id=:id AND stage_no IN (2,3)`, { id: req.params.id });
      await c.commit();
    });
    res.json({ batchId: req.params.id }); void tick();
  }));

  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.status || 500;
    if (status >= 500) console.error('Data Room request failed:', error.message);
    res.status(status).json({ error: status === 413 ? 'ZIP exceeds the 20 MiB upload limit.' : status < 500 ? error.message : 'Data Room is temporarily unavailable. Please retry.' });
  });
  app.use('/api/data-room', router);

  let busy = false, timer;
  // Durable queue in ADB. A lease lets a stopped app resume unfinished work after 90 seconds.
  // No LLM, vector, graph or Select AI agent task is claimed by this foundation worker.
  async function owned(id, token, fn) {
    return db('statewide_admin', async c => {
      const lock = await c.execute(`UPDATE cdr_batches SET lease_until=SYSTIMESTAMP+NUMTODSINTERVAL(90,'SECOND'),updated_at=SYSTIMESTAMP WHERE batch_id=:id AND lease_token=:token AND status='processing'`, { id, token });
      if (!lock.rowsAffected) throw new Error('Batch processing lease was superseded.');
      const result = await fn(c); await c.commit(); return result;
    });
  }
  async function stage(id, token, number, status, detail) {
    return owned(id, token, c => c.execute(`UPDATE cdr_stages SET status=:status,detail=:detail,
      started_at=CASE WHEN :status='running' THEN SYSTIMESTAMP ELSE started_at END,
      finished_at=CASE WHEN :status IN ('complete','failed') THEN SYSTIMESTAMP ELSE NULL END
      WHERE batch_id=:id AND stage_no=:n`, { id, n: number, status, detail }));
  }
  async function processBatch(id, token) {
    let current = 2;
    try {
      await stage(id, token, 2, 'running', 'Validating paths, formats, size limits and CRC integrity');
      const archive = await owned(id, token, async c => (await rows(c, `SELECT archive_blob FROM cdr_batches WHERE batch_id=:id`, { id }, { fetchInfo: { ARCHIVE_BLOB: { type: oracledb.BUFFER } } }))[0].ARCHIVE_BLOB);
      const inventory = await inspectArchive(archive);
      await stage(id, token, 2, 'complete', `${inventory.files.length} supported files validated; ${inventory.ignored} OS metadata files ignored`);
      current = 3;
      await stage(id, token, 3, 'running', `Storing 0 of ${inventory.files.length} items in ADB`);
      // Retrying reuses stable item IDs and replaces only this batch's derived inventory.
      await owned(id, token, async c => {
        await c.execute('DELETE FROM cdr_items WHERE batch_id=:id', { id });
        await c.execute('UPDATE cdr_batches SET file_count=0,expanded_bytes=0 WHERE batch_id=:id', { id });
      });
      let stored = 0, bytes = 0;
      for (const item of inventory.files) {
        stored++; bytes += item.bytes;
        await owned(id, token, async c => {
          await c.execute(`INSERT INTO cdr_items(item_id,batch_id,original_path,content_type,byte_count,sha256,content_blob,headline,text_preview,row_count)
            VALUES(:itemId,:id,:path,:type,:bytes,:sha,:content,:headline,:preview,:rowCount)`, {
            itemId: hash(Buffer.from(`${id}\0${item.path}`)).slice(0, 32), id, path: item.path, type: item.type, bytes: item.bytes, sha: item.sha256,
            content: { val: item.content, type: oracledb.BLOB }, headline: item.headline,
            preview: { val: item.preview, type: oracledb.CLOB }, rowCount: item.rowCount,
          });
          await c.execute(`UPDATE cdr_batches SET file_count=:stored,expanded_bytes=:bytes WHERE batch_id=:id`, { id, stored, bytes });
          await c.execute(`UPDATE cdr_stages SET detail=:detail WHERE batch_id=:id AND stage_no=3`, { id, detail: `Stored ${stored} of ${inventory.files.length} items in ADB` });
        });
      }
      await owned(id, token, async c => {
        const counts = {};
        for (const item of inventory.files) counts[item.type] = (counts[item.type] || 0) + 1;
        await c.execute(`UPDATE cdr_stages SET status='complete',finished_at=SYSTIMESTAMP,detail='Original content, checksums and inventory headlines stored' WHERE batch_id=:id AND stage_no=3`, { id });
        await c.execute(`UPDATE cdr_batches SET status='ready',headline=:headline,ignored_count=:ignored,error_text=NULL,lease_token=NULL,lease_until=NULL WHERE batch_id=:id`, {
          id, ignored: inventory.ignored, headline: `${stored} items · ${Object.entries(counts).map(([type, count]) => `${count} ${type.toUpperCase()}`).join(' · ')} · AI stages pending`,
        });
      });
    } catch (error) {
      console.error(`Data Room batch ${id} failed:`, error.message);
      const detail = error.status === 400 || /ZIP|CSV|JSON|Text|signature|Symbolic|compression|CRC/.test(error.message) ? error.message.slice(0, 450) : 'Processing interrupted. You can retry this stored ZIP.';
      try {
        await owned(id, token, async c => {
          await c.execute(`UPDATE cdr_stages SET status='failed',detail=:detail,finished_at=SYSTIMESTAMP WHERE batch_id=:id AND stage_no=:n`, { id, n: current, detail });
          await c.execute(`UPDATE cdr_batches SET status='failed',error_text=:detail,headline='Inventory processing failed',lease_token=NULL,lease_until=NULL WHERE batch_id=:id`, { id, detail });
        });
      } catch (leaseError) { console.error('Data Room failure state:', leaseError.message); }
    }
  }
  async function tick() {
    if (busy) return;
    busy = true;
    try {
      const token = crypto.randomUUID();
      const id = await db('statewide_admin', async c => {
        const candidate = (await rows(c, `SELECT batch_id FROM cdr_batches WHERE status='queued' OR (status='processing' AND lease_until<SYSTIMESTAMP) ORDER BY created_at FETCH FIRST 1 ROW ONLY`))[0];
        if (!candidate) return null;
        const claim = await c.execute(`UPDATE cdr_batches SET status='processing',lease_token=:token,lease_until=SYSTIMESTAMP+NUMTODSINTERVAL(90,'SECOND'),attempts=attempts+1,updated_at=SYSTIMESTAMP WHERE batch_id=:id AND (status='queued' OR (status='processing' AND lease_until<SYSTIMESTAMP))`, { id: candidate.BATCH_ID, token });
        await c.commit(); return claim.rowsAffected ? candidate.BATCH_ID : null;
      });
      if (id) await processBatch(id, token);
    } catch (error) { console.error('Data Room queue unavailable:', error.message); }
    finally { busy = false; }
  }
  return { start() { descriptions.start(); learning.start(); workspace.start(); moneyAgent.start(); if (!timer) { timer = setInterval(tick, 2500); timer.unref(); void tick(); } }, stop() { descriptions.stop(); learning.stop(); workspace.stop(); moneyAgent.stop(); clearInterval(timer); timer = null; } };
}
module.exports = { registerDataRoom };
