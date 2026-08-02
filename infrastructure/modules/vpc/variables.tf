variable "name" {
  type = string
}

variable "cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "azs" {
  type        = list(string)
  description = "Availability zones — one per subnet pair"
}

variable "public_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for public subnets (one per AZ)"
}

variable "private_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for private subnets (one per AZ)"
}

variable "enable_nat_gateway" {
  type        = bool
  default     = false
  description = "Create a single shared NAT gateway for private subnet egress. Disable in dev and use assign_public_ip on ECS tasks instead to avoid NAT costs."
}

variable "tags" {
  type    = map(string)
  default = {}
}
