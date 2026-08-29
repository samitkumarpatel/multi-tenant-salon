# Record-only stack: adds A / CNAME / TXT / MX records to a DNS zone that already
# exists (created by dns-bootstrapping). Split out from dns-bootstrapping so that
# records whose values are module outputs — Pages hostnames, Container App FQDNs,
# asuid tokens — can be applied after those modules without a dependency cycle.

resource "azurerm_dns_a_record" "this" {
  for_each = { for k, v in var.dns_records : k => v if v.type == "A" }

  name                = each.value.name
  zone_name           = var.zone_name
  resource_group_name = var.resource_group_name
  ttl                 = each.value.ttl
  records             = each.value.values

  depends_on = [var.dns_zone_id]
}

resource "azurerm_dns_cname_record" "this" {
  for_each = { for k, v in var.dns_records : k => v if v.type == "CNAME" }

  name                = each.value.name
  zone_name           = var.zone_name
  resource_group_name = var.resource_group_name
  ttl                 = each.value.ttl
  record              = each.value.values[0]

  depends_on = [var.dns_zone_id]
}

resource "azurerm_dns_txt_record" "this" {
  for_each = { for k, v in var.dns_records : k => v if v.type == "TXT" }

  name                = each.value.name
  zone_name           = var.zone_name
  resource_group_name = var.resource_group_name
  ttl                 = each.value.ttl

  dynamic "record" {
    for_each = each.value.values
    content {
      value = record.value
    }
  }

  depends_on = [var.dns_zone_id]
}

resource "azurerm_dns_mx_record" "this" {
  for_each = { for k, v in var.dns_records : k => v if v.type == "MX" }

  name                = each.value.name
  zone_name           = var.zone_name
  resource_group_name = var.resource_group_name
  ttl                 = each.value.ttl

  dynamic "record" {
    for_each = each.value.values
    content {
      preference = tonumber(split(" ", record.value)[0])
      exchange   = split(" ", record.value)[1]
    }
  }

  depends_on = [var.dns_zone_id]
}
