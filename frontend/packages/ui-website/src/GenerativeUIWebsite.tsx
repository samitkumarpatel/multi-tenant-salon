import { LanguageSelector, useI18n } from "@salon/i18n";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp, BadgeCheck, Calendar, CalendarCheck, CalendarRange, CheckCircle2, Clock, Info, LayoutGrid, Loader2, Maximize2, Minimize2, MapPin, Phone, PlugZap, Scissors, Search, ShoppingBag, Sparkles, SquarePen, UserRound, Users, Wrench, X,
} from "lucide-react";
import { FONTS, fontStack, loadGoogleFont, contrastText, isLightColor } from "./theme";
import { SiteHeader, SiteFooter } from "./SiteChrome";
import { apiFetch, API_BASE } from "./api";
import {
  BookingPickerCard, CardShell,
  type CardTokens, type PendingBookingFields, type PickerProgress,
} from "./GenerativeUICards";
import { GenUIComponent, type UIComponent, type GenUICtx } from "./GenerativeUIRegistry";
import { MCP_APPS, McpAppFrame } from "./McpAppFrame";
import { McpConnectGuide } from "./McpConnectGuide";
import { type ClosureRange, resolveHolidayRanges } from "./bookingDates";
import { STAFF_ROLE_LABEL } from "./constants";
import type { Booking, Salon, SalonHoliday, ServiceItem, StaffMember, WebsiteTheme } from "./types";

export interface GenerativeUIWebsiteProps {
  salon: Salon;
  staff: StaffMember[];
  services: ServiceItem[];
  theme: WebsiteTheme;
  /** "website" = embedded in the website layout (default); "booking" = standalone full-page with own header + toggle */
  context?: "website" | "booking";
  // Website context
  getPagePath?: (page: string) => string;
  onNavigate?: (page: string | null) => void;
  // Booking context
  /** Called when user taps the Wizard tab or a "Book now" CTA */
  onSwitchToWizard?: () => void;
}

// ── Types ──────────────────────────────────────────────────────────────────

type ToolCard = { name: string; label: string; done: boolean };

type PendingBookingStatus = "proposed" | "confirming" | "confirmed" | "dismissed" | "error";
type PendingBookingUI = {
  serviceId: number;
  staffId: number | null;
  appointmentDate: string;
  startTime: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  notes: string | null;
  status: PendingBookingStatus;
  error?: string;
  confirmedBooking?: Booking;
};

type CardType = "services" | "staff" | "hours" | "location" | "contact";

// The assistant can now attach several interactive components to one turn (a services card AND
// a button group, say). Each is a { type, props } directive straight from the backend — see
// GenerativeUIRegistry. `booking-picker` is the one type the parent renders itself (its
// callbacks are coupled to the thread); its props carry `serviceId`, optional `staffId`, and an
// optional `resume` snapshot lifted from an earlier picker it replaces.
type Message =
  | { role: "user"; text: string; time: string }
  | {
      role: "assistant"; text: string; tool?: ToolCard; time: string; cta?: "book";
      pendingBooking?: PendingBookingUI;
      components?: UIComponent[];
      suggested?: string[];
      mcpAppCall?: Record<string, unknown>;
      /** Which Salon MCP App `mcpAppCall` opens (e.g. `salon_booking_week`). */
      mcpAppTool?: string;
      /** The app's latest `ui/update-model-context` note — what the visitor is doing in it. */
      mcpAppContext?: string;
      /** Identifies the turn so late stream events (suggestions) land on the right message. */
      turnId?: number;
      /** True while the reply text is still arriving. */
      streaming?: boolean;
      /** Live selections inside this turn's booking-picker, lifted up for the uiState clue. */
      picker?: PickerProgress;
    };

// ── Constants ──────────────────────────────────────────────────────────────

const DAY_ORDER = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

// ── Helpers ────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}
function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function isOpenNow(salon: Salon): boolean {
  const hours = salon.operatingHours;
  if (!hours?.length) return false;
  const d = new Date();
  const today = hours.find((h) => h.day === DAY_ORDER[d.getDay()]);
  if (!today || today.closed) return false;
  const [oh, om] = today.openTime.split(":").map(Number);
  const [ch, cm] = today.closeTime.split(":").map(Number);
  const cur = d.getHours() * 60 + d.getMinutes();
  return cur >= oh * 60 + om && cur < ch * 60 + cm;
}
function todayHours(salon: Salon): string | null {
  const hours = salon.operatingHours;
  if (!hours?.length) return null;
  const today = hours.find((h) => h.day === DAY_ORDER[new Date().getDay()]);
  if (!today || today.closed) return "Closed today";
  return `${today.openTime} – ${today.closeTime}`;
}
function formatDateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function sameProgress(a: PickerProgress, b: PickerProgress): boolean {
  return a.step === b.step && a.staffId === b.staffId && a.staffChosen === b.staffChosen
    && a.date === b.date && a.time === b.time
    && a.name === b.name && a.email === b.email && a.phone === b.phone;
}

type PendingBookingResponse = {
  serviceId: number;
  staffId: number | null;
  appointmentDate: string;
  startTime: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  notes: string | null;
};
// The assistant picks which interactive component(s) to render by calling show* / start* tools
// server-side; the backend forwards the list here as { type, props }. Unknown types are ignored.
type ChatApiResponse = {
  sessionId: string;
  message: string | null;
  components?: UIComponent[] | null;
  toolsUsed?: string[];
  suggestedQuestions?: string[] | null;
  pendingBooking?: PendingBookingResponse | null;
  mcpAppCall?: Record<string, unknown> | null;
  mcpAppTool?: string | null;
};

// Header icon per Salon MCP App embedded under a reply (see MCP_APPS for the labels).
const MCP_APP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  salon_explorer: Info,
  salon_services: Scissors,
  salon_team: Users,
  salon_booking: CalendarCheck,
  salon_booking_by_stylist: UserRound,
  salon_booking_week: CalendarRange,
  salon_shop: ShoppingBag,
  salon_membership: BadgeCheck,
};

const TOOL_LABELS: Record<string, string> = {
  salon: "salon info",
  staff: "staff",
  services: "services",
  holidays: "holidays",
  slots: "availability",
  "booking-proposal": "booking",
};

function friendlyToolLabel(tools: string[]): string {
  return tools.length ? tools.map((t) => TOOL_LABELS[t] ?? MCP_APPS[t]?.title.toLowerCase() ?? t).join(", ") : "salon-data";
}

// Booking-context replies get a "Book now" CTA unless the visitor asked a location/contact
// question (nothing to book yet — they just need directions or a way to reach the salon).
const NO_CTA_PATTERN = /location|address|where|find|contact|phone|email|reach|call/i;

// Short lead-in shown above a data card that was rendered instantly (no LLM call) from a
// quick-action tap.
const CARD_INTRO: Record<CardType, string> = {
  services: "Here's what we offer:",
  staff: "Meet the team:",
  hours: "Here's when we're open:",
  location: "Here's how to find us:",
  contact: "Here's how to reach us:",
};

// Normalises the raw component list from the backend: passes every directive through untouched
// except booking-picker, whose serviceId must resolve to a real service — the model can pass one
// that never resolved (null) or hallucinated. When it doesn't resolve, don't leave a "pick a
// date below" reply pointing at nothing: one active service → open it directly; otherwise drop
// to a services card so the visitor taps one to start. Unknown types are left in place and the
// registry ignores them.
function normalizeComponents(raw: UIComponent[] | null | undefined, services: ServiceItem[]): UIComponent[] {
  if (!raw?.length) return [];
  return raw.flatMap((c): UIComponent[] => {
    if (c.type !== "booking-picker") return [c];
    const wantedId = typeof c.props?.serviceId === "number" ? (c.props.serviceId as number) : undefined;
    const wanted = wantedId != null ? services.find((s) => s.id === wantedId) : undefined;
    const staffId = typeof c.props?.staffId === "number" ? c.props.staffId : undefined;
    const date = typeof c.props?.date === "string" ? c.props.date : undefined;
    if (wanted) return [{ type: "booking-picker", props: { serviceId: wanted.id, staffId, date } }];
    const active = services.filter((s) => s.active);
    return active.length === 1
      ? [{ type: "booking-picker", props: { serviceId: active[0].id, staffId, date } }]
      : [{ type: "services", props: {} }];
  });
}

// The model is shown bracketed UI-state notes in the history ("[Showed the visitor …]") and
// occasionally parrots one back as its own reply instead of calling the matching show* tool.
// Drop any line that is wholly such a stage-direction so the raw bracket never reaches the visitor.
function stripStageDirections(text: string | null | undefined): string {
  return (text ?? "")
    .split("\n")
    .filter((line) => !/^\s*\[[^\]]*\]\s*$/.test(line))
    .join("\n")
    .trim();
}

// Session id lives in sessionStorage so a reload resumes the same server-side conversation
// (within its TTL); falls back to a fresh uuid when storage is unavailable (SSR, private mode).
function newSessionId(salonId: number): string {
  const gen = () =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  if (typeof window === "undefined") return gen();
  const key = `genui:sess:${salonId}`;
  try {
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const fresh = gen();
    window.sessionStorage.setItem(key, fresh);
    return fresh;
  } catch {
    return gen();
  }
}

function resetSessionId(salonId: number): string {
  const key = `genui:sess:${salonId}`;
  const gen =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try { window.sessionStorage.setItem(key, gen); } catch { /* ignore */ }
  return gen;
}

type ChatReplyResult = {
  text: string;
  toolsUsed: string[];
  pendingBooking: PendingBookingResponse | null;
  components: UIComponent[] | null;
  suggestedQuestions: string[];
  mcpAppCall: Record<string, unknown> | null;
  mcpAppTool: string | null;
};

async function requestChatReply(
  salonId: number,
  sessionId: string,
  context: "website" | "booking",
  message: string,
  uiState: string | undefined
): Promise<ChatReplyResult> {
  try {
    const res = await apiFetch<ChatApiResponse>(`${API_BASE}/api/salon/${salonId}/chat`, {
      method: "POST",
      body: JSON.stringify({ sessionId, context, message, uiState }),
    });
    return {
      text: res.message ?? "",
      toolsUsed: res.toolsUsed ?? [],
      pendingBooking: res.pendingBooking ?? null,
      components: res.components ?? null,
      suggestedQuestions: Array.isArray(res.suggestedQuestions) ? res.suggestedQuestions.slice(0, 4) : [],
      mcpAppCall: res.mcpAppCall ?? null,
      mcpAppTool: res.mcpAppTool ?? null,
    };
  } catch {
    return {
      text: "Sorry, I'm having trouble responding right now — please try again shortly or contact us directly.",
      toolsUsed: [],
      pendingBooking: null,
      components: null,
      suggestedQuestions: [],
      mcpAppCall: null,
      mcpAppTool: null,
    };
  }
}

type StreamHandlers = {
  /** A chunk of the reply text, as the model writes it. */
  onDelta: (text: string) => void;
  /** The assistant opened a Salon MCP App — fires before the text is finished. */
  onApp: (tool: string, args: Record<string, unknown>) => void;
  /** Follow-up chips, generated after the reply. */
  onSuggestions: (questions: string[]) => void;
};

function toResult(res: ChatApiResponse, suggestions: string[] = []): ChatReplyResult {
  return {
    text: res.message ?? "",
    toolsUsed: res.toolsUsed ?? [],
    pendingBooking: res.pendingBooking ?? null,
    components: res.components ?? null,
    suggestedQuestions: suggestions,
    mcpAppCall: res.mcpAppCall ?? null,
    mcpAppTool: res.mcpAppTool ?? null,
  };
}

/**
 * Streams one assistant turn from POST .../chat/stream (Server-Sent Events over fetch, since
 * EventSource can't POST). Resolves with the final reply on `done`; suggestions keep arriving
 * through `onSuggestions` afterwards. If streaming isn't available (older backend, proxy
 * stripping SSE) it falls back to the one-shot endpoint, so the chat always answers.
 */
async function streamChatReply(
  salonId: number,
  sessionId: string,
  context: "website" | "booking",
  message: string,
  uiState: string | undefined,
  handlers: StreamHandlers,
): Promise<ChatReplyResult> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/salon/${salonId}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ sessionId, context, message, uiState }),
    });
  } catch {
    return requestChatReply(salonId, sessionId, context, message, uiState);
  }
  if (!res.ok || !res.body || !res.headers.get("content-type")?.includes("text/event-stream")) {
    return requestChatReply(salonId, sessionId, context, message, uiState);
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let final: ChatReplyResult | null = null;
  let resolveDone!: (value: ChatReplyResult) => void;
  const done = new Promise<ChatReplyResult>((resolve) => { resolveDone = resolve; });

  const handle = (event: string, data: string) => {
    let payload: Record<string, unknown>;
    try { payload = JSON.parse(data); } catch { return; }
    if (event === "delta" && typeof payload.text === "string") handlers.onDelta(payload.text);
    else if (event === "app" && typeof payload.tool === "string") handlers.onApp(payload.tool, (payload.arguments ?? {}) as Record<string, unknown>);
    else if ((event === "done" || event === "error") && !final) { final = toResult(payload as ChatApiResponse); resolveDone(final); }
    else if (event === "suggestions" && Array.isArray(payload.questions)) handlers.onSuggestions((payload.questions as string[]).slice(0, 4));
  };

  void (async () => {
    try {
      for (;;) {
        const { value, done: ended } = await reader.read();
        if (ended) break;
        buffer += value;
        // SSE events are separated by a blank line; each has "event:" and "data:" lines.
        let split: number;
        while ((split = buffer.search(/\r?\n\r?\n/)) >= 0) {
          const raw = buffer.slice(0, split);
          buffer = buffer.slice(split).replace(/^\r?\n\r?\n/, "");
          let event = "message";
          const data: string[] = [];
          for (const line of raw.split(/\r?\n/)) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
          }
          if (data.length) handle(event, data.join("\n"));
        }
      }
    } catch {
      /* connection dropped — whatever arrived is kept; resolve below */
    }
    if (!final) {
      resolveDone({
        text: "Sorry, I'm having trouble responding right now — please try again shortly or contact us directly.",
        toolsUsed: [], pendingBooking: null, components: null, suggestedQuestions: [], mcpAppCall: null, mcpAppTool: null,
      });
    }
  })();
  return done;
}

// ── Markdown renderer ──────────────────────────────────────────────────────

function MdText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
        p.startsWith("**") && p.endsWith("**")
          ? <strong key={i}>{p.slice(2, -2)}</strong>
          : <span key={i}>{p}</span>
      )}
    </>
  );
}
/** While a reply streams, hide a `**` whose closing pair hasn't arrived yet (no raw asterisks flash). */
function withoutOpenBold(text: string) {
  const marks = text.split("**").length - 1;
  if (marks % 2 === 0) return text;
  const last = text.lastIndexOf("**");
  return text.slice(0, last) + text.slice(last + 2);
}

function MessageText({ text }: { text: string }) {
  return (
    <span className="whitespace-pre-line break-words text-[15px] leading-relaxed">
      {text.split("\n").map((line, i) => (
        <span key={i}>{i > 0 && <br />}<MdText text={line} /></span>
      ))}
    </span>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export function GenerativeUIWebsite({
  salon: salonProp, staff: staffProp, services: servicesProp, theme, context = "website", onSwitchToWizard,
}: GenerativeUIWebsiteProps) {
  const { t: translateUi, locale: uiLocale } = useI18n();
  // The long composer placeholder wraps (and is clipped) on phones; a short one fits.
  const [narrowScreen, setNarrowScreen] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const update = () => setNarrowScreen(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const isBooking = context === "booking";
  const font = { stack: fontStack(theme.fontFamily) };
  loadGoogleFont(theme.fontFamily);

  // `salonProp`/`staffProp`/`servicesProp` are a page-load snapshot from the route loader. The
  // assistant's own tool calls (getServices/getStaff/getSalonProfile/getHolidays) hit the API
  // live, so a card rendered from the snapshot can disagree with the reply next to it — a price
  // edited since load, a stylist added or deactivated, changed opening hours, a new holiday.
  // Keep the three lists in state, seeded from the props, and re-pull them on mount and after any
  // turn that used a data tool so every card and header shows what the salon
  // returns right now. `theme` stays a snapshot — it isn't salon data and rarely changes mid-visit.
  const [salon, setSalon] = useState(salonProp);
  const [staff, setStaff] = useState(staffProp);
  const [services, setServices] = useState(servicesProp);

  const accentText = contrastText(theme.accentColor);
  const avatarBg   = theme.logoBgColor;
  const avatarText = contrastText(theme.logoBgColor);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [thinking, setThinking] = useState(false);
  const [started, setStarted]   = useState(false);
  const [mcpDetailsOpen, setMcpDetailsOpen] = useState(false);
  // How the chat opens is a salon-admin theme setting: "windowed" = the constrained card,
  // anything else (default) = fullscreen. The header toggle still flips it at runtime.
  // (Booking context is always full-page and ignores this.)
  const [isFullscreen, setIsFullscreen] = useState(!isBooking && theme.chatLayout !== "windowed");
  const [closedDateRanges, setClosedDateRanges] = useState<ClosureRange[]>([]);
  // Opaque per-visitor conversation key. The backend keeps the transcript under it (TTL memory),
  // so we no longer re-send history — just this id + the new message. Persisted for the tab so a
  // reload within the TTL resumes the same conversation; "Clear chat" mints a fresh one.
  const [sessionId, setSessionId] = useState<string>(() => newSessionId(salon.id));
  // Each salon has its own MCP URL (/mcp/<handle>): it identifies the salon, so the visitor's AI
  // app never needs to be told which salon to use.
  const mcpSalonHandle = salon.handler?.trim() || String(salon.id);
  const mcpServerUrl = `${API_BASE.replace(/\/+$/, "")}/mcp/${encodeURIComponent(mcpSalonHandle)}`;
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  const turnCounter = useRef(0);
  const prevMessageCount = useRef(0);
  const prevStreaming = useRef(false);

  // Auto-scroll on real events only — never on in-place updates like an app reporting what the
  // visitor is doing in it, which would yank the page while they tap inside the app.
  useEffect(() => {
    const bottom = bottomRef.current;
    if (!bottom) return;
    const last = messages[messages.length - 1];
    const scroller = bottom.closest(".overflow-y-auto") as HTMLElement | null;
    const nearBottom = !scroller || scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 160;
    const added = messages.length !== prevMessageCount.current;
    prevMessageCount.current = messages.length;
    const streaming = last?.role === "assistant" && Boolean(last.streaming);
    const finished = prevStreaming.current && !streaming;
    prevStreaming.current = streaming;

    if (added) {
      bottom.scrollIntoView({ behavior: "smooth" });
    } else if (finished && last?.role === "assistant" && last.mcpAppCall) {
      // The app expands in now: show the reply from its first line with the app opening below,
      // rather than jumping to the bottom of a tall app.
      document.querySelector(`[data-turn="${last.turnId}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (nearBottom) {
      // Tokens arriving / chips appearing: follow, but only if the reader is already at the bottom.
      bottom.scrollIntoView({ behavior: streaming ? "auto" : "smooth", block: "end" });
    }
  }, [messages, thinking]);

  // Follow the saved layout preference when it changes. At runtime `theme.chatLayout` is
  // constant so this only matches the initial state; in the salon-admin design panel the
  // admin flips it live and the preview must snap to the new choice (the runtime header
  // toggle still overrides it freely afterwards — that never changes `theme.chatLayout`).
  useEffect(() => {
    setIsFullscreen(!isBooking && theme.chatLayout !== "windowed");
  }, [isBooking, theme.chatLayout]);

  // Fullscreen (website context only): lock body scroll and let Esc collapse it.
  useEffect(() => {
    if (!isFullscreen || typeof document === "undefined") return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setIsFullscreen(false); };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isFullscreen]);

  // Re-pull the salon profile + staff + services lists so every data card matches what the
  // assistant's own live tool calls see.
  const salonId = salonProp.id;
  const refreshSalonData = useCallback(() => {
    apiFetch<Salon>(`${API_BASE}/api/salon/${salonId}`).then(setSalon).catch(() => {});
    // The staff endpoint carries no ratings — keep the ones merged in by the loader.
    apiFetch<StaffMember[]>(`${API_BASE}/api/salon/${salonId}/staff`)
      .then((fresh) => setStaff((prev) => {
        const rated = new Map(prev.map((m) => [m.id, m]));
        return fresh.map((m) => ({ ...m, rating: m.rating ?? rated.get(m.id)?.rating, reviewCount: m.reviewCount ?? rated.get(m.id)?.reviewCount }));
      }))
      .catch(() => {});
    apiFetch<ServiceItem[]>(`${API_BASE}/api/salon/${salonId}/services`).then(setServices).catch(() => {});
  }, [salonId]);

  // Only once the visitor actually engages — no need to double-fetch for a page view that never
  // opens the chat.
  useEffect(() => { if (started) refreshSalonData(); }, [started, refreshSalonData]);

  // One-off closures + resolved holiday dates the booking picker's calendar must block. The
  // server rejects these too (`/booking/slots` returns nothing, `POST /booking` 400s) — this just keeps
  // the calendar from offering them.
  const bookingEnabled = salon.features?.includes("BOOKING") ?? false;
  const advanceDays = salon.bookingAdvanceDays ?? 60;
  const refreshClosedDates = useCallback(() => {
    if (!bookingEnabled) { setClosedDateRanges([]); return; }
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + advanceDays);
    Promise.all([
      apiFetch<ClosureRange[]>(`${API_BASE}/api/salon/${salonId}/closures`).catch((): ClosureRange[] => []),
      apiFetch<SalonHoliday[]>(`${API_BASE}/api/salon/${salonId}/holidays`).catch((): SalonHoliday[] => []),
    ]).then(([closures, holidays]) => {
      setClosedDateRanges([...closures, ...resolveHolidayRanges(holidays, maxDate)]);
    });
  }, [salonId, bookingEnabled, advanceDays]);

  useEffect(() => { if (started) refreshClosedDates(); }, [started, refreshClosedDates]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [started]);

  // Ground truth for a booking, regardless of whether it was proposed by the LLM's own tool call
  // or created entirely client-side via the interactive picker — the LLM never sees the picker,
  // so without this it has no way to know a booking exists when asked a later free-text question
  // like "is my booking confirmed?".
  function bookingStatusSummary(pb: PendingBookingUI): string {
    const serviceName = services.find((s) => s.id === pb.serviceId)?.name ?? `service #${pb.serviceId}`;
    const when = `${pb.appointmentDate} at ${pb.startTime}`;
    switch (pb.status) {
      case "confirmed":
        return pb.confirmedBooking
          ? `[Booking ${pb.confirmedBooking.status === "PENDING" ? "requested — pending the salon's confirmation" : "confirmed"}: ${serviceName} on ${when}, booking #${pb.confirmedBooking.id}.]`
          : `[Booking confirmed: ${serviceName} on ${when}.]`;
      case "proposed":
      case "confirming":
        return `[A booking for ${serviceName} on ${when} is staged in the interface with a Confirm button, awaiting the visitor's confirm click — not booked yet. Base the follow-ups on this staged booking — confirming it, changing the time or stylist, or what happens after confirming.]`;
      case "dismissed":
        return `[The visitor dismissed the booking proposal for ${serviceName} on ${when}.]`;
      case "error":
        return `[The last booking attempt for ${serviceName} on ${when} failed: ${pb.error ?? "unknown error"}.]`;
    }
  }

  // A generative-UI card carries no prose of its own, so a card-only assistant turn never
  // reaches the model through the normal history and it can't answer a later "show me that list
  // again" / "what did you just show me". These synthetic bracketed lines stand in for it — and
  // each ends with a "Base the follow-ups on ..." steer so the chip generator ties the next
  // questions to whatever this card put on screen rather than drifting to an unrelated topic.
  function componentHistoryClue(c: UIComponent): string | null {
    const p = c.props ?? {};
    const num = (v: unknown) => (typeof v === "number" ? v : undefined);
    switch (c.type) {
      case "services": {
        const forStaffId = num(p.forStaffId);
        const list = services
          .filter((s) => s.active && (forStaffId == null || !s.assignedStaffIds?.length || s.assignedStaffIds.includes(String(forStaffId))))
          .map((s) => s.name)
          .join(", ");
        return `[Showed the visitor an interactive services card${forStaffId != null ? " (filtered to one stylist)" : ""}: ${list || "no active services"}. Each row has a "Book" button. Base the follow-ups on these specific services — a price, how long one takes, who performs one, or booking one — not on an unrelated topic.]`;
      }
      case "staff": {
        const forServiceId = num(p.forServiceId);
        const svc = forServiceId != null ? services.find((s) => s.id === forServiceId) : undefined;
        const list = staff
          .filter((m) => m.status === "ACTIVE" && (!svc || !svc.assignedStaffIds?.length || svc.assignedStaffIds.includes(String(m.id))))
          .map((m) => m.name)
          .join(", ");
        return `[Showed the visitor an interactive team card${svc ? ` (who can do ${svc.name})` : ""}: ${list || "no matching team members"}. Each row can start a booking with that person. Base the follow-ups on these specific people — what one specialises in, their experience, or booking with one — not on an unrelated topic.]`;
      }
      case "hours": return "[Showed the visitor the opening-hours card with this week's opening hours. Base the follow-ups on the opening hours — a specific day, whether they're open now or this weekend, or an upcoming holiday/closure.]";
      case "location": return "[Showed the visitor the location card with the salon's address and a map link. Base the follow-ups on getting there — parking, the nearest transport, or which area it's in.]";
      case "contact": return "[Showed the visitor the contact card with the salon's phone and email. Base the follow-ups on getting in touch — the best way to reach the salon, or calling to ask something.]";
      case "date-picker": return "[Showed the visitor a date picker for choosing a day against the salon's real availability. Base the follow-ups on which days work, or asking for times on a day.]";
      case "time-slot-picker": {
        const svc = services.find((s) => s.id === num(p.serviceId));
        return `[Showed the visitor a list of real available time slots${svc ? ` for ${svc.name}` : ""}${p.date ? ` on ${p.date}` : ""}. Base the follow-ups on picking a time or asking about that day.]`;
      }
      case "form": {
        const labels = Array.isArray(p.fields)
          ? (p.fields as { label?: string }[]).map((f) => f?.label).filter(Boolean).join(", ")
          : "";
        return `[Showed the visitor a form asking for: ${labels || "some details"}. Base the follow-ups on completing it or why it's needed.]`;
      }
      case "button-group":
      case "radio-group":
      case "checkbox-group":
      case "option-list": {
        const labels = Array.isArray(p.choices)
          ? (p.choices as { label?: string }[]).map((ch) => ch?.label).filter(Boolean).join(", ")
          : "";
        return `[Showed the visitor a set of choices${p.prompt ? ` (${p.prompt})` : ""}: ${labels || "some options"}. Base the follow-ups on picking between them.]`;
      }
      case "staff-profile": {
        const m = staff.find((s) => s.id === num(p.staffId));
        return `[Showed the visitor ${m ? `${m.name}'s` : "a"} profile card: bio and a tappable gallery of their work photos/videos, plus a "Book" button. Base the follow-ups on their background, specialties, or booking with them.]`;
      }
      case "quick-actions": return "[Showed the visitor a menu of tappable quick-question options (book, services, staff, hours, location, contact). Base the follow-ups on picking one of those.]";
      case "booking-picker": return null; // covered by the live picker-progress clue instead
      default: return null;
    }
  }

  // Active stylists a visitor can pick for a service in the picker — the same ACTIVE +
  // assigned-staff filter the picker itself applies. Lets the follow-up generator name exactly
  // who is on the visitor's screen on the stylist step.
  function eligibleStylists(serviceId: number): StaffMember[] {
    const svc = services.find((s) => s.id === serviceId);
    return staff.filter(
      (m) => m.status === "ACTIVE" && (!svc?.assignedStaffIds?.length || svc.assignedStaffIds.includes(String(m.id))),
    );
  }

  function describeStylist(m: StaffMember): string {
    const role = STAFF_ROLE_LABEL[m.role] ?? m.role;
    const spec = m.specializations?.length ? `; specialises in ${m.specializations.join(", ")}` : "";
    return `${m.name} (${role}${spec})`;
  }

  // The interactive booking picker owns its own state; this turns a lifted snapshot of it into a
  // clue so the assistant can answer "is that booked yet?" correctly while the visitor is still
  // mid-flow (it isn't — and it can say exactly what's left to do). `p` is absent on the very
  // first render, before the picker has emitted any progress — describe the step it opens on.
  // The `stepFocus` sentence spells out what is interactive on screen right now so the follow-up
  // chips speak to the current step (its stylists, its calendar) rather than jumping ahead.
  function pickerHistoryClue(serviceId: number, p?: PickerProgress, initialStaffId?: number): string {
    const serviceName = services.find((s) => s.id === serviceId)?.name ?? `service #${serviceId}`;
    const roster = eligibleStylists(serviceId);
    // The picker always opens on the date step first (see BookingPickerCard) - the stylist step,
    // when there is one, comes right after a date is chosen.
    const step: PickerProgress["step"] = p?.step ?? "date";
    const onStaffStep = step === "staff";

    const stylist = onStaffStep
      ? "not chosen yet"
      : p
        ? (p.staffId == null ? "any available stylist" : staff.find((s) => s.id === p.staffId)?.name ?? `staff #${p.staffId}`)
        : initialStaffId != null
          ? staff.find((s) => s.id === initialStaffId)?.name ?? `staff #${initialStaffId}`
          : roster.length === 1 ? roster[0].name : "any available stylist";

    // Date is picked before the stylist step is ever reached, so it's already chosen by then too.
    const dateChosen = step === "staff" || step === "time" || step === "contact";
    const timeLabel = step === "contact" && p?.time ? p.time : "not chosen yet";
    const contactBits = [
      p?.name ? `name "${p.name}"` : null,
      p?.email ? `email "${p.email}"` : null,
      p?.phone ? `phone "${p.phone}"` : null,
    ].filter(Boolean);
    const contactState = step === "contact"
      ? (contactBits.length ? ` They have entered ${contactBits.join(", ")}.` : " They have not filled in their contact details yet.")
      : "";

    const stepFocus = onStaffStep
      ? ` The stylist step is open on screen now: the visitor is choosing from ${roster.map(describeStylist).join(", ") || "the salon's stylists"}, or "any available stylist" — base the follow-ups on picking between these stylists (who does what, who suits this service), not on dates or times yet.`
      : step === "date"
        ? " The date step is open on screen now: the visitor is picking a day from the calendar of real availability — base the follow-ups on which days work."
        : step === "time"
          ? ` The time step is open on screen now: the visitor is picking a slot on ${p?.date ?? "the chosen day"} — base the follow-ups on the times that day.`
          : " The contact step is open on screen now: the visitor is entering their name and an email or phone to finish.";

    return `[The visitor is using the interactive booking picker for ${serviceName} — they have NOT confirmed a booking. Selected so far — stylist: ${stylist}; date: ${dateChosen ? p?.date : "not chosen yet"}; time: ${timeLabel}. Current step: ${step}.${stepFocus}${contactState} Nothing is booked and no booking has been staged for confirmation: if they ask whether it's booked, tell them not yet — they still need to finish the picker (pick a time, enter their name and an email or phone) and confirm on the review card.]`;
  }

  // The backend keeps the transcript itself now; the one thing it can't see is the interactive
  // widget the visitor is looking at / part-way through when they send the next message. This
  // builds a bracketed note about the LATEST assistant turn's on-screen components + staged
  // booking, which the backend records as a synthetic turn before the new message. Returns
  // undefined when there's nothing on screen worth noting.
  function buildUiState(): string | undefined {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== "assistant") continue;
      const parts: string[] = [];
      const picker = m.components?.find((c) => c.type === "booking-picker");
      if (picker) {
        parts.push(pickerHistoryClue(
          picker.props.serviceId as number, m.picker,
          typeof picker.props.staffId === "number" ? picker.props.staffId : undefined,
        ));
      }
      for (const c of m.components ?? []) {
        if (c.type === "booking-picker") continue;
        const clue = componentHistoryClue(c);
        if (clue) parts.push(clue);
      }
      if (m.pendingBooking) parts.push(bookingStatusSummary(m.pendingBooking));
      if (m.mcpAppCall) {
        const app = MCP_APPS[m.mcpAppTool ?? "salon_explorer"]?.title ?? "salon";
        parts.push(`[The interactive ${app} app is on screen just below the latest reply${m.mcpAppContext ? `. ${m.mcpAppContext}` : "."} Nothing is booked or ordered unless the app itself confirmed it.]`);
      }
      return parts.length ? parts.join("\n") : undefined;
    }
    return undefined;
  }

  function replyCta(userText: string): "book" | undefined {
    return isBooking && !NO_CTA_PATTERN.test(userText) ? "book" : undefined;
  }

  // Patch the assistant message for one turn (stream events can land after the visitor moved on).
  function patchTurn(turnId: number, patch: (m: Extract<Message, { role: "assistant" }>) => Partial<Extract<Message, { role: "assistant" }>>) {
    setMessages((prev) => prev.map((m) => (m.role === "assistant" && m.turnId === turnId ? { ...m, ...patch(m) } : m)));
  }

  function resolveReply(userText: string, uiState: string | undefined, turnId: number) {
    // Tokens can arrive faster than the screen repaints; batch them into one update per frame.
    let pending = "";
    let frame = 0;
    const flush = () => {
      frame = 0;
      const chunk = pending;
      pending = "";
      if (chunk) patchTurn(turnId, (m) => ({ text: m.text + chunk }));
    };
    const handlers: StreamHandlers = {
      onDelta: (chunk) => {
        pending += chunk;
        if (!frame) frame = window.requestAnimationFrame(flush);
      },
      onApp: (tool, args) => patchTurn(turnId, () => ({
        mcpAppTool: tool,
        mcpAppCall: args,
        tool: { name: MCP_APPS[tool]?.title.toLowerCase() ?? tool, label: `Opening ${MCP_APPS[tool]?.title ?? "the app"}…`, done: false },
      })),
      onSuggestions: (questions) => patchTurn(turnId, () => ({ suggested: questions.length ? questions : undefined })),
    };
    streamChatReply(salon.id, sessionId, isBooking ? "booking" : "website", userText, uiState, handlers).then(
      ({ text: reply, toolsUsed, pendingBooking, components: rawComponents, suggestedQuestions, mcpAppCall, mcpAppTool }) => {
        const cta = replyCta(userText);
        let components = normalizeComponents(rawComponents, services);
        const cleanedReply = stripStageDirections(reply);
        if (frame) { window.cancelAnimationFrame(frame); frame = 0; }
        pending = "";
        setMessages((prev) => {
          const next = [...prev];
          const found = next.findIndex((m) => m.role === "assistant" && m.turnId === turnId);
          const lastIdx = found >= 0 ? found : next.length - 1;
          const streamed = next[lastIdx]?.role === "assistant" ? next[lastIdx] : undefined;

          // A booking picker that's still in progress always follows the conversation down to the
          // newest assistant turn, so it stays next to the last chat instead of being orphaned
          // higher up. This runs whether or not the model re-called startBookingPicker this turn
          // — it usually doesn't, because the uiState clue tells it the picker is already on
          // screen. Skip only when the model deliberately swapped in other components.
          const hasPickerNow = components.some((c) => c.type === "booking-picker");
          if (components.length === 0 || (components.length === 1 && hasPickerNow)) {
            const liveIdx = next.findIndex(
              (m, i) => i !== lastIdx && m.role === "assistant"
                && (m.components?.some((c) => c.type === "booking-picker") ?? false),
            );
            const live = liveIdx >= 0 ? next[liveIdx] : undefined;
            if (live && live.role === "assistant") {
              const liveCard = live.components!.find((c) => c.type === "booking-picker")!;
              const incoming = components.find((c) => c.type === "booking-picker");
              const n = (v: unknown) => (typeof v === "number" ? v : undefined);
              const s = (v: unknown) => (typeof v === "string" ? v : undefined);
              components = [{
                type: "booking-picker",
                props: {
                  serviceId: n(incoming?.props.serviceId) ?? liveCard.props.serviceId,
                  staffId: n(incoming?.props.staffId) ?? liveCard.props.staffId,
                  date: s(incoming?.props.date) ?? liveCard.props.date,
                  resume: live.picker,
                },
              }];
              // Clear it from its old spot — it's relocating, not spawning a copy.
              const remaining = live.components!.filter((c) => c.type !== "booking-picker");
              next[liveIdx] = { ...live, components: remaining.length ? remaining : undefined, picker: undefined };
            }
          }

          // Keep the app's argument object if the stream already opened it — a new (equal) object
          // would make the embedded app reconnect and lose what the visitor has done in it.
          const keepApp = streamed?.mcpAppCall && mcpAppCall
            && JSON.stringify(streamed.mcpAppCall) === JSON.stringify(mcpAppCall);
          next[lastIdx] = {
            role: "assistant",
            turnId,
            streaming: false,
            text: cleanedReply,
            tool: toolsUsed.length ? { name: friendlyToolLabel(toolsUsed), label: "salon-data", done: true } : undefined,
            time: nowTime(),
            cta,
            pendingBooking: pendingBooking ? { ...pendingBooking, status: "proposed" } : undefined,
            components: components.length ? components : undefined,
            suggested: suggestedQuestions.length ? suggestedQuestions : streamed?.suggested,
            mcpAppCall: keepApp ? streamed!.mcpAppCall : mcpAppCall ?? undefined,
            mcpAppTool: mcpAppTool ?? undefined,
            mcpAppContext: keepApp ? streamed?.mcpAppContext : undefined,
          };
          return next;
        });
        setThinking(false);

        // The turn that just rendered a data card pulled its facts live via a tool; refresh the
        // page-level snapshot so the card beside this reply shows the same numbers, not stale ones.
        if (toolsUsed.some((t) => t === "salon" || t === "staff" || t === "services")) refreshSalonData();
        if (toolsUsed.some((t) => t === "salon" || t === "holidays")) refreshClosedDates();
      },
    );
  }

  function sendMessage(text: string) {
    if (!text.trim() || thinking) return;
    setStarted(true);
    const uiState = buildUiState();
    setMessages((prev) => [...prev, { role: "user", text, time: nowTime() }]);
    setThinking(true);
    const tool: ToolCard = { name: "salon-data", label: "Thinking…", done: false };
    const turnId = ++turnCounter.current;
    setMessages((prev) => [...prev, { role: "assistant", text: "", tool, time: nowTime(), turnId, streaming: true }]);
    resolveReply(text, uiState, turnId);
  }

  // A card-tagged quick-action renders instantly from data already on the page — no LLM call,
  // no latency, no risk of the model getting a fact wrong. A short "thinking" beat keeps the feel
  // consistent with the rest of the chat. Kick a refresh first so the instant card can't show a
  // stale price/roster if the tab has been open a while.
  function showCard(cardType: CardType, question: string, intro?: string) {
    setStarted(true);
    refreshSalonData();
    setMessages((prev) => [...prev, { role: "user", text: question, time: nowTime() }]);
    setThinking(true);
    setTimeout(() => {
      setMessages((prev) => [...prev, { role: "assistant", text: intro ?? CARD_INTRO[cardType], time: nowTime(), components: [{ type: cardType, props: {} }] }]);
      setThinking(false);
    }, 350);
  }

  // Tapping "Book" on a specific service jumps straight to the interactive picker (calendar +
  // time slots, real availability) instead of asking the visitor to type a date in chat.
  function startBooking(service: ServiceItem, staffId?: number) {
    setStarted(true);
    setMessages((prev) => [...prev, { role: "user", text: `I'd like to book ${service.name}`, time: nowTime() }]);
    setThinking(true);
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Great choice — let's find a time for ${service.name}:`,
          time: nowTime(),
          components: [{ type: "booking-picker", props: { serviceId: service.id, staffId } }],
        },
      ]);
      setThinking(false);
    }, 350);
  }

  // "Book with {staff}" needs a service first. If that stylist only offers one active service,
  // skip straight to the picker; otherwise show a services card filtered to what they can do.
  function startBookingWithStaff(member: StaffMember) {
    const eligible = services.filter(
      (s) => s.active && (!s.assignedStaffIds?.length || s.assignedStaffIds.includes(String(member.id)))
    );
    if (eligible.length === 0) { sendMessage(`I'd like to book with ${member.name}`); return; }
    if (eligible.length === 1) { startBooking(eligible[0], member.id); return; }

    setStarted(true);
    setMessages((prev) => [...prev, { role: "user", text: `I'd like to book with ${member.name}`, time: nowTime() }]);
    setThinking(true);
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Sure — which service would you like with ${member.name}?`,
          time: nowTime(),
          components: [{ type: "services", props: { forStaffId: member.id } }],
        },
      ]);
      setThinking(false);
    }, 350);
  }

  function showStaffProfile(member: StaffMember) {
    const firstName = member.name.split(/\s+/)[0];
    setStarted(true);
    refreshSalonData();
    setMessages((prev) => [...prev, { role: "user", text: `Tell me more about ${member.name}`, time: nowTime() }]);
    setThinking(true);
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Here's ${firstName}'s profile — you can see their portfolio and book directly from the card.`,
          time: nowTime(),
          components: [{ type: "staff-profile", props: { staffId: member.id } }],
        },
      ]);
      setThinking(false);
    }, 350);
  }

  // The picker's own review step hands off into the exact same confirm/dismiss card (and the
  // same real POST /booking call) already used by the LLM's propose-booking flow.
  function completeBookingPicker(messageIndex: number, fields: PendingBookingFields) {
    setMessages((prev) => {
      const next = [...prev];
      const m = next[messageIndex];
      if (m.role !== "assistant") return prev;
      const remaining = (m.components ?? []).filter((c) => c.type !== "booking-picker");
      next[messageIndex] = {
        ...m,
        components: remaining.length ? remaining : undefined,
        picker: undefined,
        pendingBooking: { ...fields, status: "proposed" },
      };
      return next;
    });
  }

  // Records the picker's live selections onto the message so buildUiState can turn them into a
  // clue for the assistant. Bails when nothing changed so a fresh callback identity per render
  // doesn't churn state.
  function updatePickerProgress(messageIndex: number, progress: PickerProgress) {
    setMessages((prev) => {
      const m = prev[messageIndex];
      if (m?.role !== "assistant" || (m.picker && sameProgress(m.picker, progress))) return prev;
      const next = [...prev];
      next[messageIndex] = { ...m, picker: progress };
      return next;
    });
  }

  function cancelBookingPicker(messageIndex: number) {
    setMessages((prev) => {
      const next = [...prev];
      const m = next[messageIndex];
      if (m.role !== "assistant") return prev;
      const remaining = (m.components ?? []).filter((c) => c.type !== "booking-picker");
      next[messageIndex] = {
        ...m,
        components: remaining.length ? remaining : undefined,
        picker: undefined,
        text: "No problem — let me know if you'd like a different service or time.",
      };
      return next;
    });
  }

  // Called when a suggestion chip is clicked
  function askQuestion(btn: ActionButton) {
    if (btn.directAction) { btn.directAction(); return; }
    if (thinking) return;
    if (btn.cardType) { showCard(btn.cardType, btn.question, btn.cardIntro); return; }
    sendMessage(btn.question);
  }

  function send() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    sendMessage(text);
  }

  function newChat() {
    setMessages([]);
    setStarted(false);
    // Fresh server-side conversation — the old transcript is left to expire on its TTL.
    setSessionId(resetSessionId(salon.id));
  }

  // ── Booking proposal confirm/dismiss ────────────────────────────────────

  function confirmPendingBooking(messageIndex: number) {
    const target = messages[messageIndex];
    if (target.role !== "assistant" || !target.pendingBooking) return;
    const { status: _status, error: _error, confirmedBooking: _cb, ...payload } = target.pendingBooking;

    setMessages((prev) => {
      const next = [...prev];
      const m = next[messageIndex];
      if (m.role !== "assistant" || !m.pendingBooking) return prev;
      next[messageIndex] = { ...m, pendingBooking: { ...m.pendingBooking, status: "confirming" } };
      return next;
    });

    apiFetch<Booking | { booking: Booking; checkoutUrl: string }>(`${API_BASE}/api/salon/${salon.id}/booking`, {
      method: "POST",
      body: JSON.stringify({ ...payload, returnUrl: window.location.href }),
    })
      .then((result) => {
        const booking = "booking" in result ? result.booking : result;
        if ("checkoutUrl" in result && result.checkoutUrl) {
          window.location.assign(result.checkoutUrl);
          return;
        }
        setMessages((prev) => {
          const next = [...prev];
          const m = next[messageIndex];
          if (m.role !== "assistant" || !m.pendingBooking) return prev;
          next[messageIndex] = { ...m, pendingBooking: { ...m.pendingBooking, status: "confirmed", confirmedBooking: booking } };
          return next;
        });
      })
      .catch((err) => {
        setMessages((prev) => {
          const next = [...prev];
          const m = next[messageIndex];
          if (m.role !== "assistant" || !m.pendingBooking) return prev;
          next[messageIndex] = {
            ...m,
            pendingBooking: { ...m.pendingBooking, status: "error", error: err instanceof Error ? err.message : "Something went wrong" },
          };
          return next;
        });
      });
  }

  function dismissPendingBooking(messageIndex: number) {
    setMessages((prev) => {
      const next = [...prev];
      const m = next[messageIndex];
      if (m.role !== "assistant" || !m.pendingBooking) return prev;
      next[messageIndex] = { ...m, pendingBooking: { ...m.pendingBooking, status: "dismissed" } };
      return next;
    });
  }

  // ── Colour tokens ──────────────────────────────────────────────────────

  const chatBg      = theme.chatBg ?? theme.heroBg ?? "#EEF2F4";
  const chatLight   = isLightColor(chatBg);
  const msgText     = chatLight ? "#1E293B" : "#F1F5F9";
  const msgDim      = chatLight ? "#94A3B8" : "#64748B";
  const asBubbleBg  = chatLight ? "#F1F5F9" : "#1E293B";

  const topBg       = chatLight ? "#FFFFFF" : "#0F172A";
  const topText     = isLightColor(topBg) ? "#0F172A" : "#F8FAFC";
  const topBorder   = isLightColor(topBg) ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.07)";
  const topDim      = isLightColor(topBg) ? "#94A3B8" : "#475569";

  const inputBg     = isLightColor(topBg) ? "#FFFFFF" : "#111C30";
  const inputBorder = isLightColor(topBg) ? "#E2E8F0" : "#334155";

  const sendActive  = Boolean(input.trim()) && !thinking;

  const bubbleBorder = chatLight ? "rgba(148,163,184,0.28)" : "rgba(255,255,255,0.08)";
  const bubbleShadow = chatLight
    ? "0 1px 3px rgba(0,0,0,0.05), 0 0 0 1px rgba(148,163,184,0.14)"
    : "0 1px 3px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.04)";
  const errorColor = "#EF4444";

  const pageBg = `radial-gradient(ellipse 90% 60% at 50% -10%, ${theme.accentColor}16 0%, transparent 55%), ${chatBg}`;

  // ── Interactive data cards (staff / services / hours / location / contact) ────

  const canBook = Boolean(salon.features?.includes("BOOKING"));
  const cardTokens: CardTokens = { theme, msgText, msgDim, bubbleBorder, bubbleShadow, asBubbleBg, accentText };
  const genCtx: GenUICtx = { salon, staff, services, closedDateRanges, canBook };

  // Renders one component from an assistant turn. `booking-picker` and `quick-actions` are wired
  // here (they need page-local handlers/data beyond what the shared registry's ctx exposes);
  // everything else goes through the shared registry. Returns `null` when there's nothing to
  // show, so the caller can fall back gracefully.
  function renderComponent(messageIndex: number, component: UIComponent) {
    if (component.type === "quick-actions") {
      if (actionButtons.length === 0) return null;
      return (
        <CardShell title={translateUi("Quick questions")} icon={LayoutGrid} tokens={cardTokens}>
          <div className="space-y-1.5">
            {actionButtons.map((btn) => (
              <button
                key={btn.label}
                onClick={() => askQuestion(btn)}
                disabled={thinking}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-150 hover:shadow-sm active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={btn.directAction ? { backgroundColor: theme.accentColor, color: accentText } : chipStyle}
              >
                <btn.icon className="w-3.5 h-3.5 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold leading-tight">{btn.label}</span>
                  {btn.hint && <span className="block text-[10px] opacity-70 leading-snug truncate">{btn.hint}</span>}
                </span>
              </button>
            ))}
          </div>
        </CardShell>
      );
    }
    if (component.type === "booking-picker") {
      const serviceId = typeof component.props.serviceId === "number" ? component.props.serviceId : undefined;
      const service = serviceId != null ? services.find((s) => s.id === serviceId) : undefined;
      if (!service) return null;
      const staffId = typeof component.props.staffId === "number" ? component.props.staffId : undefined;
      const initialDate = typeof component.props.date === "string" ? component.props.date : undefined;
      const resume = component.props.resume as PickerProgress | undefined;
      return (
        <BookingPickerCard
          salon={salon}
          service={service}
          staff={staff}
          tokens={cardTokens}
          initialStaffId={staffId}
          initialDate={initialDate}
          resume={resume}
          closedDateRanges={closedDateRanges}
          onComplete={(fields) => completeBookingPicker(messageIndex, fields)}
          onCancel={() => cancelBookingPicker(messageIndex)}
          onProgress={(p) => updatePickerProgress(messageIndex, p)}
        />
      );
    }
    return (
      <GenUIComponent
        component={component}
        tokens={cardTokens}
        ctx={genCtx}
        onAnswer={sendMessage}
        onBookService={startBooking}
        onBookStaff={startBookingWithStaff}
        onViewProfile={showStaffProfile}
      />
    );
  }

  // ── Dynamic suggestion chips (based on available salon data) ──────────

  type ActionButton = {
    label: string;
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    question: string;
    /** When set, clicking calls this directly instead of dispatching a question */
    directAction?: () => void;
    /** When set, clicking renders this card instantly instead of dispatching a question */
    cardType?: CardType;
    /** Overrides the default per-cardType lead-in text (e.g. to frame a services card as a booking start) */
    cardIntro?: string;
    /** One-line live hint shown under the label in the empty-state card grid */
    hint?: string;
  };

  const activeServicesCount = services.filter((s) => s.active).length;
  const activeStaffCount = staff.filter((m) => m.status === "ACTIVE").length;

  const websiteButtons: ActionButton[] = [
    salon.features?.includes("BOOKING") && activeServicesCount > 0 && {
      label: "Book with us", icon: Calendar, question: "I'd like to book an appointment", cardType: "services",
      cardIntro: "Let's get you booked — pick a service to start:",
      hint: `${activeServicesCount} service${activeServicesCount === 1 ? "" : "s"} available`,
    },
    activeServicesCount > 0 && {
      label: "Our Services", icon: Sparkles, question: "What services do you offer?", cardType: "services",
      hint: `${activeServicesCount} service${activeServicesCount === 1 ? "" : "s"} available`,
    },
    activeStaffCount > 0 && {
      label: "Our Staff", icon: Users, question: "Who's on the team?", cardType: "staff",
      hint: `${activeStaffCount} team member${activeStaffCount === 1 ? "" : "s"}`,
    },
    (salon.operatingHours?.length ?? 0) > 0 && {
      label: "Opening Hours", icon: Clock, question: "What are your opening hours?", cardType: "hours",
      hint: isOpenNow(salon) ? "Open now" : "See this week's hours",
    },
    (salon.location?.address || salon.location?.city) && {
      label: "Find Us", icon: MapPin, question: "Where are you located?", cardType: "location",
      hint: salon.location?.city,
    },
    (salon.contact?.phone || salon.contact?.email) && {
      label: "Contact Us", icon: Phone, question: "How can I contact you?", cardType: "contact",
      hint: salon.contact?.phone || salon.contact?.email,
    },
  ].filter(Boolean) as ActionButton[];

  const bookingButtons: ActionButton[] = [
    { label: "Book appointment", icon: CalendarCheck, question: "", directAction: onSwitchToWizard },
    activeServicesCount > 0 && {
      label: "Our services", icon: Sparkles, question: "What services do you offer?", cardType: "services",
      hint: `${activeServicesCount} service${activeServicesCount === 1 ? "" : "s"} available`,
    },
    activeStaffCount > 0 && {
      label: "Our team", icon: Users, question: "Who are your stylists?", cardType: "staff",
      hint: `${activeStaffCount} team member${activeStaffCount === 1 ? "" : "s"}`,
    },
    services.some((s) => s.durationMinutes) && {
      label: "How long?", icon: Clock, question: "How long do your services take?",
    },
    (salon.operatingHours?.length ?? 0) > 0 && {
      label: "Opening hours", icon: Clock, question: "What are your opening hours?", cardType: "hours",
      hint: isOpenNow(salon) ? "Open now" : "See this week's hours",
    },
    (salon.location?.address || salon.location?.city) && {
      label: "Find us", icon: MapPin, question: "Where are you located?", cardType: "location",
      hint: salon.location?.city,
    },
    (salon.contact?.phone || salon.contact?.email) && {
      label: "Contact us", icon: Phone, question: "How can I contact you?", cardType: "contact",
      hint: salon.contact?.phone || salon.contact?.email,
    },
  ].filter(Boolean) as ActionButton[];

  // These options are available to assistant tools that need to recover from an off-topic turn.
  const actionButtons = isBooking ? bookingButtons : websiteButtons;

  // Starter prompts keep the empty state chat-first. Unlike the former fixed action cards,
  // these go through the normal conversation so the assistant can choose the right response/UI.
  // Quick-action chips on the landing view: short labels, the detail goes in the tooltip.
  const hoursToday = todayHours(salon);
  const bookable = salon.features?.includes("BOOKING") && activeServicesCount > 0;
  const starterQuestions = [
    activeServicesCount > 0 && {
      label: "Services",
      hint: `${activeServicesCount} treatments and prices`,
      question: isBooking ? "What services can I book?" : "Show me the salon services",
      icon: Scissors,
    },
    activeStaffCount > 0 && {
      label: "Our team",
      hint: `${activeStaffCount} team members`,
      question: "Tell me about the stylists",
      icon: Users,
    },
    bookable && {
      label: "Book now",
      hint: "Pick a service, stylist and time",
      question: "I'd like to book an appointment",
      icon: CalendarCheck,
    },
    bookable && {
      label: "This week",
      hint: "Every open time this week",
      question: "What's free this week?",
      icon: CalendarRange,
    },
    (salon.operatingHours?.length ?? 0) > 0 && {
      label: hoursToday && hoursToday !== "Closed today" ? `Today · ${hoursToday}` : hoursToday ?? "Opening hours",
      hint: "See this week's hours",
      question: "What are your opening hours?",
      icon: Clock,
    },
    salon.features?.includes("WEBSHOP") && !isBooking && {
      label: "Shop",
      hint: "Products you can order",
      question: "Show me the shop",
      icon: ShoppingBag,
    },
    salon.features?.includes("MEMBERSHIP") && !isBooking && {
      label: "Membership",
      hint: "Plans and member perks",
      question: "Show me the membership plans",
      icon: BadgeCheck,
    },
  ].filter(Boolean) as { label: string; hint: string; question: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }[];

  const chipStyle = {
    backgroundColor: `${theme.accentColor}10`,
    borderColor: `${theme.accentColor}30`,
    color: theme.accentColor,
  };

  // ── "Book now" CTA button (booking context only) ─────────────────────

  const bookCtaBtn = isBooking ? (
    <button
      onClick={onSwitchToWizard}
      className="mt-2.5 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all hover:-translate-y-0.5 active:translate-y-0"
      style={{ backgroundColor: theme.accentColor, color: accentText, boxShadow: `0 6px 16px -6px ${theme.accentColor}aa` }}
    >
      <CalendarCheck className="w-3.5 h-3.5" />
      {translateUi("Book now → ")}</button>
  ) : null;

  // ── Booking proposal card — the interactive "MCP-style" tool result ────

  function bookingCard(messageIndex: number, pb: PendingBookingUI) {
    if (pb.status === "dismissed") {
      return <p className="text-xs italic mt-1.5" style={{ color: msgDim }}>{translateUi("Booking request dismissed.")}</p>;
    }

    if (pb.status === "confirmed" && pb.confirmedBooking) {
      const isPending = pb.confirmedBooking.status === "PENDING";
      const service = services.find((s) => s.id === pb.serviceId);
      return (
        <div
          className="mt-2.5 rounded-2xl p-3.5 sm:p-4 flex items-start gap-3"
          style={{ backgroundColor: `${theme.accentColor}12`, border: `1px solid ${theme.accentColor}35` }}
        >
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" style={{ color: theme.accentColor }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: theme.accentColor }}>
              {isPending ? translateUi("Booking request sent!") : translateUi("You're booked!")}
            </p>
            <p className="text-xs mt-0.5" style={{ color: msgText }}>
              {service?.name ?? "Appointment"} · {formatDateLabel(pb.appointmentDate)} {translateUi("at ")}{pb.startTime}
              {isPending ? translateUi(" — the salon will confirm shortly.") : ""}
            </p>
          </div>
        </div>
      );
    }

    const service = services.find((s) => s.id === pb.serviceId);
    const staffMember = pb.staffId != null ? staff.find((s) => s.id === pb.staffId) : undefined;
    const confirming = pb.status === "confirming";

    return (
      <div
        className="mt-2.5 rounded-2xl overflow-hidden"
        style={{ border: `1px solid ${bubbleBorder}`, boxShadow: bubbleShadow, backgroundColor: asBubbleBg, maxWidth: 380 }}
      >
        <div className="px-3.5 py-2.5 sm:px-4" style={{ borderBottom: `1px solid ${bubbleBorder}` }}>
          <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: theme.accentColor }}>{translateUi("Review your booking")}</p>
        </div>
        <div className="px-3.5 py-3 space-y-1.5 text-sm sm:px-4">
          <div className="flex justify-between gap-3">
            <span style={{ color: msgDim }}>{translateUi("Service")}</span>
            <span className="font-medium text-right" style={{ color: msgText }}>{service?.name ?? `Service #${pb.serviceId}`}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span style={{ color: msgDim }}>{translateUi("With")}</span>
            <span className="font-medium text-right" style={{ color: msgText }}>{staffMember?.name ?? "Any available stylist"}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span style={{ color: msgDim }}>{translateUi("When")}</span>
            <span className="font-medium text-right" style={{ color: msgText }}>{formatDateLabel(pb.appointmentDate)} · {pb.startTime}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span style={{ color: msgDim }}>{translateUi("Name")}</span>
            <span className="font-medium text-right" style={{ color: msgText }}>{pb.customerName}</span>
          </div>
          {(pb.customerEmail || pb.customerPhone) && (
            <div className="flex justify-between gap-3">
              <span style={{ color: msgDim }}>{translateUi("Contact")}</span>
              <span className="font-medium text-right truncate" style={{ color: msgText }}>{pb.customerEmail || pb.customerPhone}</span>
            </div>
          )}
        </div>
        {pb.status === "error" && (
          <div className="px-3.5 pb-2 text-xs sm:px-4" style={{ color: errorColor }}>{pb.error}</div>
        )}
        <div className="px-3 pb-3 pt-1 flex gap-2">
          <button
            onClick={() => confirmPendingBooking(messageIndex)}
            disabled={confirming}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all disabled:cursor-not-allowed"
            style={{ backgroundColor: theme.accentColor, color: accentText, opacity: confirming ? 0.7 : 1 }}
          >
            {confirming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            {confirming ? translateUi("Booking…") : translateUi("Confirm booking")}
          </button>
          <button
            onClick={() => dismissPendingBooking(messageIndex)}
            disabled={confirming}
            className="px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all disabled:cursor-not-allowed disabled:opacity-50"
            style={{ color: msgDim, border: `1px solid ${bubbleBorder}` }}
          >
            {translateUi("Never mind ")}</button>
        </div>
      </div>
    );
  }

  // ── Message thread ──────────────────────────────────────────────────────

  const messageThread = (
    // Claude-style thread: one centred reading column. The visitor's turns are soft neutral
    // bubbles on the right; the assistant's replies are plain prose across the full column (no
    // avatar gutter, no bubble), with tool activity as a quiet status line and apps/cards inline
    // at the same left edge as the text.
    <div className="mx-auto max-w-[760px] space-y-7 px-4 py-6 sm:px-6">
      {messages.map((m, i) =>
        m.role === "user" ? (
          <div key={i} className="flex justify-end">
            <div
              className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed sm:max-w-[75%]"
              style={{ backgroundColor: asBubbleBg, color: msgText }}
            >
              {m.text}
            </div>
          </div>
        ) : (
          <div key={i} data-turn={m.turnId} className="scroll-mt-4 min-w-0 space-y-3">
              {m.tool && !(m.streaming && m.text && !m.tool.done) && (
                <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: msgDim }}>
                  {m.tool.done ? <Wrench className="h-3 w-3" /> : <Loader2 className="h-3 w-3 motion-safe:animate-spin" />}
                  <span>{m.tool.done ? `Used ${m.tool.name}` : m.tool.label}</span>
                </div>
              )}
              {(m.text || m.cta === "book") && (
                <div className="text-[15px] leading-relaxed" style={{ color: msgText }}>
                  {m.text && <MessageText text={m.streaming ? withoutOpenBold(m.text) : m.text} />}
                  {m.streaming && m.text && (
                    // Typing caret while the reply is still streaming in.
                    <span
                      aria-hidden
                      className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[3px] rounded-sm motion-safe:animate-pulse"
                      style={{ backgroundColor: theme.accentColor }}
                    />
                  )}
                  {m.cta === "book" && bookCtaBtn}
                </div>
              )}
              {/* Interactive components sit outside the prose bubble — nesting a bordered card
                  inside a padded bubble stacks 3 layers of horizontal padding and is unusably
                  tight on phones. Several can render in one turn; they stack in order. */}
              {m.pendingBooking && bookingCard(i, m.pendingBooking)}
              {m.mcpAppCall && (() => {
                const appTool = m.mcpAppTool ?? "salon_explorer";
                const appMeta = MCP_APPS[appTool] ?? MCP_APPS.salon_explorer;
                const AppIcon = MCP_APP_ICONS[appTool] ?? Sparkles;
                // The model opens the app before it writes its sentence. Keep the app loading out of
                // sight while the text streams, then expand it in once the text is done — so the
                // reply reads text first, app second, and the app is usually ready by then.
                const holdApp = Boolean(m.streaming);
                return (
                <>
                {/* Before any text, the thinking dots and the "Opening …" pill already say it. */}
                {holdApp && m.text && (
                  <p role="status" className="flex items-center gap-2 text-xs font-medium" style={{ color: msgDim }}>
                    <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" style={{ color: theme.accentColor }} aria-hidden />
                    {translateUi("Preparing {app}…", { app: translateUi(appMeta.title) })}
                  </p>
                )}
                {/* The app spans the reading column, aligned with the reply text. The 0.25rem
                    side padding (cancelled by the negative margin) leaves room for the card shadow
                    inside this wrapper's clip. The grid-rows 0fr → 1fr trick animates the height. */}
                <div
                  className="-mx-1 -mb-2 grid px-1 pb-2 motion-safe:transition-[grid-template-rows,opacity] motion-safe:duration-500 motion-safe:ease-out"
                  style={{ gridTemplateRows: holdApp ? "0fr" : "1fr", opacity: holdApp ? 0 : 1 }}
                  aria-hidden={holdApp || undefined}
                >
                <div className="min-h-0 overflow-hidden">
                <section
                  className="overflow-hidden rounded-2xl border"
                  aria-label={translateUi(appMeta.title)}
                  style={{ backgroundColor: asBubbleBg, borderColor: bubbleBorder, boxShadow: bubbleShadow }}
                >
                  <div className="flex items-center gap-2.5 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3" style={{ borderBottom: `1px solid ${bubbleBorder}` }}>
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl sm:h-9 sm:w-9"
                      style={{ color: accentText, backgroundColor: theme.accentColor }}
                    >
                      <AppIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold" style={{ color: msgText }}>{translateUi(appMeta.title)}</p>
                      <p className="truncate text-xs" style={{ color: msgDim }}>{translateUi(appMeta.subtitle)}</p>
                    </div>
                    <span
                      className="hidden rounded-full px-2.5 py-1 text-[10px] font-semibold sm:inline-block"
                      style={{ color: theme.accentColor, backgroundColor: `${theme.accentColor}14` }}
                    >
                      {translateUi("Interactive")}
                    </span>
                  </div>
                  <McpAppFrame
                    toolName={appTool}
                    toolArguments={m.mcpAppCall}
                    title={`${salon.name} · ${appMeta.title}`}
                    onMessage={sendMessage}
                    onContextChange={(note) => setMessages((prev) => prev.map((msg, idx) =>
                      idx === i && msg.role === "assistant" ? { ...msg, mcpAppContext: note } : msg))}
                    className="overflow-hidden rounded-none border-0"
                    hostTheme={{
                      accent: theme.accentColor,
                      accentText,
                      text: msgText,
                      mutedText: msgDim,
                      fontFamily: font.stack,
                      fontCss: (() => {
                        const googleSpec = FONTS[theme.fontFamily]?.google
                          ?? (theme.fontFamily && !FONTS[theme.fontFamily]
                            ? `${theme.fontFamily.trim().replace(/\s+/g, "+")}:wght@400;500;600;700`
                            : undefined);
                        return googleSpec
                          ? `@import url('https://fonts.googleapis.com/css2?family=${googleSpec}&display=swap');`
                          : undefined;
                      })(),
                    }}
                  />
                </section>
                </div>
                </div>
                </>
                );
              })()}
              {m.components && m.components.length > 0 && (() => {
                const rendered = m.components.map((c) => renderComponent(i, c));
                if (!rendered.some(Boolean) && !m.text) {
                  // Directives came back but nothing renders (salon data missing, or an
                  // unresolved service) — don't leave the turn as a bare avatar with no content.
                  return (
                    <p className="text-xs italic mt-1.5" style={{ color: msgDim }}>
                      {translateUi("Sorry — I couldn't pull that up just now. Please contact us directly and we'll help. ")}</p>
                  );
                }
                return rendered.map((r, ci) => <React.Fragment key={ci}>{r}</React.Fragment>);
              })()}
              {i === messages.length - 1 && !thinking && m.suggested && m.suggested.length > 0 && (
                <div className="pt-1.5">
                  <p className="text-[11px] mb-2" style={{ color: msgDim }}>{translateUi("You could ask")}</p>
                  <div className="flex flex-wrap gap-2">
                    {m.suggested.map((question, qi) => (
                      <button
                        key={`${qi}-${question}`}
                        type="button"
                        onClick={() => sendMessage(question)}
                        disabled={thinking}
                        className="px-3 py-2 rounded-full border text-xs font-medium transition-all duration-150 hover:shadow-sm active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        style={chipStyle}
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              )}
          </div>
        )
      )}

      {thinking && !(() => {
        // Once the streamed reply shows text or an app, it replaces the "thinking" dots.
        const last = messages[messages.length - 1];
        return last?.role === "assistant" && last.streaming && Boolean(last.text);
      })() && (
        <div className="flex items-center" role="status" aria-label={translateUi("Thinking…")}>
          <div className="flex items-center gap-1 py-2">
            {[0, 150, 300].map((delay) => (
              <span key={delay} className="w-1.5 h-1.5 rounded-full animate-bounce"
                style={{ backgroundColor: msgDim, animationDelay: `${delay}ms` }} />
            ))}
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );

  // ── Fullscreen toggle (website context only — booking is already full-page) ──

  function fullscreenToggle(extra = "") {
    if (isBooking) return null;
    return (
      <button
        onClick={() => setIsFullscreen((v) => !v)}
        title={isFullscreen ? translateUi("Exit fullscreen (Esc)") : translateUi("Expand to fullscreen")}
        aria-label={isFullscreen ? translateUi("Exit fullscreen") : translateUi("Expand to fullscreen")}
        className={`hidden sm:flex shrink-0 w-8 h-8 rounded-lg items-center justify-center cursor-pointer transition-all hover:scale-105 active:scale-95 ${extra}`}
        style={{ backgroundColor: `${theme.accentColor}14`, color: theme.accentColor }}
      >
        {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
      </button>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────

  // Landing view: one greeting, the composer, and a row of quick-action chips. The salon name
  // is already in the top bar, so it's only a quiet line here.
  const emptyState = (
    <div className="min-h-full flex flex-col items-center justify-center px-4 py-10 sm:px-8 gai-fade-in">
      <div className="w-full max-w-[760px]">
        <div className="mb-6 text-center sm:mb-8">
          <p className="text-sm font-medium" style={{ color: theme.accentColor }}>
            {isBooking ? translateUi("Book at {name}", { name: salon.name }) : translateUi("Welcome to {name}", { name: salon.name })}
          </p>
          <h2 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-[2rem]" style={{ color: msgText }}>
            {translateUi(isBooking ? "What would you like to book?" : "How can we help?")}
          </h2>
        </div>

        {renderComposer()}

        {starterQuestions.length > 0 && (
          <div className="mt-5 flex flex-wrap justify-center gap-2" role="list" aria-label={translateUi("Quick actions")}>
            {starterQuestions.map(({ label, hint, question, icon: Icon }) => (
              <button
                key={question}
                type="button"
                role="listitem"
                title={translateUi(hint)}
                onClick={() => sendMessage(question)}
                disabled={thinking}
                className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-all hover:shadow-sm active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ color: msgText, borderColor: bubbleBorder, backgroundColor: asBubbleBg }}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: theme.accentColor }} />
                <span>{translateUi(label)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ── Top bar — always visible, spans the chat column ───────────────────

  const chatHeader = (
    <div
      className="shrink-0 z-10"
      style={{ backgroundColor: topBg, borderBottom: `1px solid ${topBorder}` }}
    >
      <div className="flex items-center gap-2 px-3 py-3 sm:gap-3 sm:px-6">
        <div className="relative shrink-0">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: avatarBg, color: avatarText }}
          >
            {initials(salon.name)}
          </div>
          <span
            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
            style={{ backgroundColor: thinking ? theme.accentColor : "#34D399", borderColor: topBg }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate flex items-center gap-1.5" style={{ color: topText }}>
            <span className="truncate">{salon.name}</span>
            <span
              className="hidden shrink-0 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full border sm:inline-flex"
              style={{ color: theme.accentColor, borderColor: theme.accentColor }}
            >
              {translateUi("Beta ")}</span>
          </p>
          <p className="text-[11px]" style={{ color: topDim }}>
            {thinking ? translateUi("Thinking…") : isOpenNow(salon) ? translateUi("Open now · AI Assistant") : translateUi("AI Assistant · Online")}
          </p>
        </div>
        <LanguageSelector compact />
        <button
          type="button"
          onClick={() => setMcpDetailsOpen(true)}
          title={translateUi("Connect this salon to an AI app")}
          aria-label={translateUi("MCP connection details")}
          className="shrink-0 inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold transition-opacity hover:opacity-75"
          style={{ color: theme.accentColor, border: `1px solid ${topBorder}` }}
        >
          <PlugZap className="h-3.5 w-3.5" /><span>MCP</span>
        </button>
        {fullscreenToggle()}
        {started && (
          <button
            onClick={newChat}
            title={translateUi("Start a new conversation")}
            className="shrink-0 inline-flex items-center gap-1.5 px-2 py-1.5 sm:px-3 rounded-lg text-xs font-semibold cursor-pointer transition-all hover:opacity-80 active:scale-95"
            style={{ color: theme.accentColor, border: `1px solid ${topBorder}` }}
          >
            <SquarePen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{translateUi("Clear chat ")}</span></button>
        )}
      </div>
    </div>
  );

  // ── Composer ─────────────────────────────────────────────────────────────

  function renderComposer() {
    return (
    <div className="mx-auto w-full max-w-[760px]">
      <div
        className="flex items-end gap-2 rounded-2xl px-4 py-3 transition-all focus-within:ring-4 sm:py-3.5"
        style={{ backgroundColor: inputBg, border: `1.5px solid ${inputBorder}`, boxShadow: `0 8px 28px ${theme.accentColor}12`, "--tw-ring-color": `${theme.accentColor}18` } as React.CSSProperties}
      >
        <Search className="mb-1.5 h-4 w-4 shrink-0" style={{ color: msgDim }} />
        <textarea
          ref={inputRef}
          value={input}
          rows={1}
          maxLength={2000}
          aria-label={translateUi("Ask a question")}
          placeholder={narrowScreen
            ? translateUi(isBooking ? "Ask about booking…" : "Ask us anything…")
            : isBooking ? translateUi("Search services or ask about booking…") : translateUi("Search services, stylists, hours, or ask anything…")}
          className="flex-1 resize-none bg-transparent py-1.5 text-sm leading-relaxed outline-none placeholder:opacity-60"
          style={{ color: topText, maxHeight: "160px" }}
          onChange={(e) => {
            setInput(e.target.value);
            e.currentTarget.style.height = "auto";
            e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 160)}px`;
          }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <button
          onClick={send}
          disabled={!sendActive}
          aria-label={translateUi("Send question")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed"
          style={{
            backgroundColor: sendActive ? theme.accentColor : `${inputBorder}`,
            opacity: sendActive ? 1 : 0.5,
          }}
        >
          <ArrowUp className="h-4 w-4" style={{ color: sendActive ? accentText : topDim }} />
        </button>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center">
        <span className="hidden text-[10px] sm:inline" style={{ color: msgDim }}>
          {translateUi("Press Enter to ask · Shift + Enter for a new line")}</span>
        {started && <span className="hidden text-[10px] sm:inline" style={{ color: msgDim }}>·</span>}
        {started && <span className="basis-full text-[10px] text-center" style={{ color: msgDim }}>{translateUi("The assistant can make mistakes — please verify important details. ")}</span>}
      </div>
    </div>
    );
  }

  const composer = renderComposer();

  // ── Shell ────────────────────────────────────────────────────────────────

  const innerContent = (
    <>
      <style>{`
        @keyframes gai-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .gai-fade-in { animation: gai-fade-in 0.45s ease both; }
        @keyframes gai-msg-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes gai-expand { from { opacity: 0.5; } to { opacity: 1; } }
        .gai-expand { animation: gai-expand 0.18s ease both; }
      `}</style>

      {isBooking && (
        <SiteHeader
          salon={salon}
          theme={theme}
          current="ai"
          onBack={onSwitchToWizard ?? (() => {})}
          standalone
          headerExtra={
            <div
              className="inline-flex items-center rounded-xl p-1 gap-0.5"
              style={{ backgroundColor: `${theme.accentColor}12`, border: `1.5px solid ${theme.accentColor}30` }}
            >
              <button
                title={translateUi("Book with GenAI (current)")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold cursor-default select-none"
                style={{ backgroundColor: theme.accentColor, color: accentText, boxShadow: `0 2px 10px ${theme.accentColor}55` }}
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                {translateUi("Book with GenAI ")}</button>
              <button
                onClick={onSwitchToWizard}
                title={translateUi("Switch to step-by-step booking wizard")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 hover:opacity-80 cursor-pointer"
                style={{ color: theme.accentColor }}
              >
                <CalendarCheck className="w-3.5 h-3.5 shrink-0" />
                {translateUi("Book Now ")}</button>
            </div>
          }
        />
      )}

      <div
        className="flex-1 flex flex-col lg:flex-row min-h-0"
        style={{ background: pageBg, fontFamily: font.stack }}
      >
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {chatHeader}

          <div className="flex-1 overflow-y-auto min-h-0">
            {started ? messageThread : emptyState}
          </div>

          {started && <div className="shrink-0 px-4 pb-5 pt-3 sm:px-6">{composer}</div>}
        </div>
      </div>
      {mcpDetailsOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4"
          role="presentation"
          onClick={() => setMcpDetailsOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="mcp-connect-title"
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl p-5 shadow-2xl sm:max-w-xl sm:rounded-2xl sm:p-6"
            style={{ backgroundColor: topBg, color: topText, fontFamily: font.stack, paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h2 id="mcp-connect-title" className="text-base font-bold">{translateUi("Use this salon in your AI app")}</h2>
                <p className="mt-1 text-xs leading-relaxed" style={{ color: topDim }}>
                  {translateUi("Connect {name} to Claude, ChatGPT or another AI app that supports MCP, then browse services, the team, availability and the shop right in your chat.", { name: salon.name })}
                </p>
              </div>
              <button type="button" onClick={() => setMcpDetailsOpen(false)} aria-label={translateUi("Close")}
                className="rounded-lg p-2" style={{ color: topDim }}><X className="h-4 w-4" /></button>
            </div>

            <McpConnectGuide
              serverUrl={mcpServerUrl}
              handle={mcpSalonHandle}
              salonName={salon.name}
              accent={theme.accentColor}
              text={topText}
              dim={topDim}
              border={topBorder}
              t={translateUi}
            />
          </section>
        </div>
      )}
    </>
  );

  if (isBooking) {
    return (
      <div className="min-h-[100dvh] flex flex-col" style={{ fontFamily: font.stack, background: pageBg }}>
        {innerContent}
        <SiteFooter salon={salon} theme={theme} current="book" onBack={onSwitchToWizard ?? (() => {})} standalone />
      </div>
    );
  }

  return (
    <div
      className={isFullscreen ? "gai-expand fixed inset-0 z-50 flex flex-col" : "h-full flex flex-col"}
      style={isFullscreen ? { background: pageBg } : undefined}
    >
      {innerContent}
    </div>
  );
}
