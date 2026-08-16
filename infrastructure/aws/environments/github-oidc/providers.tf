terraform {
  required_version = ">= 1.9"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }

  backend "s3" {
    # Populated at init time via -backend-config:
    #   bucket  = "tfpocbucket001"
    #   key     = "github-oidc/terraform.tfstate"
    #   region  = "eu-north-1"
    #   encrypt = true
  }
}

provider "aws" {
  region = "eu-north-1"
}
