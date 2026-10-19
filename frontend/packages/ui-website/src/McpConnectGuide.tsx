import { useState } from "react";
import { Check, Copy, ExternalLink, TriangleAlert } from "lucide-react";
import { MCP_APPS } from "./McpAppFrame";

/**
 * "Use this salon in your AI app" — per-client setup for the salon's own remote MCP URL
 * ({@code /mcp/<handle>}). The URL identifies the salon, so setup is just "paste the URL".
 * Steps follow each vendor's current docs (Oct 2026); keep the `docs` links in sync when a
 * vendor renames its menus. Cloud-hosted clients (Claude, ChatGPT) connect from the vendor's
 * servers, so they need a public HTTPS URL; local clients (Claude Code, VS Code, Cursor) can
 * also use a localhost URL while developing.
 */

type Translate = (message: string, values?: Record<string, string | number>) => string;

type Client = {
  id: string;
  name: string;
  /** Runs in the vendor's cloud — can't reach localhost. */
  cloud: boolean;
  /** Renders the interactive MCP Apps views (otherwise the tools still answer in text). */
  interactive: "yes" | "experimental" | "text" | "varies";
  steps: string[];
  snippet?: (url: string, name: string) => { label: string; code: string };
  note?: string;
  docs: { label: string; href: string };
};

const CLIENTS: Client[] = [
  {
    id: "claude",
    name: "Claude",
    cloud: true,
    interactive: "yes",
    steps: [
      "In Claude (web or desktop app), open Customize → Connectors.",
      "Click Add custom connector, name it after the salon and paste the URL above.",
      "Under Authentication choose No sign-in, then click Add.",
      "In a new chat, make sure the connector is switched on in the tools menu — then just ask, e.g. \"What's free this week?\"",
    ],
    note: "Team & Enterprise: an Owner adds it under Organization settings → Connectors → Add → Custom (type Web); members then click Connect. The Free plan allows one custom connector.",
    docs: { label: "Claude connector guide", href: "https://www.claude.com/docs/connectors/custom/remote-mcp" },
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    cloud: true,
    interactive: "yes",
    steps: [
      "Go to chatgpt.com/plugins, select + and choose Add custom MCP server.",
      "Enter the salon's name and a short description, and paste the URL above under Connection.",
      "Set authentication to none, review the warning, select I understand and want to continue, then Create as a plugin.",
      "Install the plugin, start a new chat, type @ and pick it — then just ask, e.g. \"Show me your services\".",
    ],
    note: "Your account or workspace admin may restrict custom MCP servers.",
    docs: { label: "ChatGPT setup guide", href: "https://developers.openai.com/apps-sdk/deploy/connect-chatgpt" },
  },
  {
    id: "claude-code",
    name: "Claude Code",
    cloud: false,
    interactive: "text",
    steps: [
      "Run this command in your terminal:",
      "Inside Claude Code, run /mcp to check it connected, then ask about the salon.",
    ],
    snippet: (url, name) => ({ label: "Terminal", code: `claude mcp add --transport http ${name} ${url}` }),
    note: "Add --scope user to use it in every project.",
    docs: { label: "Claude Code MCP docs", href: "https://code.claude.com/docs/en/mcp" },
  },
  {
    id: "vscode",
    name: "VS Code",
    cloud: false,
    interactive: "experimental",
    steps: [
      "Run MCP: Add Server from the Command Palette, choose HTTP and paste the URL above — or add this to .vscode/mcp.json:",
      "Open Copilot Chat in Agent mode, enable the salon's tools, then ask about the salon.",
    ],
    snippet: (url, name) => ({ label: ".vscode/mcp.json", code: JSON.stringify({ servers: { [name]: { type: "http", url } } }, null, 2) }),
    note: "Interactive views in VS Code are experimental.",
    docs: { label: "VS Code MCP docs", href: "https://code.visualstudio.com/docs/copilot/customization/mcp-servers" },
  },
  {
    id: "cursor",
    name: "Cursor",
    cloud: false,
    interactive: "yes",
    steps: [
      "Add the server to ~/.cursor/mcp.json (all projects) or .cursor/mcp.json (this project):",
      "Check the server shows as connected in Cursor's MCP settings, then ask about the salon in Agent chat.",
    ],
    snippet: (url, name) => ({ label: "~/.cursor/mcp.json", code: JSON.stringify({ mcpServers: { [name]: { url } } }, null, 2) }),
    docs: { label: "Cursor MCP docs", href: "https://cursor.com/docs/context/mcp" },
  },
  {
    id: "other",
    name: "Other",
    cloud: false,
    interactive: "varies",
    steps: [
      "Add the URL above as a remote MCP server using the Streamable HTTP transport.",
      "No authentication is needed — leave sign-in / API key empty.",
      "That's it: the URL already points at this salon, so just ask about it.",
    ],
    note: "Interactive views also work in Goose, Microsoft 365 Copilot, Postman and MCPJam; other clients get the same answers as text.",
    docs: { label: "Connecting remote MCP servers", href: "https://modelcontextprotocol.io/docs/develop/connect-remote-servers" },
  },
];

function isLocalOnly(url: string) {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol !== "https:" || hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname.endsWith(".local");
  } catch {
    return true;
  }
}

export function McpConnectGuide({ serverUrl, handle, salonName, accent, text, dim, border, t }: {
  serverUrl: string;
  handle: string;
  salonName: string;
  accent: string;
  text: string;
  dim: string;
  border: string;
  t: Translate;
}) {
  const [clientId, setClientId] = useState(CLIENTS[0].id);
  const [copied, setCopied] = useState<string | null>(null);
  const client = CLIENTS.find((c) => c.id === clientId) ?? CLIENTS[0];
  const localOnly = isLocalOnly(serverUrl);
  // Config key / CLI name for the server — the salon handle, reduced to what every client accepts.
  const serverName = handle.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "salon";
  const snippet = client.snippet?.(serverUrl, serverName);

  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1600);
    } catch {
      setCopied(null);
    }
  };

  const copyBox = (key: string, label: string, value: string, multiline = false) => (
    <div className="rounded-xl border p-3" style={{ borderColor: border }}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold" style={{ color: dim }}>{label}</span>
        <button
          type="button"
          onClick={() => void copy(key, value)}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold"
          style={{ color: accent, backgroundColor: `${accent}12` }}
        >
          {copied === key ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied === key ? t("Copied") : t("Copy")}
        </button>
      </div>
      {multiline
        ? <pre className="overflow-x-auto whitespace-pre text-xs leading-relaxed" style={{ color: text }}><code>{value}</code></pre>
        : <code className="block break-all text-xs leading-relaxed" style={{ color: text }}>{value}</code>}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {copyBox("url", t("{name}'s MCP URL", { name: salonName }), serverUrl)}
        <p className="text-[11px] leading-relaxed" style={{ color: dim }}>
          {t("This URL is just for {name} — paste it into your AI app and you're set. No sign-in or salon ID needed.", { name: salonName })}
        </p>
        {localOnly && (
          <p className="flex gap-2 rounded-xl p-3 text-[11px] leading-relaxed" style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{t("This is a local address. Claude and ChatGPT connect from the internet and need the salon's public HTTPS address — open this page on the live site, or expose your dev server through an HTTPS tunnel. Claude Code, VS Code and Cursor on this computer can use it as is.")}</span>
          </p>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold" style={{ color: text }}>{t("Choose your AI app")}</p>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t("AI app")}>
          {CLIENTS.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={c.id === client.id}
              onClick={() => setClientId(c.id)}
              className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
              style={c.id === client.id
                ? { color: "#fff", backgroundColor: accent, borderColor: accent }
                : { color: text, borderColor: border }}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel" className="space-y-3">
        {client.cloud && localOnly && (
          <p className="text-[11px] font-semibold" style={{ color: "#b45309" }}>
            {t("{client} can't reach the local address above.", { client: client.name })}
          </p>
        )}
        <ol className="list-decimal space-y-2 pl-5 text-xs leading-relaxed" style={{ color: text }}>
          {client.steps.map((step, index) => (
            <li key={index}>
              {t(step)}
              {index === 0 && snippet && <div className="mt-2">{copyBox(`snippet-${client.id}`, snippet.label, snippet.code, snippet.code.includes("\n"))}</div>}
            </li>
          ))}
        </ol>
        {client.note && <p className="text-[11px] leading-relaxed" style={{ color: dim }}>{t(client.note)}</p>}
        <a href={client.docs.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold underline" style={{ color: accent }}>
          {t(client.docs.label)} <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      </div>

      <div className="rounded-xl p-3" style={{ backgroundColor: `${accent}0d` }}>
        <p className="mb-1.5 text-[11px] font-semibold" style={{ color: text }}>
          {{
            yes: t("Interactive apps in {client}", { client: client.name }),
            experimental: t("Interactive apps (experimental in {client})", { client: client.name }),
            text: t("Interactive apps — {client} shows their answers as text", { client: client.name }),
            varies: t("Interactive apps — shown where the client supports MCP Apps"),
          }[client.interactive]}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {Object.values(MCP_APPS).map((app) => (
            <span key={app.title} className="rounded-full px-2 py-0.5 text-[10.5px] font-medium" style={{ color: text, backgroundColor: `${accent}14` }}>
              {t(app.title)}
            </span>
          ))}
        </div>
        <p className="mt-2 text-[10.5px] leading-relaxed" style={{ color: dim }}>
          {t("The assistant can look up services, the team, opening hours, availability and products. Bookings and shop orders are only made when you confirm them yourself inside the app.")}
        </p>
      </div>
    </div>
  );
}
