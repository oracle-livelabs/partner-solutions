variable "tenancy_ocid" {
  type = string
}
variable "compartment_ocid" {
  type = string
}
variable "region" {
  type    = string
  default = "ap-sydney-1"
}
variable "availability_domain" {
  type = string
}
variable "stack_name" {
  type    = string
  default = "incidentdata-walkthrough"
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,23}$", var.stack_name))
    error_message = "Use 3–24 lowercase letters, digits or hyphens, beginning with a letter."
  }
}
variable "ssh_public_key" {
  type = string
  validation {
    condition     = can(regex("^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(256|384|521)) ", var.ssh_public_key))
    error_message = "Supply an SSH public key, never a private key."
  }
}
variable "ssh_ingress_cidr" {
  type    = string
  default = ""
  validation {
    condition     = var.ssh_ingress_cidr == "" || (can(cidrhost(var.ssh_ingress_cidr, 0)) && can(regex("/(2[4-9]|3[0-2])$", var.ssh_ingress_cidr)) && !strcontains(var.ssh_ingress_cidr, ":"))
    error_message = "Leave blank to disable inbound SSH, or use a trusted IPv4 /24 through /32."
  }
}
variable "public_hostname" {
  type    = string
  default = ""
  validation {
    condition     = var.public_hostname == "" || can(regex("^[a-z0-9][a-z0-9.-]+\\.[a-z]{2,}$", var.public_hostname))
    error_message = "Leave blank to use the reserved public IP, or supply a DNS hostname without a scheme, path or port."
  }
}
variable "vm_shape" {
  type    = string
  default = "VM.Standard.E4.Flex"
  validation {
    condition     = contains(["VM.Standard.E4.Flex", "VM.Standard.E5.Flex", "VM.Standard.E6.Flex"], var.vm_shape)
    error_message = "This worker release requires a supported x86_64 flexible shape."
  }
}
variable "vm_ocpus" {
  type    = number
  default = 4
  validation {
    condition     = var.vm_ocpus >= 4 && var.vm_ocpus <= 16
    error_message = "Use 4–16 OCPUs for the full media demo."
  }
}
variable "vm_memory_gbs" {
  type    = number
  default = 32
  validation {
    condition     = var.vm_memory_gbs >= 32 && var.vm_memory_gbs <= 128
    error_message = "Use 32–128 GB RAM for the application and media worker."
  }
}
variable "adb_compute_count" {
  type    = number
  default = 2
  validation {
    condition     = var.adb_compute_count >= 2 && var.adb_compute_count <= 8
    error_message = "Use 2–8 ECPUs for the initial test."
  }
}
variable "adb_storage_gbs" {
  type    = number
  default = 100
}
variable "boot_volume_gbs" {
  type    = number
  default = 100
}
variable "genai_region" {
  type    = string
  default = "us-chicago-1"
}
variable "release_manifest_path" {
  type        = string
  default     = "../release-manifest.json"
  description = "Verified release manifest packaged with the Resource Manager configuration; not a URL or a secret."
}
variable "release_namespace" { type = string }
variable "release_bucket" { type = string }
variable "release_prefix" {
  type = string
  validation {
    condition     = can(regex("^[a-zA-Z0-9][a-zA-Z0-9/_-]+$", var.release_prefix)) && !strcontains(var.release_prefix, "..")
    error_message = "Use a versioned object prefix with safe path characters."
  }
}
variable "dump_password" {
  type      = string
  sensitive = true
  validation {
    condition     = can(regex("^[a-f0-9]{48}$", var.dump_password))
    error_message = "Supply the protected AES export key using a sensitive Resource Manager variable."
  }
}
variable "ollama_image" {
  type        = string
  description = "Verified x86_64 Ollama image pinned by digest."
  validation {
    condition     = can(regex("^docker.io/ollama/ollama@sha256:[a-f0-9]{64}$", var.ollama_image))
    error_message = "Pin the tested Ollama image digest."
  }
}
