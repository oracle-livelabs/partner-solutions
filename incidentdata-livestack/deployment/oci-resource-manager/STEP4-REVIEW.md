# Step 4 — destination Plan and cost review

**Review complete; deployment is not cleared for Apply.** A local Terraform **1.5.7** Plan against OCI Sydney succeeded with **27 additions, zero changes and zero deletions**. This is the runtime currently listed for Oracle Resource Manager. No Resource Manager Stack/Job, release bucket, new ADB or new VM was created. No Apply or artifact publication ran.

The raw saved Plan, its JSON and input variables remain in ignored, access-restricted `artifacts/step4-plan/`; they can contain secrets and must not be committed. A sanitised review is in `inventory/step4-plan.json`. The release ZIP and private artifacts are indexed separately in `inventory/package.json` and `inventory/artifact-index.json`.

## Concrete proposed deployment

Destination: **apacanzset03 / franco_ucci_sandbox / ap-sydney-1**, availability domain **UEYk:AP-SYDNEY-1-AD-1**. The Plan starts from an empty managed-resource state; its existing OCI reads are platform image/namespace discovery. It neither imports nor changes the existing FU40/FU30 databases or VMs.

| Component | Proposed setting |
| --- | --- |
| VM | New E4 Flex, 4 OCPUs, 32 GB RAM, Oracle Linux 9, 100 GB balanced boot disk |
| ADB | New OLTP, 2 ECPUs, 100 GB, licence included; compute/storage autoscaling off |
| React | Reserved public IP, public HTTPS, fixed participant accounts |
| APEX | Oracle-managed public HTTPS; three imported apps using Oracle APEX Accounts |
| SQL endpoint | Public, with mandatory mTLS and database credentials |
| Network | New VCN/subnet/IGW/routes; inbound TCP 80/443 only in this Plan |
| SSH | Existing two authorised public keys reused; inbound SSH disabled while the operator supplies an IPv4/CIDR |
| Bootstrap storage | New private status bucket and encrypted wallet object; release bucket published separately only after approval |
| Credentials | Temporary private credential/wallet object, read/deleted by VM identity after acceptance; no Vault/key/secret |
| Runtime IAM | Resource-specific principal conditions and one seven-statement policy |
| GenAI | Chicago service region for source-parity models; infrastructure stays in Sydney |

The 27 additions include provider-managed infrastructure and wallet/object resources, generated random values and Terraform readiness gates. They are not 27 billable servers/services. Publication adds a separate private, versioned release bucket and the allowlisted artifacts. The Plan's source image is captured in its saved binary; `inventory/step4-plan.json` records its name and identifier hash.

## Capacity and permissions findings

The capacity-report API reported **AVAILABLE** for E4 Flex 4 OCPUs / 32 GB. Remaining quotas reported **20 ATP ECPUs** (2 needed), **17 reserved public IPs** (1 needed), **14 VCNs** (1 needed), approximately **86,751 GB boot/block storage** (100 GB needed), and sufficient Object Storage bucket/secret count capacity. These are observations at check time, not reservations or guarantees of successful provisioning.

**Vault blocker removed by design:** the owner approved a short-lived demo without Vault. The updated Plan creates no Vault, key or Vault secret. A write-only, single-object upload PAR lasts three hours; only the new VM identity can read/delete the private credential object. The VM validates its checksum and deployment/release binding, keeps a root-only recovery cache and deletes the cloud object after successful acceptance. Terraform's one-time publisher does not recreate it during a normal refresh/reapply. Protected Terraform state and VM runtime/recovery files remain sensitive. The original 20/20 Vault observation is retained as historical evidence, not a current deployment requirement.

Additional checks before Apply:

- The tenancy has **200 active dynamic groups**. The revised design creates none: every policy statement checks the exact new VM/ADB principal ID. A sandbox policy creation/deletion probe passed in Sydney, removing the tenancy-level group dependency.
- Read probes for policies, dynamic groups, Vaults and buckets succeeded. A successful read-only Plan does **not** establish all create permissions. Review the deploying identity's ability to create the listed resources, particularly sandbox IAM policies. No simple broad tenancy grant matched the current API user's memberships in the limited policy review; this is not proof that required granular permissions are absent. Resource Manager's eventual execution identity has not been exercised.
- Confirm the operator's public IPv4/CIDR if inbound SSH is wanted. Blank means no inbound SSH; it does not create a placeholder public allow rule.
- The owner approved **USD 20** for a few-hour first test, followed by deletion of its new resources. A six-hour cleanup timer is the fallback; this budget is not an instant billing cap.

## Refreshed cost estimate

The refreshed [Oracle USD product price list](https://apexapps.oracle.com/pls/apex/cetools/api/v1/products/?currencyCode=USD) remains dated 8 October 2026. Quantities match this Plan. Paid marginal storage tiers are used conservatively because the tenancy shares its free allowances.

| Base cost | USD |
| --- | ---: |
| VM + ADB compute, per running hour | 0.82 |
| ADB/boot performance/storage + 25 GB object-storage allowance, per month | 24.42 |
| 24-hour day, with prorated storage | **20.48** |
| Seven days continuously running | **143.38** |
| 730 hours | **623.02** |

No Vault, KMS key or Vault secret is requested, so Vault/secret costs and the exhausted Vault quota do not apply to this design.

The figures exclude variable GenAI requests, extra backups, network/request charges, taxes and tenancy-specific discounts. They are an estimate, **not a spending cap**. Storage/publication retention and any scheduled deletion resources must be checked after the test. No private HSM Vault, load balancer, custom domain or dedicated AI cluster is in this Plan.

## Next action

Run the isolated first test within the approved USD 20 planning budget, with SSH disabled unless an operator CIDR is supplied. Then regenerate and review the final Plan against the final package and any revised inputs, publish the approved private release, create the Resource Manager Stack using **Terraform 1.5.x**, and run its own Plan job before any Apply. The local saved Plan is not a Resource Manager job and is not transferable as a service-side approval.

The approval decision must explicitly cover public React/APEX access, the public mTLS SQL endpoint, Chicago model inference, new resource scope, variable usage charges and retention. After Apply, Step 6 must still prove fresh schema restore, all nine cities, APEX account scope, native/direct AI, Detective Room/video, external browser access and certificate renewal.

References: [supported Resource Manager Terraform versions](https://docs.oracle.com/en-us/iaas/Content/ResourceManager/Reference/terraformversions.htm), [OCI default service limits](https://docs.oracle.com/en-us/iaas/Content/General/service-limits/default.htm), [Always Free Vault allowance](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm).
