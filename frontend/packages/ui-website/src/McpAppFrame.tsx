import { useEffect, useRef, useState } from "react";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { AppBridge, PostMessageTransport } from "@modelcontextprotocol/ext-apps/app-bridge";
import type { McpUiStyles } from "@modelcontextprotocol/ext-apps/app-bridge";
import { API_BASE } from "./api";

type McpAppFrameProps = {
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
};

/** Hosts the same MCP App UI resource used by MCP-compatible assistants. */
export function McpAppFrame({ toolArguments, title = "Salon Explorer", className, hostTheme }: McpAppFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridgeRef = useRef<AppBridge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [srcReady, setSrcReady] = useState(false);
  const [frameHeight, setFrameHeight] = useState(460);

  useEffect(() => {
    let cancelled = false;
    let client: Client | undefined;
    let bridge: AppBridge | undefined;
    const frame = iframeRef.current;
    if (!frame) return;
    setReady(false);
    setError(null);
    setSrcReady(false);

    const connect = async () => {
      try {
        client = new Client({ name: "Salon Website", version: "1.0.0" });
        await client.connect(new StreamableHTTPClientTransport(new URL(`${API_BASE}/mcp`)));
        if (cancelled || !frame.contentWindow) return;

        bridge = new AppBridge(
          client,
          { name: "Salon Website", version: "1.0.0" },
          { openLinks: {}, serverTools: {}, logging: {} },
          {
            hostContext: {
              theme: "light",
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
        bridgeRef.current = bridge;
        bridge.onsizechange = ({ height }) => {
          if (typeof height === "number" && Number.isFinite(height) && height > 0) {
            // Let the chat thread own vertical scrolling instead of trapping it
            // inside a short iframe viewport.
            setFrameHeight(Math.ceil(height));
          }
        };
        bridge.oninitialized = async () => {
          try {
            await bridge!.sendToolInput({ arguments: toolArguments });
            const result = await client!.callTool({ name: "salon_explorer", arguments: toolArguments });
            await bridge!.sendToolResult(result);
            if (!cancelled) setReady(true);
          } catch {
            if (!cancelled) setError("The salon app could not load. Please try again.");
          }
        };
        await bridge.connect(new PostMessageTransport(frame.contentWindow, frame.contentWindow));
        // Load the app only after the host listener is active. The app sends ui/initialize
        // immediately on startup, so loading it sooner can lose that first postMessage.
        if (!cancelled) setSrcReady(true);
      } catch (cause) {
        console.error("Salon MCP app connection failed", cause);
        if (!cancelled) setError("The salon app could not connect. Please try again.");
      }
    };

    void connect();
    return () => {
      cancelled = true;
      bridgeRef.current = null;
      void bridge?.close();
      void client?.close();
    };
  }, [toolArguments]);

  return (
    <section
      className={className ?? "overflow-hidden rounded-2xl border"}
      aria-label={title}
    >
      {!ready && !error && <p className="px-4 py-3 text-xs text-neutral-500">Opening the interactive salon app…</p>}
      {error && <p role="status" className="px-4 py-3 text-sm text-red-600">{error}</p>}
      <iframe
        ref={iframeRef}
        title={title}
        src={srcReady ? `${API_BASE}/mcp-app/index.html` : "about:blank"}
        sandbox="allow-scripts allow-forms allow-popups"
        referrerPolicy="no-referrer"
        className="block w-full border-0"
        style={{ height: frameHeight, display: error ? "none" : "block" }}
      />
    </section>
  );
}
