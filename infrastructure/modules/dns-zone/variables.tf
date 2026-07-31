variable "domain" {
  type        = string
  description = "Root domain (e.g. my-saloon.online)."
}

variable "tags" {
  type    = map(string)
  default = {}
}
