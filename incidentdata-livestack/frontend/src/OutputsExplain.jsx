import React from 'react';
import ExplanationDialog from './ExplanationDialog';

export default function OutputsExplain() {
  return <ExplanationDialog label="Explain Outputs" title="Outputs explained">
    <p className="brief-explain-lead">Turn a batch into a source-linked room, video briefing and portable package.</p>
    <p>Virtual Detective Room &amp; Video Briefing creates a saved presentation of the selected synthetic batch. It combines an evidence room with a narrated case overview and original-source exhibits.</p>
    <h3>How generation works</h3>
    <ol className="brief-explain-flow">
      <li><strong>Check the batch.</strong> The inventory must be ready, required transcripts must be available and the media worker must be running. Any preparation issue appears above the Generate button.</li>
      <li><strong>Generate explicitly.</strong> Generate room &amp; briefing queues a background job. It uses the original batch archive and applicable saved transcripts, rather than private Ask Detective conversations or the Batch Brief as its source input.</li>
      <li><strong>Build and check the output.</strong> The worker checks the archive against its saved file inventory, prepares source-linked material, uses AI to author the overview, then builds the room, narrated video, captions and package. Publication checks must pass before the new run becomes available.</li>
      <li><strong>Return when ready.</strong> Allow around 10 minutes; larger batches may take longer. The displayed stage reports progress. You can leave this page while the job continues.</li>
    </ol>
    <h3>Using the three output tiles</h3>
    <dl>
      <dt>Generate</dt><dd>Starts a new room and briefing when preparation and permissions allow. Once a completed room exists, the button becomes Regenerate room &amp; briefing. Generation can invoke AI and media processing.</dd>
      <dt>Access</dt><dd>Open Virtual Detective Room opens the last successfully completed room in a new browser tab. Allow pop-ups for this app if prompted. The room contains exhibits and links into the video briefing.</dd>
      <dt>Download</dt><dd>Download Virtual Detective Room ZIP retrieves a portable snapshot containing the room, MP4, narration, captions, transcript, supporting files and original evidence. Extract the whole ZIP and keep its folder structure together to use it offline.</dd>
    </dl>
    <h3>Versions, freshness and availability</h3>
    <p>A completed room is a snapshot; it does not update live as the batch changes. If the source, saved transcripts or generation engine changes, the page can flag the output for regeneration.</p>
    <p>The previous completed room remains accessible while a replacement is generated. A failed new run shows an error rather than replacing the last successful output. If the media worker is unavailable, existing completed rooms remain accessible.</p>
    <aside className="brief-explain-note"><strong>A published output still requires analyst review.</strong><p>Publication checks cover the generated package; they do not establish the truth of every AI statement or association. Review claims against original sources. This is synthetic training material, with no finding of guilt or facial identification. Private Ask Detective conversations are excluded.</p></aside>
    <h3>Hosted access and downloaded copies</h3>
    <p>Hosted access is checked against your demo-user context and batch visibility. A downloaded copy is outside the app’s access controls and does not receive later updates. Keep this in mind when storing or sharing a package.</p>
    <h3>How this differs from the saved review pack</h3>
    <p><strong>Brief &amp; Connections</strong> provides a separate versioned review pack: review JSON, source manifest, connections CSV and timeline CSV. The Outputs section links back to those downloads. The Virtual Detective Room adds the visual room and narrated media package; generating it is a separate action.</p>
    <footer>Opening this explanation makes no AI request, starts no generation job and changes no batch data.</footer>
  </ExplanationDialog>;
}
