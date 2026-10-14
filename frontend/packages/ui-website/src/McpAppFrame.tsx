import { useEffect, useRef, useState } from "react";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { AppBridge, PostMessageTransport } from "@modelcontextprotocol/ext-apps/app-bridge";
import { API_BASE } from "./api";

type McpAppFrameProps = {
  toolArguments: Record<string, unknown>;
  title?: string;
  className?: string;
};

/** Hosts the same MCP App UI resource used by MCP-compatible assistants. */
export function McpAppFrame({ toolArguments, title = "Salon Explorer", className }: McpAppFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridgeRef = useRef<AppBridge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [srcReady, setSrcReady] = useState(false);

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
        );
        bridgeRef.current = bridge;
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
    <section className={className ?? "overflow-hidden rounded-2xl border"} aria-label={title}>
      {!ready && !error && <p className="px-4 py-3 text-xs text-neutral-500">Opening the interactive salon app…</p>}
      {error && <p role="status" className="px-4 py-3 text-sm text-red-600">{error}</p>}
      <iframe
        ref={iframeRef}
        title={title}
        src={srcReady ? `${API_BASE}/mcp-app/index.html` : "about:blank"}
        sandbox="allow-scripts allow-forms allow-popups"
        referrerPolicy="no-referrer"
        className="block w-full border-0"
        style={{ height: 460, display: error ? "none" : "block" }}
      />
    </section>
  );
}
