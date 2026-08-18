#!/usr/bin/env bash
# One-time manual setup — run this once per cluster/environment before deploying.
# All secrets are created idempotently (safe to re-run).
#
# Usage:
#   export POSTGRES_PASSWORD="<your-password>"
#   export GHCR_USER="<github-username>"
#   export GHCR_PAT="<github-pat-with-read:packages>"
#   ./helm/prereq-manifest/create-secrets.sh
#
# GHCR_PAT must be a long-lived Personal Access Token (not GITHUB_TOKEN) with
# read:packages scope. Create one at: github.com/settings/tokens

set -euo pipefail

NAMESPACE="salon"

# ── Validate inputs ───────────────────────────────────────────────────────────

: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
: "${GHCR_USER:?GHCR_USER is required}"
: "${GHCR_PAT:?GHCR_PAT is required}"

# ── Namespace ─────────────────────────────────────────────────────────────────

kubectl apply -f "$(dirname "$0")/namespace.yaml"

# ── postgres-secret ───────────────────────────────────────────────────────────
# Used by the postgres pod (POSTGRES_PASSWORD) and mounted into the api/auth
# pods via envFrom so they read POSTGRES_PASSWORD at runtime without CI ever
# touching the value.

kubectl create secret generic postgres-secret \
  --namespace "$NAMESPACE" \
  --from-literal=POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "postgres-secret created/updated"

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

echo ""
echo "All prerequisites are ready in namespace: $NAMESPACE"
