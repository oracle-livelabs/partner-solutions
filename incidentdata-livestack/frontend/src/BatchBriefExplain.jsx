import React from 'react';
import ExplanationDialog from './ExplanationDialog';

export default function BatchBriefExplain() {
  return <ExplanationDialog label="Explain Batch Brief" title="Batch Brief explained">
        <p className="brief-explain-lead">Understand what you have loaded before exploring its connections.</p>
        <p>The Batch Brief is a saved, source-linked AI overview of the selected batch. It helps you get your bearings and decide what to review next.</p>
        <h3>How the brief is made</h3>
        <ol className="brief-explain-flow">
          <li><strong>Describe the files.</strong> Identify/Describe first saves an AI description of each item. Audio descriptions use an unreviewed machine transcript.</li>
          <li><strong>Bring the descriptions together.</strong> Batch learning uses the saved descriptions. It does not reread the full original documents, images or recordings. Larger batches use shorter summaries per item; every item is included in the input.</li>
          <li><strong>Create a concise overview.</strong> OCI GenAI produces a title, an overview, content themes and questions or gaps for review.</li>
          <li><strong>Check references and save.</strong> The application checks that cited source IDs belong to the batch, then saves the brief and its source-description versions in Oracle Autonomous Database.</li>
        </ol>
        <h3>What you see in the brief</h3>
        <dl><dt>What is in this batch</dt><dd>A short orientation to the supplied material.</dd><dt>Content themes</dt><dd>Topics appearing in the saved descriptions. A shared theme does not establish a relationship.</dd><dt>Questions and gaps to review</dt><dd>Questions raised by the summaries. An omitted detail may still exist in the original file.</dd><dt>Source buttons</dt><dd>Open the exact saved description version cited by a current brief. Review the original file when checking a claim.</dd></dl>
        <aside className="brief-explain-note"><strong>“Brief saved” means generation finished.</strong><p>The result remains an AI draft requiring analyst review. Source checks confirm batch membership; they do not verify the truth of each statement. Errors or omissions in earlier descriptions can carry into the brief.</p></aside>
        <h3>Saved history and refresh</h3>
        <p><strong>Refresh brief</strong> reloads saved content. <strong>Reopen saved brief</strong> reuses the existing result when its inputs and prompt version are unchanged. If descriptions or the brief prompt version change, an older brief is marked out of date. Previous attempts remain available in Brief history.</p>
        <h3>Where it fits</h3>
        <p>The brief provides orientation for Connections and Batch Assistant. Creating it does not add graph links, identify people or change incident records. Connections and private investigation drafting have their own workspaces.</p>
        <p>The workflow is implemented. Its usefulness can still be refined through the prompt, summary preparation and review of representative batches.</p>
        <footer>Opening this explanation makes no AI request and changes no batch data.</footer>
  </ExplanationDialog>;
}
