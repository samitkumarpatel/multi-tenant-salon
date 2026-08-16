output "accounts" {
  description = "Map of logical app name → storage account details"
  value = {
    for k, v in azurerm_storage_account.this : k => {
      name                 = v.name
      primary_web_endpoint = v.primary_web_endpoint
      primary_web_host     = v.primary_web_host
    }
  }
}
