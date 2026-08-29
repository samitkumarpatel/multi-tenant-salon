variable "name" {
  type        = string
  description = "Flexible Server name. Globally unique, 3-63 chars, lowercase letters/numbers/hyphens."
}

variable "resource_group_name" {
  type = string
}

variable "location" {
  type = string
}

variable "database_name" {
  type    = string
  default = "salon"
}

variable "administrator_login" {
  type    = string
  default = "postgres"
}

variable "administrator_password" {
  type      = string
  sensitive = true
}

variable "postgres_version" {
  type    = string
  default = "16"
}

# Burstable B1ms (1 vCore / 2 GiB) is the cheapest Flexible Server tier and is
# the right pick for dev/test. Bump to B_Standard_B2s or GP_Standard_D2s_v3 for
# anything with real load. There is no true "serverless" PostgreSQL on Azure;
# stopping the server (az postgres flexible-server stop) pauses compute billing.
variable "sku_name" {
  type    = string
  default = "B_Standard_B1ms"
}

# 32768 MiB (32 GiB) is the Flexible Server minimum.
variable "storage_mb" {
  type    = number
  default = 32768
}

variable "auto_grow_enabled" {
  type    = bool
  default = false
}

variable "backup_retention_days" {
  type    = number
  default = 7
}

variable "geo_redundant_backup_enabled" {
  type    = bool
  default = false
}

variable "zone" {
  type    = string
  default = "1"
}

# "Allow public access from any Azure service within Azure to this server" — the
# 0.0.0.0 special firewall rule. Container Apps (Consumption) egress from
# Azure-owned IPs that are not individually stable, so this is the pragmatic
# dev/test setting. Tighten with var.firewall_rules for anything sensitive.
variable "allow_azure_services" {
  type    = bool
  default = true
}

# Extra client IP ranges to allow through the firewall (e.g. a workstation, or
# specific Container App egress IPs). name => { start_ip_address, end_ip_address }.
variable "firewall_rules" {
  type = map(object({
    start_ip_address = string
    end_ip_address   = string
  }))
  default = {}
}

variable "tags" {
  type    = map(string)
  default = {}
}
