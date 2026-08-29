# Frontend = one Cloudflare Pages project per SPA. Content is deployed by CI with
# `wrangler pages deploy` (direct upload); this stack only provisions the project
# and attaches its custom domain. The CNAME that points the custom domain at
# <project>.pages.dev is created in the Azure DNS zone by the dns-update stack,
# fed from this stack's `pages_hostnames` output.

module "pages" {
  source   = "../../modules/cloudflare-pages"
  for_each = var.apps

  account_id        = var.account_id
  project_name      = each.value.project
  production_branch = var.production_branch
  custom_domain     = try(each.value.custom_domain, null)
}
