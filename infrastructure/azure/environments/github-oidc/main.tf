# Azure AD Workload Identity Federation for GitHub Actions
# Mirrors the AWS github-oidc environment — lets GitHub Actions authenticate
# to Azure without any long-lived credentials stored in GitHub secrets.
#
# Usage in GitHub Actions:
#   permissions:
#     id-token: write
#     contents: read
#   steps:
#     - uses: azure/login@v2
#       with:
#         client-id: ${{ secrets.AZURE_CLIENT_ID }}
#         tenant-id: ${{ secrets.AZURE_TENANT_ID }}
#         subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

locals {
  app_name = "${var.github_org}-${var.github_repo}-gha"
}

data "azurerm_subscription" "current" {}

# ── App registration ──────────────────────────────────────────────────────────

resource "azuread_application" "github" {
  display_name = local.app_name
}

resource "azuread_service_principal" "github" {
  client_id = azuread_application.github.client_id
}

# ── Federated credentials — one per subject filter ───────────────────────────
# Add entries here for each branch / environment / PR pattern you need.

resource "azuread_application_federated_identity_credential" "github" {
  for_each = var.federated_credentials

  application_id = azuread_application.github.id
  display_name   = each.key
  description    = each.value.description
  audiences      = ["api://AzureADTokenExchange"]
  issuer         = "https://token.actions.githubusercontent.com"
  subject        = each.value.subject
}

# ── RBAC — grant the SP the roles it needs to deploy ─────────────────────────

resource "azurerm_role_assignment" "github" {
  for_each = toset(var.role_definitions)

  scope                = data.azurerm_subscription.current.id
  role_definition_name = each.value
  principal_id         = azuread_service_principal.github.object_id
}
