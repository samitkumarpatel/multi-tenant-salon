module "bootstrap" {
  source = "../../stacks/bootstrap"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  environment = var.environment
  name        = var.name
  domain      = var.domain
}

module "stack" {
  source = "../../stacks/1.0.0"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  environment     = var.environment
  name            = var.name
  domain          = var.domain
  certificate_arn = module.bootstrap.certificate_arn
  zone_id         = module.bootstrap.zone_id
}
