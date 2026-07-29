variable "name" {
  type        = string
  description = "Project name prefix used to scope S3 bucket permissions (e.g. my-saloon)."
}

variable "aws_region" {
  type        = string
  description = "Primary AWS region."
}

variable "github_org" {
  type        = string
  description = "GitHub organisation or username that owns the repository."
}

variable "github_repo" {
  type        = string
  description = "Repository name without the org prefix."
}
