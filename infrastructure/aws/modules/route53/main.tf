resource "aws_route53_record" "this" {
  for_each = var.records

  zone_id = var.zone_id
  name    = each.value.name
  type    = "A"

  alias {
    name                   = each.value.cf_domain
    zone_id                = each.value.cf_zone_id
    evaluate_target_health = false
  }
}
