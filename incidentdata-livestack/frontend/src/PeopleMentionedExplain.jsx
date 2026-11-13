import React from 'react';
import ExplanationDialog from './ExplanationDialog';

export default function PeopleMentionedExplain(){
 return <ExplanationDialog label="Explain People mentioned" title="People mentioned explained">
  <p className="brief-explain-lead">Find people in the source material, then compare their names with the authorised POI register.</p>
  <h3>1. Find source-supported mentions</h3>
  <p>“Find people in material” asks the language model to read this batch’s TXT, CSV and JSON excerpts and saved audio transcripts. It can return named and unnamed people. The application checks supporting quotes against the supplied source text; unsupported details are omitted or flagged.</p>
  <p>Names, ages, gender and roles must be explicitly stated in the supporting text. Images are not used to identify people here. A transcript is machine-generated text and should be checked against its recording.</p>
  <h3>2. Compare names with the POI register</h3>
  <p>The application compares each extracted name with <code>PERSONS_OF_INTEREST.DISPLAY_NAME</code>, the primary alias in <code>ALIAS_NAME</code>, and every additional alias registered in <code>POI_IDENTIFIERS</code> for the active city profile, within your authorised scope.</p>
  <p>Only <em>declared</em> or <em>confirmed</em> registered aliases are used; <em>proposed</em> and <em>rejected</em> entries never match. A registered alias still matches outside its validity period, because the material’s own date is not known: the card shows the recorded period and labels a past alias as historical.</p>
  <p>It normalises case, punctuation and spacing, then requires an exact match of the normalised names. The language model does not choose the POI match.</p>
  <dl>
   <dt>One matching POI</dt><dd>The card shows a possible POI match, with the register name and its existing portrait. “Open register detail” opens the same Person Intelligence register record, with Time, Table and Graph views. It explains why it was opened and highlights the matched registered alias.</dd>
   <dt>Multiple matching POIs</dt><dd>The candidates are listed for review. The application does not choose one automatically.</dd>
   <dt>No matching POI</dt><dd>The source-mentioned person stays on the card without an assigned POI. This does not create a new person record.</dd>
  </dl>
  <h3>Example: Tony Kapoor</h3>
  <dl>
   <dt>Tony Kapoor</dt><dd>Can match the display name.</dd>
   <dt>Skids</dt><dd>Can match the primary alias in <code>ALIAS_NAME</code>.</dd>
   <dt>Tone</dt><dd>An additional alias in <code>POI_IDENTIFIERS</code>; matches, with its review status and recorded period.</dd>
   <dt>Slate Pipit</dt><dd>An earlier registered alias whose period has ended; matches and is labelled “Historical alias”.</dd>
  </dl>
  <h3>How people cards are grouped</h3>
  <p>Mentions with the same normalised name, or names and aliases that uniquely match the same POI, share a card. Under each candidate, the card lists which name or alias matched and in which sources. All supporting source mentions remain available. Unnamed people stay separate; age, gender and generic roles are not used to merge them.</p>
  <aside className="brief-explain-note"><strong>A possible match is not confirmed identity.</strong><p>This section uses name matching, not vector similarity, facial comparison or an AI identity decision. Usernames, email addresses and phone numbers in <code>POI_IDENTIFIERS</code> are not yet matched here. A register portrait is not a face identified in the batch.</p></aside>
  <h3>Coverage and saved work</h3>
  <p>Each run reads up to 24,000 characters per source and 80,000 combined, returning at most 60 source mentions. Review coverage and original sources for omitted or truncated material. Results remain in this workspace until you leave or refresh; download people notes to retain them.</p>
  <footer>Opening this explanation makes no AI request, changes no batch data and does not run POI matching.</footer>
 </ExplanationDialog>;
}
