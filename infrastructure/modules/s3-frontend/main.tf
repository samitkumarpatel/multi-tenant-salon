# ── S3 Buckets ────────────────────────────────────────────────────────────────
# bucket: main-web  — hosts /onboarding/ and /admin/ prefixes (Distribution #1)
# bucket: public-web — hosts saloon public sites (Distribution #2, default origin)
# bucket: super-admin-web — hosts admin.my-saloon.online (Distribution #2, switched origin)
# bucket: cf-logs — CloudFront access logs

locals {
  buckets = {
    main_web       = "${var.name}-main-web"
    public_web     = "${var.name}-public-web"
    super_admin    = "${var.name}-super-admin-web"
    cf_logs        = "${var.name}-cf-logs"
  }
}

resource "aws_s3_bucket" "main_web" {
  bucket        = local.buckets.main_web
  force_destroy = var.force_destroy
  tags          = merge(var.tags, { Name = local.buckets.main_web })
}

resource "aws_s3_bucket" "public_web" {
  bucket        = local.buckets.public_web
  force_destroy = var.force_destroy
  tags          = merge(var.tags, { Name = local.buckets.public_web })
}

resource "aws_s3_bucket" "super_admin" {
  bucket        = local.buckets.super_admin
  force_destroy = var.force_destroy
  tags          = merge(var.tags, { Name = local.buckets.super_admin })
}

resource "aws_s3_bucket" "cf_logs" {
  bucket        = local.buckets.cf_logs
  force_destroy = var.force_destroy
  tags          = merge(var.tags, { Name = local.buckets.cf_logs })
}

# Block all public access on content buckets (CloudFront uses OAC)
resource "aws_s3_bucket_public_access_block" "main_web" {
  bucket                  = aws_s3_bucket.main_web.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "public_web" {
  bucket                  = aws_s3_bucket.public_web.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "super_admin" {
  bucket                  = aws_s3_bucket.super_admin.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ── Origin Access Controls ────────────────────────────────────────────────────

resource "aws_cloudfront_origin_access_control" "main_web" {
  name                              = "${local.buckets.main_web}-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_origin_access_control" "public_web" {
  name                              = "${local.buckets.public_web}-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_origin_access_control" "super_admin" {
  name                              = "${local.buckets.super_admin}-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Logs bucket: grant CloudFront delivery service write access
resource "aws_s3_bucket_ownership_controls" "cf_logs" {
  bucket = aws_s3_bucket.cf_logs.id
  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_acl" "cf_logs" {
  bucket     = aws_s3_bucket.cf_logs.id
  acl        = "log-delivery-write"
  depends_on = [aws_s3_bucket_ownership_controls.cf_logs]
}
