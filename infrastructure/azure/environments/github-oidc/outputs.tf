output "client_id" {
  description = "AZURE_CLIENT_ID — add to GitHub repository secrets"
  value       = azuread_application.github.client_id
}

output "tenant_id" {
  description = "AZURE_TENANT_ID — add to GitHub repository secrets"
  value       = data.azurerm_subscription.current.tenant_id
}

output "subscription_id" {
  description = "AZURE_SUBSCRIPTION_ID — add to GitHub repository secrets"
  value       = data.azurerm_subscription.current.subscription_id
}
