# ─────────────────────────────────────────────────────────────────────────────
# RETIRED ENVIRONMENT
# ─────────────────────────────────────────────────────────────────────────────
# The salon platform moved to infrastructure/mix:
#   - DNS ............. Cloudflare zone (salonsaas.org)
#   - Frontend ........ Cloudflare Pages          (was Azure Front Door + Storage)
#   - Backend ......... Azure Container Apps      (was AKS)
#   - Database ........ Azure PostgreSQL Flexible (was in-cluster / RDS)
#   - Resource group .. multi-tenant-salon-mix    (new, created by mix — this
#                       environment's multi-tenant-salon-dev RG is destroyed)
#
# The stack + module code under infrastructure/azure/ is kept for reference and
# rollback, but nothing is applied from here any more.
#
# Tear-down (after mix is live and verified — see infrastructure/mix/README.md,
# "Cut-over runbook"):
#
#   terraform -chdir=infrastructure/azure/environments/dev init
#   terraform -chdir=infrastructure/azure/environments/dev destroy
#
# That destroys the multi-tenant-salon-dev resource group and everything still
# in this state: Front Door, storage accounts, AKS cluster, managed disks, and
# the old Azure DNS zone. mix uses a separate RG (multi-tenant-salon-mix), so
# nothing of mix's is touched.
