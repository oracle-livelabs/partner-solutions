# Approved scope — September 20, 2026

User approved: “the scoped map clustering/pagination update and controlled redeployment, keeping Dublin active” with “yes i do”.

Implement reusable read-only saved-profile map aggregation, bounded raw detail markers and record pagination. Preserve existing profiles' default review behavior, restore tiles, permissions, active Dublin data, runtime settings and unrelated application features. Preserve a verified rollback image and source backups. No database DML/DDL, profile activation, Chicago load, mass embedding calls or data-review waiver is included in this app phase.

Use the spatial-address-data-less-congested skill for exact count reconciliation, approximate synthetic-location notices and separation of reference-only records. Do not change incident coordinates. No subagents authorized or used.

Current implementation plan: explicit optional clustered review for existing saved profiles; automatic bounded mode when the stored profile configuration requests it. No profile-code-specific branches. Test on a saved profile larger than Chicago without activating it. Chicago-specific database acceptance remains pending because Chicago is not loaded.
