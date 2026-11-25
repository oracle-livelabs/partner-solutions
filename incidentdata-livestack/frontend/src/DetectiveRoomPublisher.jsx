import React, {useEffect, useRef, useState} from 'react';
import './detective-room-publisher.css';
import OutputsExplain from './OutputsExplain';

export default function DetectiveRoomPublisher({batchId, api, readOnly, explain=false}) {
  const [status, setStatus] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    let timer, stopped = false;
    const controller = new AbortController();
    async function poll() {
      try {
        const value = await api(`/batches/${batchId}/room`, {signal:controller.signal});
        if (!stopped) { setStatus(value); setError(''); }
      } catch (e) { if (!stopped) setError(e.message); }
      finally { if (!stopped) timer = setTimeout(poll, 5000); }
    }
    if (batchId) void poll();
    return () => { stopped = true; alive.current = false; controller.abort(); clearTimeout(timer); };
  }, [batchId, api]);
  if (!batchId || status?.enabled === false) return null;
  const active = ['QUEUED','IN_PROGRESS'].includes(status?.state), ready = status?.ready;
  async function generate() {
    setBusy(true); setError('');
    try {
      await api(`/batches/${batchId}/room`, {method:'POST',body:JSON.stringify({regenerate:!!ready})});
      const next = await api(`/batches/${batchId}/room`);
      if (alive.current) setStatus(next);
    } catch (e) { if (alive.current) setError(e.message); }
    finally { if (alive.current) setBusy(false); }
  }
  async function access(download) {
    const popup = download ? null : window.open('about:blank','_blank');
    if (popup) popup.opener = null;
    setBusy(true); setError('');
    try {
      const links = await api(`/batches/${batchId}/room/runs/${ready.id}/access`, {method:'POST'});
      if (download) { const a = document.createElement('a'); a.href = links.download; a.download = ''; a.click(); }
      else if (popup) popup.location.replace(links.view);
      else throw new Error('Allow pop-ups for this app, then open the room again.');
    } catch (e) { popup?.close(); if (alive.current) setError(e.message); }
    finally { if (alive.current) setBusy(false); }
  }
  return <section className="cdr-card detective-publisher" aria-labelledby="detective-room-heading">
    {explain?<div className="cdr-card-top"><div className="cdr-section-title"><span className="cdr-letter">H</span><div>
      <h2 id="detective-room-heading">Virtual Detective Room &amp; Video Briefing</h2>
      <p>Industrial evidence room, narrated case overview and a portable offline package.</p>
    </div></div><OutputsExplain/></div>:<div className="cdr-section-title"><span className="cdr-letter">H</span><div>
      <h2 id="detective-room-heading">Virtual Detective Room &amp; Video Briefing</h2>
      <p>Industrial evidence room, narrated case overview and a portable offline package.</p>
    </div></div>}
    <div className="detective-publisher-tiles">
      <article><h3>Generate</h3><p className="detective-room-state" role="status">{(status?.state || 'Loading').replaceAll('_',' ')}</p>
        <p>{status?.latest?.stage || 'Create a briefing from the original batch evidence.'}</p>
        {status?.latest?.startedAt && <small>Started {new Date(status.latest.startedAt).toLocaleString()}</small>}
        <p>Allow around 10 minutes; larger batches may take longer. You can leave this page while it runs.</p>
        {status?.generationIssue && <p className="pattern-error" role="alert">{status.generationIssue}</p>}
        <button disabled={busy || active || readOnly || !status?.eligible || !status?.workerAvailable} onClick={generate}>
          {active ? 'Generation in progress' : ready ? 'Regenerate room & briefing' : 'Generate room & briefing'}</button>
        {status?.enabled && !status?.workerAvailable && <p className="cdr-failure">Media worker unavailable. Completed rooms remain accessible.</p>}
        {status?.latest?.error && <p className="cdr-failure">{status.latest.error}</p>}
      </article>
      <article><h3>Access</h3><p>Open the last successfully completed room, with source-linked exhibits and the video briefing.</p>
        <button disabled={!ready || busy} onClick={() => access(false)}>Open Virtual Detective Room ↗</button>
        {ready && <small>Completed {new Date(ready.finishedAt).toLocaleString()}</small>}
        {ready && active && <p>The previous version stays available during regeneration.</p>}
        {ready && status?.current === false && <p>Source evidence or the engine has changed. Regenerate to refresh.</p>}
      </article>
      <article><h3>Download</h3><p>ZIP includes the room, MP4, narration, captions and original evidence. Filename includes the batch and run IDs.</p>
        <button disabled={!ready || busy} onClick={() => access(true)}>Download Virtual Detective Room ZIP</button>
        <small>Keep the extracted folder together. Downloaded evidence is outside the app’s access controls.</small>
      </article>
    </div>
    {error && <p className="cdr-failure" role="alert">{error}</p>}
    <p className="cdr-small">AI draft · Analyst review required · Synthetic training only. Private Ask Detective conversations are excluded. No finding of guilt or facial identification.</p>
  </section>;
}
