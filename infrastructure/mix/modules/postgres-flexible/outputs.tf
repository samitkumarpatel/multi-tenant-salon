output "id" {
  value = azurerm_postgresql_flexible_server.this.id
}

output "server_name" {
  value = azurerm_postgresql_flexible_server.this.name
}

output "fqdn" {
  value = azurerm_postgresql_flexible_server.this.fqdn
}

output "database_name" {
  value = azurerm_postgresql_flexible_server_database.this.name
}

output "administrator_login" {
  value = azurerm_postgresql_flexible_server.this.administrator_login
}

# Flexible Server enforces TLS (require_secure_transport = on) by default.
# sslmode=require encrypts without needing the CA bundle on the client.
output "jdbc_url" {
  value = "jdbc:postgresql://${azurerm_postgresql_flexible_server.this.fqdn}:5432/${azurerm_postgresql_flexible_server_database.this.name}?sslmode=require"
}
