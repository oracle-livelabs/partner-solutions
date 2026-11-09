# Full-stack candidate design. The release gate prevents provisioning while
# the application/database/APEX/bootstrap payload is incomplete.
locals {
  tags    = { application = "IncidentData", purpose = "walkthrough-test" }
  release = try(jsondecode(file(var.release_manifest_path)), {})
}
resource "terraform_data" "release_gate" {
  input = local.release
  lifecycle {
    precondition {
      condition     = try(local.release.status == "candidate" && local.release.packaging_verified == true && length(local.release.acceptance_contract_sha256) == 64, false)
      error_message = "Full-stack release is not ready. Complete schema/APEX/media/AI/bootstrap packaging and preflight before provisioning. Build and verify the complete candidate before applying."
    }
  }
}
resource "random_id" "suffix" { byte_length = 3 }
resource "random_password" "admin" {
  length      = 24
  special     = false
  min_upper   = 2
  min_lower   = 2
  min_numeric = 2
}
resource "oci_core_vcn" "demo" {
  compartment_id = var.compartment_ocid
  display_name   = "${var.stack_name}-vcn"
  cidr_blocks    = ["10.86.0.0/16"]
  dns_label      = "incidentdemo"
  freeform_tags  = local.tags
  depends_on     = [terraform_data.release_gate]
}
resource "oci_core_internet_gateway" "demo" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.demo.id
  display_name   = "${var.stack_name}-internet"
}
resource "oci_core_route_table" "demo" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.demo.id
  route_rules {
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
    network_entity_id = oci_core_internet_gateway.demo.id
  }
}
resource "oci_core_security_list" "demo" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.demo.id
  display_name   = "${var.stack_name}-web-only"
  egress_security_rules {
    protocol    = "all"
    destination = "0.0.0.0/0"
  }
  dynamic "ingress_security_rules" {
    for_each = { http = 80, https = 443 }
    content {
      protocol = "6"
      source   = "0.0.0.0/0"
      tcp_options {
        min = ingress_security_rules.value
        max = ingress_security_rules.value
      }
    }
  }
  dynamic "ingress_security_rules" {
    for_each = var.ssh_ingress_cidr == "" ? [] : [var.ssh_ingress_cidr]
    content {
      protocol = "6"
      source   = ingress_security_rules.value
      tcp_options {
        min = 22
        max = 22
      }
    }
  }
}
resource "oci_core_subnet" "demo" {
  compartment_id             = var.compartment_ocid
  vcn_id                     = oci_core_vcn.demo.id
  cidr_block                 = "10.86.10.0/24"
  display_name               = "${var.stack_name}-web"
  dns_label                  = "web"
  route_table_id             = oci_core_route_table.demo.id
  security_list_ids          = [oci_core_security_list.demo.id]
  prohibit_public_ip_on_vnic = false
}
data "oci_core_images" "oracle_linux" {
  compartment_id           = var.compartment_ocid
  operating_system         = "Oracle Linux"
  operating_system_version = "9"
  shape                    = var.vm_shape
  sort_by                  = "TIMECREATED"
  sort_order               = "DESC"
}
resource "oci_database_autonomous_database" "demo" {
  compartment_id                      = var.compartment_ocid
  display_name                        = "${var.stack_name}-adb"
  db_name                             = "ID${upper(random_id.suffix.hex)}"
  db_workload                         = "OLTP"
  db_version                          = "23ai" # OCI API value for the audited 26ai source release
  compute_model                       = "ECPU"
  compute_count                       = var.adb_compute_count
  data_storage_size_in_gb             = var.adb_storage_gbs
  admin_password                      = random_password.admin.result
  license_model                       = "LICENSE_INCLUDED"
  is_free_tier                        = false
  is_auto_scaling_enabled             = false
  is_auto_scaling_for_storage_enabled = false
  is_mtls_connection_required         = true
  # Public managed APEX also makes the database network endpoint public.
  # SQL still requires mTLS + database credentials. Do not call this a private DB.
  whitelisted_ips = ["0.0.0.0/0"]
  freeform_tags   = local.tags
  depends_on      = [terraform_data.release_gate]
}
resource "oci_core_instance" "demo" {
  compartment_id       = var.compartment_ocid
  availability_domain  = var.availability_domain
  display_name         = "${var.stack_name}-vm"
  preserve_boot_volume = false
  shape                = var.vm_shape
  shape_config {
    ocpus         = var.vm_ocpus
    memory_in_gbs = var.vm_memory_gbs
  }
  create_vnic_details {
    subnet_id        = oci_core_subnet.demo.id
    assign_public_ip = false
    hostname_label   = "incidentdata"
  }
  source_details {
    source_type             = "image"
    source_id               = data.oci_core_images.oracle_linux.images[0].id
    boot_volume_size_in_gbs = var.boot_volume_gbs
    boot_volume_vpus_per_gb = 10
  }
  metadata = {
    ssh_authorized_keys = var.ssh_public_key
    user_data = base64gzip(templatefile("${path.module}/../bootstrap/firstboot.sh.tftpl", {
      config_json      = jsonencode(local.boot_config)
      installer_base64 = filebase64("${path.module}/../bootstrap/install.py")
    }))
  }
  lifecycle {
    precondition {
      condition = length(base64encode(jsonencode({
        ssh_authorized_keys = var.ssh_public_key
        user_data = base64gzip(templatefile("${path.module}/../bootstrap/firstboot.sh.tftpl", {
          config_json      = jsonencode(local.boot_config)
          installer_base64 = filebase64("${path.module}/../bootstrap/install.py")
        }))
      }))) * 3 / 4 < 32000
      error_message = "Rendered VM metadata exceeds OCI's 32000-byte launch limit."
    }
  }
  depends_on    = [oci_objectstorage_object.status, terraform_data.bootstrap_credentials]
  freeform_tags = local.tags
}

# A reserved address supports a stable IP-based walkthrough URL and IP certificate.
data "oci_core_vnic_attachments" "demo" {
  compartment_id = var.compartment_ocid
  instance_id    = oci_core_instance.demo.id
}
data "oci_core_private_ips" "demo" {
  vnic_id = data.oci_core_vnic_attachments.demo.vnic_attachments[0].vnic_id
}
resource "oci_core_public_ip" "demo" {
  compartment_id = var.compartment_ocid
  display_name   = "${var.stack_name}-public-ip"
  lifetime       = "RESERVED"
  private_ip_id  = data.oci_core_private_ips.demo.private_ips[0].id
  freeform_tags  = local.tags
}
