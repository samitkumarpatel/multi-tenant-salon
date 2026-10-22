# Stripe Connect payments

Salons take online payments through their own Stripe connected account, created with the
**Accounts v2 API** (`POST /v2/core/accounts`, merchant configuration with `card_payments`). The platform
creates Checkout Sessions *on* that account (direct charges, `Stripe-Account` header), so funds settle to
the salon.

Accounts are created with `dashboard: full` and `defaults.responsibilities` `fees_collector: stripe`,
`losses_collector: stripe`: each salon gets the full Stripe Dashboard, pays Stripe's processing fees on
its own charges and Stripe carries negative-balance liability. Express (`dashboard: express`) is not
used because v2 then requires the platform to collect fees and cover losses — with no application fee
the platform would pay every salon's processing fees. Responsibilities can't be changed after creation.
Onboarding uses `POST /v2/core/account_links` (`account_onboarding`, configuration `merchant`); status
is read with `GET /v2/core/accounts/{id}?include=configuration.merchant,requirements`:
*charges enabled* = `card_payments` capability `active`, *payouts enabled* = `stripe_balance.payouts`
`active`, *details submitted* = no requirement `currently_due`/`past_due`. v2 calls send
`Stripe-Version` (`STRIPE_API_VERSION`, default `2026-08-26.dahlia`). Checkout Sessions and webhooks
stay on v1 — v2 accounts are interoperable with them (every call pins the same `Stripe-Version`). Payments
are enabled per area — **Shop**, **Booking** (full or deposit %), **Till / POS**, **Memberships** — under
**Admin → Payments**, each with its own checkout style (below). Salons that never enable Stripe keep the previous behaviour (shop orders come back
`PAID` via the dummy step, bookings need no payment).

## Platform setup (one-off, per Stripe mode)

1. In the Stripe Dashboard enable **Connect** and complete the platform profile and questionnaire
   (otherwise account creation fails with `connect_profile_not_submitted`). Accounts v1 support does
   **not** need to be enabled.
2. Create a secret key — or a restricted key with write access to Connect accounts, account links,
   account sessions, Checkout Sessions, PaymentIntents, refunds and Terminal (locations, readers), and
   read access to accounts. Note the matching **publishable key** too.
3. Add a **Connect** webhook endpoint (*"Events on connected accounts"*, not *"Your account"*):
   `https://api.salonsaas.org/api/payments/stripe/webhook` with events
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`, `checkout.session.expired`,
   `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`,
   `terminal.reader.action_failed`, `refund.created`, `refund.updated`, `refund.failed`,
   `charge.refund.updated`. Copy its `whsec_` signing secret.
4. For card readers, check that **Terminal** is available for the platform's connected-account
   countries (Dashboard → Terminal). In test mode simulated readers work without hardware.
5. mix environment: set `TF_VAR_stripe_secret_key`, `TF_VAR_stripe_webhook_secret` and
   `TF_VAR_stripe_publishable_key` in the environment's configuration, then review and apply
   `infrastructure/mix/environments/mix`. The first two are injected as Container App secrets
   (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`), the publishable key as a plain env var
   (`STRIPE_PUBLISHABLE_KEY`); `PAYMENTS_*_APP_URL` are set from the frontend hostnames.
6. Deploy the backend (Flyway **V20** payment areas + ledger, **V21** card readers) and the admin,
   dashboard, booking and public-website frontends.

Test mode and live mode have separate keys, webhook endpoints and connected accounts — a salon
onboarded in test mode must onboard again in live mode.

Backend environment variables (non-Terraform deployments):

| Variable | Purpose / default |
|---|---|
| `STRIPE_SECRET_KEY` | Platform key; unset → payments report *not configured* |
| `STRIPE_WEBHOOK_SECRET` | Connect endpoint signing secret; required as well |
| `STRIPE_PUBLISHABLE_KEY` | Platform publishable key; unset → only the redirect checkout, no embedded account screens |
| `PAYMENTS_ADMIN_APP_URL` | `https://admin.salonsaas.org` — onboarding return/refresh |
| `PAYMENTS_DASHBOARD_APP_URL` | `https://dashboard.salonsaas.org` — POS return |
| `PAYMENTS_BOOKING_APP_URL` | `https://book.salonsaas.org` — booking fallback return |
| `PAYMENTS_WEBSITE_APP_URL` | empty — set only when the website runs on a single host with `?slug=` (local dev) |
| `SALON_DOMAIN` | `salonsaas.org` — tenant subdomain for the shop fallback return |

## Checkout styles and salon branding

Each area has a `checkoutUi` the owner picks under **Admin → Payments → Setup**:

| Style | What the customer sees |
|---|---|
| `REDIRECT` | Stripe's hosted Checkout page (`ui_mode: hosted_page`), then back to the salon's page |
| `EMBEDDED` | Stripe's Checkout form inside the salon's own page (`ui_mode: embedded_page`, Stripe.js `createEmbeddedCheckoutPage`) |
| `ELEMENTS` | The salon's own payment form (`ui_mode: elements`, `initCheckoutElementsSdk` + Payment Element) styled with the website theme |

All three are the same one-time Checkout Session on the salon's account with the same metadata,
webhooks and return pages (`?payment=success|cancel…`), so the shop, booking, membership and till
logic doesn't care which one ran. The hosted and embedded pages carry the salon's brand per session
(`branding_settings`: salon name, website accent colour as button colour, hero background); the
Elements form gets the accent colour and website font through the Appearance API (`PaymentGateway.Checkout.branding`).

The in-page styles only apply when the client says it can show them (`inlineCheckout: true` — the
website, booking app and desk do). MCP apps and the chat tools can only open a link, so they always
get the redirect checkout. Without `STRIPE_PUBLISHABLE_KEY` everything stays on `REDIRECT`.
Front-end packages are pinned to the backend's API release: `@stripe/stripe-js@9` (Dahlia Stripe.js).

## Card readers (Stripe Terminal)

Owners register readers under **Admin → Payments → Card readers** by the pairing code the reader shows
(`simulated-wpe` in test mode). The first reader creates the salon's Terminal **Location** on its
connected account from the salon address. Integration is **server-driven** (no Terminal SDK in the
browser): the desk creates a card-present PaymentIntent (`allowed_payment_method_types[]=card_present`,
automatic capture) and `POST /v1/terminal/readers/{id}/process_payment_intent`. Used by the till
(`/dashboard/sales/terminal-checkout`) and membership desk sales (`terminalId`).

- The sale is committed before the reader is asked, so a fast outcome always finds it.
- `payment_intent.succeeded` / `.canceled` settle the payment once (conditional ledger update) and publish
  the same `StripePaymentEvent` a checkout does. A decline (`terminal.reader.action_failed` /
  `payment_intent.payment_failed`) keeps the payment open — Stripe's advice is to reuse the PaymentIntent —
  so the desk can retry (on any reader) or cancel.
- The desk polls `/payments/terminal-payments/{id}`; when the stored state is older than ~10 s the API asks
  Stripe for the PaymentIntent and reader action, so a late webhook doesn't block the desk.
- Cancel calls `cancel_action` on the reader then cancels the PaymentIntent (`409` while the card is being
  authorised). Test mode can tap a test card from the desk (`present_payment_method`).
- Tap to Pay on a phone needs a native app and isn't supported.

## Payment ledger and refunds

Every Checkout Session and reader PaymentIntent is recorded in `payment` (area, reference, channel,
status, amount, PaymentIntent id, refunded amount); refunds in `payment_refund`. Owners see it under
**Transactions** and refund all or part of a payment to the customer's card from there
(`POST /v1/refunds` on the salon's account, idempotent per payment/amount). Accepting a shop refund
request also refunds the card when the order was paid online. Refund webhooks keep the ledger right,
including refunds made in Stripe's embedded payments component; a refund that later fails is added back
to the refundable balance.

## Embedded account screens

With the publishable key set, the admin app renders Stripe's **Connect embedded components** from
`POST /payments/stripe/account-session`: onboarding (`account_onboarding` — the account is created on first
use, so the owner never has to leave the app), the requirements banner (`notification_banner`), **Payouts**,
**Payments & disputes** and **Account** details. Salons have the full Stripe Dashboard, so Stripe asks the
owner to confirm their Stripe login inside a component for sensitive actions. The redirect onboarding link
stays as a fallback. Payment-method settings are not embedded yet (the component is preview-only in
`@stripe/connect-js@3.4.6`), so that one still links to the Stripe Dashboard.

## Payment methods

Checkout Sessions don't set `payment_method_types`, so Stripe offers every method the salon has
enabled on its own connected account that fits the currency and the customer's device (cards,
Apple Pay / Google Pay, MobilePay, Klarna, …). Salons have the full Stripe Dashboard, so the owner
manages this themselves at **Stripe Dashboard → Settings → Payment methods**; once connected, the
admin Payments screen links there ("Manage payment methods"). The choice is account-wide — the same
methods apply to Shop, Booking and Till / POS. Per-area choices would need Stripe's Payment Method
Configurations API and aren't implemented.

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

- Account creation is retry-safe. Before `POST /v2/core/accounts` the API lists connected accounts and
  adopts one whose `metadata.salon_id` matches (covers an earlier attempt that created the account in
  Stripe but failed before it was stored). The idempotency key is
  `salon-connect-v2-<salonId>-<body hash>`, so an identical retry replays, while a changed request (e.g. the
  salon was renamed) no longer fails with *"Idempotency keys can only be reused with the same parameters"*.

- Webhooks settle payments; the success page alone never marks anything paid. If the API is scaled to
  zero or stopped by the night-time scheduler, Stripe retries delivery (up to 3 days in live mode) and
  items stay `PENDING` until it succeeds.
- Unpaid Checkout Sessions expire after 24 h → `checkout.session.expired` restores shop/POS stock and
  cancels the pending booking (the slot stays held until then).
- For local work: `stripe listen --forward-connect-to localhost:8080/api/payments/stripe/webhook` and use
  the CLI's signing secret as `STRIPE_WEBHOOK_SECRET`.
- Card readers need the salon's street address, city and postal code (Terminal Location).
