import { useEffect, useRef, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { AppBridge, PostMessageTransport } from "@modelcontextprotocol/ext-apps/app-bridge";
import type { McpUiStyles } from "@modelcontextprotocol/ext-apps/app-bridge";
import { API_BASE } from "./api";

/** The model-visible Salon MCP App tools and how the website labels each one. */
export const MCP_APPS: Record<string, { title: string; subtitle: string }> = {
  salon_explorer: { title: "Salon info", subtitle: "Today's hours, holidays, location — and links to services, team and booking" },
  salon_services: { title: "Explore services", subtitle: "The menu, a card per service, its stylists and booking" },
  salon_team: { title: "Meet the team", subtitle: "Stylist profiles, their work and services, and booking" },
  salon_booking: { title: "Book an appointment", subtitle: "Service, stylist, date and time — step by step" },
  salon_booking_by_stylist: { title: "Book by stylist", subtitle: "Pick a stylist and see when they're free" },
  salon_booking_week: { title: "Week view", subtitle: "Every open time this week at a glance" },
  salon_shop: { title: "Salon shop", subtitle: "Products, variants, cart and checkout" },
  salon_membership: { title: "Membership", subtitle: "Plans, what members get, and joining online" },
};

type McpAppFrameProps = {
  /** The app's MCP tool, e.g. `salon_booking_week`. Defaults to the salon explorer. */
  toolName?: string;
  toolArguments: Record<string, unknown>;
  title?: string;
  className?: string;
  hostTheme: {
    accent: string;
    accentText: string;
    text: string;
    mutedText: string;
    fontFamily: string;
    fontCss?: string;
  };
  /** The app asked the host to send a chat message on the visitor's behalf (`ui/message`). */
  onMessage?: (text: string) => void;
  /** The app reported what the visitor is doing in it (`ui/update-model-context`). */
  onContextChange?: (text: string) => void;
};

/** Placeholder height while the app loads — roughly a short app, so the thread doesn't jump much. */
const LOADING_HEIGHT = 320;

// Every embedded app on the page shares one resolved HTML per tool — resolving it costs a
// tools/list plus a resources/read round-trip on a fresh MCP session.
const appHtmlCache = new Map<string, Promise<string>>();

function textOf(content: { type: string; text?: string }[] | undefined) {
  return (content ?? []).filter((c) => c.type === "text" && c.text).map((c) => c.text).join("\n").trim();
}

async function resolveAppHtml(client: Client, toolName: string): Promise<string> {
  const { tools } = await client.listTools();
  const tool = tools.find((t) => t.name === toolName);
  const ui = (tool?._meta as { ui?: { resourceUri?: string } } | undefined)?.ui;
  const uri = ui?.resourceUri ?? (tool?._meta as Record<string, unknown> | undefined)?.["ui/resourceUri"];
  if (typeof uri !== "string") throw new Error(`MCP tool ${toolName} has no UI resource`);
  const resource = await client.readResource({ uri });
  const html = resource.contents.find((c) => "text" in c && typeof c.text === "string");
  if (!html || !("text" in html)) throw new Error(`MCP resource ${uri} has no HTML`);
  return html.text as string;
}

/** Hosts the same MCP App UI resources used by MCP-compatible assistants. */
export function McpAppFrame({
  toolName = "salon_explorer", toolArguments, title, className, hostTheme, onMessage, onContextChange,
}: McpAppFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [srcDoc, setSrcDoc] = useState<string | null>(null);
  const [frameHeight, setFrameHeight] = useState(LOADING_HEIGHT);
  const [attempt, setAttempt] = useState(0);
  // Callbacks change identity every render; keep the latest without reconnecting the app.
  const callbacks = useRef({ onMessage, onContextChange });
  callbacks.current = { onMessage, onContextChange };

  useEffect(() => {
    let cancelled = false;
    let client: Client | undefined;
    let bridge: AppBridge | undefined;
    const frame = iframeRef.current;
    if (!frame) return;
    setReady(false);
    setError(null);
    setSrcDoc(null);

    const connect = async () => {
      try {
        client = new Client({ name: "Salon Website", version: "1.0.0" });
        await client.connect(new StreamableHTTPClientTransport(new URL(`${API_BASE}/mcp`)));
        const cached = appHtmlCache.get(toolName) ?? resolveAppHtml(client, toolName);
        appHtmlCache.set(toolName, cached);
        cached.catch(() => appHtmlCache.delete(toolName));
        const html = await cached;
        if (cancelled || !frame.contentWindow) return;

        bridge = new AppBridge(
          client,
          { name: "Salon Website", version: "1.0.0" },
          { openLinks: {}, downloadFile: {}, serverTools: {}, logging: {}, message: { text: {} }, updateModelContext: { text: {} } },
          {
            hostContext: {
              theme: "light",
              displayMode: "inline",
              styles: {
                variables: {
                  "--color-background-primary": "#ffffff",
                  "--color-background-secondary": "#f8fafc",
                  "--color-background-inverse": hostTheme.accent,
                  "--color-text-primary": hostTheme.text,
                  "--color-text-secondary": hostTheme.mutedText,
                  "--color-text-inverse": hostTheme.accentText,
                  "--color-border-primary": "#d9dee8",
                  "--font-sans": hostTheme.fontFamily,
                } as McpUiStyles,
                ...(hostTheme.fontCss ? { css: { fonts: hostTheme.fontCss } } : {}),
              },
            },
          },
        );
        bridge.onsizechange = ({ height }) => {
          if (typeof height === "number" && Number.isFinite(height) && height > 0) {
            // Let the chat thread own vertical scrolling instead of trapping it
            // inside a short iframe viewport.
            setFrameHeight(Math.ceil(height));
          }
        };
        bridge.onopenlink = async ({ url }) => {
          window.open(url, "_blank", "noopener,noreferrer");
          return {};
        };
        // Apps hand over files (e.g. a booking's .ics) as embedded resources; save them from the page,
        // since the sandboxed frame has no allow-downloads.
        bridge.ondownloadfile = async ({ contents }) => {
          const item = contents[0];
          if (!item || item.type !== "resource") return { isError: true };
          const resource = item.resource as { uri: string; mimeType?: string; text?: string; blob?: string };
          const data = resource.text ?? (resource.blob ? Uint8Array.from(atob(resource.blob), (ch) => ch.charCodeAt(0)) : undefined);
          if (data === undefined) return { isError: true };
          const url = URL.createObjectURL(new Blob([data], { type: resource.mimeType ?? "application/octet-stream" }));
          const link = document.createElement("a");
          link.href = url;
          link.download = resource.uri.split("/").pop() || "download";
          document.body.append(link);
          link.click();
          link.remove();
          window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
          return {};
        };
        bridge.onmessage = async ({ content }) => {
          const text = textOf(content as { type: string; text?: string }[]);
          if (!text || !callbacks.current.onMessage) return { isError: true };
          callbacks.current.onMessage(text);
          return {};
        };
        bridge.onupdatemodelcontext = async ({ content }) => {
          const text = textOf(content as { type: string; text?: string }[] | undefined);
          if (text) callbacks.current.onContextChange?.(text);
          return {};
        };
        bridge.oninitialized = async () => {
          try {
            await bridge!.sendToolInput({ arguments: toolArguments });
            const result = await client!.callTool({ name: toolName, arguments: toolArguments });
            await bridge!.sendToolResult(result);
            if (!cancelled) setReady(true);
          } catch {
            if (!cancelled) setError("The salon app could not load. Please try again.");
          }
        };
        await bridge.connect(new PostMessageTransport(frame.contentWindow, frame.contentWindow));
        // Load the app only after the host listener is active. The app sends ui/initialize
        // immediately on startup, so loading it sooner can lose that first postMessage.
        if (!cancelled) setSrcDoc(html);
      } catch (cause) {
        // A cleanup that closed the client mid-handshake surfaces here as "Not connected" —
        // that attempt was abandoned on purpose, not a failure.
        if (cancelled) return;
        console.error("Salon MCP app connection failed", cause);
        setError("The salon app could not connect. Please try again.");
      }
    };

    // Start on the next tick: StrictMode's dev mount → cleanup → mount then cancels the first
    // run before it opens a throwaway MCP session, instead of aborting its handshake.
    const start = window.setTimeout(() => void connect(), 0);
    return () => {
      cancelled = true;
      window.clearTimeout(start);
      void bridge?.close();
      void client?.close();
    };
  }, [toolName, toolArguments, attempt]);

  const label = title ?? MCP_APPS[toolName]?.title ?? "Salon app";
  const appName = MCP_APPS[toolName]?.title ?? "salon app";
  const loading = !ready && !error;
  return (
    <section className={`relative ${className ?? "overflow-hidden rounded-2xl border"}`} aria-label={label} aria-busy={loading}>
      {loading && (
        // Spinner + skeleton in the app's rough shape until its first tool result has rendered;
        // the iframe underneath stays transparent so the visitor never sees a blank white box.
        <div role="status" className="absolute inset-x-0 top-0 z-10 flex flex-col gap-4 p-4 sm:p-5" style={{ height: LOADING_HEIGHT }}>
          <div className="flex items-center gap-2.5 text-sm font-medium" style={{ color: hostTheme.mutedText }}>
            <Loader2 className="h-4 w-4 motion-safe:animate-spin" style={{ color: hostTheme.accent }} aria-hidden />
            <span>Opening {appName}…</span>
          </div>
          <div className="space-y-3 motion-safe:animate-pulse" aria-hidden>
            <div className="h-5 w-2/5 rounded-md" style={{ backgroundColor: `${hostTheme.accent}1f` }} />
            <div className="flex gap-2">
              {[0, 1, 2].map((n) => <div key={n} className="h-8 w-20 rounded-full" style={{ backgroundColor: `${hostTheme.accent}14` }} />)}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <div key={n} className={`h-20 rounded-xl ${n > 3 ? "hidden sm:block" : ""}`} style={{ backgroundColor: `${hostTheme.accent}10` }} />
              ))}
            </div>
          </div>
        </div>
      )}
      {error && (
        <div role="status" className="flex items-center justify-between gap-3 px-4 py-4 text-sm">
          <span className="text-red-600">{error}</span>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
            style={{ color: hostTheme.accent, backgroundColor: `${hostTheme.accent}14` }}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Try again
          </button>
        </div>
      )}
      <iframe
        ref={iframeRef}
        title={label}
        srcDoc={srcDoc ?? ""}
        sandbox="allow-scripts allow-forms allow-popups"
        referrerPolicy="no-referrer"
        className="block w-full border-0 motion-safe:transition-[opacity,height] motion-safe:duration-300 motion-safe:ease-out"
        style={{
          height: loading ? Math.max(frameHeight, LOADING_HEIGHT) : frameHeight,
          opacity: loading ? 0 : 1,
          display: error ? "none" : "block",
        }}
      />
    </section>
  );
}
