# Adelaide art-market graph investigation

`CASE-2026-0421` is a second, deliberately subtle relationship-graph exercise.
It recuts eight existing Adelaide fraud reports and therefore leaves the active
dataset at exactly **21,513 incidents**. All identities, images, documents,
payments, and relationships are fictional teaching data.

## What was planted

The reports do not announce a common series. Four document markers occur in
different contexts:

| Marker | First context | Comparator |
|---|---|---|
| `AR-17` | West Croydon advisory invoice | Prospect consultancy invoices |
| `OE-24` | North Adelaide retail refund | North Adelaide grant instruction |
| `P-441` | Ovingham provenance record | Norwood sponsorship note |
| `DS-8` | Dudley Park shipment insurance | Norwood sponsorship note |

Four generated scene images add public-setting context without claiming that
any person committed, witnessed, or knew about an offence:

- George Kaplan and Eve Kendall at a cafe
- Clara Thornhill and Philip Vandamm in a shopping precinct
- George Kaplan and Clara Thornhill at a theatre entrance
- Eve Kendall and Philip Vandamm in an art gallery

## Investigator walkthrough

1. Open **Case Relationships** and search for `art-market`.
2. Select `CASE-2026-0421` and begin at **1 hop**. Read the eight one-line
   report titles; they look like separate payment and document reports.
3. Move to **2 hops**. Follow the evidence nodes and compare their shared
   markers. Open a scene-image evidence node to see the generated image.
4. Follow person edges and read each relationship summary. The wording states
   why the edge exists and what it does not prove.
5. Move to **3 hops**. The similarity edges expose repeated references and
   create bridges across invoice, ledger, provenance, and consignment reports.
6. Open **Person Intelligence**. Try the narrative query `art gallery
   transactions charitable foundation and connected entities`.
7. Upload one of the four scene images from
   `frontend/public/poi/nbynw/case-images/`. Visual search compares the scene
   with the four generated reference portraits and returns candidates for
   manual review; it is not a biometric or identity finding.

The terminal version of the same trail is
[`db/tutorial/04_adelaide_art_market_walkthrough.sql`](../db/tutorial/04_adelaide_art_market_walkthrough.sql).

## Repeatable load

Run the relational case loader in SQL*Plus with `APPLY` as its first argument:

```text
@db/demo/17_add_adelaide_art_market_graph_case.sql APPLY
```

Then create the eight POI-to-scene vector associations from the four unique
generated images:

```bash
npm run load:nbynw-case-images -- --confirm-generated-fictional
```

Both loaders are idempotent. The image loader embeds each unique scene once,
then associates the vector with the two fictional people shown in that scene.

## Safety and interpretation

- Street addresses remain synthetic and masked; reports use only broad place
  context.
- A shared code, visual similarity, person edge, or graph path is a comparison
  lead—not proof of identity, presence, causation, or responsibility.
- Scene images were generated specifically for this project and are not
  photographs of real people.

