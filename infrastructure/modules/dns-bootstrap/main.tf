# ── Route 53 Hosted Zone ──────────────────────────────────────────────────────

resource "aws_route53_zone" "this" {
  name = var.domain
  tags = var.tags
}

# ── ACM Certificate (must live in us-east-1 for CloudFront) ──────────────────

resource "aws_acm_certificate" "this" {
  provider                  = aws.us_east_1
  domain_name               = var.domain
  subject_alternative_names = ["*.${var.domain}"]
  validation_method         = "DNS"
  tags                      = var.tags

  lifecycle {
    create_before_destroy = true
  }
}

# ── DNS validation records ────────────────────────────────────────────────────

resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.this.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = aws_route53_zone.this.zone_id
}

# ── Wait for certificate to be issued ────────────────────────────────────────

resource "aws_acm_certificate_validation" "this" {
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.this.arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}
