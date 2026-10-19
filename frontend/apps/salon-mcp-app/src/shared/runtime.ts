import { App, applyDocumentTheme, applyHostFonts, applyHostStyleVariables } from "@modelcontextprotocol/ext-apps";
import { h } from "./dom";
import "../style.css";

type CallToolResult = Awaited<ReturnType<App["callServerTool"]>>;

export type Data = Record<string, any> & { app?: string; view?: string; salonId: string; salonName?: string; error?: string };
export type Outcome<T> = { ok: true; data: T } | { ok: false; error: string };

export function parseResult<T>(result: CallToolResult | undefined): Outcome<T> {
  const text = result?.content?.find((item) => item.type === "text")?.text;
  if (!result || result.isError) return { ok: false, error: text || "Something went wrong. Please try again." };
  if (result.structuredContent) return { ok: true, data: result.structuredContent as T };
  try {
    return { ok: true, data: JSON.parse(text ?? "") as T };
  } catch {
    return { ok: false, error: text || "Unexpected response from the salon." };
  }
}

/**
 * One running Salon MCP App. Owns the host connection and the app's latest tool data; the
 * app-specific `view` re-renders the whole root from that state whenever it changes.
 */
export class SalonApp<T extends Data> {
  readonly app: App;
  readonly root = document.querySelector<HTMLElement>("#app")!;
  data: T | undefined;
  busy = false;
  error: string | undefined;
  private contextTimer: number | undefined;
  private lastContext = "";

  constructor(name: string, readonly tool: string, private readonly view: (rt: SalonApp<T>) => Node | (Node | null | undefined | false)[]) {
    this.app = new App({ name, version: "2.0.0" });
    this.app.onhostcontextchanged = () => this.applyTheme();
    this.app.ontoolresult = (result) => {
      const outcome = parseResult<T>(result as CallToolResult);
      if (outcome.ok) {
        this.data = outcome.data;
        this.error = undefined;
      } else {
        this.error = outcome.error;
      }
      this.render();
    };
  }

  start() {
    this.app.connect().then(() => this.applyTheme()).catch(() => {
      this.root.replaceChildren(h("p", { class: "error" }, "Could not connect to the chat client."));
    });
  }

  get salonId() {
    return this.data?.salonId ?? "";
  }

  render() {
    if (!this.data) {
      this.root.replaceChildren(this.error
        ? h("p", { class: "error" }, this.error)
        : h("div", { class: "loading" }, h("span", { class: "spinner" }), h("span", null, "Loading…")));
      return;
    }
    const nodes = this.view(this);
    this.root.replaceChildren(...(Array.isArray(nodes) ? nodes : [nodes]).filter((n): n is Node => !!n));
  }

  /** Calls any server tool through the host, scoped to this salon. */
  async call<R = Data>(tool: string, args: Record<string, unknown> = {}): Promise<Outcome<R>> {
    try {
      const result = await this.app.callServerTool({
        name: tool,
        arguments: { salonIdOrHandler: this.salonId, ...stripEmpty(args) },
      });
      return parseResult<R>(result as CallToolResult);
    } catch {
      return { ok: false, error: "Could not reach the salon. Please try again." };
    }
  }

  /** Re-runs this app's own tool with new arguments and replaces its data. */
  async reload(args: Record<string, unknown>) {
    if (this.busy) return false;
    this.busy = true;
    this.error = undefined;
    this.render();
    const outcome = await this.call<T>(this.tool, args);
    this.busy = false;
    if (outcome.ok) this.data = outcome.data;
    else this.error = outcome.error;
    this.render();
    return outcome.ok;
  }

  /** Runs a write/side tool with the busy indicator, without replacing this app's data. */
  async act<R = Data>(tool: string, args: Record<string, unknown>): Promise<Outcome<R>> {
    this.busy = true;
    this.render();
    const outcome = await this.call<R>(tool, args);
    this.busy = false;
    this.render();
    return outcome;
  }

  /** Asks the host to post a chat message on the visitor's behalf — how one app hands off to another. */
  ask(text: string) {
    void this.app.sendMessage({ role: "user", content: [{ type: "text", text }] }).catch(() => undefined);
  }

  /** Tells the host (and so the assistant) what the visitor is doing in the app. Debounced. */
  context(text: string) {
    if (text === this.lastContext) return;
    this.lastContext = text;
    window.clearTimeout(this.contextTimer);
    this.contextTimer = window.setTimeout(() => {
      void this.app.updateModelContext({ content: [{ type: "text", text }] }).catch(() => undefined);
    }, 400);
  }

  openLink(url: string) {
    this.app.openLink({ url }).catch(() => window.open(url, "_blank", "noopener,noreferrer"));
  }

  private applyTheme() {
    const context = this.app.getHostContext();
    if (context?.theme) applyDocumentTheme(context.theme);
    if (context?.styles?.variables) applyHostStyleVariables(context.styles.variables);
    if (context?.styles?.css?.fonts) applyHostFonts(context.styles.css.fonts);
  }
}

function stripEmpty(args: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(args).filter(([, v]) => v !== undefined && v !== null && v !== ""));
}

/** The header every app shares: eyebrow, salon name, and an optional subtitle. */
export function appHeader(eyebrow: string, title: string, subtitle?: string) {
  return h("header", { class: "header" },
    h("span", { class: "eyebrow" }, eyebrow),
    h("span", { class: "title" }, title),
    subtitle ? h("span", { class: "subtitle" }, subtitle) : null);
}

export function statusLine(rt: SalonApp<any>) {
  return [
    rt.busy ? h("div", { class: "loading compact" }, h("span", { class: "spinner" }), h("span", null, "Updating…")) : null,
    rt.error ? h("p", { class: "error", role: "alert" }, rt.error) : null,
  ].filter(Boolean) as Node[];
}
