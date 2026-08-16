output "resource_group_name" {
  value = var.resource_group_name
}

output "aks_cluster_name" {
  value = module.aks.cluster_name
}

output "kube_config_raw" {
  value     = module.aks.kube_config_raw
  sensitive = true
}

output "postgres_disk_id" {
  description = "Reference this disk ID in your PostgreSQL PersistentVolume manifest"
  value       = module.aks.postgres_disk_id
}

output "postgres_disk_name" {
  value = module.aks.postgres_disk_name
}

output "key_vault_uri" {
  value = module.key_vault.vault_uri
}

output "vnet_id" {
  value = module.vnet.vnet_id
}
