import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import './agent-history.css';

const date = value => value ? new Date(value).toLocaleString() : 'Time unavailable';
const display = value => value == null ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value);
const title = action => action.PAYLOAD?.title || action.PAYLOAD?.question || action.PAYLOAD?.topic || action.ACTION_TYPE.replaceAll('_', ' ');

export function useConversationHistory() {
  const [threadId, setThreadId] = useState(''), [warning, setWarning] = useState('');
  return {threadId, warning, reset: () => {setThreadId(''); setWarning('');},
    readResponse: async response => {
      const body = await response.json();
      if (Object.hasOwn(body, 'historyThreadId')) setThreadId(body.historyThreadId || '');
      setWarning(body.historyWarning || '');
      if (!response.ok) throw Error(body.error || 'The request could not be completed.');
      return body;
    }};
}
export function HistorySaveNotice({history}) {
  return history.warning ? <p className="agent-history-warning" role="alert">{history.warning}</p> : null;
}

function Exchange({turn, selected}) {
  const response = turn.response, details = turn.details || {};
  const rows = response?.rows || response?.records || [], columns = response?.columns || Object.keys(rows[0] || {});
  const sql = response?.generatedSql || response?.sql || details.generatedSql;
  const findings = response?.findings || response?.keyFindings || response?.gaps || [];
  return <article className={`agent-history-exchange${selected ? ' selected' : ''}`} data-action-id={turn.actionId} aria-label={`Exchange ${turn.actionId}`}>
    <header><span>{turn.status === 'limited' ? 'Limited historical record' : turn.status === 'failed' ? 'Failed request' : 'Saved exchange'}{selected ? ' · Selected entry' : ''}</span><time>{date(turn.createdAt)}</time></header>
    <section className="agent-history-question"><h3>You asked</h3><p>{turn.question || 'The original question was not recorded.'}</p></section>
    {response ? <section className="agent-history-answer"><h3>{response.agent || response.title || 'Assistant response'}</h3>
      {response.error ? <p className="agent-history-warning">Request failed: {response.error}</p> : <>
        {response.answer && <p>{response.answer}</p>}
        {response.mode === 'review_only_case_brief' && <><p>{response.pattern?.PATTERN_SUMMARY}</p><p>Review-only brief · human review required · no external action taken.</p></>}
        {findings.length > 0 && <ul>{findings.map((item, index) => <li key={index}>{item}</li>)}</ul>}
      </>}
      {rows.length > 0 && <details><summary>Saved results · {rows.length} rows</summary><div className="agent-history-table" tabIndex={0} role="region" aria-label="Saved query results"><table><thead><tr>{columns.map(column => <th key={column}>{column.replaceAll('_', ' ')}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map(column => <td key={column}>{display(row[column])}</td>)}</tr>)}</tbody></table></div></details>}
    </section> : <p className="agent-history-warning">No original assistant response was stored for this entry. Only the recorded question and details are available; no answer has been recreated.</p>}
    {sql && <details><summary>{response ? 'Saved SQL' : 'Recorded SQL'}</summary><pre>{sql}</pre></details>}
    <details><summary>Audit details{response?.model || details.model ? ' and model' : ''}</summary><dl>
      <dt>Action</dt><dd>{turn.actionType.replaceAll('_', ' ')}</dd><dt>Audit ID</dt><dd>{turn.actionId}</dd>
      {(response?.model || details.model) && <><dt>Model</dt><dd>{response?.model || details.model}</dd></>}
      {(response?.team || details.team) && <><dt>Agent team</dt><dd>{response?.team || details.team}</dd></>}
      {details.conversationId && <><dt>Native conversation</dt><dd>{details.conversationId}</dd></>}
    </dl><pre>{JSON.stringify(details, null, 2)}</pre></details>
    {response && <details><summary>Full saved response JSON</summary><pre>{JSON.stringify(response, null, 2)}</pre></details>}
  </article>;
}

function ConversationDialog({user, action, onClose}) {
  const dialog = useRef(null), body = useRef(null), close = useRef(onClose);
  close.current = onClose;
  const [data, setData] = useState(null), [error, setError] = useState(''), [page, setPage] = useState(null), [retry, setRetry] = useState(0);
  useEffect(() => {
    const element = dialog.current, trigger = document.activeElement, overflow = document.body.style.overflow;
    element.showModal(); document.body.style.overflow = 'hidden';
    return () => {element.close(); document.body.style.overflow = overflow; if (trigger?.isConnected) trigger.focus({preventScroll:true});};
  }, []);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    setData(null); setError('');
    fetch(`/api/agents/actions/${action.ACTION_ID}/thread${page ? `?page=${page}` : ''}`, {headers:{'X-Demo-User':user}, signal:controller.signal})
      .then(async response => {const result = await response.json(); if (!response.ok) throw Error(result.error || 'Conversation unavailable.'); return result;})
      .then(result => {if (active) setData(result);})
      .catch(e => {if (active) setError(e.message);});
    return () => {active = false; controller.abort();};
  }, [user, action.ACTION_ID, page, retry]);
  useEffect(() => {
    if (!data) return;
    const selected = body.current.querySelector(`[data-action-id="${data.selectedActionId}"]`);
    body.current.scrollTop = selected ? selected.offsetTop : 0;
  }, [data]);
  function handleKeys(event) {
    if (event.key === 'Escape') {event.preventDefault(); event.stopPropagation(); close.current(); return;}
    if (event.key !== 'Tab') return;
    const controls = [...dialog.current.querySelectorAll('button:not(:disabled),summary,a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(element => element.getClientRects().length);
    const first = controls[0], last = controls[controls.length - 1], active = document.activeElement;
    if (event.shiftKey && (active === first || !controls.includes(active))) {event.preventDefault(); last?.focus();}
    else if (!event.shiftKey && (active === last || !controls.includes(active))) {event.preventDefault(); first?.focus();}
  }
  return createPortal(<dialog ref={dialog} className="agent-history-dialog" aria-labelledby="agent-history-title" onKeyDownCapture={handleKeys} onCancel={event => {event.preventDefault(); close.current();}}>
    <header><div><small>ORACLE JSON AUDIT TRAIL · READ-ONLY HISTORY</small><h2 id="agent-history-title">Saved conversation</h2><p>{title(action)}</p></div><button autoFocus onClick={onClose}>Close history</button></header>
    <div className="agent-history-context"><span>Demo user: {user}</span><span>Recorded exchanges only · no queries or AI calls are rerun</span></div>
    <div ref={body} className="agent-history-body" aria-busy={!data && !error}>
      {!data && !error && <p role="status">Loading saved conversation…</p>}
      {error && <div role="alert"><p>{error}</p><button onClick={() => setRetry(value => value + 1)}>Retry loading history</button></div>}
      {data && <>{data.turns.some(turn => turn.status === 'limited') && <p className="agent-history-warning">This page includes older entries with limited records. Missing responses cannot be recovered from these audit entries.</p>}
        {data.turns.map(turn => <Exchange key={turn.actionId} turn={turn} selected={turn.actionId === data.selectedActionId}/>)}
      </>}
    </div>
    <footer>{data ? <><span>{data.total} recorded exchange{data.total === 1 ? '' : 's'} · Page {data.page} of {data.pages}</span><nav aria-label="Conversation history pages"><button disabled={data.page === 1} onClick={() => setPage(data.page - 1)}>Earlier exchanges</button><button disabled={data.page === data.pages} onClick={() => setPage(data.page + 1)}>Later exchanges</button></nav></> : <span>Historical snapshots, not current query results.</span>}</footer>
  </dialog>, document.body);
}

export default function AgentAuditTrail({user, revision}) {
  const [actions, setActions] = useState([]), [error, setError] = useState(''), [loading, setLoading] = useState(false), [refresh, setRefresh] = useState(0), [selected, setSelected] = useState(null);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    setLoading(true); setError('');
    fetch('/api/agents/actions', {headers:{'X-Demo-User':user}, signal:controller.signal})
      .then(async response => {const result = await response.json(); if (!response.ok) throw Error(result.error || 'Audit history unavailable.'); return result;})
      .then(result => {if (active) setActions(result);}).catch(e => {if (active) setError(e.message);}).finally(() => {if (active) setLoading(false);});
    return () => {active = false; controller.abort();};
  }, [user, revision, refresh]);
  return <aside className="crime-agent-console__audit agent-history-sidebar"><header><div><small>ORACLE JSON AUDIT TRAIL</small><h3>Recent agent actions</h3><p>Latest eight actions for the active demo user. Select an entry to review its saved conversation.</p></div><button aria-label="Refresh audit history" disabled={loading} onClick={() => setRefresh(value => value + 1)}>↻</button></header>
    {error && <p role="alert">{error}</p>}{loading && !actions.length && <p role="status">Loading audit history…</p>}
    <div>{actions.map(action => <button key={action.ACTION_ID} className="agent-history-entry" aria-haspopup="dialog" aria-label={`View saved conversation: ${title(action)}`} onClick={() => setSelected(action)}>
      <span className="agent-history-entry-icon" aria-hidden="true">↗</span><span><b>{title(action)}</b><small>{date(action.CREATED_AT)}</small><em>{action.ACTION_TYPE.replaceAll('_', ' ')} · {action.HISTORY_STATUS === 'complete' ? 'saved exchange' : action.HISTORY_STATUS === 'failed' ? 'failed request' : 'limited record'}</em></span>
    </button>)}</div>
    {!loading && !error && !actions.length && <p className="crime-agent-console__audit-empty">No actions yet. Run a workflow to create a saved exchange.</p>}
    <footer><b>Conversation history</b><span>New exchanges retain the question and response. Older entries show only the details originally recorded.</span></footer>
    {selected && <ConversationDialog key={`${user}:${selected.ACTION_ID}`} user={user} action={selected} onClose={() => setSelected(null)}/>}
  </aside>;
}
