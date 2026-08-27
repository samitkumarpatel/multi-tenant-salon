import React, { useEffect, useRef, useState } from "react";
import {
  Calendar, CalendarCheck, CheckCircle2, Clock, Loader2, Maximize2, Minimize2, MapPin, Phone, Send, Sparkles, SquarePen, Users, Wrench,
} from "lucide-react";
import { fontStack, loadGoogleFont, contrastText, isLightColor } from "./theme";
import { SiteHeader, SiteFooter } from "./SiteChrome";
import { apiFetch, API_BASE } from "./api";
import {
  ServicesCard, StaffCard, HoursCard, LocationCard, ContactCard, BookingPickerCard,
  type CardTokens, type PendingBookingFields, type PickerProgress,
} from "./GenerativeUICards";
import { type ClosureRange, resolveHolidayRanges } from "./bookingDates";
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

type MessageCard =
  | { type: "hours" | "location" | "contact" }
  | { type: "staff"; forServiceId?: number }
  | { type: "services"; forStaffId?: number }
  | { type: "booking-picker"; serviceId: number; staffId?: number };

type Message =
  | { role: "user"; text: string; time: string }
  | { role: "assistant"; text: string; tool?: ToolCard; time: string; cta?: "book"; pendingBooking?: PendingBookingUI; card?: MessageCard; picker?: PickerProgress };

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
// The assistant picks which interactive card to render by calling a show* / startBookingPicker
// tool server-side; the backend forwards its choice here. Unknown components are ignored.
type UiDirectiveResponse = {
  component: string;
  serviceId?: number | null;
  staffId?: number | null;
  forStaffId?: number | null;
  forServiceId?: number | null;
  forBooking?: boolean | null;
};
type ChatApiResponse = {
  reply: string;
  toolsUsed?: string[];
  pendingBooking?: PendingBookingResponse | null;
  ui?: UiDirectiveResponse | null;
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
  return tools.length ? tools.map((t) => TOOL_LABELS[t] ?? t).join(", ") : "salon-data";
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

// Maps the assistant's render directive onto a message card. Any component the assistant names
// that isn't in this switch is ignored — the reply text still shows — so a stray/renamed
// component can never break a turn.
function directiveToCard(ui: UiDirectiveResponse | null): MessageCard | undefined {
  switch (ui?.component) {
    case "services": return { type: "services", forStaffId: ui.forStaffId ?? undefined };
    case "staff": return { type: "staff", forServiceId: ui.forServiceId ?? undefined };
    case "hours": return { type: "hours" };
    case "location": return { type: "location" };
    case "contact": return { type: "contact" };
    case "booking-picker":
      return ui.serviceId != null
        ? { type: "booking-picker", serviceId: ui.serviceId, staffId: ui.staffId ?? undefined }
        : undefined;
    default: return undefined;
  }
}

async function requestChatReply(
  salonId: number,
  context: "website" | "booking",
  message: string,
  history: { role: "user" | "assistant"; text: string }[]
): Promise<{ text: string; toolsUsed: string[]; pendingBooking: PendingBookingResponse | null; ui: UiDirectiveResponse | null }> {
  try {
    const res = await apiFetch<ChatApiResponse>(`${API_BASE}/api/salon/${salonId}/chat`, {
      method: "POST",
      body: JSON.stringify({ context, message, history }),
    });
    return { text: res.reply, toolsUsed: res.toolsUsed ?? [], pendingBooking: res.pendingBooking ?? null, ui: res.ui ?? null };
  } catch {
    return {
      text: "Sorry, I'm having trouble responding right now — please try again shortly or contact us directly.",
      toolsUsed: [],
      pendingBooking: null,
      ui: null,
    };
  }
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
function MessageText({ text }: { text: string }) {
  return (
    <span className="whitespace-pre-line text-[15px] leading-relaxed">
      {text.split("\n").map((line, i) => (
        <span key={i}>{i > 0 && <br />}<MdText text={line} /></span>
      ))}
    </span>
  );
}

// Landing-moment reveal: each character of the salon name fades/rises in with a short stagger,
// in the salon's chosen accent color and font.
function AnimatedSalonName({ text, color }: { text: string; color: string }) {
  return (
    <h1 className="text-2xl font-bold leading-tight" style={{ color }}>
      {text.split("").map((ch, i) => (
        <span key={i} className="inline-block gai-fade-in" style={{ animationDelay: `${i * 28}ms`, whiteSpace: ch === " " ? "pre" : "normal" }}>
          {ch}
        </span>
      ))}
    </h1>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export function GenerativeUIWebsite({ salon, staff, services, theme, context = "website", onSwitchToWizard }: GenerativeUIWebsiteProps) {
  const isBooking = context === "booking";
  const font = { stack: fontStack(theme.fontFamily) };
  loadGoogleFont(theme.fontFamily);

  const accentText = contrastText(theme.accentColor);
  const avatarBg   = theme.logoBgColor;
  const avatarText = contrastText(theme.logoBgColor);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [thinking, setThinking] = useState(false);
  const [started, setStarted]   = useState(false);
  // How the chat opens is a salon-admin theme setting: "windowed" = the constrained card,
  // anything else (default) = fullscreen. The header toggle still flips it at runtime.
  // (Booking context is always full-page and ignores this.)
  const [isFullscreen, setIsFullscreen] = useState(!isBooking && theme.chatLayout !== "windowed");
  const [closedDateRanges, setClosedDateRanges] = useState<ClosureRange[]>([]);
  // LLM-suggested next questions, shown as chips above the composer; refreshed after each
  // assistant turn / instant card, cleared when the visitor sends something.
  const [followups, setFollowups] = useState<string[]>([]);
  const [followupsLoading, setFollowupsLoading] = useState(false);
  const followupKeyRef = useRef<string>("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

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

  // After each completed assistant turn (a reply, or an instant card from a sidebar option),
  // ask the assistant for the questions the visitor is likely to want next and show them as
  // chips above the composer. Cleared as soon as the visitor's own message lands.
  useEffect(() => {
    const reset = () => { setFollowups([]); setFollowupsLoading(false); followupKeyRef.current = ""; };
    if (thinking) { reset(); return; }
    const last = messages[messages.length - 1];
    if (!last) return;
    if (last.role === "user") { reset(); return; }
    if (!(last.text || last.card || last.pendingBooking)) return; // empty placeholder
    const key = `${messages.length}:${last.text}:${last.card?.type ?? ""}:${last.pendingBooking?.status ?? ""}`;
    if (key === followupKeyRef.current) return;
    followupKeyRef.current = key;
    setFollowups([]);
    setFollowupsLoading(true);
    apiFetch<{ followups?: string[] }>(`${API_BASE}/api/salon/${salon.id}/chat/followups`, {
      method: "POST",
      body: JSON.stringify({ context: isBooking ? "booking" : "website", history: historySnapshot() }),
    })
      .then((r) => setFollowups(Array.isArray(r.followups) ? r.followups.slice(0, 4) : []))
      .catch(() => setFollowups([]))
      .finally(() => setFollowupsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, thinking]);

  // One-off closures + resolved holiday dates the booking picker's calendar must block. The
  // server rejects these too (`/slots` returns nothing, `POST /booking` 400s) — this just keeps
  // the calendar from offering them.
  useEffect(() => {
    if (!salon.features?.includes("BOOKING")) return;
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + (salon.bookingAdvanceDays ?? 60));
    Promise.all([
      apiFetch<ClosureRange[]>(`${API_BASE}/api/salon/${salon.id}/closures`).catch((): ClosureRange[] => []),
      apiFetch<SalonHoliday[]>(`${API_BASE}/api/salon/${salon.id}/holidays`).catch((): SalonHoliday[] => []),
    ]).then(([closures, holidays]) => {
      setClosedDateRanges([...closures, ...resolveHolidayRanges(holidays, maxDate)]);
    });
  }, [salon.id, salon.bookingAdvanceDays, salon.features]);

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
        return `[A booking for ${serviceName} on ${when} is staged in the interface, awaiting the visitor's confirm click — not booked yet.]`;
      case "dismissed":
        return `[The visitor dismissed the booking proposal for ${serviceName} on ${when}.]`;
      case "error":
        return `[The last booking attempt for ${serviceName} on ${when} failed: ${pb.error ?? "unknown error"}.]`;
    }
  }

  // A generative-UI card carries no prose of its own, so a card-only assistant turn never
  // reaches the model through the normal history and it can't answer a later "show me that list
  // again" / "what did you just show me". These synthetic bracketed lines stand in for it.
  function cardHistoryClue(card: MessageCard): string | null {
    switch (card.type) {
      case "services": {
        const list = services
          .filter((s) => s.active && (card.forStaffId == null || !s.assignedStaffIds?.length || s.assignedStaffIds.includes(String(card.forStaffId))))
          .map((s) => s.name)
          .join(", ");
        return `[Showed the visitor an interactive services card${card.forStaffId != null ? " (filtered to one stylist)" : ""}: ${list || "no active services"}. They can tap "Book" on any of them.]`;
      }
      case "staff": {
        const svc = card.forServiceId != null ? services.find((s) => s.id === card.forServiceId) : undefined;
        const list = staff
          .filter((m) => m.status === "ACTIVE" && (!svc || !svc.assignedStaffIds?.length || svc.assignedStaffIds.includes(String(m.id))))
          .map((m) => m.name)
          .join(", ");
        return `[Showed the visitor an interactive team card${svc ? ` (who can do ${svc.name})` : ""}: ${list || "no matching team members"}.]`;
      }
      case "hours": return "[Showed the visitor the opening-hours card with this week's hours.]";
      case "location": return "[Showed the visitor the location card with the salon's address and a map link.]";
      case "contact": return "[Showed the visitor the contact card with the salon's phone and email.]";
      case "booking-picker": return null; // covered by the live picker-progress clue instead
    }
  }

  // The interactive booking picker owns its own state; this turns a lifted snapshot of it into a
  // clue so the assistant can answer "is that booked yet?" correctly while the visitor is still
  // mid-flow (it isn't — and it can say exactly what's left to do).
  function pickerHistoryClue(serviceId: number, p: PickerProgress): string {
    const serviceName = services.find((s) => s.id === serviceId)?.name ?? `service #${serviceId}`;
    const stylist = !p.staffChosen
      ? "not chosen yet"
      : p.staffId == null
        ? "any available stylist"
        : staff.find((s) => s.id === p.staffId)?.name ?? `staff #${p.staffId}`;
    const dateChosen = p.step === "time" || p.step === "contact";
    const timeLabel = p.step === "contact" && p.time ? p.time : "not chosen yet";
    const contactBits = [
      p.name ? `name "${p.name}"` : null,
      p.email ? `email "${p.email}"` : null,
      p.phone ? `phone "${p.phone}"` : null,
    ].filter(Boolean);
    const contactState = p.step === "contact"
      ? (contactBits.length ? ` They have entered ${contactBits.join(", ")}.` : " They have not filled in their contact details yet.")
      : "";
    return `[The visitor is using the interactive booking picker for ${serviceName} — they have NOT confirmed a booking. Selected so far — stylist: ${stylist}; date: ${dateChosen ? p.date : "not chosen yet"}; time: ${timeLabel}. Current step: ${p.step}.${contactState} Nothing is booked and no booking has been staged for confirmation: if they ask whether it's booked, tell them not yet — they still need to finish the picker (pick a time, enter their name and an email or phone) and confirm on the review card.]`;
  }

  // Prior turns, formatted for the chat API — captured before the new user message is appended.
  function assistantHistoryText(m: Extract<Message, { role: "assistant" }>): string | null {
    const parts: string[] = [];
    if (m.text) parts.push(m.text);
    if (m.card?.type === "booking-picker" && m.picker) {
      parts.push(pickerHistoryClue(m.card.serviceId, m.picker));
    } else if (m.card) {
      const clue = cardHistoryClue(m.card);
      if (clue) parts.push(clue);
    }
    if (m.pendingBooking) parts.push(bookingStatusSummary(m.pendingBooking));
    return parts.length ? parts.join("\n") : null;
  }

  function historySnapshot(): { role: "user" | "assistant"; text: string }[] {
    type Turn = { role: "user" | "assistant"; text: string };
    return messages.flatMap((m): Turn[] => {
      if (m.role === "user") return m.text ? [{ role: "user", text: m.text }] : [];
      const text = assistantHistoryText(m);
      return text ? [{ role: "assistant", text }] : [];
    });
  }

  function replyCta(userText: string): "book" | undefined {
    return isBooking && !NO_CTA_PATTERN.test(userText) ? "book" : undefined;
  }

  function resolveReply(userText: string, history: ReturnType<typeof historySnapshot>) {
    requestChatReply(salon.id, isBooking ? "booking" : "website", userText, history).then(({ text: reply, toolsUsed, pendingBooking, ui }) => {
      const cta = replyCta(userText);
      const card = directiveToCard(ui);
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          text: reply,
          tool: toolsUsed.length ? { name: friendlyToolLabel(toolsUsed), label: "salon-data", done: true } : undefined,
          time: nowTime(),
          cta,
          pendingBooking: pendingBooking ? { ...pendingBooking, status: "proposed" } : undefined,
          card,
        };
        return next;
      });
      setThinking(false);
    });
  }

  function sendMessage(text: string) {
    if (!text.trim() || thinking) return;
    setStarted(true);
    const history = historySnapshot();
    setMessages((prev) => [...prev, { role: "user", text, time: nowTime() }]);
    setThinking(true);
    const tool: ToolCard = { name: "salon-data", label: "Thinking…", done: false };
    setMessages((prev) => [...prev, { role: "assistant", text: "", tool, time: nowTime() }]);
    resolveReply(text, history);
  }

  // A card-tagged quick-action renders instantly from data already on the page — no LLM call,
  // no latency, no risk of the model getting a fact wrong. A short "thinking" beat keeps the feel
  // consistent with the rest of the chat.
  function showCard(cardType: CardType, question: string, intro?: string) {
    setStarted(true);
    setMessages((prev) => [...prev, { role: "user", text: question, time: nowTime() }]);
    setThinking(true);
    setTimeout(() => {
      setMessages((prev) => [...prev, { role: "assistant", text: intro ?? CARD_INTRO[cardType], time: nowTime(), card: { type: cardType } }]);
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
          card: { type: "booking-picker", serviceId: service.id, staffId },
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
          card: { type: "services", forStaffId: member.id },
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
      next[messageIndex] = { ...m, card: undefined, pendingBooking: { ...fields, status: "proposed" } };
      return next;
    });
  }

  // Records the picker's live selections onto the message so historySnapshot can turn them into
  // a clue for the assistant. Bails when nothing changed so a fresh callback identity per render
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
      next[messageIndex] = { ...m, card: undefined, text: "No problem — let me know if you'd like a different service or time." };
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
    setFollowups([]);
    followupKeyRef.current = "";
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

    apiFetch<Booking>(`${API_BASE}/api/salon/${salon.id}/booking`, {
      method: "POST",
      body: JSON.stringify(payload),
    })
      .then((booking) => {
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

  const chatBg      = theme.chatBg ?? theme.heroBg ?? "#F8FAFC";
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

  function renderCard(messageIndex: number, card: MessageCard) {
    switch (card.type) {
      case "services": {
        const filtered = card.forStaffId != null
          ? services.filter((s) => s.active && (!s.assignedStaffIds?.length || s.assignedStaffIds.includes(String(card.forStaffId))))
          : services;
        return <ServicesCard services={filtered} tokens={cardTokens} showBookPill={canBook} onBook={(s) => startBooking(s, card.forStaffId)} />;
      }
      case "staff": {
        const svc = card.forServiceId != null ? services.find((s) => s.id === card.forServiceId) : undefined;
        const filtered = svc && svc.assignedStaffIds?.length
          ? staff.filter((m) => svc.assignedStaffIds!.includes(String(m.id)))
          : staff;
        return <StaffCard staff={filtered} tokens={cardTokens} showBookPill={canBook} onBook={startBookingWithStaff} />;
      }
      case "hours": return <HoursCard salon={salon} tokens={cardTokens} />;
      case "location": return <LocationCard salon={salon} tokens={cardTokens} />;
      case "contact": return <ContactCard salon={salon} tokens={cardTokens} />;
      case "booking-picker": {
        const service = services.find((s) => s.id === card.serviceId);
        if (!service) return null;
        return (
          <BookingPickerCard
            salon={salon}
            service={service}
            staff={staff}
            tokens={cardTokens}
            initialStaffId={card.staffId}
            closedDateRanges={closedDateRanges}
            onComplete={(fields) => completeBookingPicker(messageIndex, fields)}
            onCancel={() => cancelBookingPicker(messageIndex)}
            onProgress={(p) => updatePickerProgress(messageIndex, p)}
          />
        );
      }
    }
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

  // The sidebar and empty-state cards are the fixed category options. LLM-generated follow-up
  // questions appear separately, as chips above the composer.
  const actionButtons = isBooking ? bookingButtons : websiteButtons;

  const chipStyle = {
    backgroundColor: `${theme.accentColor}10`,
    borderColor: `${theme.accentColor}30`,
    color: theme.accentColor,
  };

  // The strip above the composer is *only* the assistant's dynamically-generated follow-up
  // questions, built from the latest message in the thread — never the fixed category options
  // (those live in the sidebar / empty state). Nothing shows here until we have some.
  const followupChips = followups.length > 0 && (
    <div className="flex flex-wrap gap-2 justify-center">
      {followups.map((q) => (
        <button
          key={q}
          onClick={() => sendMessage(q)}
          disabled={thinking}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-xs font-medium transition-all duration-150 hover:shadow-sm active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={chipStyle}
        >
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          {q}
        </button>
      ))}
    </div>
  );

  // Richer "card" grid — the pre-chat landing screen's quick-question tiles, each with a live
  // one-line hint pulled straight from the salon's own data.
  const suggestionCards = actionButtons.length > 0 && (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 w-full max-w-[380px] lg:max-w-[560px]">
      {actionButtons.map((btn) => {
        const active = Boolean(btn.directAction);
        return (
          <button
            key={btn.label}
            onClick={() => askQuestion(btn)}
            className="flex flex-col items-start gap-2 p-3.5 rounded-2xl border text-left transition-all duration-150 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 active:translate-y-0 cursor-pointer"
            style={active ? { backgroundColor: theme.accentColor, borderColor: theme.accentColor, color: accentText } : chipStyle}
          >
            <btn.icon className="w-4 h-4 shrink-0" />
            <span className="text-xs font-semibold leading-tight">{btn.label}</span>
            {btn.hint && <span className="text-[10px] leading-snug opacity-70">{btn.hint}</span>}
          </button>
        );
      })}
    </div>
  );

  // ── "Book now" CTA button (booking context only) ─────────────────────

  const bookCtaBtn = isBooking ? (
    <button
      onClick={onSwitchToWizard}
      className="mt-2.5 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all hover:-translate-y-0.5 active:translate-y-0"
      style={{ backgroundColor: theme.accentColor, color: accentText, boxShadow: `0 6px 16px -6px ${theme.accentColor}aa` }}
    >
      <CalendarCheck className="w-3.5 h-3.5" />
      Book now →
    </button>
  ) : null;

  // ── Booking proposal card — the interactive "MCP-style" tool result ────

  function bookingCard(messageIndex: number, pb: PendingBookingUI) {
    if (pb.status === "dismissed") {
      return <p className="text-xs italic mt-1.5" style={{ color: msgDim }}>Booking request dismissed.</p>;
    }

    if (pb.status === "confirmed" && pb.confirmedBooking) {
      const isPending = pb.confirmedBooking.status === "PENDING";
      const service = services.find((s) => s.id === pb.serviceId);
      return (
        <div
          className="mt-2.5 rounded-2xl p-4 flex items-start gap-3"
          style={{ backgroundColor: `${theme.accentColor}12`, border: `1px solid ${theme.accentColor}35` }}
        >
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" style={{ color: theme.accentColor }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: theme.accentColor }}>
              {isPending ? "Booking request sent!" : "You're booked!"}
            </p>
            <p className="text-xs mt-0.5" style={{ color: msgText }}>
              {service?.name ?? "Appointment"} · {formatDateLabel(pb.appointmentDate)} at {pb.startTime}
              {isPending ? " — the salon will confirm shortly." : ""}
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
        <div className="px-4 py-2.5" style={{ borderBottom: `1px solid ${bubbleBorder}` }}>
          <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: theme.accentColor }}>Review your booking</p>
        </div>
        <div className="px-4 py-3 space-y-1.5 text-sm">
          <div className="flex justify-between gap-3">
            <span style={{ color: msgDim }}>Service</span>
            <span className="font-medium text-right" style={{ color: msgText }}>{service?.name ?? `Service #${pb.serviceId}`}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span style={{ color: msgDim }}>With</span>
            <span className="font-medium text-right" style={{ color: msgText }}>{staffMember?.name ?? "Any available stylist"}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span style={{ color: msgDim }}>When</span>
            <span className="font-medium text-right" style={{ color: msgText }}>{formatDateLabel(pb.appointmentDate)} · {pb.startTime}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span style={{ color: msgDim }}>Name</span>
            <span className="font-medium text-right" style={{ color: msgText }}>{pb.customerName}</span>
          </div>
          {(pb.customerEmail || pb.customerPhone) && (
            <div className="flex justify-between gap-3">
              <span style={{ color: msgDim }}>Contact</span>
              <span className="font-medium text-right truncate" style={{ color: msgText }}>{pb.customerEmail || pb.customerPhone}</span>
            </div>
          )}
        </div>
        {pb.status === "error" && (
          <div className="px-4 pb-2 text-xs" style={{ color: errorColor }}>{pb.error}</div>
        )}
        <div className="px-3 pb-3 pt-1 flex gap-2">
          <button
            onClick={() => confirmPendingBooking(messageIndex)}
            disabled={confirming}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all disabled:cursor-not-allowed"
            style={{ backgroundColor: theme.accentColor, color: accentText, opacity: confirming ? 0.7 : 1 }}
          >
            {confirming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            {confirming ? "Booking…" : "Confirm booking"}
          </button>
          <button
            onClick={() => dismissPendingBooking(messageIndex)}
            disabled={confirming}
            className="px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all disabled:cursor-not-allowed disabled:opacity-50"
            style={{ color: msgDim, border: `1px solid ${bubbleBorder}` }}
          >
            Never mind
          </button>
        </div>
      </div>
    );
  }

  // ── Message thread ──────────────────────────────────────────────────────

  const messageThread = (
    <div className="mx-auto px-4 sm:px-6 py-6 space-y-6 max-w-[760px]">
      {messages.map((m, i) =>
        m.role === "user" ? (
          <div key={i} className="flex justify-end">
            <div
              className="max-w-[80%] px-4 py-2.5 text-[15px] leading-relaxed"
              style={{ backgroundColor: theme.accentColor, color: accentText, borderRadius: "1.25rem 1.25rem 0.25rem 1.25rem" }}
            >
              {m.text}
            </div>
          </div>
        ) : (
          <div key={i} className="flex items-start gap-3">
            <div
              className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold"
              style={{ backgroundColor: avatarBg, color: avatarText }}
            >
              {initials(salon.name)[0]}
            </div>
            <div className="flex-1 min-w-0 space-y-1.5 pt-0.5">
              {m.tool && (
                <div
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium"
                  style={{
                    backgroundColor: m.tool.done ? `${theme.accentColor}10` : `${msgDim}15`,
                    color: m.tool.done ? theme.accentColor : msgDim,
                  }}
                >
                  {m.tool.done ? <Wrench className="w-2.5 h-2.5" /> : <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                  <span>{m.tool.done ? `Used ${m.tool.name}` : m.tool.label}</span>
                </div>
              )}
              {(m.text || m.card || m.pendingBooking) && (
                <div
                  className="rounded-2xl px-4 py-3"
                  style={{ color: msgText, backgroundColor: asBubbleBg, border: `1px solid ${bubbleBorder}`, boxShadow: bubbleShadow }}
                >
                  {m.text && <MessageText text={m.text} />}
                  {m.cta === "book" && bookCtaBtn}
                  {m.pendingBooking && bookingCard(i, m.pendingBooking)}
                  {m.card && renderCard(i, m.card)}
                </div>
              )}
            </div>
          </div>
        )
      )}

      {thinking && (
        <div className="flex items-start gap-3">
          <div
            className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold"
            style={{ backgroundColor: avatarBg, color: avatarText }}
          >
            {initials(salon.name)[0]}
          </div>
          <div className="flex items-center gap-1 pt-3">
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
        title={isFullscreen ? "Exit fullscreen (Esc)" : "Expand to fullscreen"}
        aria-label={isFullscreen ? "Exit fullscreen" : "Expand to fullscreen"}
        className={`hidden sm:flex shrink-0 w-8 h-8 rounded-lg items-center justify-center cursor-pointer transition-all hover:scale-105 active:scale-95 ${extra}`}
        style={{ backgroundColor: `${theme.accentColor}14`, color: theme.accentColor }}
      >
        {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
      </button>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────

  const emptyState = (
    <div className="h-full flex flex-col items-center justify-center px-6 gap-7 gai-fade-in">
      <div className="flex flex-col items-center text-center gap-3 max-w-md">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold"
          style={{
            backgroundColor: avatarBg, color: avatarText,
            boxShadow: `0 0 0 4px ${theme.accentColor}18, 0 8px 24px ${theme.accentColor}30`,
          }}
        >
          {initials(salon.name)}
        </div>
        <div>
          <AnimatedSalonName text={isBooking ? `Book at ${salon.name}` : salon.name} color={theme.accentColor} />
          <p className="text-sm mt-1.5" style={{ color: msgDim }}>
            {isBooking
              ? "Tell me what you'd like, and I'll get it booked."
              : "Ask me anything about services, hours, location, or booking."}
          </p>
        </div>
      </div>
      <div className="lg:hidden">{suggestionCards}</div>
    </div>
  );

  // ── Top bar — always visible, spans the chat column ───────────────────

  const chatHeader = (
    <div
      className="shrink-0 z-10"
      style={{ backgroundColor: topBg, borderBottom: `1px solid ${topBorder}` }}
    >
      <div className="flex items-center gap-3 px-4 sm:px-6 py-3">
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
          <p className="text-sm font-bold truncate" style={{ color: topText }}>{salon.name}</p>
          <p className="text-[11px]" style={{ color: topDim }}>
            {thinking ? "Thinking…" : isOpenNow(salon) ? "Open now · AI Assistant" : "AI Assistant · Online"}
          </p>
        </div>
        {fullscreenToggle()}
        {started && (
          <button
            onClick={newChat}
            title="Start a new conversation"
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all hover:opacity-80 active:scale-95"
            style={{ color: theme.accentColor, border: `1px solid ${topBorder}` }}
          >
            <SquarePen className="w-3.5 h-3.5" />
            Clear chat
          </button>
        )}
      </div>
    </div>
  );

  // ── Composer ─────────────────────────────────────────────────────────────

  const composer = (
    <div className="mx-auto w-full max-w-[760px]">
      <div
        className="flex items-end gap-2 pl-4 pr-2 py-3 rounded-2xl"
        style={{ backgroundColor: inputBg, border: `1.5px solid ${inputBorder}` }}
      >
        <textarea
          ref={inputRef}
          value={input}
          rows={1}
          maxLength={2000}
          placeholder={isBooking ? `Ask about services, or say what you'd like to book…` : `Message ${salon.name}…`}
          className="flex-1 resize-none text-sm outline-none bg-transparent leading-relaxed py-1.5"
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
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all cursor-pointer disabled:cursor-not-allowed"
          style={{
            backgroundColor: sendActive ? theme.accentColor : `${inputBorder}`,
            opacity: sendActive ? 1 : 0.5,
          }}
        >
          <Send className="w-4 h-4" style={{ color: sendActive ? accentText : topDim }} />
        </button>
      </div>
      <div className="flex items-center justify-center gap-2 mt-2.5">
        <span className="text-[10px]" style={{ color: msgDim }}>
          The assistant can make mistakes — please verify important details.
        </span>
      </div>
    </div>
  );

  // ── Sidebar (lg screens and up) — persistent salon facts + quick questions,
  // so the extra desktop width goes toward something useful instead of stretching message text.

  const sidebar = actionButtons.length > 0 && (
    <aside
      className="hidden lg:flex lg:flex-col lg:w-[300px] xl:w-[320px] shrink-0 gap-5 px-5 py-6 overflow-y-auto"
      style={{ borderRight: `1px solid ${bubbleBorder}`, backgroundColor: asBubbleBg }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{ backgroundColor: avatarBg, color: avatarText }}
        >
          {initials(salon.name)}
        </div>
        <p className="text-sm font-bold leading-tight" style={{ color: msgText }}>{salon.name}</p>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: isOpenNow(salon) ? "#34D399" : msgDim }} />
          <span className="text-xs font-semibold" style={{ color: isOpenNow(salon) ? theme.accentColor : msgDim }}>
            {isOpenNow(salon) ? "Open now" : todayHours(salon) ?? "Closed"}
          </span>
        </div>
        {(salon.location?.address || salon.location?.city) && (
          <p className="text-xs leading-snug flex items-start gap-1.5" style={{ color: msgDim }}>
            <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{[salon.location?.address, salon.location?.city].filter(Boolean).join(", ")}</span>
          </p>
        )}
        {salon.contact?.phone && (
          <a href={`tel:${salon.contact.phone}`} className="text-xs flex items-center gap-1.5 no-underline" style={{ color: msgDim }}>
            <Phone className="w-3.5 h-3.5 shrink-0" />
            {salon.contact.phone}
          </a>
        )}
      </div>

      <div style={{ borderTop: `1px solid ${bubbleBorder}` }} />

      <div className="space-y-1.5 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: msgDim }}>Quick questions</p>
        {actionButtons.map((btn) => (
          <button
            key={btn.label}
            onClick={() => askQuestion(btn)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-150 hover:shadow-sm active:scale-[0.98] cursor-pointer"
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

      {started && (
        <button
          onClick={newChat}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all hover:opacity-80"
          style={{ color: theme.accentColor, border: `1px solid ${bubbleBorder}` }}
        >
          <SquarePen className="w-3.5 h-3.5" /> New conversation
        </button>
      )}
    </aside>
  );

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
                title="Book with GenAI (current)"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold cursor-default select-none"
                style={{ backgroundColor: theme.accentColor, color: accentText, boxShadow: `0 2px 10px ${theme.accentColor}55` }}
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                Book with GenAI
              </button>
              <button
                onClick={onSwitchToWizard}
                title="Switch to step-by-step booking wizard"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 hover:opacity-80 cursor-pointer"
                style={{ color: theme.accentColor }}
              >
                <CalendarCheck className="w-3.5 h-3.5 shrink-0" />
                Book Now
              </button>
            </div>
          }
        />
      )}

      <div
        className="flex-1 flex flex-col lg:flex-row min-h-0"
        style={{ background: pageBg, fontFamily: font.stack }}
      >
        {sidebar}

        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {chatHeader}

          <div className="flex-1 overflow-y-auto min-h-0">
            {started ? messageThread : emptyState}
          </div>

          <div className="shrink-0 px-4 sm:px-6 pb-5 pt-3">
            {started && (followupsLoading || followupChips) && (
              <div className="mx-auto mb-3 max-w-[760px]">
                {followupsLoading ? (
                  <div className="flex items-center justify-center gap-1.5 py-1.5 text-[11px]" style={{ color: msgDim }}>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Preparing suggestions…</span>
                  </div>
                ) : followupChips}
              </div>
            )}
            {composer}
          </div>
        </div>
      </div>
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
