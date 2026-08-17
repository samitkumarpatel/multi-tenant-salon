output "zone_id" {
  value = module.dns_zone.zone_id
}

output "zone_name" {
  value = module.dns_zone.zone_name
}

output "name_servers" {
  description = "Set these NS records at your domain registrar to delegate DNS to Azure"
  value       = module.dns_zone.name_servers
}
