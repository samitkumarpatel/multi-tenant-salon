output "name_servers" {
  description = "Set these NS records at your registrar to delegate salonsaas.org to Azure DNS"
  value       = module.dns_bootstrapping.name_servers
}

output "aks_cluster_name" {
  value = module.backend.aks_cluster_name
}

output "kube_config_raw" {
  description = "Raw kubeconfig for the AKS cluster — use with KUBECONFIG env var or kubectl --kubeconfig"
  value       = module.backend.kube_config_raw
  sensitive   = true
}

output "nginx_ingress_ip" {
  description = "Static public IP for the nginx ingress controller — pass to --set controller.service.loadBalancerIP"
  value       = module.backend.nginx_ingress_ip
}

output "postgres_disk_id" {
  description = "Reference in your PostgreSQL PersistentVolume manifest"
  value       = module.backend.postgres_disk_id
}

output "aks_cluster_identity_principal_id" {
  description = "Use with `az role assignment create` if the deploying identity can't write role assignments itself (see azurerm_role_assignment.aks_network_contributor / aks_cluster_disk_contributor in stacks/backend)"
  value       = module.backend.aks_cluster_identity_principal_id
}

output "aks_kubelet_identity_object_id" {
  description = "Use with `az role assignment create` if the deploying identity can't write role assignments itself (see azurerm_role_assignment.aks_kubelet_disk_contributor in stacks/backend)"
  value       = module.backend.aks_kubelet_identity_object_id
}

output "key_vault_uri" {
  value = module.backend.key_vault_uri
}

output "cdn_endpoints" {
  description = "Front Door endpoint hostnames (*.z01.azurefd.net) — use these as CNAME targets"
  value       = module.frontend.cdn_endpoints
}

output "custom_domain_validation_tokens" {
  description = "Add each as a DNS TXT record at _dnsauth.<subdomain> to prove domain ownership for Front Door TLS"
  value       = module.frontend.custom_domain_validation_tokens
}
