# Salon MCP Apps

This workspace builds the interactive views behind the backend's Salon MCP App tools — one
single-file HTML per app. `npm run build` (`build.mjs`) runs one Vite pass per entry with
`vite-plugin-singlefile`, writing `src/main/resources/static/mcp-app/<app>.html`; Spring serves each
as `ui://salon/<app>.html` with the MCP Apps MIME type (`SalonMcpAppResources`).

| App (entry) | MCP tool | What it does |
|---|---|---|
| `explorer.html` | `salon_explorer` | Overview, opening hours, location, contact; launcher tiles to the other apps |
| `services.html` | `salon_services` | Searchable, categorised service menu; book a service in place |
| `team.html` | `salon_team` | Stylist cards, profiles with portfolio lightbox; book with a stylist |
| `booking.html` | `salon_booking` | Step-by-step booking with a month calendar |
| `booking-stylist.html` | `salon_booking_by_stylist` | Stylist first, then their working days and times |
| `booking-week.html` | `salon_booking_week` | Mon–Sun grid of open times, week by week |
| `shop.html` | `salon_shop` | Products, variants, cart and checkout |

Layout: `src/apps/<app>.ts` is each app's view; `src/shared/` holds the runtime (`SalonApp` — host
connection, tool calls, `ui/message` hand-offs, `ui/update-model-context`), DOM/format helpers, the
booking building blocks (calendar, day strip, slot grid, `CheckoutFlow`), the reusable
`InlineBooking` pane and the `StaffProfile` dialog. `src/style.css` is shared and themed from the
host's MCP Apps style variables.

Build it before packaging the backend:

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
public endpoints the website uses, preserving salon confirmation, stock and payment rules. The MCP
endpoint is permitted without a token so third-party hosts can connect; keep its tools scoped to
public customer actions and do not expose salon administration or customer records.
