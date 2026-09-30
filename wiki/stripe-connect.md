# Stripe Connect payments

Salons take online payments through their own **Stripe Express** connected account; the platform
account creates Checkout Sessions *on* that account (`Stripe-Account` header), so funds settle to the
salon. Payments are enabled per area — **Shop**, **Booking** (full or deposit %), **Till / POS** — under
**Admin → Payments**. Salons that never enable Stripe keep the previous behaviour (shop orders come back
`PAID` via the dummy step, bookings need no payment).

## Platform setup (one-off, per Stripe mode)

1. In the Stripe Dashboard enable **Connect** and complete the platform profile (Express accounts,
   business type, branding/icon shown during onboarding).
2. Create a secret key — or a restricted key with write access to Connect accounts, account links and
   Checkout Sessions, and read access to accounts.
3. Add a **Connect** webhook endpoint (*"Events on connected accounts"*, not *"Your account"*):
   `https://api.salonsaas.org/api/payments/stripe/webhook` with events
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`, `checkout.session.expired`. Copy its `whsec_` signing secret.
4. mix environment: set `TF_VAR_stripe_secret_key` and
   `TF_VAR_stripe_webhook_secret` in the environment's secret configuration, then review and apply
   `infrastructure/mix/environments/mix`. They are injected as Container App secrets
   (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`); `PAYMENTS_*_APP_URL` are set from the frontend hostnames.
5. Deploy the backend (Flyway **V12**) and the admin, dashboard, booking and public-website frontends.

Test mode and live mode have separate keys, webhook endpoints and connected accounts — a salon
onboarded in test mode must onboard again in live mode.

Backend environment variables (non-Terraform deployments):

| Variable | Purpose / default |
|---|---|
| `STRIPE_SECRET_KEY` | Platform key; unset → payments report *not configured* |
| `STRIPE_WEBHOOK_SECRET` | Connect endpoint signing secret; required as well |
| `PAYMENTS_ADMIN_APP_URL` | `https://admin.salonsaas.org` — onboarding return/refresh |
| `PAYMENTS_DASHBOARD_APP_URL` | `https://dashboard.salonsaas.org` — POS return |
| `PAYMENTS_BOOKING_APP_URL` | `https://book.salonsaas.org` — booking fallback return |
| `PAYMENTS_WEBSITE_APP_URL` | empty — set only when the website runs on a single host with `?slug=` (local dev) |
| `SALON_DOMAIN` | `salonsaas.org` — tenant subdomain for the shop fallback return |

## Return pages and custom domains

The website stores the pending order/booking in `sessionStorage`, which is per-origin, so Stripe must
return the customer to the **same origin** they checked out on. Shop and booking requests therefore
send `returnUrl` (`window.location.href`). The API accepts it only when its origin is the salon's
`https://<handler>.<SALON_DOMAIN>`, the salon's **currently active** custom domain
(see [custom-domains.md](custom-domains.md)), or the configured booking/website app; otherwise it falls
back to the defaults above. This keeps customers on `www.mysalon.dk` after paying without making
Checkout an open redirect. No Stripe-side configuration is needed per custom domain (hosted Checkout
runs on `checkout.stripe.com`). POS always returns to the dashboard.

## Operational notes

- Webhooks settle payments; the success page alone never marks anything paid. If the API is scaled to
  zero or stopped by the night-time scheduler, Stripe retries delivery (up to 3 days in live mode) and
  items stay `PENDING` until it succeeds.
- Unpaid Checkout Sessions expire after 24 h → `checkout.session.expired` restores shop/POS stock and
  cancels the pending booking (the slot stays held until then).
- For local work: `stripe listen --forward-connect-to localhost:8080/api/payments/stripe/webhook` and use
  the CLI's signing secret as `STRIPE_WEBHOOK_SECRET`.
- Card-present Stripe Terminal readers for the Till are not implemented; POS card payments use Checkout.
