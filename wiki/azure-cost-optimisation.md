# Azure Cost Optimisation — Dev Environment

Decisions deferred for later implementation. Current estimated monthly cost: ~$115–120/mo.
Target after optimisation: ~$20–25/mo.

---

## Scheduler (already in place)

`aks-onoff-scheduler.yml` stops the AKS cluster at 00:00 CEST and starts it at 14:00 CEST, giving 10 active hours/day (300 h/mo vs 720 h full month — 58% compute saving).

Extend to weekdays only for a further ~27% reduction:

```yaml
- cron: '0 12 * * 1-5'   # startup Mon–Fri 14:00 CEST
- cron: '0 22 * * 1-5'   # shutdown Mon–Fri 00:00 CEST
```

---

## 1. Replace Azure Front Door with Azure CDN Classic (~$35/mo saved)

Front Door Standard charges ~$35/mo flat regardless of traffic. For dev, swap to **Azure CDN Classic** (no base fee, bandwidth-only pricing ~$0.08/GB).

- Supports custom subdomains with free managed TLS
- Same outcome: `admin.salonsaas.org`, `book.salonsaas.org`, etc. all work
- Deprecated (EOL Sept 2027) — acceptable for dev, not for prod
- Implementation: swap `modules/cdn/` to use `azurerm_cdn_profile` (Classic) instead of `azurerm_cdn_frontdoor_profile`

**Alternative — Cloudflare free tier:**
Move `salonsaas.org` nameservers to Cloudflare. Proxy CNAME records for each subdomain → storage static website endpoints. Free TLS, free CDN. Trade-off: DNS records migrate out of Azure / Terraform `azurerm_dns_*` resources.

---

## 2. Reduce system node pool — 1 node, smaller VM (~$38/mo saved)

```hcl
# infrastructure/azure/environments/dev/main.tf
system_node_count = 1                    # was 2
system_vm_size    = "Standard_B2s"       # was Standard_D2s_v3 (~$0.042/hr vs $0.096/hr)
```

`Standard_B2s` (2 vCPU / 4 GB, burstable) comfortably handles system pods + PostgreSQL for dev. Single node is fine — dev doesn't need HA.

---

## 3. Downgrade PostgreSQL disk to Standard_LRS (~$3/mo saved)

```hcl
# infrastructure/azure/environments/dev/main.tf
postgres_disk_sku = "Standard_LRS"      # was Premium_LRS (~$1.54/mo vs $5.28/mo for P4 32 GB)
```

Lower IOPS, acceptable for dev workloads.

---

## 4. Disable Log Analytics (~$2/mo saved)

```hcl
# infrastructure/azure/environments/dev/main.tf — passed to module "backend"
enable_monitoring = false
```

---

## Projected costs after all changes

| Resource | Current | Optimised |
|---|---|---|
| System nodes | ~$58 | ~$13 (1× B2s, 300 h) |
| Spot nodes | ~$7 | ~$4 (1× B2s spot) |
| PostgreSQL disk | ~$5 | ~$2 (Standard_LRS) |
| Public IP | ~$4 | ~$4 |
| CDN / Front Door | ~$38 | ~$0–1 (CDN Classic) |
| Storage accounts | ~$2 | ~$2 |
| DNS zone | ~$2 | ~$2 |
| Log Analytics | ~$2 | ~$0 |
| **Total** | **~$118/mo** | **~$27/mo** |
