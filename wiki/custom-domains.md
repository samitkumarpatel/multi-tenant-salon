# Customer website domains

Owners connect one hostname under **Admin → Website → Domains**. They keep their
registrar, nameservers and DNS provider. We never create a customer DNS zone or
change their DNS records. The existing `<handler>.salonsaas.org` address remains
available. Connected domains are preferred in admin share/live links and website
canonical links, without redirecting the included address.

## Customer setup

1. Enable the salon's website feature and enter a hostname such as `www.mysalon.dk`.
2. Add the displayed TXT ownership record and CNAME at the existing DNS provider.
   The default target is `customers.salonsaas.org`. Use **DNS-only** mode, not a
   proxied/flattened record. Some providers append the zone name automatically;
   enter the relative record name in those providers.
3. Select **Check connection**, or wait for the automatic check. Keep both records.
4. The connection becomes active only when the unique ownership TXT matches, the
   direct CNAME matches our configured target, and both Cloudflare hostname and
   certificate statuses are `active`.

The first release supports direct CNAME hostnames. Bare/apex domains, flattened
CNAMEs, customer-CDN proxying, domain purchase/transfer, multiple aliases, and
automatic redirects are not supported. Recommend `www` and a redirect from the
bare domain managed by the customer's existing provider.

## Platform setup (Cloudflare + mix)

1. Enable Cloudflare for SaaS on the `salonsaas.org` zone and review the account's
   hostname quota/billing. No per-customer DNS zones are needed.
2. Create a **separate runtime API token** with **SSL and Certificates Write**
   permission scoped to this zone. Do not give the runtime application DNS Write
   permission or reuse the Terraform token.
3. Configure `TF_VAR_website_domains_enabled=true` and
   `TF_VAR_website_domains_api_token` in the mix environment's secret configuration.
   The token is injected through the existing Container App / Key Vault mechanism;
   protect Terraform state like the other credentials already managed there.
4. Review and apply `infrastructure/mix/environments/mix`. This adds the proxied
   `customers` AAAA record (`100::`, originless), the SaaS fallback origin, and a
   `*/*` Worker route. Specific bypass routes preserve the apex marketing website
   and admin, staff, booking, dashboard, API and auth hosts. The existing tenant
   wildcard route remains. Customer hostname registrations belong to the API,
   not Terraform.
5. Deploy the backend (Flyway V11) and both frontends. Enable the feature only once
   the shared fallback origin is active and the Worker is deployed.

Backend environment variables (also available for non-Terraform deployments):

| Variable | Purpose / default |
|---|---|
| `WEBSITE_DOMAINS_ENABLED` | `false`; explicit feature switch |
| `WEBSITE_DOMAINS_ZONE_ID` | SaaS zone ID |
| `WEBSITE_DOMAINS_API_TOKEN` | Restricted server-side token |
| `WEBSITE_DOMAINS_CNAME_TARGET` | `customers.salonsaas.org` |
| `SALON_DOMAIN` | `salonsaas.org` |
| `WEBSITE_DOMAINS_POLL_INTERVAL_MS` | `60000` |

Production must use the real OAuth2 issuer and explicit platform CORS patterns.
As before, a localhost issuer disables authentication for local development.
The API needs outbound HTTPS to `api.cloudflare.com` and `cloudflare-dns.com`.
Run at least one backend replica for reconciliation; the mix configuration does
this when custom domains are enabled. If using the night-time mix shutdown
scheduler, do not stop the API while customer websites are expected to work.

## Lifecycle and isolation

- Unique normalized hostnames and one connection per salon are enforced in PostgreSQL.
- A per-claim random TXT token proves ownership. Cloudflare is not called until
  ownership is verified. Intent is committed before external creation; retries
  recover an interrupted create by exact hostname lookup in our SaaS zone.
- Reconciliation uses row locks with `SKIP LOCKED` across replicas, bounded HTTP
  timeouts, a five-minute per-domain polling interval, and a 30-second manual
  check cooldown. Provisioning may therefore need more than one polling cycle.
- Unverified claims expire after seven days. Owner verification records must
  remain in DNS; removing ownership/routing records revokes activation when checked.
- On a transient provider outage an active domain retains its last successful
  verification for at most 24 hours. After that it stops resolving until verified.
- Disabled salons and salons without the website feature never resolve, even if
  Cloudflare still has their hostname. Re-enabling permits reconciliation again.
- Disconnect immediately sets `DELETING`, removing the domain from public lookup
  and CORS. Remote deletion is retried; the claim remains reserved until cleanup
  succeeds. Reconnecting generates a new ownership token.
- The Worker resolves custom hosts through the API before serving Pages. Neither
  the Worker nor the API caches domain mappings, so disconnect is not delayed by
  a mapping cache. Provider outages fail closed. An already-open browser is not
  retroactively cleared, and public salon data remains public on the included URL.
- Custom origins are admitted only for public salon, utility and analytics APIs;
  admin endpoints retain their existing JWT ownership rules. CORS does not replace
  authorization. Requests without a browser Origin header follow existing rules.

- Stripe Checkout (shop/booking) returns shoppers to the page they paid from when it is the salon's
  active custom domain, so the checkout hand-off survives on the custom origin. See
  [stripe-connect.md](stripe-connect.md). The return page is fixed when the Checkout Session is
  created, so a domain disconnected mid-checkout returns to a dead host; the payment itself is still
  settled by the webhook.

## Verification and rollout

```sh
./mvnw test
npm run typecheck --prefix frontend --workspace=apps/salon-admin --workspace=apps/salon-public-website
npm run test:domains --prefix frontend --workspace=apps/salon-public-website
node --test infrastructure/mix/stacks/tenant-wildcard/worker.test.mjs
```

For local application startup use `./mvnw spring-boot:test-run`. Without provider
configuration the Domains section explains that connections are not yet available.
Integration tests use real PostgreSQL and mocked DNS/Cloudflare services, including
JWT filters and CORS; they never create real custom hostnames.

Before production rollout, connect a domain you control and test DNS propagation,
TLS, static and AI website modes, deep links, bookings, shop orders, analytics,
disconnect/reconnect, and the reserved platform hosts. A live DNS/TLS smoke test
requires the configured Cloudflare account and control of that test hostname.

Rollback: disable the feature to stop custom-domain resolution while preserving
included subdomains. Disconnect customer domains before removing shared SaaS
infrastructure if remote hostname cleanup is required; leave credentials enabled
until deletion completes. Do not delete domain rows to bypass provider cleanup.

Provider references:
- https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/start/advanced-settings/worker-as-origin/
- https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/start/common-api-calls/
- https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/
