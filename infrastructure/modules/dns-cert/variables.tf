variable "domain" {
  type        = string
  description = "Root domain. A wildcard SAN is added automatically."
}

variable "zone_id" {
  type        = string
  description = "Route 53 hosted zone ID where DNS validation records will be created."
}

variable "tags" {
  type    = map(string)
  default = {}
}
