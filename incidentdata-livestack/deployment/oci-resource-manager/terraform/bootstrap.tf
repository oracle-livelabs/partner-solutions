locals {
  release_sha256 = try(filesha256(var.release_manifest_path), "")
  deployment_id  = random_id.suffix.hex
  participants = {
    operator = { persona = "statewide_admin", operator = true }
    central  = { persona = "central_analyst", operator = false }
    northern = { persona = "northern_analyst", operator = false }
    southern = { persona = "southern_analyst", operator = false }
    viewer   = { persona = "read_only_viewer", operator = false }
  }
  boot_config = {
    region             = var.region
    compartment_ocid   = var.compartment_ocid
    deployment_id      = local.deployment_id
    release_sha256     = local.release_sha256
    release_namespace  = var.release_namespace
    release_bucket     = var.release_bucket
    release_prefix     = var.release_prefix
    status_namespace   = data.oci_objectstorage_namespace.target.namespace
    status_bucket      = oci_objectstorage_bucket.status.name
    status_object      = "${local.deployment_id}/status.json"
    runtime_object     = "${local.deployment_id}/runtime.json"
    credentials_object = "${local.deployment_id}/bootstrap.json"
    credentials_sha256 = sha256(local.bootstrap_payload)
    database_name      = oci_database_autonomous_database.demo.db_name
    apex_url           = oci_database_autonomous_database.demo.connection_urls[0].apex_url
    public_hostname    = var.public_hostname
    genai_region       = var.genai_region
    ollama_image       = var.ollama_image
  }
}
resource "random_password" "schema" {
  length      = 32
  special     = false
  min_upper   = 2
  min_lower   = 2
  min_numeric = 2
}
resource "random_password" "wallet" {
  length      = 32
  special     = false
  min_upper   = 2
  min_lower   = 2
  min_numeric = 2
}
resource "random_password" "participant" {
  for_each    = local.participants
  length      = 24
  special     = false
  min_upper   = 2
  min_lower   = 2
  min_numeric = 2
}
resource "oci_database_autonomous_database_wallet" "demo" {
  autonomous_database_id = oci_database_autonomous_database.demo.id
  password               = random_password.wallet.result
  generate_type          = "SINGLE"
  base64_encode_content  = true
}
# A one-time private object replaces Vault for this short-lived demo.
# Upload uses a write-only PAR; only the new VM may read/delete the object.
# terraform_data does not recreate a retired credential object on later refresh.
locals {
  bootstrap_payload = jsonencode({
    deployment_id   = local.deployment_id
    release_sha256  = local.release_sha256
    admin_password  = random_password.admin.result
    schema_password = random_password.schema.result
    wallet_password = random_password.wallet.result
    wallet_base64   = oci_database_autonomous_database_wallet.demo.content
    dump_password   = var.dump_password
    participants    = [for name, account in local.participants : merge(account, { username = name, password = random_password.participant[name].result })]
  })
}
resource "oci_objectstorage_preauthrequest" "bootstrap_write" {
  namespace    = oci_objectstorage_bucket.status.namespace
  bucket       = oci_objectstorage_bucket.status.name
  name         = "one-time-bootstrap-upload"
  access_type  = "ObjectWrite"
  object       = local.boot_config.credentials_object
  time_expires = timeadd(timestamp(), "3h")
  lifecycle { ignore_changes = [time_expires] }
}
resource "terraform_data" "bootstrap_credentials" {
  triggers_replace = [local.deployment_id, local.release_sha256]
  provisioner "local-exec" {
    command = "python3 '${path.module}/../scripts/upload_bootstrap.py'"
    environment = {
      INCIDENTDATA_BOOTSTRAP_BODY       = sensitive(local.bootstrap_payload)
      INCIDENTDATA_BOOTSTRAP_UPLOAD_URL = sensitive("https://objectstorage.${var.region}.oraclecloud.com${oci_objectstorage_preauthrequest.bootstrap_write.access_uri}")
    }
    quiet = true
  }
}
data "oci_objectstorage_namespace" "target" { compartment_id = var.compartment_ocid }
resource "oci_objectstorage_bucket" "status" {
  compartment_id = var.compartment_ocid
  namespace      = data.oci_objectstorage_namespace.target.namespace
  name           = "incidentdata-status-${local.deployment_id}"
  access_type    = "NoPublicAccess"
  freeform_tags  = local.tags
  depends_on     = [terraform_data.release_gate]
}
resource "oci_objectstorage_object" "status" {
  namespace    = oci_objectstorage_bucket.status.namespace
  bucket       = oci_objectstorage_bucket.status.name
  object       = local.boot_config.status_object
  content_type = "application/json"
  content      = jsonencode({ deployment_id = local.deployment_id, release_sha256 = local.release_sha256, instance_id = "", state = "pending", stage = "pending" })
  lifecycle { ignore_changes = [content] }
}
resource "oci_objectstorage_object" "runtime" {
  namespace    = oci_objectstorage_bucket.status.namespace
  bucket       = oci_objectstorage_bucket.status.name
  object       = local.boot_config.runtime_object
  content_type = "application/json"
  content      = jsonencode({ deployment_id = local.deployment_id, instance_id = oci_core_instance.demo.id, public_ip = oci_core_public_ip.demo.ip_address })
}
resource "oci_identity_policy" "runtime" {
  compartment_id = var.compartment_ocid
  name           = "incidentdata-runtime-${local.deployment_id}"
  description    = "Private release/bootstrap reads, one-object cleanup, scoped status writes and inference"
  # any-user is restricted by the exact authenticated principal ID on every rule.
  # This grants nothing to other users/VMs/ADBs and needs no tenancy-level groups.
  statements = [
    "Allow any-user to use instance-agent-command-execution-family in compartment id ${var.compartment_ocid} where all {request.principal.id = '${oci_core_instance.demo.id}', request.instance.id = target.instance.id}",
    "Allow any-user to read objects in compartment id ${var.compartment_ocid} where all {request.principal.id = '${oci_core_instance.demo.id}', target.bucket.name = '${var.release_bucket}'}",
    "Allow any-user to read objects in compartment id ${var.compartment_ocid} where all {request.principal.id = '${oci_database_autonomous_database.demo.id}', target.bucket.name = '${var.release_bucket}'}",
    "Allow any-user to read objects in compartment id ${var.compartment_ocid} where all {request.principal.id = '${oci_core_instance.demo.id}', target.bucket.name = '${oci_objectstorage_bucket.status.name}', any {target.object.name = '${local.boot_config.runtime_object}', target.object.name = '${local.boot_config.credentials_object}'}}",
    "Allow any-user to manage objects in compartment id ${var.compartment_ocid} where all {request.principal.id = '${oci_core_instance.demo.id}', target.bucket.name = '${oci_objectstorage_bucket.status.name}', target.object.name = '${local.boot_config.status_object}', any {request.permission = 'OBJECT_CREATE', request.permission = 'OBJECT_OVERWRITE'}}",
    "Allow any-user to manage objects in compartment id ${var.compartment_ocid} where all {request.principal.id = '${oci_core_instance.demo.id}', target.bucket.name = '${oci_objectstorage_bucket.status.name}', target.object.name = '${local.boot_config.credentials_object}', request.permission = 'OBJECT_DELETE'}",
    "Allow any-user to use generative-ai-family in compartment id ${var.compartment_ocid} where request.principal.id = '${oci_core_instance.demo.id}'",
    "Allow any-user to use generative-ai-family in compartment id ${var.compartment_ocid} where request.principal.id = '${oci_database_autonomous_database.demo.id}'"
  ]
}
resource "oci_objectstorage_preauthrequest" "status" {
  namespace    = oci_objectstorage_bucket.status.namespace
  bucket       = oci_objectstorage_bucket.status.name
  name         = "read-only-bootstrap-status"
  access_type  = "ObjectRead"
  object       = local.boot_config.status_object
  time_expires = timeadd(timestamp(), "24h")
  lifecycle { ignore_changes = [time_expires] }
}
resource "terraform_data" "readiness" {
  triggers_replace = [oci_core_instance.demo.id, local.release_sha256]
  provisioner "local-exec" {
    command     = "python3 '${path.module}/../scripts/wait_ready.py' --deployment '${local.deployment_id}' --instance '${oci_core_instance.demo.id}' --release '${local.release_sha256}'"
    environment = { INCIDENTDATA_STATUS_URL = "https://objectstorage.${var.region}.oraclecloud.com${oci_objectstorage_preauthrequest.status.access_uri}" }
    quiet       = true
  }
  depends_on = [oci_identity_policy.runtime, oci_objectstorage_object.runtime]
}
output "participant_accounts" {
  value       = [for name, account in local.participants : merge(account, { username = name, password = random_password.participant[name].result })]
  sensitive   = true
  description = "Generated participant accounts for the authorised operator; retrieve only through protected Terraform/Resource Manager outputs."
}
output "deployment_acceptance" { value = terraform_data.readiness.id }
