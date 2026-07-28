# Lambda@Edge and ACM certificates for CloudFront must be in us-east-1.
# The stack passes the provider alias in; this file just declares the requirement.

terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = ">= 5.0"
      configuration_aliases = [aws.us_east_1]
    }
    archive = {
      source  = "hashicorp/archive"
      version = ">= 2.0"
    }
  }
}
