# TODO / Follow-ups

Deferred decisions and known gaps that aren't tracked elsewhere — not a full backlog, just things
worth remembering the reasoning behind.

---

## MCP Apps protocol — not implemented for the Gen UI chat (2026-08-26)

The Generative UI website chat (`chat` module + `GenerativeUIWebsite.tsx`) uses a real Anthropic
model with direct Spring AI `@Tool` function-calling (`SalonDataTools` in
`chat/internal/SalonDataTools.java`), not the spec-compliant
[MCP Apps extension](https://modelcontextprotocol.io/extensions/apps/overview) (JSON-RPC over
postMessage, sandboxed `<iframe>`, `ui://` resources, a real MCP server).

**Decision:** per the user's call, kept the direct tool-calling architecture since the website is
the only consumer of this chat today — there's no external MCP host (Claude Desktop, VS Code
Copilot, etc.) that needs to connect to it. Implementing the full protocol would mean standing up
an actual MCP server plus a postMessage bridge between the React chat window and that server for
every interactive element, with no one to interoperate with yet.

**Revisit if:** there's ever a concrete need for this salon assistant to be discoverable/usable
from a real external MCP client, not just this site's own chat window.

---

## Voice for the website chat — planned, not started (2026-10-20)

Plan and current-setup review in [voice-chat.md](voice-chat.md): Phase 1 browser speech
(Web Speech API, no backend change), optional Phase 2 server speech (Azure AI Speech). Waiting
on review of the open decisions at the end of that page before implementing.

## Customer self-service portal — Phase 1 built (2026-10-23)

Plan in [customer-self-service-portal.md](customer-self-service-portal.md): a per-salon signed-in
account area (email magic-link / OTP, no password) covering booking, order and membership history,
booking cancel/reschedule, membership renew/cancel and contact details. Decided: per-salon scope,
passwordless sign-in, all four capability areas in. Phase 1 (auth + read-only history) is
independently shippable — built: sign-in + read-only history (`customer` module, `/account`). Next: Phase 2 (owner policy + booking cancel/reschedule).

Two things it surfaced that are worth knowing regardless of whether the portal gets built:
bookings have **no** customer-facing mutation endpoints at all (only `/api/salon-admin/**`), and
shop checkout returns a `Location` header pointing at a customer order route that does not exist.
Blocking question for Phase 2: cancelling a *paid* booking has no refund path, unlike the shop and
membership.
