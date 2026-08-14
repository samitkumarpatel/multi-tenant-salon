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
    #Populated at init time via -backend-config or TF_BACKEND_* env vars in .env:
      bucket         = "tfpocbucket001"
      key            = "dev/1.0.0/terraform.tfstate"
      region         = "eu-north-1"
      encrypt        = true
  }
}

locals {
  default_tags = {
    Project     = "multi-tenant-salon"
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}

provider "aws" {
  region = "eu-north-1"

  default_tags {
    tags = local.default_tags
  }
}

# Lambda@Edge and CloudFront ACM certificates must live in us-east-1
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = local.default_tags
  }
}
