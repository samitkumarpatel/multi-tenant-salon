variable "domain" {
  type = string
}

variable "resource_group_name" {
  type = string
}

variable "records" {
  type = map(object({
    type   = string # "A", "CNAME", "TXT", "MX"
    name   = string # "@" for apex
    values = list(string)
    ttl    = optional(number, 300)
  }))
  default = {}
}

variable "tags" {
  type    = map(string)
  default = {}
}
