# Batch removal recovery — 14 September 2026

Deployed image: `local/adelaide-crime-intelligence:cdr-removal-fix-20260914` on FU40 port 8706.

The pre-fix `DELETE FROM cdr_workspace_runs WHERE batch_id=:id` left a parallel coordinator and worker deadlocked (ORA-12860). The remaining coordinator also exhausted parallel resources, queuing batch-history reads. Restarting the app alone did not clear the database session. Recovery terminated only the verified stuck CRIME_DATA coordinator, letting Oracle roll back its transaction.

Removal now uses per-statement DISABLE_PARALLEL_DML and NO_PARALLEL hints, locks the batch row before rechecking active jobs, and explicitly rolls back child deletions on failure. No global database parallel settings were changed.

Verification: existing 11 test files passed. A rollback-only live diagnostic executed every deletion successfully. The actual deployed DELETE endpoint then removed the already-selected sample `DR-20260912-38be78f8-7a8c-448a` with HTTP 200. Expected row reductions were checked in all 11 CDR tables: 1 product, 3 tool events, 10 vectors, 4 workspace runs, 2 threads, 10 AI results, 2 AI runs, 1 learning run, 8 items, 7 stages and 1 batch. Live Stack incident, report, evidence and POI counts remained unchanged. The removed batch was absent from the refreshed history.
