# Five fictional network profiles

Registered in the FU40 `CRIME_DATA` application on port 8706 on 12 September 2026.
Open Person Intelligence as `statewide_admin` and select the new profiles.

| Reference | Name | Original JPEG |
| --- | --- | --- |
| POI-FNET-MARA | Mara Vega | mara-vega-portrait-sheet.jpeg |
| POI-FNET-ELIAS | Elias Grant | elias-grant-portrait-sheet.jpeg |
| POI-FNET-NOAH | Noah Kim | noah-kim-portrait-sheet.jpeg |
| POI-FNET-TESSA | Tessa Rowe | tessa-rowe-portrait-sheet.jpeg |
| POI-FNET-DARNELL | Darnell Price | darnell-price-portrait-sheet.jpeg |

The user confirmed that all portraits were generated in ChatGPT and assigned
each name explicitly. The original files remain in `/home/opc/scratch/photos/`;
byte-identical published copies are in `frontend/public/poi/fnet/`. The existing
FU40 bind mount serves these at `/poi/fnet/`. Avoid the word `fictional` in
asset paths because the application's existing presentationCopy middleware
replaces it within API string values, including URLs.

Each profile has the supplied fictional role hypothesis, generated-fictional
metadata and a portrait checksum, a 384-dimensional narrative vector and a
512-dimensional visual vector. Status is `associate`; CENTRAL is the demo
access scope, not an inferred location. No incident or scene relationships
were added. The existing Data Room checksum-based cast links do not
automatically extend to these new portraits or future scene uploads.

Loader: `scripts/load_fictional_network_pois.js`. It requires the existing FU40
environment and `--apply`, validates all five JPEGs, refuses conflicting profile
records, commits together, and reuses a complete matching registration. Run in
the app container after copying the script to `/app/scripts/`:

```sh
podman exec -e TRANSFORMERS_OFFLINE=true policeadelaide_app-fu40_1 \
  node scripts/load_fictional_network_pois.js --apply
```

This is an active-dataset addition; existing Z_BASE snapshots were not replaced.
Restoring another profile may remove these database rows. The source assets and
loader are retained for re-registration.

Verification passed: all five live API profiles expose both vectors; all five
served JPEG checksums equal their source files; narrative search returns Elias
for the supplied finance description; visual search ranks Mara's own supplied
fictional portrait first. A repeated load reused the five profiles without
duplicates. The initial ADB parallel-query error was rolled back; the loader
now disables session parallel query and DML for this small registration.
