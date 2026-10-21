# Salon MCP Apps

This workspace builds the interactive views behind the backend's Salon MCP App tools — one
single-file HTML per app. `npm run build` (`build.mjs`) runs one Vite pass per entry with
`vite-plugin-singlefile`, writing `src/main/resources/static/mcp-app/<app>.html`; Spring serves each
as `ui://salon/<app>.html` with the MCP Apps MIME type (`SalonMcpAppResources`).

| App (entry) | MCP tool | What it does |
|---|---|---|
| `explorer.html` | `salon_explorer` | Connected salon guide, opening on the salon home card (today's status, dated hours with holidays, location, contact) |
| `services.html` | `salon_services` | Connected salon guide, opening on the service menu (or one service's detail card) |
| `team.html` | `salon_team` | Connected salon guide, opening on the team (or one stylist's profile page) |
| `booking.html` | `salon_booking` | Step-by-step booking with a month calendar |
| `booking-stylist.html` | `salon_booking_by_stylist` | Stylist first, then their working days and times |
| `booking-week.html` | `salon_booking_week` | Mon–Sun grid of open times, week by week |
| `shop.html` | `salon_shop` | Products, variants, cart and checkout |
| `membership.html` | `salon_membership` | Membership plans, comparison, and joining via a one-time Stripe Checkout (`create_membership_checkout`, app-only) |

Layout: `src/apps/<app>.ts` is each app's view; `src/shared/` holds the runtime (`SalonApp` — host
connection, tool calls, `ui/message` hand-offs, `ui/update-model-context`), DOM/format helpers, the
booking building blocks (calendar, day strip, slot grid, `CheckoutFlow`), the reusable
`InlineBooking` pane, the `PortfolioGallery` lightbox, the opening-hours cards (`opening.ts`) and
`SalonNavigator` (`navigator.ts`) — the back-stack router behind the explorer, services and team apps,
which renders every section (home, hours, location, service menu, service card, team, stylist page,
booking) and loads the other sections' data through their tools on demand. `nextAvailable.ts` caches the app-only
`salon_next_available` lookups behind the "Next free" hints; `calendar.ts` builds the booking's
`.ics`, which `SalonApp.download` hands to the host (`ui/download-file`). `src/style.css` is shared and themed from the
host's MCP Apps style variables.

Build it before packaging the backend locally (`./mvnw` never runs npm; it packages the committed
`static/mcp-app/*.html`). The `deploy-backend` workflow rebuilds it on every deploy, so the image
always matches this source — but commit the regenerated HTML anyway so local builds match too:

```sh
cd frontend
npm install
npm run build --workspace=apps/salon-mcp-app
```

Each salon has its own MCP URL, `https://<backend-host>/mcp/<salon-handle>` (Streamable HTTP) — the
one the salon website's **MCP** button shows. Paste it into a compatible client and every tool uses
that salon; no `salonIdOrHandler` needed. The shared `https://<backend-host>/mcp` endpoint also works
when each tool call passes `salonIdOrHandler`.

Bookings and orders are two-step app flows: the visitor enters their details, reviews, and taps
**Confirm booking** / **Place order**. The app-only `create_customer_booking` and
`create_shop_order` tools (`visibility: ["app"]`, never callable by the model) then call the same
public endpoints the website uses, preserving salon confirmation, stock and payment rules. Memberships work the
same way: `create_membership_checkout` (app-only) starts the one-time Stripe Checkout for the first period
that the website uses, and the app opens it. Once Stripe confirms payment the membership becomes active and
its QR code is emailed; a renewal link follows by email before the period ends. The MCP
endpoint is permitted without a token so third-party hosts can connect; keep its tools scoped to
public customer actions and do not expose salon administration or customer records.
