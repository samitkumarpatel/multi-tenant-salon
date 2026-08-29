output "cname_fqdns" {
  description = "Map of record key → fully-qualified record name for the CNAMEs created."
  value       = { for k, r in azurerm_dns_cname_record.this : k => r.fqdn }
}

output "txt_fqdns" {
  value = { for k, r in azurerm_dns_txt_record.this : k => r.fqdn }
}
