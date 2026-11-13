# NByNW fictional POI multimodal search

This iteration loads four generated fictional profiles: George Kaplan, Clara
Thornhill, Eve Kendall, and Philip Vandamm. The original actor photographs in
`case_nbynw/Headshots.zip` are not loaded or embedded.

## What is running

The Person Intelligence page exposes two separate searches:

| Search | Model | Oracle column | Purpose |
|---|---|---|---|
| Visual | `Xenova/clip-vit-base-patch32` | `VECTOR(512, FLOAT32)` | Rank generated test imagery against the four generated reference portraits |
| Narrative | `Xenova/all-MiniLM-L6-v2` | `VECTOR(384, FLOAT32)` | Rank profile narratives against investigator-entered context |

The model runtime is local to the application container. Model files persist in
the `police-transformers-cache` Podman volume. Oracle performs the final ranking
with `VECTOR_DISTANCE(..., COSINE)` after `secure_persons_of_interest_v` applies
the active demo-user scope.

The visual path is generic CLIP image similarity, not facial recognition. It is
restricted to generated fictional test identities and produces candidates for
manual comparison, never an identity finding.

## Core data

- `PERSONS_OF_INTEREST` stores the profile, full narrative, generated portrait
  URI, JSON provenance, and owning patrol area.
- `PERSON_NARRATIVE_EMBEDDINGS` stores one 384-dimensional narrative vector per
  profile.
- `PERSON_VISUAL_EMBEDDINGS` stores reference portraits and future generated
  case images with their 512-dimensional vectors, checksums, captions, and
  asset type.
- `Z_BASE_PERSON_NARRATIVE_VEC` and `Z_BASE_PERSON_VISUAL_VEC` preserve these
  records in every captured dataset profile.

The four generated portraits are served from `frontend/public/poi/nbynw/`.
Their source narratives remain in `case_nbynw/poi_*.txt`.

## Repeatable load

Apply the schema migration, load the four profiles, and rebuild only the app:

```bash
podman exec policeadelaide_db_1 sqlplus -L -s \
  ADELAIDE_CRIME/crime-demo-only@localhost:1521/FREEPDB1 \
  @/workspace/app/db/migrations/20260825_add_multimodal_poi_vectors.sql

TRANSFORMERS_CACHE=/home/opc/.cache/policeAdelaide-transformers \
  npm run load:nbynw-poi

podman compose build app
podman compose up -d --no-deps --force-recreate app
```

Open **Person Intelligence** as `statewide_admin` or
`central_analyst`. Use **Test selected portrait** for a deterministic
first check. George, Eve, Clara, or Philip should rank first when their own
portrait is queried.

For narrative search, begin with a broad clue rather than a name, for example:

> gallery director linked to irregular art transactions and charitable
> foundation payments

George should rank first, with Clara usually the next contextual result.

## Add a future generated case photograph

Only use a photograph of one of the generated fictional identities. Load it as
a controlled case asset:

```bash
TRANSFORMERS_CACHE=/home/opc/.cache/policeAdelaide-transformers \
  npm run load:poi-case-image -- \
  --person-ref POI-NBNW-GEORGE \
  --asset-ref NBNW-GEORGE-CASE-01 \
  --image /absolute/path/to/generated-george-case-photo.png \
  --caption "Generated gallery-entry image retained for comparison" \
  --confirm-generated-fictional
```

The loader copies the image into the mounted POI asset directory, calculates a
CLIP vector, and adds it as `asset_kind='case_image'`. Upload that same image—or
a controlled generated variation—on the Person Intelligence page to compare it
against the reference portraits.

After adding or changing profiles or case images, capture `ADELAIDE_DATA` again
from **Data Foundation** so its current `Z_BASE` snapshot includes the changes.

## Current verified baseline

- 21,513 Adelaide incidents and reports remain unchanged.
- 6 visible statewide POI profiles: 2 service-corridor profiles and 4 NByNW
  profiles.
- 4 NByNW narrative vectors in live tables and `Z_BASE`.
- 4 NByNW visual vectors in live tables and `Z_BASE`.
- Central analyst sees the four NByNW profiles; Northern and Southern analysts
  do not.
