# JSON duality presenter walkthrough

On **Data Foundation**, choose **JSON duality views**. The button matches the Vector tile and opens a four-step walkthrough with speaker talk tracks.

1. Explain relational rows, JSON objects and arrays, and two representations of the same underlying data.
2. Change an invented incident status through either the table or JSON controls. Both representations update together. A linked report appears as a row and a nested array. Reset returns the example to Open.
3. Explain Oracle's table-to-document mapping, read-only defaults, explicit update annotations and ETAG checks. The optional SQL shows a simple status-updatable view over an assumed teaching table.
4. Discuss how incident/report records could be grouped for a screen while tables support reporting. Existing JSON endpoints or uploaded files do not themselves demonstrate a native duality view.

This is local teaching content. Controls simulate changes without database writes. The example JSON omits Oracle-managed metadata. Next/Back and numbered buttons navigate the guide; Close, Finish and Escape restore tile focus. The layout supports mobile screens.

References: [Oracle duality view definition](https://docs.oracle.com/en/database/oracle/oracle-database/26/sqlrf/create-json-relational-duality-view.html), [Optimistic concurrency and ETAGs](https://docs.oracle.com/en/database/oracle/oracle-database/26/jsnvu/using-optimistic-concurrency-control-duality-views.html).

Verification: build the frontend, then run `NODE_PATH=/tmp/crimedata-graph-browser.Sdn124/node_modules node scripts/test_json_duality_presenter_browser.cjs --local`. Omit `--local` for deployed assets. Checks cover both update directions, reset, optional SQL, mobile, keyboard focus, closing, tile colours and read-only requests.
