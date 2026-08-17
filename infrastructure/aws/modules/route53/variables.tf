variable "zone_id" {
  type        = string
  description = "Route 53 hosted zone ID"
}

variable "records" {
  type = map(object({
    name       = string # fully qualified name, e.g. "my-salon.online", "www.my-salon.online", "*.my-salon.online"
    cf_domain  = string # CloudFront distribution domain name
    cf_zone_id = string # CloudFront distribution hosted zone ID
  }))
  description = "Map of Route 53 A ALIAS records to create. Each entry points a DNS name at a CloudFront distribution."
}
