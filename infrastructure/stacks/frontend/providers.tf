terraform {
  required_version = ">= 1.9"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = ">= 2.0"
    }
  }

  backend "s3" {
    # Fill in before first apply — or export via TF_BACKEND_* in environments/dev/.env:
    #   bucket         = "my-saloon-terraform-state"
    #   key            = "dev/frontend/terraform.tfstate"
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

# Lambda@Edge and CloudFront ACM must live in us-east-1
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = local.common_tags
  }
}
