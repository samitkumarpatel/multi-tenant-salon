# No-show protection — deposits and card on file

Status: **planned, not started** (2026-10-25). Third step of the "protect the money" bundle.

## Already built

| Piece | Where |
|---|---|
| Owner refunds an appointment's card payment (full / partial) | `POST …/booking/{id}/refund`, admin prompts after cancel / no-show |
| Per-salon no-show fee (`NONE` / `PERCENT` / `FIXED`) | `booking_fee_policy` (V27), `PUT …/booking-fee-policy` |
| Payment link for an unpaid appointment, defaulting to the fee on a no-show | `POST …/booking/{id}/payment-link` |
| Fee shown to the customer on the booking details step | `BookingWizard` → `StepDetails` |
| Deposit at booking: full or % of the price | `SalonPaymentSettings.BookingPaymentType`, `BookingController.createBooking` |

## The gap

1. **A deposit has no fate.** It is taken at booking, then nothing says whether it is kept on a no-show,
   credited against the bill on completion, or refunded on a cancel in time. Today the owner decides by hand
   and `payment-link` refuses a `PAID` booking, so a deposit smaller than the fee cannot be topped up.
2. **A no-show is collected only by link.** The customer may never open it. Charging the fee automatically
   needs a card saved at booking time (none is: no Stripe Customer / SetupIntent anywhere).
3. **Customers cannot cancel a booking they paid for** (409 in `BookingService.cancelForCustomer`) because
   nothing decided whether they get the money back.

## Decisions needed before building

1. **Deposit on a no-show** — keep it all, keep up to the fee and refund the rest, or owner's choice per case?
   *Recommendation:* keep up to the fee, refund any excess, and bill the shortfall if the fee is bigger.
2. **Late-cancel rule** — add a notice window and fee to `booking_fee_policy` (same table, two columns)?
   *Recommendation:* yes; it is what makes customer self-cancel of paid bookings safe: inside the window the
   deposit is kept (up to the fee), outside it it is refunded automatically.
3. **Card on file: opt-in or required?** Charging off-session needs the customer's consent, and the SCA /
   mandate wording must be shown. *Recommendation:* only when the salon turns on "Charge no-show fees
   automatically"; the wizard then shows a card form (SetupIntent) with the consent text.
4. **Who may see / use the saved card** — owner and desk only, via the fee action; never listed in full.

## Design

### Phase 1 — deposit lifecycle (no new Stripe objects)

- `booking_fee_policy`: add `late_cancel_notice_hours` (nullable) and `late_cancel_fee_type/value`.
- Pure rule in `BookingFeePolicy`: `settle(booking, paid, outcome)` → `{keep, refund, bill}` for
  `NO_SHOW` and `CANCELLED` (in or out of the notice window). Unit-tested, no I/O.
- Owner cancel / no-show: the existing refund dialog is pre-filled with the rule's `refund` amount, and the
  payment-link dialog with the `bill` shortfall. `payment-link` accepts a `PAID` booking when the amount is
  the shortfall (needs a `booking_charge` row or a ledger reference per charge: today the reference is the
  booking id, so a second Checkout on the same reference collides — give charges their own reference,
  `booking:{id}:fee`).
- Customer self-cancel of a paid booking: allowed, applying the rule and calling `refundIfPaid`
  with the computed amount in the same flow as `cancelForCustomer`; the account response's
  `canCancel` / `blockedReason` loses the "paid online" block. Update the confirmation email text.

### Phase 2 — card on file (Stripe)

- Booking wizard (only when the salon opts in): create a **Customer** and a **SetupIntent**
  (`usage: off_session`) on the salon's connected account, collect the card with Stripe Elements, store
  `stripe_customer_id` / `payment_method_id` on `salon_customer`, never the card. Pin the same
  `Stripe-Version` as the rest of `payments` and reuse `StripeClient` — see the Dahlia API names note
  before writing request fields.
- `PaymentGateway`: new `chargeSavedCard(salonId, area, reference, customerRef, amount, currency, description)`
  → off-session PaymentIntent (`confirm=true`, `off_session=true`), recorded in the same `payment` ledger
  (new channel `SAVED_CARD`) and reporting through `StripePaymentEvent` exactly like checkout, so
  `BookingStripePaymentListener` settles it with no new path.
- Failure handling: `authentication_required` / `card_declined` → fall back to emailing the payment link
  (already built) and show the failure on the booking.
- Owner action "Charge no-show fee" on a no-show: one confirm, then charge; idempotency key per
  booking + fee.
- Webhook: add `setup_intent.succeeded` / `payment_method.detached` to the Connect webhook so a removed card
  is forgotten. Customer erasure (`anonymizeCustomer`) must detach and delete the Stripe Customer.

### Phase 3 — polish

- Show the cancel / no-show rule in the confirmation email, the customer account and the salon policy
  page (`SalonPolicyService`), not only in the wizard.
- Report: no-show count and fees collected / outstanding in the owner's customer view.

## Risks

- **Disputes / chargebacks** on off-session charges — keep the consent text, the booking and the fee rule
  shown at booking time on the payment record (snapshot the policy on the booking, don't re-read it later).
- **Legal**: fee and consent wording differs by country (DK / EU consumer rules). Get the text reviewed
  before enabling automatic charging.
- **Ledger references**: the booking id is the reference for the first payment; Phase 1 must not break the
  refund endpoint, which finds the card payment by `BOOKING` + booking id.
- Race: a webhook, a poll and an owner action can settle the same booking — keep the conditional
  `UPDATE … WHERE payment_status = …` pattern.

## Tests (per phase)

- Phase 1: rule table unit test; cancel with deposit in / out of window; payment-link top-up of a
  partially paid booking; customer self-cancel of a paid booking refunds the right amount.
- Phase 2: `StripeClient` mocked like `StripePaymentFlowIntegrationTest`; saved-card charge settles the
  booking through `StripePaymentEvent`; declined card falls back to the link; erasure detaches the card.

## Size

Phase 1 ≈ M, Phase 2 ≈ M–L (Stripe Elements form in the wizard is the bulk), Phase 3 ≈ S.
Ship Phase 1 alone first: it removes the manual deposit handling and unblocks customer self-cancel.
