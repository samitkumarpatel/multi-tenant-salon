# The `salonsaas.org` zone is owned by the live `azure` environment's Terraform
# state (azure/environments/dev). `mix` does NOT create a second zone — that
# would produce a dark, non-delegated duplicate. It reads the existing zone and
# the dns-update stack adds only mix's own `*-m` sub-domain records into it.
# Record resources are tracked in mix's own state, keyed by name, so the two
# environments never fight over the same record.

data "azurerm_dns_zone" "this" {
  name                = var.zone_name
  resource_group_name = var.resource_group_name
}
