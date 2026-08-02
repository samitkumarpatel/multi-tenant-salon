locals {
  common_tags = {
    Project     = "multi-tenant-saloon"
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  global_certs   = { for k, v in var.certificates : k => v if v.global }
  regional_certs = { for k, v in var.certificates : k => v if !v.global }

  # Deduplicated DNS validation CNAMEs across all certs.
  # When two certs cover the same domain (e.g. both cloudfront and api-gateway use
  # *.my-saloon.online), ACM produces identical CNAME names. Keying by
  # resource_record_name collapses them to a single Route 53 record.
  all_validation_records = {
    for dvo in flatten([
      for cert in concat(
        values(aws_acm_certificate.global),
        values(aws_acm_certificate.regional),
      ) : [for option in cert.domain_validation_options : option]
    ]) : dvo.resource_record_name => {
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }
}

# Phase 1 — apply this target first, then update NS records at your registrar:
#   terraform apply -target=module.dns_bootstrapping.module.dns_zone
module "dns_zone" {
  source = "../../modules/dns-zone"

  domain = var.domain
  tags   = local.common_tags
}

# ── Certificates ──────────────────────────────────────────────────────────────

resource "aws_acm_certificate" "global" {
  for_each = local.global_certs
  provider = aws.us_east_1

  domain_name               = each.value.domain
  subject_alternative_names = each.value.subject_alternative_names
  validation_method         = "DNS"
  tags                      = merge(local.common_tags, { Name = each.key })

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_acm_certificate" "regional" {
  for_each = local.regional_certs

  domain_name               = each.value.domain
  subject_alternative_names = each.value.subject_alternative_names
  validation_method         = "DNS"
  tags                      = merge(local.common_tags, { Name = each.key })

  lifecycle {
    create_before_destroy = true
  }
}

# ── DNS validation records (shared, deduplicated) ─────────────────────────────
# Route 53 is a global service — records are written with the default provider
# regardless of whether the cert is global or regional.

resource "aws_route53_record" "cert_validation" {
  for_each = local.all_validation_records

  allow_overwrite = true
  name            = each.key
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = module.dns_zone.zone_id
}

# ── Certificate validation ────────────────────────────────────────────────────

resource "aws_acm_certificate_validation" "global" {
  for_each = local.global_certs
  provider = aws.us_east_1

  certificate_arn = aws_acm_certificate.global[each.key].arn
  validation_record_fqdns = [
    for dvo in aws_acm_certificate.global[each.key].domain_validation_options :
    aws_route53_record.cert_validation[dvo.resource_record_name].fqdn
  ]
}

resource "aws_acm_certificate_validation" "regional" {
  for_each = local.regional_certs

  certificate_arn = aws_acm_certificate.regional[each.key].arn
  validation_record_fqdns = [
    for dvo in aws_acm_certificate.regional[each.key].domain_validation_options :
    aws_route53_record.cert_validation[dvo.resource_record_name].fqdn
  ]
}
