import React from 'react';
import ExplanationDialog from './ExplanationDialog';

export default function FilesExplain() {
  return <ExplanationDialog label="Explain Files" title="Files explained">
    <p className="brief-explain-lead">Review what was loaded and keep the original separate from its AI description.</p>
    <p>Files is the inventory for your selected batch. It lists each ingested file, its type, size and one-line description, with controls to inspect details or download the original.</p>
    <h3>How the file list works</h3>
    <ol className="brief-explain-flow">
      <li><strong>Load and ingest.</strong> ZIP loading stores the original archive and validates its contents. Files appear in the inventory as ingestion saves them.</li>
      <li><strong>Review the inventory.</strong> The initial one-line description is inventory-derived. It is labelled separately from an AI-generated description.</li>
      <li><strong>Run Identify/Describe.</strong> This explicit action sends supported content to OCI GenAI, which creates draft headlines, descriptions and details. Progress shows completed and failed items.</li>
      <li><strong>Inspect and check.</strong> Use Details to review the saved description, supporting excerpts, limitations and provenance. Download the original when you need its full contents.</li>
    </ol>
    <h3>What can be described</h3>
    <dl>
      <dt>TXT, CSV and JSON</dt><dd>Analysis uses the first 24,000 text characters per file. Coverage shows whether the original was only partly analysed. Supporting detail quotes are checked against the supplied text.</dd>
      <dt>JPG/JPEG and PNG</dt><dd>Supported images up to 5 MiB can receive visual descriptions. Observations remain unverified; this step does not identify people or match them to POIs.</dd>
      <dt>MP3 and M4A</dt><dd>Identify/Describe saves a machine transcript, then describes its text for later analysis. Check names, amounts and unclear speech against the recording. A transcript quote is not verification of what was actually said.</dd>
      <dt>MP4</dt><dd>The original video can be downloaded. Video analysis is unavailable; supply a TXT transcript or JPG/PNG stills if you want that material analysed.</dd>
    </dl>
    <h3>Using the controls</h3>
    <dl>
      <dt>Content type</dt><dd>Filters the visible file list. Identify/Describe still acts on the batch, rather than just the filtered rows.</dd>
      <dt>Details</dt><dd>Opens the saved AI description and available source preview. Text previews show up to 6,000 characters. Image, audio and video originals are available through Download.</dd>
      <dt>Download</dt><dd>Retrieves the original file. When an audio transcript is available, Details also provides a separate Download transcript TXT action.</dd>
      <dt>Retry unfinished descriptions</dt><dd>Appears after a failed description run. Check the reported error before retrying. Original files remain unchanged.</dd>
    </dl>
    <aside className="brief-explain-note"><strong>“Described” does not mean verified.</strong><p>An AI headline or description is a draft for review. Exact text-quote checks establish where a quote came from; they do not establish the truth of the source or the AI interpretation. Partial coverage and transcription errors can affect later summaries.</p></aside>
    <h3>Where the descriptions go next</h3>
    <p>Batch Brief brings the saved descriptions together into an overview, themes and review questions. Supported Explore tools can also work directly with their source records. Describing files does not itself establish relationships or change incident records.</p>
    <footer>Opening this explanation makes no AI request and changes no batch data.</footer>
  </ExplanationDialog>;
}
