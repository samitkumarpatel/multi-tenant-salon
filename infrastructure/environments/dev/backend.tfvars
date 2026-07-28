environment = "dev"
name        = "my-saloon"
aws_region  = "ap-south-1"
domain      = "my-saloon.online"

db_name     = "saloon"
db_username = "saloon_app"
ghcr_image  = "samitkumarpatel/multi-tenant-saloon"

# Secrets are NOT stored here — see .env.example and copy to .env:
#   TF_VAR_api_acm_certificate_arn
#   TF_VAR_ghcr_username
#   TF_VAR_ghcr_pat
