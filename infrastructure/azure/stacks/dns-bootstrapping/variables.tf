variable "environment" {
  type = string
}

variable "resource_group_name" {
  type = string
}

variable "domain" {
  type = string
}

variable "location" {
  type    = string
  default = "eastus"
}

variable "dns_records" {
  type = map(object({
    type   = string
    name   = string
    values = list(string)
    ttl    = optional(number, 300)
  }))
  default = {}
}
