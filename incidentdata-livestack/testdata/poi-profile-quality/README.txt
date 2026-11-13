POI profile editorial revision, 29 October 2026

30 October 2026: NARRATIVE_TEXT and PROFILE_ATTRIBUTES
20261030-narratives-attributes.json supplies natural case-record narratives and
descriptive JSON fields for the same 17 live people and 180 saved copies across
12 profiles. Narrative claims remain attributed or qualified; no new incident,
person or evidence relationship is created. Alder and Meridian remain
unidentified observation profiles, and care-worker allocation remains distinct
from attendance, account control, message authorship and resident permission.

PROFILE_ATTRIBUTES now includes record context, roles, occupation where known,
review topics, information gaps and assessment status. The verbose root
synthetic_notice was removed, while stable source keys, hashes, evidence refs,
knowledge-set IDs, dataset identifiers, portrait policies, provenance and
generated_fictional flags were preserved. synthetic_record=true explicitly
retains the dataset's nature. Technical identifiers containing historical
scenario names and source filenames were not renamed. narrative_basis and
embedding_text_policy describe the current editorial revision; current text
hashes were recalculated. Previous values remain in the backup.

Existing 15 live and 168 saved narrative vectors were recomputed offline with
Xenova/all-MiniLM-L6-v2, q8, mean pooling and normalization, at 384 dimensions.
Their source hash now refers to the complete current NARRATIVE_TEXT. No vector
was added to a profile lacking one, and visual vectors were unchanged.

Run node scripts/refresh_poi_narratives_attributes.cjs --check to verify the
latest narratives, attributes and bound vectors. --dry-run checks the captured
baseline and rolls back; --apply refuses to overwrite its backup. Generation
inputs and offline vectors are checked before database writes. Full-row
comparisons protect other person fields, identifier assertions, source refs,
technical flags, visual vectors, person/incident links and active-profile state.
Older care/shared-cast loaders may reject the intentionally revised narrative
hashes; do not replay historical loaders to overwrite this editorial revision.

Receipts, before-apply.json (including previous vector values), review CSV and
offline vector inputs: /home/opc/scratch/poi-quality-20261030/.
Live API checks verified all 17 narrative/attribute pairs, four restricted
personas and the new vectors through a bookkeeping query ranking Elias first.

Portrait alt text revision: 20261029-natural-portrait-alt.json removes editorial
wording from PORTRAIT_ALT_TEXT. Descriptions name the reference portrait or
portrait sheet, and explicitly report absent photographs for the four records
without a portrait URI. No physical characteristics were invented.
Use node scripts/refresh_poi_natural_portrait_alt.cjs --check to verify.
Only PORTRAIT_ALT_TEXT changes; summaries, primary aliases, identifiers,
portrait assets, metadata and other person fields remain as they were.
Backup, comparison CSV and receipts are in the natural-portrait-alt subdirectory
of /home/opc/scratch/poi-quality-20261029/.

Latest summary revision: 20261029-natural-summaries.json removes editorial
phrases from NARRATIVE_SUMMARY and uses natural case-record wording while
retaining uncertainty in the underlying accounts. User requested this revision
after the first pack was applied. This supersedes the summary values in
20261029.json; the primary alias and identifier revision still applies.
Use node scripts/refresh_poi_natural_summaries.cjs --check for the latest summaries.
The original refresh_poi_profile_quality.cjs --check expects the superseded
summary wording and will deliberately report that mismatch after this revision.
Latest backup, comparison CSV and receipts are in the natural-summaries
subdirectory of /home/opc/scratch/poi-quality-20261029/.

20261029.json is the curated content pack for the 17 people in the active
Adelaide dataset and their 180 existing saved copies across 12 profiles.
It changes ALIAS_NAME (primary alias) and NARRATIVE_SUMMARY only in the person
registers. Additional aliases use POI_IDENTIFIERS; current alias counts vary
from one to three. Existing single-alias screens and equality matching retain
their primary-alias contract. They do not automatically display or search the
additional identifiers; existing poi-identifiers.match callers can use them.

Aliases are authored fictional scenario labels, not evidence-derived identity
assertions. Summaries condense existing scenario roles and limits. No incident,
case, relationship, original narrative, portrait, embedding or profile metadata
is changed. Other saved people remain outside this revision.

Superseded animal-name aliases from synthetic:city-poi-identifiers:v1:2026-10-20
remain stored with VALID_TO=2026-10-29T00:00:00Z. Their review status, source,
attribution and other fields are preserved. Proposed owner-supplied aliases are
unchanged and remain ineligible for matching. Old v1 loaders asserting an open
validity window will now report a deliberate conflict for superseded aliases;
do not rerun them to recreate or reactivate the older allocation.

Run node scripts/refresh_poi_profile_quality.cjs --check to verify the revision.
--dry-run rehearses the same changes and rolls back. --apply is guarded against
overwriting its before-change backup. The check compares full person rows except
the two edited columns, active-profile state and all existing identifier fields
except the explicitly superseded alias end dates. It checks the exact eligible
alias set for every affected person/profile pair.

Backup, review CSV and dry-run/apply/check receipts:
/home/opc/scratch/poi-quality-20261029/
The before-apply.json backup retains the complete previous person registers and
identifier assertions; it contains no connection secrets.
