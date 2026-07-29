variable "domain" {
  type        = string
  description = "Root domain (e.g. my-saloon.online). A wildcard SAN is added automatically."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Tags applied to all resources."
}
