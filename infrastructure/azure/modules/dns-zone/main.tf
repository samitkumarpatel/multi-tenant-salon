resource "azurerm_dns_zone" "this" {
  name                = var.domain
  resource_group_name = var.resource_group_name
  tags                = var.tags
}

# Generic records — callers pass whatever record types they need
resource "azurerm_dns_a_record" "this" {
  for_each = { for k, v in var.records : k => v if v.type == "A" }

  name                = each.value.name
  zone_name           = azurerm_dns_zone.this.name
  resource_group_name = var.resource_group_name
  ttl                 = lookup(each.value, "ttl", 300)
  records             = each.value.values
}

resource "azurerm_dns_cname_record" "this" {
  for_each = { for k, v in var.records : k => v if v.type == "CNAME" }

  name                = each.value.name
  zone_name           = azurerm_dns_zone.this.name
  resource_group_name = var.resource_group_name
  ttl                 = lookup(each.value, "ttl", 300)
  record              = each.value.values[0]
}

resource "azurerm_dns_txt_record" "this" {
  for_each = { for k, v in var.records : k => v if v.type == "TXT" }

  name                = each.value.name
  zone_name           = azurerm_dns_zone.this.name
  resource_group_name = var.resource_group_name
  ttl                 = lookup(each.value, "ttl", 300)

  dynamic "record" {
    for_each = each.value.values
    content {
      value = record.value
    }
  }
}

resource "azurerm_dns_mx_record" "this" {
  for_each = { for k, v in var.records : k => v if v.type == "MX" }

  name                = each.value.name
  zone_name           = azurerm_dns_zone.this.name
  resource_group_name = var.resource_group_name
  ttl                 = lookup(each.value, "ttl", 300)

  dynamic "record" {
    for_each = each.value.values
    content {
      preference = tonumber(split(" ", record.value)[0])
      exchange   = split(" ", record.value)[1]
    }
  }
}
