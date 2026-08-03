variable "name" {
  type        = string
  description = "Prefix used for naming IAM resources."
}

variable "github_org" {
  type        = string
  description = "GitHub organisation or username (e.g. samitkumarpatel)."
}

variable "github_repo" {
  type        = string
  description = "Repository name without the org prefix (e.g. multi-tenant-saloon)."
}

variable "s3_bucket_arns" {
  type        = list(string)
  description = "ARNs of S3 buckets the pipeline is allowed to read/write."
}

variable "cloudfront_distribution_arns" {
  type        = list(string)
  description = "ARNs of CloudFront distributions the pipeline is allowed to invalidate."
}

variable "ecs_cluster_arns" {
  type        = list(string)
  default     = []
  description = "ARNs of ECS clusters the pipeline can describe and update services on."
}

variable "ecs_task_execution_role_arns" {
  type        = list(string)
  default     = []
  description = "ARNs of ECS task execution roles the pipeline is allowed to pass (needed to register task definitions)."
}

variable "tags" {
  type    = map(string)
  default = {}
}
