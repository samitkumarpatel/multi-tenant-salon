variable "name" {
  type = string
}

variable "dev_mode" {
  type        = bool
  default     = true
  description = "true = single-AZ db.t4g.micro, no deletion protection; false = Multi-AZ db.t4g.small"
}

variable "db_name" {
  type    = string
  default = "saloon"
}

variable "db_username" {
  type    = string
  default = "saloon_app"
}

variable "subnet_ids" {
  type        = list(string)
  description = "Private subnet IDs for the RDS subnet group"
}

variable "security_group_id" {
  type        = string
  description = "Security group that allows PostgreSQL from ECS"
}

variable "secret_path_prefix" {
  type        = string
  description = "Secrets Manager path prefix, e.g. multi-tenant-saloon/dev"
}

variable "tags" {
  type    = map(string)
  default = {}
}
