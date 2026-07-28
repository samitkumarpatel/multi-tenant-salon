terraform {
  required_version = ">= 1.9"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.0"
    }
  }

  backend "s3" {
    # Fill in before first apply — or export via TF_BACKEND_* in environments/dev/.env:
    #   bucket         = "my-saloon-terraform-state"
    #   key            = "dev/backend/terraform.tfstate"
    #   region         = "ap-south-1"
    #   dynamodb_table = "terraform-locks"
    #   encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}
