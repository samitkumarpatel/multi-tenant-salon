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
