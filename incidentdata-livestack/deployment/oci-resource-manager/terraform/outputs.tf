output "proposed_application_url" {
  value       = "https://${var.public_hostname != "" ? var.public_hostname : oci_core_public_ip.demo.ip_address}"
  description = "Proposed address only; the foundation draft is not application readiness."
}
output "vm_public_ip" { value = oci_core_public_ip.demo.ip_address }
output "database_id" { value = oci_database_autonomous_database.demo.id }
output "apex_service_urls" {
  value       = oci_database_autonomous_database.demo.connection_urls
  description = "Managed APEX/ORDS service URLs; actual imported application aliases need bootstrap verification."
}
