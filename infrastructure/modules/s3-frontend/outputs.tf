output "main_web_bucket" {
  value = aws_s3_bucket.main_web.id
}

output "main_web_bucket_arn" {
  value = aws_s3_bucket.main_web.arn
}

output "main_web_bucket_regional_domain" {
  value = aws_s3_bucket.main_web.bucket_regional_domain_name
}

output "public_web_bucket" {
  value = aws_s3_bucket.public_web.id
}

output "public_web_bucket_arn" {
  value = aws_s3_bucket.public_web.arn
}

output "public_web_bucket_regional_domain" {
  value = aws_s3_bucket.public_web.bucket_regional_domain_name
}

output "super_admin_bucket" {
  value = aws_s3_bucket.super_admin.id
}

output "super_admin_bucket_arn" {
  value = aws_s3_bucket.super_admin.arn
}

output "super_admin_bucket_regional_domain" {
  value = aws_s3_bucket.super_admin.bucket_regional_domain_name
}

output "cf_logs_bucket" {
  value = aws_s3_bucket.cf_logs.id
}

output "oac_main_web_id" {
  value = aws_cloudfront_origin_access_control.main_web.id
}

output "oac_public_web_id" {
  value = aws_cloudfront_origin_access_control.public_web.id
}

output "oac_super_admin_id" {
  value = aws_cloudfront_origin_access_control.super_admin.id
}
