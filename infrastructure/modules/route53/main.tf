# my-saloon.online → CloudFront Distribution #1
resource "aws_route53_record" "apex" {
  zone_id = var.zone_id
  name    = var.domain
  type    = "A"

  alias {
    name                   = var.cf_main_domain
    zone_id                = var.cf_main_zone_id
    evaluate_target_health = false
  }
}

# www.my-saloon.online → same distribution
resource "aws_route53_record" "www" {
  zone_id = var.zone_id
  name    = "www.${var.domain}"
  type    = "A"

  alias {
    name                   = var.cf_main_domain
    zone_id                = var.cf_main_zone_id
    evaluate_target_health = false
  }
}

# *.my-saloon.online → CloudFront Distribution #2
resource "aws_route53_record" "wildcard" {
  zone_id = var.zone_id
  name    = "*.${var.domain}"
  type    = "A"

  alias {
    name                   = var.cf_wildcard_domain
    zone_id                = var.cf_wildcard_zone_id
    evaluate_target_health = false
  }
}

# api.my-saloon.online → ALB (optional)
resource "aws_route53_record" "api" {
  count   = var.alb_dns_name != null ? 1 : 0
  zone_id = var.zone_id
  name    = "api.${var.domain}"
  type    = "A"

  alias {
    name                   = var.alb_dns_name
    zone_id                = var.alb_zone_id
    evaluate_target_health = true
  }
}
