variable "github_org" {
  type        = string
  description = "GitHub organisation or user (e.g. samitkumarpatel)"
}

variable "github_repo" {
  type        = string
  description = "GitHub repository name (e.g. multi-tenant-salon)"
}

# Federated credential subjects — one per branch / environment pattern.
# subject follows GitHub's OIDC claim format:
#   branch:   "repo:<org>/<repo>:ref:refs/heads/<branch>"
#   env:      "repo:<org>/<repo>:environment:<env>"
#   pr:       "repo:<org>/<repo>:pull_request"
variable "federated_credentials" {
  type = map(object({
    subject     = string
    description = string
  }))
  default = {}
}

# Azure built-in role names granted at subscription scope
variable "role_definitions" {
  type    = list(string)
  default = ["Contributor"]
}

# Resource group the deploy-time role-assignment-writer permission is scoped
# to (see role_assignment_writer below). Must match environments/dev's
# resource_group_name ("multi-tenant-salon-${environment}").
variable "resource_group_name" {
  type    = string
  default = "multi-tenant-salon-dev"
}
