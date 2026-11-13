# Illustrated guides inside IncidentData LiveStack

Deployed 10 October 2026 to fu_edge, application port 8706 (forwarded locally to 18706).

The React app now includes a Workshop & Guides navigation entry, seven illustrated guide cards and a Welcome learning section. Oracle Internals displays a relevant illustration or diagram for each page, with a matching chapter link. Existing SQL examples remain available. Images include captions, alternative text, intrinsic dimensions and full-size links. The library adapts to available width.

The seven chapters cover the introduction, React, Data Room, APEX, Deep Data Security, capabilities and presenter preparation. Prerequisites and pending validation are explicit. A dedicated Graph Lab remains a future update. The visual style is Redwood-inspired and Powtoon-like; these are reusable project assets, not official vendor artwork.

## Source and refresh

Remote application: `/home/opc/livestack/policeAdelaide`.

Components: `frontend/src/WorkshopGuides.jsx`, `workshop-guides.css` and `workshop-visuals.mjs`. Integration points: `main.jsx`, `OracleInternalsPanel.jsx` and `oracle-internals-content.mjs`.

The served static copy lives in `frontend/public/workshop/`. Update the canonical workshop text in this workspace's `docs/workshop/`, regenerate the illustrated HTML in `output/IncidentData-Workshop/`, then copy that public package into the remote `frontend/public/workshop/`. Keep the private instructor source map outside the public copy. Update visual captions or page associations in `workshop-visuals.mjs` as needed. Build the frontend and redeploy the app image to publish changes.

## Verification

Production build passed. Suite: 317/319 passed, with the same two baseline failures in foundation restore profile expectations and setup profile selection. Browser verification confirmed Welcome, the seven-card library, loaded images, a learner guide opening in a new tab and the relationship diagram alongside the existing SQL example. No horizontal overflow at the current 762-pixel viewport. All seven chapter URLs returned HTTP 200. Application and database health returned healthy.

The guide controls serve static files and do not execute SQL, call AI or start data preparation. Live APEX exercises, native DDS enforcement and vector fixture preparation still need their separate workshop validation.

## Deployment and rollback

Image: `localhost/incidentdata-livestack:illustrated-guides-20261010-r3`.

Backup: `/home/opc/livestack/policeAdelaide/.incidentdata-docs-backup-20261010`. It contains previous modified sources, the previous compose file and an inventory of newly added files. Previous running image: `localhost/incidentdata-livestack:branding-20261010-r3`.

For runtime rollback, restore the saved compose file and run the existing environment-preserving redeployment helper. For source rollback, restore the saved source files and remove only the added files listed in the backup inventory. Preserve unrelated changes.
