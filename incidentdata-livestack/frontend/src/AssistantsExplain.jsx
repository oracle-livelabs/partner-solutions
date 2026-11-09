import React from 'react';
import ExplanationDialog from './ExplanationDialog';

export default function AssistantsExplain() {
  return <ExplanationDialog label="Explain Assistants" title="Assistants explained">
    <p className="brief-explain-lead">Choose Batch Assistant to understand the sources, or Crime Expert Assistant to test explanations. One workspace is shown at a time; switching preserves your drafts. Example questions fill the input without sending. Open the optional investigation board within Crime Expert Assistant when you need it.</p>
    <h3>Batch Assistant: find and understand sources</h3>
    <p>Ask about the selected batch’s saved descriptions, source references and current Batch Brief. It can summarise material, point you to relevant files and flag coverage gaps. It does not freshly read every original or search the wider incident database.</p>
    <p>Questions use Oracle Select AI Chat. The previous five completed turns in the selected conversation provide context. Conversations are saved for the same demo user and can be reopened from Conversation history.</p>
    <h3>Crime Expert Assistant: test explanations</h3>
    <p>Ask for cautious hypotheses, plausible alternatives, counterevidence and source checks that could distinguish explanations. Data Room supplies saved descriptions, the current brief and your saved private investigation board. Board statements and arrows remain analyst proposals.</p>
    <p><strong>Generate first-cut explanation</strong> drafts a possible explanation, reasons it may be wrong and records or tests to consider, then creates a private source-linked board. The board shows readable source cards with no decorative connection lines. Add proposed relationships and use <strong>Save board</strong> to keep your changes. You can also create a source board without running AI.</p>
    <p><strong>Suggest relationships</strong> requests draft connections from Crime Expert Assistant using saved descriptions. Each suggestion includes exact description excerpts, uncertainty, an alternative explanation and a source check. Suggestions are temporary until you add them as proposed relationships and save the board. You can edit or dismiss them first.</p>
    <p>Select a saved relationship to inspect its supporting sources and rationale. Amber means proposed; green means analyst-reviewed. A reviewed relationship needs a review note and still does not establish that the claim is true. Changing its support returns it to proposed.</p>
    <p>Crime Expert Assistant answers and the board are saved privately to your demo user. Each Crime Expert Assistant question is independent: previous Crime Expert Assistant exchanges and unsaved board edits are not automatically supplied. Save edits before asking about the board.</p>
    <h3>Help and status</h3>
    <dl>
      <dt>help</dt><dd>Explains that assistant’s capabilities and offers questions you can ask.</dd>
      <dt>status</dt><dd>Reads current application state. Batch Assistant reports inventory, description coverage, brief readiness and the connections stage. Crime Expert Assistant also reports your private board, its source-version check and saved reply count.</dd>
      <dt>Suggested questions</dt><dd>Use saved batch themes and filenames where available. Choosing one fills and focuses the input; it does not submit the question. Use Send or Ask Crime Expert Assistant when ready.</dd>
    </dl>
    <p>Type help or status in either question box, or use its Help and Status buttons. These commands make no AI call and are not saved as conversation turns. They can explain missing prerequisites before AI questions are available.</p>
    <h3>Readiness and source checks</h3>
    <p>AI questions require a current Batch Brief and an authorised demo user. Help and status retain batch visibility rules. Read-only users can read guidance for visible batches, but cannot run AI questions or save boards.</p>
    <aside className="brief-explain-note"><strong>Answers and proposed explanations remain drafts.</strong><p>Check claims against original sources. Valid source references establish batch membership, not the truth of each statement. A missing detail in a summary is not proof that it is absent from the original. Neither assistant establishes guilt or identifies people from images.</p></aside>
    <h3>Saved work and cleanup</h3>
    <p>Private Crime Expert Assistant conversations are excluded from the Virtual Detective Room output. Batch Assistant also retains the explicit <code>REMOVE BATCH `DR-…`</code> cleanup command, which immediately removes the specified Data Room batch. Help, status and ordinary AI replies do not execute that command.</p>
    <footer>Opening this explanation makes no AI request and changes no batch data.</footer>
  </ExplanationDialog>;
}
