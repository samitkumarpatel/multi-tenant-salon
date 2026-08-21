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

output "aks_cluster_identity_principal_id" {
  description = "Grant this Network Contributor on the resource group, and Contributor on the postgres disk (see aks_kubelet_identity_object_id too) — needed for the LoadBalancer public IP and CSI disk attach. Only needed manually if the deploying identity lacks Microsoft.Authorization/roleAssignments/write."
  value       = module.aks.cluster_identity_principal_id
}

output "aks_kubelet_identity_object_id" {
  description = "Grant this Contributor on the postgres disk — the kubelet identity needs it to format/mount the disk on the node. Only needed manually if the deploying identity lacks Microsoft.Authorization/roleAssignments/write."
  value       = module.aks.kubelet_identity_object_id
}

output "key_vault_uri" {
  value = module.key_vault.vault_uri
}

output "vnet_id" {
  value = module.vnet.vnet_id
}
