variable "zone_name" {
  type        = string
  description = "Name of the DNS zone, e.g. salonsaas.org."
}

variable "resource_group_name" {
  type        = string
  description = "Resource group that holds the DNS zone. For coexistence with the live `azure` environment this is that environment's resource group (multi-tenant-salon-dev)."
}
