# One Cloudflare Pages project per frontend app, direct-upload style.
# CI (`wrangler pages deploy build/client --project-name=<name> --branch=main`)
# pushes the SPA build output; Cloudflare never clones the repo.

resource "cloudflare_pages_project" "this" {
  account_id        = var.account_id
  name              = var.project_name
  production_branch = var.production_branch
}

# Registers each custom domain on the project (apex, sub-domain and/or the
# "*.salonsaas.org" wildcard). Cloudflare validates a domain once its DNS record
# resolves to <project>.pages.dev and then issues the edge certificate — for the
# wildcard, coverage comes from the zone's free Universal SSL cert. The DNS
# records themselves live in the dns-update stack, not here.
resource "cloudflare_pages_domain" "this" {
  for_each = toset(var.custom_domains)

  account_id   = var.account_id
  project_name = cloudflare_pages_project.this.name
  name         = each.value
}
