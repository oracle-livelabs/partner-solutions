import React from 'react';
import ExplanationDialog from './ExplanationDialog';

export default function ExploreExplain() {
  return <ExplanationDialog label="Explain Explore" title="Explore explained">
    <p className="brief-explain-lead">Choose a focused tool for the material in your batch.</p>
    <p>Explore looks at the selected batch’s file formats, photo inventory and saved analysis metadata to show relevant workspaces. You can use supported tools once ingestion is ready; you do not need to complete the Batch Brief first.</p>
    <h3>How the tiles are chosen</h3>
    <ol className="brief-explain-flow">
      <li><strong>Check the available sources.</strong> The application checks supported format signatures and photo inventory. Discovery does not run a model, query the investigation graphs or automatically analyse the batch.</li>
      <li><strong>Show relevant tools and their status.</strong> A tile can appear for recognised material, a format needing inspection or previously saved analysis. Its counts may describe detected sources or saved results.</li>
      <li><strong>Open a workspace.</strong> Read its coverage notes, then use the available build, map, comparison or review controls. Some actions create saved results or invoke AI; check the workspace’s action before running it.</li>
      <li><strong>Return to your batch.</strong> Close the workspace to return to Explore. Your batch selection stays in place, and tiles refresh to reflect saved work.</li>
    </ol>
    <h3>What each tool does</h3>
    <dl>
      <dt>Money Flows</dt><dd>Explore supported transaction records, transfers between accounts and source-linked routes. The workspace includes graph exploration and a separately invoked AI agent pilot.</dd>
      <dt>Messages</dt><dd>Build a conversation view from supported message records, then explore participants, threads and original exchanges. Supported text conversations can work without photos or AI descriptions. Audio needs saved dialogue from Identify/Describe first.</dd>
      <dt>Travel</dt><dd>Map journeys recorded in supported sources and inspect places, sequence and source records. A recorded journey is not independent proof of someone’s whereabouts.</dd>
      <dt>People mentioned</dt><dd>Use Find people in material to acknowledge named or unnamed people from original text and saved audio transcripts. Neutral avatar cards show only source-stated details and exact excerpts. Mentions are AI drafts, may describe the same person across files and do not create POI records. Results remain in the current workspace; download notes to retain them.</dd>
      <dt>People &amp; Photos</dt><dd>Select a region of a photo, compare it with fictional POI portraits and record a review decision. Photo inventory does not automatically detect people. Similarity scores and accepted demo links do not establish identity.</dd>
    </dl>
    <h3>What the statuses mean</h3>
    <dl>
      <dt>Waiting for ingestion</dt><dd>The batch is still being prepared.</dd>
      <dt>Ready to analyse</dt><dd>Supported material has been recognised; analysis or comparison still needs to be run.</dd>
      <dt>Results available</dt><dd>Saved analysis or comparisons can be reviewed. This does not mean the results have been verified.</dd>
      <dt>Rebuild needed</dt><dd>Sources or an analysis version changed. Rebuild or recompare before relying on older results.</dd>
      <dt>Needs attention</dt><dd>Inspect the warning: a format may need checking, a size limit may apply or an analysis may have failed.</dd>
      <dt>Not recognised</dt><dd>No supported format was recognised for that tool. Discovery and coverage shows the detail, including tools without a tile.</dd>
    </dl>
    <aside className="brief-explain-note"><strong>Check coverage before drawing conclusions.</strong><p>Recognising a format does not validate every record. Missing tiles, skipped files, empty results or unmatched photo regions do not establish that relevant material is absent. Follow source links and review originals when checking a result.</p></aside>
    <h3>Refresh and saved work</h3>
    <p><strong>Refresh tiles</strong> checks availability and saved-result status again. It does not rebuild analyses or run photo comparisons. Use the controls inside each workspace for those actions. Your existing access permissions still apply.</p>
    <footer>Opening this explanation makes no AI request and changes no batch data.</footer>
  </ExplanationDialog>;
}
