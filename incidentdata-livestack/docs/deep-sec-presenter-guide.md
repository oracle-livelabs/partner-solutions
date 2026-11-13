# Deep Sec ABAC presenter walkthrough

On **Data Foundation**, choose **Deep Sec · ABAC**. The button matches the Vector tile and opens a four-step walkthrough with speaker talk tracks.

1. Explain Attribute-Based Access Control: policies compare user, record and action attributes. Distinguish authentication from authorization.
2. Change a fictional user's area (North, South or Statewide), clearance (Standard or Restricted), role (Reader or Editor), and requested action (Read or Update). The example requires matching area scope, sufficient clearance and an Editor role for updates. Statewide scope does not bypass clearance. Allowed rows have masked contacts unless clearance is Restricted. A fixture panel explains denied decisions; denied records would not appear in a real scoped result.
3. Explain Oracle's trusted end-user context, declarative data grants, row/column/cell controls and configured masking. Optional policy logic is explicitly pseudocode, not deployable Oracle grant syntax.
4. Connect this to IncidentData's database context and secure views. Native DDS grants and context provisioning are a separate deployment step; the demonstration persona selector illustrates scope and is not production authentication.

The example uses invented local fixtures. Controls do not read protected data, change the app persona, modify authorization or execute updates. Close, Finish and Escape return focus to the tile. The guide supports mobile screens and keyboard navigation.

References: [Oracle Deep Data Security overview](https://docs.oracle.com/en/database/oracle/oracle-database/26/ddscg/what-is-oracle-deep-data-security.html), [Data grants](https://docs.oracle.com/en/database/oracle/oracle-database/26/ddscg/data-grants.html), [Security context](https://docs.oracle.com/en/database/oracle/oracle-database/26/ddscg/configure-security-context.html).

Verification: build the frontend, then run `NODE_PATH=/tmp/crimedata-graph-browser.Sdn124/node_modules node scripts/test_deep_sec_presenter_browser.cjs --local`. Omit `--local` for deployed assets. Checks cover area, clearance, action, role, masking, reset, policy logic, mobile layout, focus and closing, matching tile colours and GET-only requests.
