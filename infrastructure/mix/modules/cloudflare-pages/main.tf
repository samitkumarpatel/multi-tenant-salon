# One Cloudflare Pages project per frontend app, direct-upload style.
# CI (`wrangler pages deploy build/client --project-name=<name> --branch=main`)
# pushes the SPA build output; Cloudflare never clones the repo.

resource "cloudflare_pages_project" "this" {
  account_id        = var.account_id
  name              = var.project_name
  production_branch = var.production_branch
}

# Registers the custom domain on the project. Cloudflare validates it once the
# CNAME (<custom_domain> -> <project>.pages.dev) resolves and then issues the
# edge certificate. The DNS record itself lives in the Azure DNS zone and is
# created by the dns-update stack, not here.
resource "cloudflare_pages_domain" "this" {
  count = var.custom_domain == null ? 0 : 1

  account_id   = var.account_id
  project_name = cloudflare_pages_project.this.name
  name         = var.custom_domain
}
