import React, { useCallback, useEffect, useRef, useState } from 'react';
import './crime-data-room.css';
import './data-room2.css';
import FilesExplain from './FilesExplain';
import DataRoomAssistants from './DataRoomAssistants';
import BatchLearning from './BatchLearning';
import {BatchConnections} from './BatchWorkspace';
import BatchExplore from './BatchExplore';
import DetectiveRoomPublisher from './DetectiveRoomPublisher';

const formatDate = value => value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const bytes = value => value >= 1048576 ? `${(value / 1048576).toFixed(1)} MiB` : value >= 1024 ? `${(value / 1024).toFixed(1)} KiB` : `${value || 0} B`;
const statusLabel = value => ({ ready: 'Inventory ready', uploading: 'Awaiting upload', queued: 'Queued', processing: 'Processing', failed: 'Failed', not_enabled: 'Not enabled', pending: 'Pending', running: 'Running', complete: 'Complete' }[value] || value);
function Status({ value }) { return <span className={`cdr-status cdr-status--${value}`}>{statusLabel(value)}</span>; }
function SectionTitle({ letter, title, children }) { return <div className="cdr-section-title"><span className="cdr-letter">{letter}</span><div><h2>{title}</h2>{children && <p>{children}</p>}</div></div>; }
function AIDetails({ attempts = [], onTranscriptDownload }) {
  const transcriptAttempt=attempts.find(a=>a.result_json?.transcription), transcript=transcriptAttempt?.result_json?.transcription;
  const latest = attempts[0], result = latest?.status === 'complete' ? latest.result_json : null;
  if (!latest) return <div className="cdr-ai-detail"><strong>No AI description yet</strong><p>Run Identify/Describe for this batch once its inventory is ready.</p></div>;
  return <div className="cdr-ai-detail"><span className="cdr-ai-label">AI DRAFT · ANALYST REVIEW REQUIRED</span>
    {result ? <><h3>{result.headline}</h3><p>{result.description}</p>
      {['text_excerpt','machine_transcript_excerpt'].includes(result.coverage?.mode) && <p className={result.coverage.truncated ? 'cdr-ai-warning' : 'cdr-small'}>Coverage: {result.coverage.charactersSent.toLocaleString()} of {result.coverage.totalCharacters.toLocaleString()} {result.transcription ? 'transcript' : 'text'} characters.{result.coverage.truncated ? ' Partial document only; content beyond this excerpt was not analysed.' : ''}</p>}
      {result.coverage?.mode === 'original_image' && <p className="cdr-small">Original image submitted. Visual observations and any transcribed text are unverified; no person identification or POI matching.</p>}
      <dl className="cdr-ai-fields">{result.details.map((d,i) => <div key={i}><dt>{d.label}</dt><dd>{d.value}{d.sourceQuote ? <><blockquote>{d.sourceQuote}</blockquote><small>{result.transcription ? 'Transcript' : 'Source'} characters {d.startCharacter}–{d.endCharacter} (zero-based, end exclusive). Exact quote verified against {result.transcription ? 'the machine transcript, not the recording' : 'the source text'}; interpretation remains an AI draft.</small></> : <small>Image location: {d.location} · unverified visual observation</small>}</dd></div>)}</dl>
      {result.limitations.length > 0 && <div><strong>Model-reported limitations</strong><ul>{result.limitations.map((v,i)=><li key={i}>{v}</li>)}</ul></div>}
    </> : <p className="cdr-failure">{latest.error_text || 'Description failed. Retry unfinished items.'}</p>}
    {transcript && <details className="cdr-transcript" open><summary>{transcript.sourceType==='m4a'?'M4A':'MP3'} transcript · unreviewed machine output</summary><p className="cdr-small">Check names, amounts and unclear speech against the original audio. Language: {transcript.language || 'undetermined'}. Model: {transcript.model}.</p><button onClick={()=>onTranscriptDownload?.(transcriptAttempt.run_id)}>Download transcript TXT</button><pre>{transcript.text}</pre><p className="cdr-small">Transcript SHA-256: <code>{transcript.transcriptSha256}</code> · Original audio SHA-256: <code>{transcript.sourceSha256}</code></p></details>}
    <details><summary>Technical provenance</summary><div className="cdr-ai-provenance"><span>Model: {latest.model_id}</span><span>Region: {latest.region} · Prompt: {latest.prompt_version}</span><span>Generated: {formatDate(latest.created_at)}</span><span>Run: <code>{latest.run_id}</code></span><span>Source SHA-256: <code>{latest.source_sha256}</code></span>{latest.request_id && <span>OCI request: <code>{latest.request_id}</code></span>}</div>
    </details>
    {latest.result_json?.generation?.attempts?.length > 0 && <details><summary>Generation diagnostics</summary>{latest.result_json.generation.attempts.map(a=><p className="cdr-small" key={a.attempt}>Attempt {a.attempt}: {a.status} · {a.elapsedMs} ms · finish: {a.finishReason || 'unavailable'} · tokens: {a.usage?.totalTokens ?? 'unavailable'}{a.error ? ` · ${a.error}` : ''}</p>)}</details>}
    {attempts.length > 1 && <details><summary>Previous attempts ({attempts.length - 1}; latest 20 retained in this view)</summary>{attempts.slice(1).map(a=><p className="cdr-small" key={a.run_id}>{formatDate(a.created_at)} · {a.status} · {a.model_id}{a.error_text ? ` · ${a.error_text}` : ''}</p>)}</details>}
  </div>;
}

export default function DataRoom2({ user, initialBatch='', onAiOps }) {
  const [history, setHistory] = useState([]), [selected, setSelected] = useState(initialBatch), [detail, setDetail] = useState(null);
  const [file, setFile] = useState(null), [confirmed, setConfirmed] = useState(false), [uploading, setUploading] = useState(false), [progress, setProgress] = useState(0);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [loading, setLoading] = useState(true), [preview, setPreview] = useState(null), [type, setType] = useState('all');
  const [working, setWorking] = useState(false);
  const [tab, setTab] = useState('files'), [chooser, setChooser] = useState('history');
  const xhrRef = useRef(), fileInput = useRef(), alive = useRef(true), previewRequest = useRef(0), previewPane = useRef();
  const readOnly = user === 'read_only_viewer';
  const api = useCallback(async (url, options = {}) => {
    const response = await fetch(`/api/data-room${url}`, { ...options, headers: { 'X-Demo-User': user, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
    const result = await response.json();
    if (!response.ok) throw Object.assign(new Error(result.error || 'Data Room request failed.'),{details:result});
    return result;
  }, [user]);
  const refreshHistory = useCallback(async () => {
    const result = await api('/batches');
    if (alive.current) setHistory(result.batches);
    return result.batches;
  }, [api]);
  const refreshStages = useCallback(() => {
    if(selected)api(`/batches/${selected}`).then(result=>{if(alive.current)setDetail(result);}).catch(e=>{if(alive.current)setError(e.message);});
  },[selected,api]);
  useEffect(() => {
    alive.current = true;
    refreshHistory().then(batches => { if (alive.current && batches.length && !initialBatch) setSelected(batches[0].batch_id); })
      .catch(e => { if (alive.current) setError(e.message); }).finally(() => { if (alive.current) setLoading(false); });
    return () => { alive.current = false; xhrRef.current?.abort(); };
  }, [refreshHistory]);
  useEffect(() => {
    setDetail(null); setPreview(null); setType('all'); previewRequest.current++;
    if (!selected) return;
    let stopped = false, timer;
    const controller = new AbortController();
    const poll = async () => {
      try {
        const result = await api(`/batches/${selected}`, { signal: controller.signal });
        if (stopped) return;
        setDetail(result);
        if (['uploading', 'queued', 'processing'].includes(result.batch.status) || ['queued','running'].includes(result.aiRun?.status) || ['queued','running'].includes(result.learningRun?.status)) timer = setTimeout(poll, 2000);
        else await refreshHistory();
      } catch (e) {
        if (!stopped) { setError(e.message); timer = setTimeout(poll, 5000); }
      }
    };
    void poll();
    return () => { stopped = true; clearTimeout(timer); controller.abort(); };
  }, [selected, api, refreshHistory]);
  useEffect(()=>{if(preview?.linkedDescription)previewPane.current?.scrollIntoView({behavior:'smooth',block:'start'});},[preview]);

  async function download(url, name) {
    setError(''); setWorking(true);
    try {
      const response = await fetch(`/api/data-room${url}`, { headers: { 'X-Demo-User': user } });
      if (!response.ok) throw new Error((await response.json()).error || 'Download failed.');
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = objectUrl; link.download = name; link.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (e) { if (alive.current) setError(e.message); }
    finally { if (alive.current) setWorking(false); }
  }
  async function upload() {
    if (!file || !confirmed || readOnly) return;
    setError(''); setUploading(true); setProgress(0);
    try {
      if (!/\.zip$/i.test(file.name) || !file.size || file.size > 20 * 1048576) throw new Error('Choose a non-empty ZIP up to 20 MiB.');
      // Reuse an unfinished selected upload only when its declared filename and size match.
      const reuse = detail?.batch.status === 'uploading' && detail.batch.filename === file.name && detail.batch.archive_bytes === file.size;
      const { batchId } = reuse ? { batchId: selected } : await api('/batches', { method: 'POST', body: JSON.stringify({ filename: file.name, size: file.size, syntheticOnly: true }) });
      if (!alive.current) return;
      setSelected(batchId); await refreshHistory();
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest(); xhrRef.current = xhr;
        xhr.open('PUT', `/api/data-room/batches/${batchId}/archive`);
        xhr.setRequestHeader('X-Demo-User', user); xhr.setRequestHeader('Content-Type', 'application/zip');
        xhr.timeout = 120000;
        xhr.upload.onprogress = event => { if (alive.current && event.lengthComputable) setProgress(Math.round(event.loaded / event.total * 100)); };
        xhr.onerror = () => reject(new Error('Upload connection lost. Reselect the same ZIP to resume this batch, or cancel its unfinished upload.'));
        xhr.ontimeout = () => reject(new Error('Upload timed out. Check the batch status before retrying.'));
        xhr.onabort = () => reject(new Error('Upload stopped. The Batch ID remains in history.'));
        xhr.onload = () => {
          let result; try { result = JSON.parse(xhr.responseText); } catch { return reject(new Error('Unexpected upload response. Check the batch before retrying.')); }
          if (xhr.status >= 200 && xhr.status < 300) resolve(result); else reject(new Error(result.error || 'Upload failed.'));
        };
        xhr.send(file);
      });
      if (alive.current) { setFile(null); if (fileInput.current) fileInput.current.value = ''; setConfirmed(false); await refreshHistory(); }
    } catch (e) { if (alive.current) setError(e.message); }
    finally { if (alive.current) { setUploading(false); xhrRef.current = null; } }
  }
  async function action(kind) {
    setError(''); setWorking(true);
    try {
      await api(`/batches/${selected}/${kind}`, { method: 'POST' });
      // Remount polling for a previously terminal batch without discarding its ID.
      const id = selected; setSelected(''); await refreshHistory(); if (alive.current) setSelected(id);
    } catch (e) { if (alive.current) setError(e.message); }
    finally { if (alive.current) setWorking(false); }
  }
  async function openPreview(item) {
    setTab('files'); setError(''); const request = ++previewRequest.current;
    try {
      const result = await api(`/batches/${selected}/items/${item.item_id}${item.descriptionRunId?`?descriptionRunId=${encodeURIComponent(item.descriptionRunId)}`:''}`);
      if (alive.current && request === previewRequest.current) setPreview({...result,linkedDescription:!!item.descriptionRunId});
    } catch (e) { if (alive.current && request === previewRequest.current) setError(e.message); }
  }
  async function batchRemoved(id) {
    if (selected === id) { setSelected(''); setDetail(null); setPreview(null); }
    const batches = await refreshHistory();
    if (alive.current && selected === id) setSelected(batches[0]?.batch_id || '');
    if (alive.current) setNotice(`Data Room batch ${id} removed. IncidentData LiveStack data was not changed.`);
  }
  async function removeBatch(id) {
    setError(''); setWorking(true);
    try { await api(`/batches/${encodeURIComponent(id)}`, { method:'DELETE', body:JSON.stringify({confirmation:id}) }); await batchRemoved(id); }
    catch (e) { if (alive.current) setError(e.message); }
    finally { if (alive.current) setWorking(false); }
  }

  const batch = detail?.batch, items = detail?.items || [], counts = items.reduce((out, item) => ({ ...out, [item.content_type]: (out[item.content_type] || 0) + 1 }), {});
  const needsAudioDialogue=items.some(item=>['mp3','m4a'].includes(item.content_type)&&item.ai?.transcript_dialogue_ready!==1);
  const visibleItems = type === 'all' ? items : items.filter(item => item.content_type === type);
  const aiRun = detail?.aiRun, aiBusy = ['queued','running'].includes(aiRun?.status), aiCompleted = items.filter(i => i.ai?.status === 'complete').length;
  return <div className="cdr-page dr2-page">
    <div className="cdr-intro"><div><span className="cdr-eyebrow">DATA ROOM</span><h2>A focused workspace for your batch.</h2><p>Choose a batch, review its files, then explore, connect and discuss.</p></div><div className="dr2-picker-actions">{onAiOps&&<button onClick={()=>onAiOps(selected)}>View AI activity ↗</button>}</div></div>
    <div className="cdr-boundary">Synthetic training data only; do not upload real evidence or personal data.</div>
    {error && <div className="cdr-error" role="alert">{error}<button type="button" onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
    {notice && <div className="cdr-boundary" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss message">×</button></div>}

    <section className="cdr-card dr2-batch-picker" aria-label="Choose a batch">
      <div className="dr2-heading"><div><h2>Choose your batch</h2><p>Open saved work or load a new ZIP.</p></div><div className="dr2-picker-actions">
        <button aria-pressed={chooser==='history'} onClick={()=>setChooser(chooser==='history'?'':'history')}>Open existing batch</button>
        <button aria-pressed={chooser==='upload'} onClick={()=>setChooser(chooser==='upload'?'':'upload')}>Upload new ZIP</button>
      </div></div>
      <div hidden={chooser!=='history'}>    <section className="cdr-card">
      <div className="cdr-card-top"><SectionTitle letter="E" title="Batch Load History">Latest 100 batches visible to this demo user. Select a row to revisit its contents.</SectionTitle><button disabled={uploading || working} onClick={() => refreshHistory().catch(e => setError(e.message))}>Refresh history</button></div>
      {loading ? <p className="cdr-empty">Loading ADB batch history…</p> : !history.length ? <p className="cdr-empty">No batches in your scope yet.</p> : <div className="cdr-table-scroll"><table className="cdr-table cdr-history"><thead><tr><th>Batch / one-line description</th><th>Created · local time</th><th>Person loaded</th><th>Status</th><th>Actions</th></tr></thead><tbody>{history.map(row => <tr key={row.batch_id} className={row.batch_id === selected ? 'is-selected' : ''}><td><strong>{row.filename}</strong><span>{row.headline}</span><code>{row.batch_id}</code></td><td>{formatDate(row.created_at)}{row.uploaded_at && <small className="cdr-source">Loaded {formatDate(row.uploaded_at)}</small>}</td><td>{row.loaded_by}</td><td><Status value={row.status} /></td><td><div className="cdr-item-actions"><button disabled={uploading || working} aria-pressed={row.batch_id === selected} onClick={() => { setError(''); setSelected(row.batch_id); setChooser(''); }}>{row.batch_id === selected ? 'Selected' : 'Open'}</button><button disabled={readOnly || uploading || working} title="Remove this Data Room batch only" onClick={() => removeBatch(row.batch_id)}>Remove</button></div></td></tr>)}</tbody></table></div>}
    </section>

</div>
      <div hidden={chooser!=='upload'}>    <section className="cdr-card">
      <SectionTitle letter="A" title="ZIP Loader">A Batch ID is allocated before upload. The original ZIP is retained with a SHA-256 checksum.</SectionTitle>
      <div className="cdr-upload">
        <label className="cdr-file-label">Choose a ZIP file<input ref={fileInput} type="file" accept=".zip,application/zip" disabled={readOnly || uploading} onChange={e => { setFile(e.target.files?.[0] || null); setError(''); }} /></label>
        <div className="cdr-upload-info"><strong>{file ? file.name : 'Narratives, photos, receipts and records'}</strong><span>{file ? bytes(file.size) : 'TXT · CSV · JSON · JPG/JPEG · PNG · MP3 · M4A · MP4'}</span><small>20 MiB ZIP · 100 files · 8 MiB per file · 40 MiB expanded. UTF-8 text; no encrypted or nested archives.</small></div>
        <button className="cdr-primary" onClick={upload} disabled={!file || !confirmed || readOnly || uploading || working}>{uploading ? 'Uploading…' : 'Load ZIP'}</button>
      </div>
      <div className="cdr-upload-options"><label><input type="checkbox" checked={confirmed} disabled={readOnly || uploading} onChange={e => setConfirmed(e.target.checked)} />I confirm this ZIP contains synthetic training data only.</label><button className="cdr-text-button" disabled={working || uploading} onClick={() => download('/sample.zip', 'incidentdata-room-synthetic-sample.zip')}>Download sample ZIP</button></div>
      <p className="cdr-small">The sample contains eight files, including two existing staged POI scene photos. No person-photo matches are inferred in this release.</p>
      {readOnly && <p className="cdr-small">Uploads are disabled for the read-only demo user.</p>}
      {uploading && <div className="cdr-upload-progress" role="status"><div><span>{progress < 100 ? 'Uploading ZIP bytes' : 'Upload bytes sent · saving to ADB'}</span><strong>{progress}%</strong></div><progress max="100" value={progress} aria-label="ZIP upload progress" /></div>}
      {selected && <div className="cdr-batch-strip"><span>Selected Batch ID <code>{selected}</code></span>{batch && <Status value={batch.status} />}</div>}
    </section>

</div>
    </section>
    <section className="cdr-card dr2-summary" aria-label="Selected batch">
      <div className="dr2-heading"><div><span className="cdr-eyebrow">SELECTED BATCH</span><h2>{batch?.filename || (loading ? 'Loading batches…' : selected ? 'Loading selected batch…' : 'Select a batch to begin')}</h2><code>{selected || 'No batch selected'}</code></div>{batch&&<Status value={batch.status}/>}</div>
      {batch&&<><p>{items.length} files · {aiCompleted} described · {detail.stages.filter(s=>s.status==='complete').length} of 7 processing stages complete</p>
      <div className="dr2-next"><span>{batch.status==='failed'?'Processing needs attention.':batch.status!=='ready'?'Your batch is being prepared.':detail.stages[3]?.status!=='complete'?'Next: describe the files, or open an available exploration tool.':detail.stages[4]?.status!=='complete'?'Next: create the Batch Brief.':detail.stages[5]?.status!=='complete'?'Next: review connections.':detail.stages[6]?.status!=='complete'?'Next: create a saved review pack.':'Batch processing complete. Explore, ask questions or open your outputs.'}</span>
      <button onClick={()=>{setTab(batch.status!=='ready'?'brief':detail.stages[3]?.status!=='complete'?'files':detail.stages[6]?.status!=='complete'?'brief':'explore');setChooser('');}}>Go to workspace</button></div>
      <details><summary>Batch details & processing status</summary><p className="cdr-small">Loaded {formatDate(batch.uploaded_at)} by {batch.loaded_by} · ZIP {bytes(batch.archive_bytes)} · Expanded {bytes(batch.expanded_bytes)}</p>    <section className="cdr-card">
      <SectionTitle letter="D" title="Processing status">Load, Unzip and Ingest run on upload. Describe, learn, review connections with the ADB agent, then create saved data products.</SectionTitle>
      <ol className="cdr-pipeline">{(detail?.stages || ['Load', 'Unzip', 'Ingest', 'Identify/Describe', 'Learn-what-is-there', 'Understand-Connections', 'Create-Data-products'].map((name, i) => ({ stage_no: i + 1, stage_name: name, status: 'pending', detail: i < 3 ? 'Load a ZIP to begin' : i === 3 ? 'Run after inventory is ready' : i === 4 ? 'Run after descriptions are complete' : i === 5 ? 'Run after batch learning' : 'Create after connections complete' }))).map(stage => <li key={stage.stage_no} className={`cdr-stage cdr-stage--${stage.status}`}><span className="cdr-stage-number">{stage.status === 'complete' ? '✓' : stage.stage_no}</span><strong>{stage.stage_name.replaceAll('-', ' ')}</strong><Status value={stage.status} /><p>{stage.detail}</p>{stage.finished_at && <small>{formatDate(stage.finished_at)}</small>}</li>)}</ol>
      {batch?.error_text && <p className="cdr-failure" role="status">{batch.error_text}</p>}
      {batch?.status === 'failed' && batch.archive_sha256 && !readOnly && <button disabled={working} onClick={() => action('retry')}>Retry stored ZIP</button>}
      {batch?.status === 'uploading' && !readOnly && !uploading && <button disabled={working} onClick={() => action('cancel')}>Cancel unfinished upload</button>}
      {batch?.status === 'ready' && <p className="cdr-small">{detail.stages.filter(s=>s.status==='complete').length} of 7 stages complete. Descriptions are AI drafts, not verified evidence or a completed investigation.</p>}
    </section>
</details></>}
    </section>
    <nav className="dr2-tabs" aria-label="Data Room workspaces">{[['files','Files'],['explore','Explore'],['brief','Brief & Connections'],['assistants','Assistants'],['outputs','Outputs']].map(([id,label])=><button key={id} aria-current={tab===id?'page':undefined} onClick={()=>{setTab(id);setChooser('');}}>{label}</button>)}</nav>
    <div hidden={tab!=='files'} aria-label="Files workspace">    <section className="cdr-card">
      <div className="cdr-card-top"><SectionTitle letter="C" title="Files & descriptions">AI drafts remain separate from original content. Text details link to exact excerpts; photo observations require visual review.</SectionTitle><label className="cdr-filter">Content type<select value={type} onChange={e => setType(e.target.value)}><option value="all">All types ({items.length})</option>{Object.entries(counts).map(([t, n]) => <option key={t} value={t}>{t.toUpperCase()} ({n})</option>)}</select></label></div>
      <div className="cdr-ai-controls"><div><strong>{aiCompleted} of {items.length} items described</strong><p>Run sends this batch’s content to OCI GenAI. Text analysis covers the first 24,000 characters per file; images up to 5 MiB. Stage 4 transcribes MP3/M4A audio with OCI GenAI, saves the full transcript, and describes that transcript for later analysis. MP4 originals are available to download; video analysis is unavailable. Original files are unchanged.</p></div><div className="brief-explain-actions"><FilesExplain/><button className="cdr-primary" disabled={readOnly || batch?.status !== 'ready' || aiBusy || working || uploading || !items.length || (detail?.stages[3]?.status === 'complete'&&!needsAudioDialogue)} onClick={() => action('describe')}>{aiBusy ? 'Describing…' : aiRun?.status === 'failed' ? 'Retry unfinished descriptions' : detail?.stages[3]?.status === 'complete'&&needsAudioDialogue ? 'Create audio dialogue' : 'Run Identify/Describe'}</button></div></div>
      {aiRun && <div className="cdr-ai-run" role="status"><Status value={aiRun.status} /><span>This run: {aiRun.completed_count} described · {aiRun.failed_count} failed · {aiRun.item_total} requested</span><small>{aiRun.text_model} (text) · {aiRun.image_model} (images) · {aiRun.region}</small>{aiBusy && <progress max={Math.max(1,aiRun.item_total)} value={aiRun.completed_count + aiRun.failed_count} aria-label="AI description progress" />}{aiRun.error_text && <p className="cdr-failure">{aiRun.error_text}</p>}</div>}
      {!items.length ? <p className="cdr-empty">{selected ? 'Content appears here as the Ingest stage stores each validated file.' : 'No batch selected. Your content inventory will appear here.'}</p> : <div className="cdr-table-scroll"><table className="cdr-table"><thead><tr><th>Item / source file</th><th>Type</th><th>One-line description</th><th>Size</th><th>Inspect</th></tr></thead><tbody>{visibleItems.map(item => <tr key={item.item_id}><td><strong className="cdr-path">{item.original_path}</strong><code title={item.item_id}>{item.item_id.slice(0, 12)}</code></td><td><span className="cdr-type">{item.content_type.toUpperCase()}</span></td><td>{item.ai?.status === 'complete' ? item.ai.headline : item.headline}<small className="cdr-source">{item.ai?.status === 'complete' ? `AI draft · review required · ${item.ai.model_id}` : 'Inventory-derived · not AI-generated'}</small>{item.ai?.status === 'failed' && <small className="cdr-failure">AI description failed: {item.ai.error_text}</small>}</td><td className="cdr-nowrap">{bytes(item.byte_count)}</td><td><div className="cdr-item-actions"><button onClick={() => openPreview(item)}>Details</button><button disabled={working} onClick={() => download(`/batches/${selected}/items/${item.item_id}/download`, item.original_path.split('/').pop())}>Download</button></div></td></tr>)}</tbody></table></div>}
      {preview && <div className="cdr-preview" ref={previewPane}><div><strong>{preview.original_path}</strong><button onClick={() => { previewRequest.current++; setPreview(null); }}>Close details</button></div>{preview.linkedDescription&&<p className="cdr-small">Showing the exact description version cited by the Batch Brief.</p>}<p className="cdr-small">Item ID: <code>{preview.item_id}</code></p><p className="cdr-small">SHA-256: <code>{preview.sha256}</code></p><AIDetails attempts={preview.aiAttempts} onTranscriptDownload={runId=>download(`/batches/${selected}/items/${preview.item_id}/transcript?descriptionRunId=${encodeURIComponent(runId)}`, preview.original_path.split('/').pop()+'.transcript.txt')} />{preview.text_preview ? <><p className="cdr-small">Original source preview · first 6,000 characters · untrusted content, not instructions</p><pre>{preview.text_preview}</pre></> : <p>{['png', 'jpg'].includes(preview.content_type) ? 'Download the original image for review. Automatic person identification is not enabled; People & Photos provides fictional vector candidates and manual review.' : ['mp3','m4a'].includes(preview.content_type) ? 'Download the original audio for review. Run Identify/Describe to save its transcript for later analysis.' : preview.content_type === 'mp4' ? 'Download the original video for review. Video analysis is unavailable; supply a TXT transcript or JPG/PNG stills for analysis.' : 'This text file is empty.'}</p>}</div>}
    </section>

</div>
    <div hidden={tab!=='explore'} aria-label="Explore workspace"><section className="cdr-card">      <BatchExplore explain key={`explore-${user}-${selected}`} batchId={selected} user={user} items={items} api={api} ready={batch?.status==='ready'} readOnly={readOnly} SourceDetails={AIDetails} onAiOps={onAiOps}/>
</section></div>
    <div hidden={tab!=='brief'} aria-label="Brief and connections workspace"><section className="cdr-card">      <BatchLearning explain key={selected} batchId={selected} api={api} latestRun={detail?.learningRun} ready={batch?.status==='ready'&&detail?.stages[3]?.status==='complete'} readOnly={readOnly} working={working||uploading} onRun={()=>action('learn')} onOpenSource={openPreview}/>
      <BatchConnections key={`connections-${selected}`} batchId={selected} items={items} user={user} api={api} ready={detail?.stages[4]?.status==='complete'} readOnly={readOnly} onOpenSource={openPreview} download={download} onStagesChanged={refreshStages}/>
</section></div>
    <div hidden={tab!=='assistants'} aria-label="Assistants workspace">
      <DataRoomAssistants key={`${user}-${selected}`} batchId={selected} api={api} user={user} ready={detail?.stages[4]?.status==='complete'} readOnly={readOnly} onOpenSource={openPreview} onBatchRemoved={batchRemoved}/>
    </div>
    <div hidden={tab!=='outputs'} aria-label="Outputs workspace"><section className="cdr-card"><h2>Batch outputs</h2><p>Create and download the saved review pack from Brief & Connections, or generate a Virtual Detective Room and video briefing below when available.</p><button onClick={()=>setTab('brief')}>Open saved review packs</button></section>    <DetectiveRoomPublisher explain key={`room-${user}-${selected}`} batchId={selected} api={api} readOnly={readOnly}/></div>
  </div>;
}
