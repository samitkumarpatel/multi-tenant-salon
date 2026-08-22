output "container_app_environment_id" {
  value = module.environment.id
}

output "fqdns" {
  value = { for k, s in module.services : k => s.fqdn }
}

output "egress_ips" {
  description = "Per-service outbound IPs — add as PostgreSQL/firewall allow-list entries."
  value       = { for k, s in module.services : k => s.egress_ip }
}
