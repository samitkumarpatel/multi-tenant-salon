#!/usr/bin/env bash
# One-time manual setup — run this once per cluster/environment before deploying.
# All secrets are created idempotently (safe to re-run).
#
# Usage:
#   export AZURE_POSTGRES_PASSWORD="<managed-flexible-server-admin-password>"
#   # export POSTGRES_PASSWORD="<in-cluster-postgres-password>"   # rollback only, see below
#   export GHCR_USER="<github-username>"
#   export GHCR_PAT="<github-pat-with-read:packages>"
#   export MAILJET_API_KEY="<your-mailjet-api-key>"
#   export MAILJET_API_SECRET="<your-mailjet-api-secret>"
#   export ANTHROPIC_API_KEY="<your-anthropic-api-key>"
#   ./helm/prereq-manifest/create-secrets.sh
#
# AZURE_POSTGRES_PASSWORD is the admin password of the managed Azure Database for
# PostgreSQL Flexible Server (salon-saas-mix-psql) the api now points at — get it
# with: terraform -chdir=infrastructure/mix/environments/mix output -raw database_password
#
# GHCR_PAT must be a long-lived Personal Access Token (not GITHUB_TOKEN) with
# read:packages scope. Create one at: github.com/settings/tokens

set -euo pipefail

NAMESPACE="salon"

# ── Validate inputs ───────────────────────────────────────────────────────────

: "${AZURE_POSTGRES_PASSWORD:?AZURE_POSTGRES_PASSWORD is required}"
# : "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"   # rollback only (in-cluster postgres)
: "${GHCR_USER:?GHCR_USER is required}"
: "${GHCR_PAT:?GHCR_PAT is required}"
: "${MAILJET_API_KEY:?MAILJET_API_KEY is required}"
: "${MAILJET_API_SECRET:?MAILJET_API_SECRET is required}"
: "${ANTHROPIC_API_KEY:?ANTHROPIC_API_KEY is required}"

# ── Namespace ─────────────────────────────────────────────────────────────────

kubectl apply -f "$(dirname "$0")/namespace.yaml"

# ── postgres-secret (RETAINED FOR ROLLBACK — NOT CREATED ANY MORE) ────────────
# Was the password for the in-cluster postgres pod, also injected into api as
# SPRING_DATASOURCE_PASSWORD. Migration step 1 repointed api at the managed
# Azure Flexible Server (azure-postgres-secret below). The live secret still
# exists in the cluster and is untouched. To roll back: re-export
# POSTGRES_PASSWORD, uncomment the guard above and the block below, uncomment
# helm/postgres/postgres.yaml, and set helm/api/values.yaml
# database.passwordSecretName back to postgres-secret.
#
# kubectl create secret generic postgres-secret \
#   --namespace "$NAMESPACE" \
#   --from-literal=POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
#   --dry-run=client -o yaml | kubectl apply -f -
#
# echo "postgres-secret created/updated"

# ── azure-postgres-secret ─────────────────────────────────────────────────────
# Admin password for the managed Azure Database for PostgreSQL Flexible Server
# (salon-saas-mix-psql). The api Deployment reads it as SPRING_DATASOURCE_PASSWORD
# when helm/api/values.yaml sets database.passwordSecretName: azure-postgres-secret
# (the post-migration default). Same key name (POSTGRES_PASSWORD) as
# postgres-secret so the chart's secretKeyRef.key stays constant.

kubectl create secret generic azure-postgres-secret \
  --namespace "$NAMESPACE" \
  --from-literal=POSTGRES_PASSWORD="$AZURE_POSTGRES_PASSWORD" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "azure-postgres-secret created/updated"

# ── ghcr-secret ───────────────────────────────────────────────────────────────
# docker-registry pull secret so pods in the salon namespace can pull images
# from ghcr.io. Uses a long-lived PAT — not GITHUB_TOKEN which expires when
# the workflow job ends.

kubectl create secret docker-registry ghcr-secret \
  --namespace "$NAMESPACE" \
  --docker-server=ghcr.io \
  --docker-username="$GHCR_USER" \
  --docker-password="$GHCR_PAT" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "ghcr-secret created/updated"

# ── mailjet-secret ────────────────────────────────────────────────────────────
# Shared with the auth service (multi-tenant-salon-authz) — both mount it via
# envFrom so MAILJET_API_KEY and MAILJET_API_SECRET are available at runtime
# without CI ever touching the values. Safe to re-run from either repo.

kubectl create secret generic mailjet-secret \
  --namespace "$NAMESPACE" \
  --from-literal=MAILJET_API_KEY="$MAILJET_API_KEY" \
  --from-literal=MAILJET_API_SECRET="$MAILJET_API_SECRET" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "mailjet-secret created/updated"

# ── anthropic-secret ──────────────────────────────────────────────────────────
# Used by the api pod for the Gen UI chat assistant (Spring AI's Anthropic
# starter reads ANTHROPIC_API_KEY directly) — mounted via envFrom.

kubectl create secret generic anthropic-secret \
  --namespace "$NAMESPACE" \
  --from-literal=ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "anthropic-secret created/updated"

echo ""
echo "All prerequisites are ready in namespace: $NAMESPACE"
