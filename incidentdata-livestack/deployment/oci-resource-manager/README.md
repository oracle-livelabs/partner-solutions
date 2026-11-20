# IncidentData OCI Resource Manager deployment

**Step 4 review complete: the short-lived demo uses temporary private bootstrap credentials; no Vault required. Destination provisioning and public walkthrough testing have not run.**

This deployment branch preserves the original milestone/main and running FU40 application. It prepares an independent new ADB and VM in **apacanzset03 / franco_ucci_sandbox / ap-sydney-1**, including React/API, three APEX apps, nine synthetic city profiles, native AI/agents, local Ollama and Detective Room narration/video.

| Step | Status |
| --- | --- |
| 1. Deployment branch | Complete: `deployment/oci-resource-manager` |
| 2. Read-only inventory | Complete: source/runtime/APEX/AI/destination reports in `inventory/` |
| 3. Package full stack | Complete local candidate: 33 checksum-verified artifacts (~5.8 GB) and a 23 KB Resource Manager ZIP; see `inventory/package.json` |
| 4. Validate and review Plan | Complete local OCI Plan: 27 adds / 0 changes / 0 deletes. **No Vault required; direct-principal IAM probe passes; USD 20 first-test budget approved**; see [STEP4-REVIEW.md](STEP4-REVIEW.md). |
| 5. Provision new resources | Not started; requires reviewed Plan and explicit cost approval |
| 6. Public walkthrough | Not started; fresh restore, AI/media, APEX browser and certificate renewal acceptance required |

Read [RUNBOOK.md](RUNBOOK.md) for preparation, private publication, Resource Manager working directory, Plan/Apply, monitoring, participant access and cleanup. [acceptance-contract.json](acceptance-contract.json) separates automated destination checks from the final human walkthrough.

The default React address is **`https://<reserved-public-IP>`**; no custom domain is required. Caddy uses an explicit ACME issuer and the short-lived IP-certificate profile. Its configuration validates locally, but real issuance/renewal must pass on the new destination. APEX uses Oracle's managed HTTPS address with fresh Oracle APEX Accounts. See [Let's Encrypt IP certificate availability](https://letsencrypt.org/2026/01/15/6day-and-ip-general-availability) and [Caddy TLS configuration](https://caddyserver.com/docs/caddyfile/directives/tls).

The ADB endpoint is **public**, with mandatory mTLS and database credentials, to provide managed public APEX access. This candidate does not provide a private SQL endpoint. Only HTTP/HTTPS and operator-limited SSH are allowed into the VM. The API/Ollama bind to loopback. Public React accounts have server-enforced personas; a supplied `X-Demo-User` cannot grant additional privileges. Development mode retains its existing persona chooser.

Source inventory: 122 CRIME_DATA tables, five graphs, three APEX apps, four AI profiles, 14 native tools and six agents/tasks/teams. The nine profiles hold 143 person/city records and 875 identifier assertions, with six active watches each. The OCI API database version is `23ai`; the audited source banner identifies the current product as Oracle AI Database 26ai (23.26.4.1.0). Chicago remains a separate AI-service-region setting because Sydney did not list all source-parity models. Listing models is not proof of working inference.

Private staging includes an AES-256 password-encrypted schema export, APEX definitions, AI configuration, current fictional associations, voice models and version-pinned SQLcl. Private conversations, telemetry history, access keys, source credentials, APEX developer passwords and scheduler argument helper tables are excluded. Scheduler/native-AI configuration is reconstructed using fresh runtime identities. Hashes and audit receipts are reviewable in `inventory/`; large data, keys, wallets and credentials remain ignored by Git. No artifacts have been uploaded to cloud storage.

`bootstrap/` implements fresh-target identity guards, guarded schema import, AI reconstruction, authenticated APEX import, participant accounts, services, public HTTPS and destination acceptance. The installer reads a checksum-verified credential/wallet object through its VM identity and deletes it after successful acceptance. A write-only three-hour upload token is held only by Terraform; root-only recovery/runtime files and protected state retain necessary secrets. Terraform grants runtime access only to the newly created resource identities and waits for a release/instance-bound status callback. A running VM alone cannot satisfy readiness.

`scripts/build_release.py` creates the private payload manifest and small Resource Manager ZIP from a committed code snapshot, requiring a passed current export audit and local validation receipt. The manifest says **candidate**, with destination restore/bootstrap testing explicitly false. `scripts/publish_release.py` defaults to a local publication plan; `--publish` is reserved for the approved deployment. Terraform refuses an incomplete manifest. Use the ZIP's **`terraform` working directory**.

Preliminary sizing is E4 Flex 4 OCPUs/32 GB, ADB 2 ECPUs/100 GB and 100 GB boot disk. The current [Oracle price worksheet](inventory/cost-estimate.json) estimates **USD 20.48/day / USD 623.02 per 730 hours**, excluding GenAI, additional backups, requests/egress, taxes and tenancy discounts. Refresh this estimate for the full actual Plan, including storage and retention. **USD 20 is approved for the first few-hour test with teardown afterwards. No Terraform Apply has run yet.**

Local validation passes: 57 application test files, frontend production build, seven Python bootstrap tests, Terraform validation, both isolated images, network-disabled browser/image/speech/FFmpeg probes and Oracle Resource Manager meta-schema validation. The extracted Resource Manager ZIP also validates. The destination remains untested.
