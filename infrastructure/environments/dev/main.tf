module "dns_bootstrapping" {
  source = "../../stacks/dns-bootstrapping"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  environment = "dev"
  domain      = "my-saloon.online"

  certificates = {
    # CloudFront requires a certificate in us-east-1 regardless of deployment region
    cloudfront = {
      domain                    = "my-saloon.online"
      subject_alternative_names = ["*.my-saloon.online"]
      global                    = true
    }
    # ALB requires a certificate in the deployment region
    alb = {
      domain                    = "my-saloon.online"
      subject_alternative_names = ["*.my-saloon.online"]
      global                    = false
    }
  }
}

module "frontend" {
  source = "../../stacks/frontend"

  providers = {
    aws = aws
  }

  environment      = "dev"
  name             = "my-saloon"
  domain           = "my-saloon.online"
  zone_id          = module.dns_bootstrapping.zone_id
  certificate_arns = module.dns_bootstrapping.certificate_arns

  buckets = {
    onboarding-web  = { force_destroy = true }
    admin-web       = { force_destroy = true }
    public-web      = { force_destroy = true }
    super-admin-web = { force_destroy = true }
    booking-web     = { force_destroy = true }
  }

  distributions = {
    onboarding = {
      aliases            = ["my-saloon.online", "www.my-saloon.online"]
      certificate_key    = "cloudfront"
      default_origin_key = "onboarding-web"
      log_prefix         = "onboarding/"
      custom_error_responses = [
        { error_code = 403, response_page_path = "/index.html" },
        { error_code = 404, response_page_path = "/index.html" },
      ]
    }
    admin = {
      aliases            = ["admin.my-saloon.online"]
      certificate_key    = "cloudfront"
      default_origin_key = "admin-web"
      log_prefix         = "admin/"
      custom_error_responses = [
        { error_code = 403, response_page_path = "/index.html" },
        { error_code = 404, response_page_path = "/index.html" },
      ]
    }
    wildcard = {
      aliases            = ["*.my-saloon.online"]
      certificate_key    = "cloudfront"
      default_origin_key = "public-web"
      log_prefix         = "wildcard/"
      custom_error_responses = [
        { error_code = 403, response_page_path = "/index.html" },
        { error_code = 404, response_page_path = "/index.html" },
      ]
    }
    super-admin = {
      aliases            = ["super-admin.my-saloon.online"]
      certificate_key    = "cloudfront"
      default_origin_key = "super-admin-web"
      log_prefix         = "super-admin/"
      custom_error_responses = [
        { error_code = 403, response_page_path = "/index.html" },
        { error_code = 404, response_page_path = "/index.html" },
      ]
    }
    booking = {
      aliases            = ["book.my-saloon.online"]
      certificate_key    = "cloudfront"
      default_origin_key = "booking-web"
      log_prefix         = "booking/"
      custom_error_responses = [
        { error_code = 403, response_page_path = "/index.html" },
        { error_code = 404, response_page_path = "/index.html" },
      ]
    }
  }

  dns_records = {
    apex        = { subdomain = "",            distribution_key = "onboarding"  }
    www         = { subdomain = "www",         distribution_key = "onboarding"  }
    admin       = { subdomain = "admin",       distribution_key = "admin"       }
    wildcard    = { subdomain = "*",           distribution_key = "wildcard"    }
    super-admin = { subdomain = "super-admin", distribution_key = "super-admin" }
    booking     = { subdomain = "book",        distribution_key = "booking"     }
  }
}

module "backend" {
  source = "../../stacks/backend"

  ghcr_token               = var.ghcr_token
  environment              = "dev"
  name                     = "my-saloon"
  domain                   = "my-saloon.online"
  regional_certificate_arn = module.dns_bootstrapping.certificate_arns["alb"]
  zone_id                  = module.dns_bootstrapping.zone_id

  services = {
    api = {
      image             = "ghcr.io/samitkumarpatel/multi-tenant-saloon"
      image_tag         = "latest"
      health_check_path = "/actuator/health"
      cpu               = 512
      memory            = 1024
      env_vars = {
        "spring.sql.init.mode" = "never"
        "spring.modulith.events.jdbc.schema-initialization.enabled" = "false"
        "spring.flyway.enabled" = "true"
        CORS_ALLOWED_ORIGIN_PATTERNS = "https://my-saloon.online,https://www.my-saloon.online,https://*.my-saloon.online"
      }
    }
    auth = {
      image             = "nginx"
      health_check_path = "/actuator/health"
      container_port    = 9000
      cpu               = 512
      memory            = 1024
      env_vars = {
        IDENTITY_SERVICE_URL = "https://api.my-saloon.online"
      }
    }
  }

  ingress = {
    "api.my-saloon.online"  = "api"
    "auth.my-saloon.online" = "auth"
  }
}