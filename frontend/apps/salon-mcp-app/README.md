# Salon MCP App

This workspace builds the interactive view returned by the backend's `salon_explorer` MCP tool. Vite inlines JavaScript and CSS into one HTML file at `src/main/resources/static/mcp-app/index.html`; Spring serves that file as `ui://salon/explorer.html` with the MCP Apps MIME type.

Build it before packaging the backend:

```sh
cd frontend
npm install
npm run build --workspace=apps/salon-mcp-app
```

The HTTP MCP endpoint is `/mcp` (Streamable HTTP). Connect a compatible client to `https://<backend-host>/mcp`. Call `salon_explorer` with the salon's public UUID or handler/slug and a view (`overview`, `services`, `team`, `hours`, `location`, or `availability`). The returned MCP App lets the visitor switch views and check live availability through the host's tool bridge.

The server exposes public salon information, read-only availability, and customer booking. Booking is a two-step app flow: the visitor enters their details, reviews the service/date/time, and taps **Confirm booking**. The app-only `create_customer_booking` tool then calls the same public booking endpoint used by the website, preserving salon confirmation and payment rules. The MCP endpoint is permitted without a token so third-party hosts can connect; keep its tools scoped to public customer actions and do not expose salon administration or customer records.
