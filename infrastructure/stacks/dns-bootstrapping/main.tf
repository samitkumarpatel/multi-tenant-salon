locals {
  common_tags = {
    Project     = "multi-tenant-saloon"
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  global_certs   = { for k, v in var.certificates : k => v if v.global }
  regional_certs = { for k, v in var.certificates : k => v if !v.global }

  # Resolve names to FQDNs and auto-chunk TXT values that exceed the 255-char DNS limit.
  dns_records_normalized = {
    for k, r in var.dns_records : k => merge(r, {
      fqdn = r.name == "@" ? var.domain : "${r.name}.${var.domain}"
      records = [
        for value in r.records :
        r.type == "TXT" && length(value) > 255
        ? join("\" \"", [for i in range(0, ceil(length(value) / 255)) : substr(value, i * 255, 255)])
        : value
      ]
    })
  }
}

# Phase 1 — apply this target first, then update NS records at your registrar:
#   terraform apply -target=module.dns_bootstrapping.module.dns_zone
module "dns_zone" {
  source = "../../modules/dns-zone"

  domain = var.domain
  tags   = local.common_tags
}

# ── DNS records ────────────────────────────────────────────────────────────────

resource "aws_route53_record" "this" {
  for_each = local.dns_records_normalized

  zone_id         = module.dns_zone.zone_id
  name            = each.value.fqdn
  type            = each.value.type
  ttl             = each.value.ttl
  allow_overwrite = true
  records         = each.value.records
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

# ── DNS validation records ─────────────────────────────────────────────────────
# Derived from the global cert only — both global and regional certs cover the
# same domains so ACM issues identical CNAMEs. The regional cert validation
# below reuses these same Route 53 records.
# for_each keys come from domain_validation_options.domain_name which mirrors
# the configured domain_name / subject_alternative_names — known at plan time
# once the global cert exists in state.
#
# Fresh environment: run once with -target first:
#   terraform apply -target=module.dns_bootstrapping.aws_acm_certificate.global

resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in flatten([
      for cert in values(aws_acm_certificate.global) :
      [for o in cert.domain_validation_options : {
        domain = o.domain_name
        name   = o.resource_record_name
        value  = o.resource_record_value
        type   = o.resource_record_type
      }]
    ]) : dvo.domain => {
      name   = dvo.name
      record = dvo.value
      type   = dvo.type
    }
  }

  allow_overwrite = true
  name            = each.value.name
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
    aws_route53_record.cert_validation[dvo.domain_name].fqdn
  ]
}

resource "aws_acm_certificate_validation" "regional" {
  for_each = local.regional_certs

  certificate_arn = aws_acm_certificate.regional[each.key].arn
  validation_record_fqdns = [
    for dvo in aws_acm_certificate.regional[each.key].domain_validation_options :
    aws_route53_record.cert_validation[dvo.domain_name].fqdn
  ]
}
