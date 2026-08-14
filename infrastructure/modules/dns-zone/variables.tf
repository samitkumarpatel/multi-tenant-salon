variable "domain" {
  type        = string
  description = "Root domain (e.g. my-salon.online)."
}

variable "tags" {
  type    = map(string)
  default = {}
}
