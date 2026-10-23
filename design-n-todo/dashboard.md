# Operations Dashboard

The Dashboard is an optional salon feature and a separate microfrontend. It is intentionally not
embedded in `salon-admin`: configuration and daily operations have different users, rhythms, and
deployment needs.

## Application boundary

| Area | Responsibility |
| --- | --- |
| `frontend/apps/salon-admin` | Enable the `DASHBOARD` feature, choose available capabilities, maintain the default customer message, and launch the Dashboard. |
| `frontend/apps/salon-dashboard` | Run appointments and in-salon checkout. It has its own URL, authentication client, build, and deployment. |
| Backend `dashboard` module | Enforce feature/capability flags, record POS sales, expose the cashier catalogue, and publish notification requests. |
| Existing `booking`, `shop`, and `notification` modules | Remain the systems of record for appointments, stock, and email delivery. The Dashboard consumes their public APIs. |

Development URLs are admin `http://localhost:5173` and Dashboard `http://localhost:5179`.
Production defaults to `https://admin.salonsaas.org` and `https://dashboard.salonsaas.org`.
Use `VITE_DASHBOARD_APP_URL` to override the Dashboard URL. Production authentication requires a
public PKCE client named `salon-dashboard` with `https://dashboard.<domain>/login` registered as a
redirect and post-logout URL.

Sign-in matches the other portals: `react-router dev` uses the email + dummy OTP (`123456`) mock
flow, while any build uses OAuth2 Authorization Code + PKCE with hidden-iframe silent renew (the
header `SessionBadge` shows the countdown) and signs out through the auth server's `/connect/logout`.
`/login?salon=<id>` carries the intended salon through the sign-in round-trip.

## Delivered MVP

- Optional `DASHBOARD` salon feature across admin and super-admin feature controls.
- Admin configuration for appointment management, cashier, and customer notifications.
- Appointment workspace: create, edit/reschedule, confirm, complete, cancel, and notify.
- Notification choice between the salon default and a custom appointment message.
- Cashier catalogue combining active salon services with in-stock Shop variants.
- Cash, card, and other payment recording; sale history and immutable line snapshots.
- Transactional Shop stock decrement and tenant/feature enforcement on every Dashboard API.

## Next increments

1. Operator permissions and shifts: owner-defined roles, cashier access, till opening/closing, and an audit trail.
2. Payment integration: terminal/provider intents, payment status, refunds, tips, VAT/tax breakdown, and printable/email receipts.
3. Rich appointment workflow: calendar views, drag-and-drop rescheduling, waitlist, walk-ins, no-show action, and SMS/push channels.
4. Customer and reporting: customer lookup, sale-to-appointment association, daily cash reconciliation, revenue reports, and exports.
5. Reliability: idempotency keys for checkout/notifications, optimistic stock locking, offline-safe drafts, and dedicated Dashboard API integration tests.
