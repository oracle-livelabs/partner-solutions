# Ask IncidentData V2 long-text result fix

15 September 2026 · FU40 only · port 8706.

The question `show me the last 5 incidents in norwood, including report summary and narrative` previously executed successfully in Oracle but failed while formatting the HTTP response. `REPORT_TEXT` is a CLOB; the default fetch returned a driver Lob object. The application's recursive presentation formatter traversed that object's internal references and raised `Maximum call stack size exceeded`.

`backend/ask-crime-v2-results.js` now fetches CLOB and NCLOB result columns as strings, using a per-execution `fetchTypeHandler`. Both the initial query and the one permitted SQL-correction retry use this helper. Conversion follows database column types, not model-generated aliases, and finishes before the connection is released. It does not truncate text with `DBMS_LOB.SUBSTR` or alter global fetch settings.

The query wrapper includes an Ask IncidentData V2 comment to separate its text-fetch statements from default-LOB statements in the driver cache. A read-only check on the installed node-oracledb 6.10.0 reproduced a conversion issue when switching the same cached statement from default LOB fetching to string fetching. The dedicated wrapper and repeated typed executions passed.

SQL validation, approved views, active user scope, the 100-row ceiling, audit logging, the Select AI profile/model, and all Data Room agents are unchanged. No database migration or data reload is required.

## Verification

- `npm test`: all 17 test files pass. The new test file contains seven checks, including initial execution, SQL retry, long text, nulls, dates/JSON, empty results, validation rejection, and bounded failure handling.
- `npm run build`: passes; the existing main-bundle size warning remains.
- `scripts/check_ask_crime_v2_results.js`: read-only Oracle checks pass for CLOB, NCLOB, null/empty values, aliases, three cached executions, 46,500-character text, and all five Norwood narrative lengths against `DBMS_LOB.GETLENGTH`.
- `scripts/test_ask_crime_v2_browser.cjs`: the exact user question returns HTTP 200 and five displayed rows, with summaries and narrative lengths 344, 264, 290, 281 and 316 characters. Observed response time: 7,408 ms; no browser errors. This test invokes native Select AI once and creates the normal query audit entry.
- `scripts/test_suga_explorer_browser.cjs`: existing Money Flows and Messages tiles, lazy loading, retained filters, keyboard focus, dialog closing and mobile widths pass without starting analysis or producing browser errors.

The live Oracle script is a direct executor check; its DUAL fixtures do not change the public route's approved SQL scope.

## Deployment

Image: `local/adelaide-crime-intelligence:ask-v2-clob-fix-20260915`.

Image SHA: `89c7ce7c4208fd4eec390cbbe2bc35cfb132397270285668640e6c26294ecea7`.

Only `app-fu40` was recreated after all five Data Room active-work counts were zero. Health passed after restart. The previous `cdr-people-photos-v1-20260915` image remains available for rollback. Rollback would restore the earlier Ask IncidentData V2 bug; retain the current image unless there is a separate regression.

To retest manually, refresh Ask IncidentData, open **Ask IncidentData V2**, and submit the exact Norwood question above. Expect five rows containing report summaries and narratives, and no red error message.

Driver reference: [node-oracledb query fetch type handlers](https://node-oracledb.readthedocs.io/en/v6.10.0/user_guide/sql_execution.html#fetch-type-handlers).
