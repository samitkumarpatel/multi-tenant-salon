# Customer self-service portal (plan)

> **Status: proposed — nothing built.** Written 2026-10-23. Decisions already taken are marked
> **[decided]**; everything under "Open questions" still needs an answer before Phase 2.

Today a customer can book, buy and join — and then has no way back in. There is no customer-facing
view of anything they did: no order lookup, no appointment list, no membership status. Every
"when's my appointment", "where's my order", "cancel my membership" is a phone call to the salon.
This plan gives them a signed-in account area per salon.

## The decisions already made

| | |
|---|---|
| **Sign-in** | Email magic link / one-time code. No password. **[decided]** |
| **Scope** | Per salon. One salon's portal shows that salon's history only. **[decided]** |
| **Customers can** | See bookings, orders and membership; cancel & reschedule bookings; renew & cancel membership; edit their own contact details. **[decided]** |

## Why email is the right key

Every customer-owned row in the system already carries an email, and nothing else:

- `booking.customer_email` (`V1__schema.sql`)
- `shop_order.customer_email` (`V9__shop_module.sql`)
- `membership_subscription.customer_email` (`V18__membership.sql`)

So a session that proves *"this person controls `ann@example.com`, for salon X"* unlocks their whole
history by selecting on `(salon_id, lower(customer_email))`. **No data migration, no customer table,
no change to how guests check out today.** Guest checkout stays exactly as it is; the portal is a
read/write lens over records that already exist.

`identity.UserIdentity` is *not* the thing to reuse — it models staff/owner access (email + salon
roles) and is wired into `SalonDeskAccess`. Customers must not touch that surface. This is a
separate, lower-privilege credential.

## What exists vs. what's new

| Capability | Today | Work needed |
|---|---|---|
| Membership renewal | `GET/POST /membership/renewals/{token}` — a per-subscription bearer token | Reuse the flow; drive it from the session instead of an emailed token |
| Membership cancel | Owner-only | **New** customer-facing endpoint + policy |
| Booking create | Public (`POST /api/salon/{salonId}/booking`) | — |
| Booking list / cancel / reschedule | **Owner-only** (`/api/salon-admin/...`) | **All new** customer-facing endpoints |
| Order history | **No customer endpoint at all** — checkout even returns a `Location` header pointing at a route that 404s | **New** |
| Contact details | Membership has `PATCH /subscriptions/{id}/contact` (owner-only, added recently) | **New** customer-facing variant |

The single biggest surprise: **bookings have no customer-facing mutation surface whatsoever.** That
is the bulk of the backend work, not the auth.

## Where it lives

Two entry points, one app:

1. **Inside the salon website** — the avatar button already exists. `ShopView.tsx` renders a
   `UserAccountPanel` behind it that is currently a disabled "coming soon" stub with three greyed-out
   inputs. A shopper clicking it today expects order tracking and gets nothing. That stub is the
   natural home for the signed-in panel.
2. **A dedicated URL**, because a salon may not have the website feature on at all. The cleanest fit
   with the existing infrastructure is a new frontend app `account-web` →
   `account.salonsaas.org/{handler}`, added to `frontend_hostnames` in
   `infrastructure/mix/environments/mix/main.tf` exactly like every other app (one Cloudflare Pages
   project, one CNAME). Serving it from the booking app instead would break for a shop-only or
   membership-only salon.

## Auth design

```
POST /api/salon/{salonId}/account/sign-in      { email }           → 202 (always)
POST /api/salon/{salonId}/account/verify       { email, code }     → { sessionToken, expiresAt }
GET  /api/salon/{salonId}/account/me           Bearer sessionToken → profile + counts
```

- **Always return 202** from sign-in regardless of whether the email is known. Telling an anonymous
  caller "no account here" turns the endpoint into a customer-list oracle for that salon.
- The code is only sent if that email actually has something in that salon. An unknown email simply
  receives nothing.
- **Short-lived code** (10 min, single use, ~6 digits) and a **longer session** (e.g. 30 days,
  revocable). Store a hash of the code, never the code.
- **Rate-limit per email and per IP.** Six digits is brute-forceable without it.
- Session is scoped to `(salonId, email)` and must be re-checked on every request — never trust a
  salon id from the client.

Reuse `notification.internal.NotificationService` for delivery, as every other email does.

### Interaction with the existing renewal token

`membership_subscription.renewal_token` is a permanent, never-rotated bearer credential sitting in an
email. It is currently the *only* way a member can pay for another period, so it has to keep working.
Two notes:

- Round 2 made the token rotate when an owner corrects a member's email, which is the first time it
  has ever been invalidated.
- Once the portal exists, the emailed link should ideally become a *deep link into the portal* rather
  than a standalone payable credential. Worth doing, but it is a migration, not a prerequisite.

## Scope per area

**Bookings** — upcoming and past; cancel and reschedule within the salon's rules. Reschedule must go
through the same availability check as booking (`BookingService.findAvailableSlots`) rather than a
second, divergent implementation. Cancelling must free the slot immediately.

**Orders** — history with status and the per-order timeline the owner already sees (minus internal
notes, which are explicitly staff-only). This also fixes the dangling `Location` header from checkout.

**Membership** — status, member code + QR, payment history, renew, cancel. The QR is already rendered
server-side by `utility.QrCodes`.

**Contact details** — name, email, phone. Changing the email is the sharp edge: it is the session key
*and* where confirmations go. Require re-verification of the new address before switching, and never
let it collide with another active member of the same plan (the owner-side `PATCH .../contact`
already enforces that).

## Policy the owner must configure

None of this can ship without the salon deciding:

- **Cancellation notice** — how close to the appointment may a customer still cancel? (e.g. 24h)
- **Self-reschedule** — allowed at all, and within what window?
- **Late cancellation** — blocked, or allowed and flagged to the salon?
- **Membership self-cancel** — allowed? Immediate or end-of-period? Given there is no auto-renewal,
  end-of-period is the natural default and needs no refund.

These belong next to the existing booking settings (`bookingRequiresConfirmation`,
`bookingAdvanceDays` on the salon), surfaced as a new admin screen. **A customer-facing portal with
no owner-side policy controls would be worse than no portal** — it hands customers the ability to
cancel an hour before a two-hour appointment with no recourse.

## Phasing

| Phase | Content | Why this order |
|---|---|---|
| **1** | Auth (sign-in, verify, session, `/me`) + **read-only** history across all three areas | Delivers most of the value — "where's my order", "when's my appointment" — at the lowest risk. Nothing is mutable, so nothing can be abused. |
| **2** | Owner policy settings + booking cancel & reschedule | The highest-demand write action, gated behind the rules the owner sets in the same phase. |
| **3** | Membership renew & cancel; contact details with re-verification | Renewal is largely a re-point of the existing token flow. |
| **4** | Retire the standalone renewal token in favour of portal deep links; consider order-level actions (request return) | Cleanup once the portal is established. |

Phase 1 is independently shippable and worth shipping alone.

## Open questions

1. **Session lifetime and revocation** — 30 days? Can the owner force sign-out (e.g. a disputed
   account)? Where are sessions stored — a table, or stateless signed tokens that cannot be revoked?
2. **Identity across salons** — explicitly out of scope **[decided: per-salon]**, but a customer using
   three salons will sign in three times. Is that acceptable long-term, and does per-salon now make a
   later merge harder?
3. **Guest-to-account linkage** — if someone books as `Ann <ann@x>` and later as `ann@X` (different
   case) or with a typo, those are different histories. Normalise on `lower(email)`; typos stay split.
4. **Deletion / GDPR** — a customer asking to be forgotten currently has no path, and the records are
   also the salon's financial history. Needs a legal answer, not just a technical one.
5. **Does cancelling a paid booking refund it?** Bookings can take full payment or a deposit. The
   shop and membership both now have refund paths; booking does not. Likely blocks Phase 2.
6. **Notification volume** — sign-in codes add a new email category. Does it respect
   `CommunicationPreference`? (It should not — a sign-in code is transactional, not marketing.)

## Explicitly not in this plan

- Cross-salon identity, social login, passwords.
- Loyalty (the feature flag routes to a stub today).
- Customer-initiated returns/refunds — the owner-side flows exist; exposing them is a later decision.
