import React, {useState} from 'react';
import AssistantsExplain from './AssistantsExplain';
import {BatchChat} from './BatchWorkspace';
import BatchCrimeExpert from './BatchCrimeExpert';

export default function DataRoomAssistants(props) {
  const [assistant,setAssistant]=useState('batch');
  return <>
    <div className="dr2-assistants-intro"><p className="dr2-help">Two specialisations for the same material. Choose the help you need.</p><AssistantsExplain/></div>
    <div className="dr2-assistant-choices" role="group" aria-label="Choose an assistant">
      <button type="button" aria-pressed={assistant==='batch'} aria-controls="batch-assistant-workspace" onClick={()=>setAssistant('batch')}><strong>Batch Assistant</strong><span>Understand the sources</span><small>Find files, summarise material and check coverage.</small></button>
      <button type="button" aria-pressed={assistant==='expert'} aria-controls="expert-assistant-workspace" onClick={()=>setAssistant('expert')}><strong>Crime Expert Assistant</strong><span>Test explanations</span><small>Compare alternatives, counterevidence and source checks.</small></button>
    </div>
    {!props.batchId&&<p className="cdr-empty">Select a batch to work with either assistant.</p>}
    <section id="batch-assistant-workspace" className="cdr-card" hidden={assistant!=='batch'} aria-label="Batch Assistant workspace"><h2>Batch Assistant</h2><BatchChat enhanced {...props}/></section>
    <section id="expert-assistant-workspace" className="cdr-card" hidden={assistant!=='expert'} aria-label="Crime Expert Assistant workspace"><BatchCrimeExpert enhanced {...props}/></section>
  </>;
}
