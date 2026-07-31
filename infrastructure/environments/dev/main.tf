module "dns_bootstrapping" {
  source = "../../stacks/dns-bootstrapping"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  environment = "dev"
  domain      = "my-saloon.online"
}

module "stack" {
  source = "../../stacks/1.0.0"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  environment     = "dev"
  name            = "my-saloon"
  domain          = "my-saloon.online"
  certificate_arn = module.dns_bootstrapping.certificate_arn
  zone_id         = module.dns_bootstrapping.zone_id
}
