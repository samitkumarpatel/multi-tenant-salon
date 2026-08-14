import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar, CalendarCheck, ChevronDown, ChevronRight, Clock, MapPin, Mic, MessageCircle, Phone, Send, Sparkles, SquarePen, Users, Wrench,
} from "lucide-react";
import { FONTS, loadGoogleFont, contrastText, isLightColor } from "./theme";
import { formatPrice } from "./constants";
import { SiteHeader, SiteFooter } from "./SiteChrome";
import type { Salon, ServiceItem, StaffMember, WebsiteTheme } from "./types";

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
type Message =
  | { role: "user"; text: string; time: string }
  | { role: "assistant"; text: string; tool?: ToolCard; time: string; cta?: "book" };

type ReplyResult = { text: string; cta?: "book" };

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
function mockBookingReply(input: string, salon: Salon, services: ServiceItem[], staff: StaffMember[]): ReplyResult {
  const lower = input.toLowerCase();
  const name  = salon.name;
  const phone = salon.contact?.phone;
  const email = salon.contact?.email;
  if (/book|appointment|schedule|slot|reserv/i.test(lower)) {
    return { text: `Ready to book at **${name}**! The step-by-step wizard will help you pick a service, choose a date and time, and confirm your details.`, cta: "book" };
  }
  if (/price|cost|fee|how much/.test(lower)) {
    const priced = services.filter((s) => s.active && s.price != null).slice(0, 5);
    if (priced.length) {
      const list = priced.map((s) => `**${s.name}** — ${formatPrice(s.price!, s.currency ?? "EUR")}`).join("\n");
      return { text: `Here are some of our services and prices:\n\n${list}`, cta: "book" };
    }
    return { text: `Please ${phone ? `call us at ${phone}` : "reach out"} for our current pricing.` };
  }
  if (/service|treatment|offer|menu|what can|what do/.test(lower)) {
    const active = services.filter((s) => s.active).slice(0, 6);
    if (active.length) {
      const list = active.map((s) => {
        const parts = [`**${s.name}**`];
        if (s.durationMinutes) parts.push(`${s.durationMinutes} min`);
        if (s.price != null) parts.push(formatPrice(s.price, s.currency ?? "EUR"));
        return parts.join(" · ");
      }).join("\n");
      return { text: `At **${name}** we offer:\n\n${list}`, cta: "book" };
    }
    return { text: `**${name}** offers a range of beauty & wellness services. Book now and we'll match you with the perfect treatment!`, cta: "book" };
  }
  if (/how long|duration|takes/.test(lower)) {
    const timed = services.filter((s) => s.active && s.durationMinutes).slice(0, 5);
    if (timed.length) {
      return { text: `Here's how long our services take:\n\n${timed.map((s) => `**${s.name}** — ${s.durationMinutes} min`).join("\n")}`, cta: "book" };
    }
    return { text: `Session lengths vary by service — you'll see durations when selecting a treatment!`, cta: "book" };
  }
  if (/staff|stylist|team|who|person/.test(lower)) {
    const names = staff.slice(0, 4).map((s) => `**${s.name}**${s.role ? ` (${s.role})` : ""}`);
    return names.length
      ? { text: `Our team at **${name}**:\n\n${names.join("\n")}\n\nYou can pick your preferred person when booking!`, cta: "book" }
      : { text: `**${name}** has a skilled team ready to help!`, cta: "book" };
  }
  if (/hour|open|close|when/.test(lower)) {
    const h = todayHours(salon);
    const open = isOpenNow(salon);
    const line = h ? `\n\n${open ? "We're **currently open**." : "We're **currently closed**."} Today: ${h === "Closed today" ? "**closed all day**" : `**${h}**`}.` : "";
    return { text: `You can find our full hours on our website.${line}`, cta: "book" };
  }
  if (/location|address|where|find/.test(lower)) {
    const loc  = salon.location;
    const parts = [loc?.address, loc?.city, loc?.country].filter(Boolean).join(", ");
    return { text: parts ? `You can find us at **${parts}**.` : `Please ${phone ? `call us at ${phone}` : email ? `email ${email}` : "contact us"} for directions.` };
  }
  if (/contact|phone|email|reach|call/.test(lower)) {
    const lines: string[] = [];
    if (phone) lines.push(`📞 ${phone}`);
    if (email) lines.push(`📧 ${email}`);
    return { text: lines.length ? `Reach **${name}**:\n\n${lines.join("\n")}` : `Visit our page for contact details.` };
  }
  return { text: `I can help with services, prices, our team, or hours — or just go ahead and book!`, cta: "book" };
}

function mockReply(input: string, salon: Salon, services: ServiceItem[], staff: StaffMember[]): string {
  const lower = input.toLowerCase();
  const name  = salon.name;
  const phone = salon.contact?.phone;
  const email = salon.contact?.email;
  const contact = phone ? `call us at ${phone}` : email ? `email us at ${email}` : "contact us directly";
  if (/service|treatment|offer|menu|price|cost/.test(lower)) {
    const names = services.filter((s) => s.active).slice(0, 5).map((s) => s.name);
    return names.length
      ? `At ${name} we offer: **${names.join(", ")}** and more. Feel free to ask about any service in detail!`
      : `${name} offers a range of beauty & wellness services. Feel free to ask me anything specific!`;
  }
  if (/book|appointment|schedule|slot|reserv/.test(lower))
    return `To book at ${name}, you can ${contact} and our team will get you set up. We'd love to see you! 📅`;
  if (/staff|stylist|team|who|person|employ/.test(lower)) {
    const names = staff.slice(0, 3).map((s) => s.name);
    return names.length
      ? `Our talented team at ${name} includes **${names.join(", ")}** and more talented professionals ready to help you look your best!`
      : `${name} has a dedicated team of professionals. Reach out and we'll match you with the right person.`;
  }
  if (/hour|open|close|time|when/.test(lower)) {
    const h = todayHours(salon);
    const currently = isOpenNow(salon) ? "We're **currently open**." : "We're **currently closed**.";
    const line = h ? `\n\n${currently} Today: ${h === "Closed today" ? "**closed all day**" : `**${h}**`}.` : "";
    return `You can find our full hours on our website.${line}`;
  }
  if (/location|address|where|find|direction|map/.test(lower)) {
    const loc  = salon.location;
    const parts = [loc?.address, loc?.city, loc?.country].filter(Boolean).join(", ");
    return parts
      ? `You can find us at **${parts}**.${phone ? ` Give us a call at ${phone} if you need help finding us!` : ""}`
      : `Please ${contact} and we'll share our exact location with you.`;
  }
  if (/contact|phone|email|reach|call/.test(lower)) {
    const lines: string[] = [];
    if (phone) lines.push(`📞 ${phone}`);
    if (email) lines.push(`📧 ${email}`);
    return lines.length
      ? `Here's how to reach **${name}**:\n\n${lines.join("\n")}\n\nWe're always happy to hear from you!`
      : `Visit our website for full contact details — we'd love to connect!`;
  }
  return `Thanks for reaching out to **${name}**! I'm here to help with anything — services, bookings, hours, location, or our team. What would you like to know?`;
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
    <span className="whitespace-pre-line text-sm leading-relaxed">
      {text.split("\n").map((line, i) => (
        <span key={i}>{i > 0 && <br />}<MdText text={line} /></span>
      ))}
    </span>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export function GenerativeUIWebsite({ salon, staff, services, theme, context = "website", getPagePath, onNavigate, onSwitchToWizard }: GenerativeUIWebsiteProps) {
  const isBooking = context === "booking";
  const font = FONTS[theme.fontFamily as keyof typeof FONTS] ?? FONTS.system;
  loadGoogleFont(theme.fontFamily);

  const accentText = contrastText(theme.accentColor);
  const avatarBg   = theme.logoBgColor;
  const avatarText = contrastText(theme.logoBgColor);

  const openingMsg: Message = {
    role: "assistant",
    time: nowTime(),
    text: isBooking
      ? `Hi! 👋 I'm the AI booking assistant for **${salon.name}**.\n\nAsk me about services, prices, how long things take, or who's on the team — or just go ahead and book!`
      : `Hi! 👋 I'm the AI assistant for **${salon.name}**, powered by MCP.\n\nAsk me anything — services, team, hours, location, or how to book. I'm here to help!`,
    cta: isBooking ? "book" : undefined,
  };

  const [messages, setMessages]   = useState<Message[]>([openingMsg]);
  const [input, setInput]         = useState("");
  const [thinking, setThinking]   = useState(false);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);
  const moreRef    = useRef<HTMLDivElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  // Intro phases: "playing" = full-page animation, "exiting" = fade out overlay, "done" = chat visible
  const [introPhase, setIntroPhase] = useState<"playing" | "exiting" | "done">("playing");
  // Question phase: "welcome" = initial stack, "answered" = Q clicked (no input), "chatting" = full conversation
  const [questionPhase, setQuestionPhase] = useState<"welcome" | "answered" | "chatting">("welcome");
  // Track which question cards have been asked
  const [askedLabels, setAskedLabels] = useState<Set<string>>(new Set());

  // Typewriter animation states (drive the full-page intro overlay)
  const fullTitle = isBooking ? `Book at ${salon.name}` : salon.name;
  const [labelVisible, setLabelVisible] = useState(false);
  const [typedTitle, setTypedTitle]     = useState("");
  const [titleDone, setTitleDone]       = useState(false);
  const [cursorHidden, setCursorHidden] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  useEffect(() => {
    if (questionPhase === "chatting") inputRef.current?.focus();
  }, [questionPhase]);

  // Typewriter plays in the full-page overlay; once typing is done, transition to chat
  useEffect(() => {
    let i = 0;
    let iv: ReturnType<typeof setInterval>;
    let nameStart: ReturnType<typeof setTimeout>;
    let exitTimer: ReturnType<typeof setTimeout>;
    let doneTimer: ReturnType<typeof setTimeout>;
    let cursorTimer: ReturnType<typeof setTimeout>;
    setLabelVisible(false);
    setTypedTitle("");
    setTitleDone(false);
    setCursorHidden(false);
    setIntroPhase("playing");
    const labelTimer = setTimeout(() => {
      setLabelVisible(true);
      nameStart = setTimeout(() => {
        iv = setInterval(() => {
          i++;
          setTypedTitle(fullTitle.slice(0, i));
          if (i >= fullTitle.length) {
            clearInterval(iv);
            setTitleDone(true);
            cursorTimer = setTimeout(() => setCursorHidden(true), 2000);
            // After subtitle settles, begin cross-fade to chat layout
            exitTimer = setTimeout(() => {
              setIntroPhase("exiting");
              doneTimer = setTimeout(() => setIntroPhase("done"), 600);
            }, 1400);
          }
        }, 60);
      }, 300);
    }, 350);
    return () => {
      clearTimeout(labelTimer); clearTimeout(nameStart); clearInterval(iv);
      clearTimeout(exitTimer); clearTimeout(doneTimer); clearTimeout(cursorTimer);
    };
  }, [fullTitle]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!moreOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [moreOpen]);

  // Called from the input box — switches to full chat mode
  function startInteraction() {
    setQuestionPhase("chatting");
  }

  function getReply(text: string): ReplyResult {
    return isBooking
      ? mockBookingReply(text, salon, services, staff)
      : { text: mockReply(text, salon, services, staff) };
  }

  // Called when a question card is clicked — answers inline, stays in answered phase
  function askQuestion(btn: ActionButton) {
    if (btn.directAction) { btn.directAction(); return; }
    if (thinking) return;
    setAskedLabels(prev => new Set([...prev, btn.label]));
    setQuestionPhase("answered");
    setMessages(prev => [...prev, { role: "user", text: btn.question, time: nowTime() }]);
    setThinking(true);
    setTimeout(() => {
      const tool: ToolCard = { name: "salon-data", label: "Querying salon data…", done: false };
      setMessages(prev => [...prev, { role: "assistant", text: "", tool, time: nowTime() }]);
      setTimeout(() => {
        const { text: reply, cta } = getReply(btn.question);
        setMessages(prev => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", text: reply, tool: { ...tool, done: true, label: "salon-data" }, time: nowTime(), cta };
          return next;
        });
        setThinking(false);
      }, 900);
    }, 600);
  }

  function dispatch(text: string) {
    if (!text.trim() || thinking) return;
    startInteraction();
    setMessages((prev) => [...prev, { role: "user", text, time: nowTime() }]);
    setThinking(true);
    setTimeout(() => {
      const tool: ToolCard = { name: "salon-data", label: "Querying salon data…", done: false };
      setMessages((prev) => [...prev, { role: "assistant", text: "", tool, time: nowTime() }]);
      setTimeout(() => {
        const { text: reply, cta } = getReply(text);
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", text: reply, tool: { ...tool, done: true, label: "salon-data" }, time: nowTime(), cta };
          return next;
        });
        setThinking(false);
      }, 900);
    }, 600);
  }

  function send() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    dispatch(text);
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

  const inputBg     = isLightColor(topBg) ? "#F8FAFC" : "#0F172A";
  const inputBorder = isLightColor(topBg) ? "#E2E8F0" : "#334155";
  const inputShadow = isLightColor(topBg)
    ? "0 1px 8px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)"
    : "0 1px 8px rgba(0,0,0,0.3),  0 0 0 1px rgba(255,255,255,0.04)";

  const sendActive  = Boolean(input.trim()) && !thinking;

  // Booking mode: own header uses theme.headerBg
  const headerBg      = theme.headerBg ?? "#FFFFFF";
  const headerIsLight = isLightColor(headerBg);
  const headerText    = headerIsLight ? "#0F172A" : "#FFFFFF";
  const headerBorder  = headerIsLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.12)";

  const chatBorder  = chatLight ? "rgba(148,163,184,0.35)" : "rgba(255,255,255,0.12)";
  const bubbleBorder = chatLight ? "rgba(148,163,184,0.3)" : "rgba(255,255,255,0.08)";
  const bubbleShadow = chatLight
    ? "0 1px 3px rgba(0,0,0,0.05), 0 0 0 1px rgba(148,163,184,0.15)"
    : "0 1px 3px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.04)";

  const pageBg = `radial-gradient(ellipse 80% 50% at 50% -10%, ${theme.accentColor}18 0%, transparent 60%), ${chatBg}`;

  // ── Dynamic action buttons (based on available salon data) ────────────

  type ActionButton = {
    label: string;
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    question: string;
    iconAnim: string;
    /** When set, clicking calls this directly instead of dispatching a question */
    directAction?: () => void;
  };

  const websiteButtons: ActionButton[] = [
    salon.features?.includes("BOOKING") && {
      label: "Book with us",
      icon: Calendar,
      question: "How do I book an appointment?",
      iconAnim: "group-hover:rotate-12 group-hover:scale-110",
    },
    services.filter((s) => s.active).length > 0 && {
      label: "Our Services",
      icon: Sparkles,
      question: "What services do you offer?",
      iconAnim: "group-hover:scale-125 group-hover:rotate-6",
    },
    staff.length > 0 && {
      label: "Our Staff",
      icon: Users,
      question: "Who's on the team?",
      iconAnim: "group-hover:scale-110",
    },
    (salon.operatingHours?.length ?? 0) > 0 && {
      label: "Opening Hours",
      icon: Clock,
      question: "What are your opening hours?",
      iconAnim: "group-hover:rotate-45",
    },
    (salon.location?.address || salon.location?.city) && {
      label: "Find Us",
      icon: MapPin,
      question: "Where are you located?",
      iconAnim: "group-hover:-translate-y-1 group-hover:scale-110",
    },
    (salon.contact?.phone || salon.contact?.email) && {
      label: "Contact Us",
      icon: Phone,
      question: "How can I contact you?",
      iconAnim: "group-hover:rotate-12 group-hover:scale-110",
    },
  ].filter(Boolean) as ActionButton[];

  const bookingButtons: ActionButton[] = [
    {
      label: "Book appointment",
      icon: CalendarCheck,
      question: "",
      iconAnim: "group-hover:rotate-12 group-hover:scale-110",
      directAction: onSwitchToWizard,
    },
    services.filter((s) => s.active).length > 0 && {
      label: "Our services",
      icon: Sparkles,
      question: "What services do you offer?",
      iconAnim: "group-hover:scale-125 group-hover:rotate-6",
    },
    staff.length > 0 && {
      label: "Our team",
      icon: Users,
      question: "Who are your stylists?",
      iconAnim: "group-hover:scale-110",
    },
    services.some((s) => s.durationMinutes) && {
      label: "How long?",
      icon: Clock,
      question: "How long do your services take?",
      iconAnim: "group-hover:rotate-45",
    },
    (salon.location?.address || salon.location?.city) && {
      label: "Find us",
      icon: MapPin,
      question: "Where are you located?",
      iconAnim: "group-hover:-translate-y-1 group-hover:scale-110",
    },
    (salon.contact?.phone || salon.contact?.email) && {
      label: "Contact us",
      icon: Phone,
      question: "How can I contact you?",
      iconAnim: "group-hover:rotate-12 group-hover:scale-110",
    },
  ].filter(Boolean) as ActionButton[];

  const actionButtons = isBooking ? bookingButtons : websiteButtons;

  // Shuffle once on mount; first 3 (or 2 for booking) shown, rest in "More" dropdown
  const [visibleButtons, dropdownButtons] = useMemo(() => {
    const shufflable = actionButtons.filter((b) => !b.directAction);
    const arr = [...shufflable];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return isBooking ? [arr.slice(0, 2), arr.slice(2)] : [arr.slice(0, 3), arr.slice(3)];
  }, [actionButtons.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const inputCard = (
    <div
      className="flex items-end gap-2 px-4 py-3 rounded-2xl"
      style={{ backgroundColor: inputBg, border: `1px solid ${inputBorder}`, boxShadow: inputShadow }}
    >
      <textarea
        ref={inputRef}
        value={input}
        rows={3}
        placeholder="Ask me anything…"
        className="flex-1 resize-none text-sm outline-none bg-transparent leading-relaxed"
        style={{ color: topText, maxHeight: "200px" }}
        onChange={(e) => {
          setInput(e.target.value);
          e.currentTarget.style.height = "auto";
          e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 200)}px`;
        }}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
      />
      {/* Mic — disabled, voice input not yet available */}
      <button
        disabled
        title="Voice input coming soon"
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 cursor-not-allowed"
        style={{
          backgroundColor: "transparent",
          border: `1.5px solid ${inputBorder}`,
          opacity: 0.3,
        }}
      >
        <Mic className="w-4 h-4" style={{ color: topDim }} />
      </button>
      <button
        onClick={send}
        disabled={!sendActive}
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all cursor-pointer disabled:cursor-not-allowed"
        style={{
          backgroundColor: sendActive ? theme.accentColor : "transparent",
          border: `1.5px solid ${sendActive ? theme.accentColor : inputBorder}`,
          opacity: sendActive ? 1 : 0.4,
        }}
      >
        <Send className="w-4 h-4" style={{ color: sendActive ? accentText : topDim }} />
      </button>
    </div>
  );

  const btnStyle = {
    backgroundColor: `${theme.accentColor}10`,
    borderColor: `${theme.accentColor}35`,
    color: theme.accentColor,
    boxShadow: `0 1px 3px ${theme.accentColor}15`,
  };

  const actionButtonsPanel = visibleButtons.length > 0 || isBooking ? (
    <div className="flex gap-1.5 mb-3 w-full">
      {/* Booking: prominent "Book" primary button */}
      {isBooking && (
        <button
          onClick={onSwitchToWizard}
          className="group flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 hover:shadow-md active:scale-95 cursor-pointer"
          style={{ backgroundColor: theme.accentColor, color: accentText }}
        >
          <CalendarCheck className="w-3.5 h-3.5 shrink-0 group-hover:scale-110 transition-transform duration-200" />
          <span>Book</span>
        </button>
      )}
      {visibleButtons.map((btn) => (
        <button
          key={btn.label}
          onClick={() => askQuestion(btn)}
          title={btn.label}
          className="group flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border text-xs font-medium transition-all duration-200 hover:shadow-md active:scale-95 cursor-pointer overflow-hidden"
          style={btnStyle}
        >
          <btn.icon className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${btn.iconAnim}`} />
          <span className="truncate hidden sm:inline">{btn.label}</span>
        </button>
      ))}

      {dropdownButtons.length > 0 && (
        <div ref={moreRef} className="relative flex-1 min-w-0">
          <button
            onClick={() => setMoreOpen((o) => !o)}
            title="More"
            className="group w-full inline-flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border text-xs font-medium transition-all duration-200 hover:shadow-md active:scale-95 cursor-pointer overflow-hidden"
            style={btnStyle}
          >
            <span className="truncate hidden sm:inline">More</span>
            <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${moreOpen ? "rotate-180" : ""}`} />
          </button>

          {moreOpen && (
            <div
              className="absolute bottom-full mb-1.5 right-0 z-50 min-w-[140px] rounded-xl border py-1 shadow-lg"
              style={{
                backgroundColor: topBg,
                borderColor: `${theme.accentColor}35`,
                boxShadow: `0 4px 16px ${theme.accentColor}20`,
              }}
            >
              {dropdownButtons.map((btn) => (
                <button
                  key={btn.label}
                  onClick={() => { askQuestion(btn); setMoreOpen(false); }}
                  className="group w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors duration-150 hover:opacity-80 cursor-pointer"
                  style={{ color: theme.accentColor }}
                >
                  <btn.icon className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${btn.iconAnim}`} />
                  {btn.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  ) : null;

  const footerStrip = (
    <div className="flex items-center justify-between flex-wrap gap-x-3 mt-2 px-1">
      <div className="flex items-center gap-2.5">
        <span className="text-[9px]" style={{ color: msgDim }}>© {new Date().getFullYear()} {salon.name}.</span>
        {salon.contact?.phone && (
          <a
            href={`tel:${salon.contact.phone}`}
            className="inline-flex items-center gap-0.5 text-[9px] no-underline hover:opacity-70"
            style={{ color: msgDim }}
          >
            <Phone className="w-2.5 h-2.5" /> {salon.contact.phone}
          </a>
        )}
        {salon.showBusinessId && salon.businessRegistrationId && (
          <span className="text-[9px]" style={{ color: msgDim }}>· {salon.businessIdLabel ?? "Reg. No."} {salon.businessRegistrationId}</span>
        )}
        <span className="text-[9px]" style={{ color: msgDim }}>Powered by AI.</span>
      </div>
      <div className="flex items-center gap-2">
        <a href="#" className="text-[9px] hover:opacity-70 no-underline" style={{ color: msgDim }}>Privacy</a>
        <a href="#" className="text-[9px] hover:opacity-70 no-underline" style={{ color: msgDim }}>Terms</a>
        <span className="text-[9px] opacity-40" style={{ color: msgDim }}>My Salon</span>
      </div>
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

  // ── Shared card for "start conversation" ──────────────────────────────

  const startConversationCard = (animDelay: number) => (
    <button
      onClick={() => { setQuestionPhase("chatting"); setTimeout(() => inputRef.current?.focus(), 80); }}
      className="group flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left w-full cursor-pointer transition-all duration-200 hover:shadow-lg active:scale-[0.98]"
      style={{
        backgroundColor: `${theme.accentColor}12`,
        borderColor: `${theme.accentColor}40`,
        opacity: 0,
        animation: `gai-question-in 0.4s ease forwards`,
        animationDelay: `${animDelay}ms`,
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110"
        style={{ backgroundColor: `${theme.accentColor}25` }}
      >
        <MessageCircle className="w-4 h-4" style={{ color: theme.accentColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: theme.accentColor }}>
          Want to start a conversation?
        </p>
        <p className="text-xs mt-0.5" style={{ color: msgDim }}>
          Type anything — I'm here to help.
        </p>
      </div>
      <ChevronRight className="w-4 h-4 shrink-0 group-hover:translate-x-0.5 transition-transform" style={{ color: theme.accentColor }} />
    </button>
  );

  // ── Welcome view (shown when no questions asked yet) ───────────────────

  const welcomeView = (
    <div className="flex flex-col" style={{ height: "100%", overflow: "hidden", maxWidth: 680, margin: "0 auto", width: "100%" }}>

      {/* Upper: greeting centred in the remaining space above the input */}
      <div className="flex-1 flex flex-col items-start justify-start min-h-0 overflow-y-auto px-8 pt-16 pb-4">
        {/* Greeting */}
        <div className="flex items-start gap-4 mb-8">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold shrink-0 mt-0.5"
            style={{
              backgroundColor: avatarBg,
              color: avatarText,
              boxShadow: `0 0 0 4px ${theme.accentColor}20, 0 6px 20px ${theme.accentColor}30`,
            }}
          >
            {initials(salon.name)}
          </div>

          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-medium tracking-wide"
              style={{
                color: msgDim,
                opacity: labelVisible ? 1 : 0,
                transform: labelVisible ? "translateY(0)" : "translateY(6px)",
                transition: "opacity 0.4s ease, transform 0.4s ease",
              }}
            >
              {isBooking ? "AI Booking Assistant" : "Welcome to"}
            </p>

            <h1 className="text-2xl font-bold leading-tight mb-2" style={{ color: msgText, minHeight: "1.9rem" }}>
              {typedTitle || "​"}
              {!cursorHidden && (
                <span
                  aria-hidden
                  className="inline-block w-[2px] h-6 ml-0.5 rounded-sm"
                  style={{
                    backgroundColor: theme.accentColor,
                    animation: "gai-cursor-blink 0.65s ease-in-out infinite",
                    verticalAlign: "middle",
                  }}
                />
              )}
            </h1>

            <div
              style={{
                opacity: titleDone ? 1 : 0,
                transform: titleDone ? "translateY(0)" : "translateY(10px)",
                transition: "opacity 0.5s ease, transform 0.5s ease",
              }}
            >
              <p className="text-sm mb-1" style={{ color: msgText, opacity: 0.8 }}>
                {isBooking ? "Ask about services, prices, or our team — or just book now." : "Your AI assistant — ask me anything about us."}
              </p>
              <p className="flex items-center gap-2 text-xs" style={{ color: msgDim }}>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block shrink-0" />
                Online · How can I help you today?
              </p>
            </div>
          </div>
        </div>

        {/* Question stack */}
        <div className="flex flex-col gap-2.5 w-full">
          {actionButtons.map((btn, i) => (
            <button
              key={btn.label}
              onClick={() => askQuestion(btn)}
              className="group flex items-center gap-3 px-4 py-3 rounded-xl border text-left w-full cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.98]"
              style={{
                backgroundColor: btn.directAction ? theme.accentColor : asBubbleBg,
                borderColor: btn.directAction ? theme.accentColor : bubbleBorder,
                opacity: 0,
                animation: `gai-question-in 0.4s ease forwards`,
                animationDelay: `${i * 70}ms`,
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110"
                style={{ backgroundColor: btn.directAction ? `${accentText}20` : `${theme.accentColor}15` }}
              >
                <btn.icon className="w-4 h-4" style={{ color: btn.directAction ? accentText : theme.accentColor }} />
              </div>
              <span className="flex-1 text-sm font-medium" style={{ color: btn.directAction ? accentText : msgText }}>
                {btn.directAction ? btn.label : btn.question}
              </span>
              <ChevronRight className="w-4 h-4 shrink-0 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" style={{ color: btn.directAction ? accentText : theme.accentColor }} />
            </button>
          ))}

          {/* Conversation starter — shown only in website context */}
          {!isBooking && (
            <div className="mt-1">
              {startConversationCard(actionButtons.length * 70)}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ── Answered view (question asked, reply shown, remaining questions below) ──

  const unansweredButtons = actionButtons.filter(btn => !btn.directAction && !askedLabels.has(btn.label));

  const answeredView = (
    <div className="flex flex-col" style={{ height: "100%", overflow: "hidden", maxWidth: 680, margin: "0 auto", width: "100%" }}>
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto px-8 pt-8 pb-4">

        {/* Q&A history (skip the opening assistant message) */}
        <div className="space-y-3 mb-5">
          {messages.slice(1).map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div
                  className="max-w-[80%] px-4 py-2.5 text-sm leading-relaxed"
                  style={{ backgroundColor: theme.accentColor, color: accentText, borderRadius: "1.2rem 0.2rem 1.2rem 1.2rem" }}
                >
                  {m.text}
                </div>
              </div>
            ) : (
              <div key={i} className="flex items-end gap-2.5">
                <div
                  className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold"
                  style={{ backgroundColor: avatarBg, color: avatarText }}
                >
                  {initials(salon.name)[0]}
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  {m.tool && (
                    <div
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[11px] font-medium"
                      style={{
                        backgroundColor: m.tool.done ? `${theme.accentColor}10` : asBubbleBg,
                        borderColor:     m.tool.done ? `${theme.accentColor}30` : inputBorder,
                        color:           m.tool.done ? theme.accentColor : topDim,
                      }}
                    >
                      <Wrench className={`w-3 h-3 ${!m.tool.done ? "animate-spin" : ""}`} />
                      <span className="font-mono">{m.tool.name}</span>
                      <span>{m.tool.done ? "✓ done" : m.tool.label}</span>
                    </div>
                  )}
                  {m.text && (
                    <div
                      className="inline-block max-w-[90%] px-4 py-2.5"
                      style={{
                        backgroundColor: asBubbleBg,
                        color: msgText,
                        borderRadius: "0.2rem 1.2rem 1.2rem 1.2rem",
                        border: `1px solid ${bubbleBorder}`,
                        boxShadow: bubbleShadow,
                      }}
                    >
                      <MessageText text={m.text} />
                      {(m as Extract<Message, { role: "assistant" }>).cta === "book" && bookCtaBtn}
                    </div>
                  )}
                </div>
              </div>
            )
          )}

          {/* Thinking indicator */}
          {thinking && (
            <div className="flex items-end gap-2.5">
              <div
                className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold"
                style={{ backgroundColor: avatarBg, color: avatarText }}
              >
                {initials(salon.name)[0]}
              </div>
              <div
                className="px-4 py-3 flex items-center gap-1"
                style={{
                  backgroundColor: asBubbleBg,
                  borderRadius: "0.2rem 1.2rem 1.2rem 1.2rem",
                  border: `1px solid ${bubbleBorder}`,
                  boxShadow: bubbleShadow,
                }}
              >
                {[0, 150, 300].map((delay) => (
                  <span key={delay} className="w-2 h-2 rounded-full animate-bounce"
                    style={{ backgroundColor: theme.accentColor, animationDelay: `${delay}ms` }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Remaining questions + start conversation — shown after reply arrives */}
        {!thinking && (
          <div className="flex flex-col gap-2.5 w-full">
            {unansweredButtons.length > 0 && (
              <>
                <p className="text-xs font-medium px-1 mb-0.5" style={{ color: msgDim }}>More questions</p>
                {unansweredButtons.map((btn, i) => (
                  <button
                    key={btn.label}
                    onClick={() => askQuestion(btn)}
                    className="group flex items-center gap-3 px-4 py-3 rounded-xl border text-left w-full cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.98]"
                    style={{
                      backgroundColor: asBubbleBg,
                      borderColor: bubbleBorder,
                      opacity: 0,
                      animation: `gai-question-in 0.4s ease forwards`,
                      animationDelay: `${i * 50}ms`,
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110"
                      style={{ backgroundColor: `${theme.accentColor}15` }}
                    >
                      <btn.icon className="w-4 h-4" style={{ color: theme.accentColor }} />
                    </div>
                    <span className="flex-1 text-sm font-medium" style={{ color: msgText }}>{btn.question}</span>
                    <ChevronRight className="w-4 h-4 shrink-0 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" style={{ color: theme.accentColor }} />
                  </button>
                ))}
              </>
            )}

            {!isBooking && (
              <div className={unansweredButtons.length > 0 ? "mt-1" : ""}>
                {startConversationCard(unansweredButtons.length * 50 + 80)}
              </div>
            )}
            {isBooking && (
              <div className={unansweredButtons.length > 0 ? "mt-3" : ""}>
                {actionButtonsPanel}
              </div>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 px-8 pb-4 pt-1">
        {footerStrip}
      </div>
    </div>
  );

  const innerContent = (
    <>
    <style>{`
      @keyframes gai-cursor-blink {
        0%, 100% { opacity: 1; }
        50%       { opacity: 0; }
      }
      @keyframes gai-scale-in {
        from { opacity: 0; transform: scale(0.6); }
        to   { opacity: 1; transform: scale(1); }
      }
      @keyframes gai-slide-down {
        from { opacity: 0; transform: translateY(-100%); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes gai-card-in {
        0%   { opacity: 0; transform: scale(0.94) translateY(20px); }
        60%  { opacity: 1; transform: scale(1.01) translateY(-3px); }
        100% { opacity: 1; transform: scale(1)    translateY(0); }
      }
      @keyframes gai-question-in {
        from { opacity: 0; transform: translateY(10px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @media (max-width: 639px) {
        .gai-card-mobile { border-radius: 0 !important; }
        .gai-booking-card { border-radius: 0 !important; margin: 0 !important; border-left: none !important; border-right: none !important; }
      }
      @media (min-width: 640px) {
        .gai-booking-card { max-width: 720px; width: 100%; margin-left: auto; margin-right: auto; margin-top: 0.75rem; margin-bottom: 0.75rem; border-radius: 12px !important; }
      }
    `}</style>

    {/* ── Full-page intro overlay (website mode only; booking mode has its own in-card overlay) ── */}
    {!isBooking && introPhase !== "done" && (
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: pageBg, fontFamily: font.stack,
          opacity: introPhase === "exiting" ? 0 : 1,
          transition: "opacity 0.6s ease",
          pointerEvents: introPhase === "exiting" ? "none" : "auto",
        }}
      >
        <div style={{ maxWidth: 640, width: "100%", padding: "0 40px" }}>
          <div className="flex items-start gap-5">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold shrink-0 mt-1"
              style={{
                backgroundColor: avatarBg, color: avatarText,
                boxShadow: `0 0 0 5px ${theme.accentColor}20, 0 8px 28px ${theme.accentColor}35`,
                animation: "gai-scale-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
                opacity: 0,
              }}
            >
              {initials(salon.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-base font-medium tracking-wide mb-1"
                style={{
                  color: msgDim,
                  opacity: labelVisible ? 1 : 0,
                  transform: labelVisible ? "translateY(0)" : "translateY(8px)",
                  transition: "opacity 0.4s ease, transform 0.4s ease",
                }}
              >
                {isBooking ? "AI Booking Assistant" : "Welcome to"}
              </p>
              <h1 className="text-4xl font-bold leading-tight" style={{ color: msgText, minHeight: "3rem" }}>
                {typedTitle || "​"}
                {!cursorHidden && (
                  <span
                    aria-hidden
                    className="inline-block w-[3px] h-9 ml-1 rounded-sm"
                    style={{
                      backgroundColor: theme.accentColor,
                      animation: "gai-cursor-blink 0.65s ease-in-out infinite",
                      verticalAlign: "middle",
                    }}
                  />
                )}
              </h1>
              <div
                className="mt-3"
                style={{
                  opacity: titleDone ? 1 : 0,
                  transform: titleDone ? "translateY(0)" : "translateY(10px)",
                  transition: "opacity 0.5s ease, transform 0.5s ease",
                }}
              >
                <p className="text-lg" style={{ color: msgText, opacity: 0.8 }}>
                  {isBooking ? "Ask about services, prices, or our team." : "Your AI assistant — ask me anything about us."}
                </p>
                <p className="flex items-center gap-2 text-sm mt-1" style={{ color: msgDim }}>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block shrink-0" />
                  {isBooking ? "Online · Powered by AI" : "Online · Powered by MCP"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* ── Booking mode: shared SiteHeader with the same toggle used in wizard mode ── */}
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

    {/* ── Chat card ── */}
    <div
      className={isBooking ? "flex-1 flex flex-col min-h-0 overflow-hidden relative gai-booking-card" : "flex flex-col gai-card-mobile"}
      style={{
        background: pageBg,
        border: `1px solid ${chatBorder}`,
        borderRadius: "12px",
        boxShadow: chatLight
          ? "0 0 0 1px rgba(148,163,184,0.12), 0 4px 24px rgba(0,0,0,0.06)"
          : "0 0 0 1px rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.35)",
        ...(!isBooking && {
          height: "100%", overflow: "hidden", fontFamily: font.stack,
          opacity: introPhase === "done" ? 1 : 0,
          animation: introPhase === "done" ? "gai-card-in 0.65s cubic-bezier(0.22, 1, 0.36, 1) forwards" : "none",
        }),
      }}
    >
      {/* ── In-card intro overlay (booking mode only — header/footer stay visible above/below the card) ── */}
      {isBooking && introPhase !== "done" && (
        <div
          style={{
            position: "absolute", inset: 0, zIndex: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: pageBg, fontFamily: font.stack,
            opacity: introPhase === "exiting" ? 0 : 1,
            transition: "opacity 0.6s ease",
            pointerEvents: introPhase === "exiting" ? "none" : "auto",
          }}
        >
          <div style={{ maxWidth: 560, width: "100%", padding: "0 32px" }}>
            <div className="flex items-start gap-5">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold shrink-0 mt-1"
                style={{
                  backgroundColor: avatarBg, color: avatarText,
                  boxShadow: `0 0 0 5px ${theme.accentColor}20, 0 8px 28px ${theme.accentColor}35`,
                  animation: "gai-scale-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
                  opacity: 0,
                }}
              >
                {initials(salon.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium tracking-wide mb-1"
                  style={{
                    color: msgDim,
                    opacity: labelVisible ? 1 : 0,
                    transform: labelVisible ? "translateY(0)" : "translateY(8px)",
                    transition: "opacity 0.4s ease, transform 0.4s ease",
                  }}
                >
                  AI Booking Assistant
                </p>
                <h1 className="text-3xl font-bold leading-tight" style={{ color: msgText, minHeight: "2.4rem" }}>
                  {typedTitle || "​"}
                  {!cursorHidden && (
                    <span
                      aria-hidden
                      className="inline-block w-[3px] h-8 ml-1 rounded-sm"
                      style={{
                        backgroundColor: theme.accentColor,
                        animation: "gai-cursor-blink 0.65s ease-in-out infinite",
                        verticalAlign: "middle",
                      }}
                    />
                  )}
                </h1>
                <div
                  className="mt-2"
                  style={{
                    opacity: titleDone ? 1 : 0,
                    transform: titleDone ? "translateY(0)" : "translateY(10px)",
                    transition: "opacity 0.5s ease, transform 0.5s ease",
                  }}
                >
                  <p className="text-base" style={{ color: msgText, opacity: 0.8 }}>
                    Ask about services, prices, or our team.
                  </p>
                  <p className="flex items-center gap-2 text-sm mt-1" style={{ color: msgDim }}>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block shrink-0" />
                    Online · Powered by AI
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Chat header — only visible in chatting phase ── */}
      {questionPhase === "chatting" && (
        <div
          className="shrink-0"
          style={{
            backgroundColor: topBg,
            borderBottom: `1px solid ${topBorder}`,
            animation: "gai-slide-down 0.25s ease forwards",
          }}
        >
          <div style={{ height: 2, background: `linear-gradient(90deg, ${theme.accentColor} 0%, ${theme.accentColor}55 65%, transparent 100%)` }} />
          <div className="flex items-center gap-3 px-4 py-3 mx-auto" style={{ maxWidth: 720 }}>
            <div className="relative shrink-0">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300"
                style={{
                  backgroundColor: avatarBg,
                  color: avatarText,
                  boxShadow: thinking
                    ? `0 0 0 2px ${topBg}, 0 0 0 3.5px ${theme.accentColor}`
                    : `0 0 0 2px ${topBg}, 0 0 0 3.5px ${avatarBg}40`,
                }}
              >
                {initials(salon.name)}
              </div>
              <span
                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
                style={{
                  backgroundColor: thinking ? theme.accentColor : "#34D399",
                  borderColor: topBg,
                  transition: "background-color 0.4s ease",
                }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: topText }}>{salon.name}</p>
              <div className="flex items-center gap-1.5 text-[11px]" style={{ color: topDim }}>
                {thinking ? (
                  <>
                    {[0, 150, 300].map((d) => (
                      <span key={d} className="w-1 h-1 rounded-full animate-bounce inline-block"
                        style={{ backgroundColor: theme.accentColor, animationDelay: `${d}ms` }} />
                    ))}
                    <span className="ml-0.5">Thinking…</span>
                  </>
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block shrink-0" />
                    {isOpenNow(salon) ? "Open now · AI Assistant" : "AI Assistant · Online"}
                  </>
                )}
              </div>
            </div>
            <button
              onClick={() => { setMessages([openingMsg]); setQuestionPhase("welcome"); setAskedLabels(new Set()); }}
              title="Start new conversation"
              className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all hover:scale-105 active:scale-95"
              style={{ backgroundColor: `${theme.accentColor}18`, color: theme.accentColor }}
            >
              <SquarePen className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Scrollable area ── */}
      <div className="flex-1 overflow-y-auto">
        {questionPhase === "welcome" ? welcomeView :
         questionPhase === "answered" ? answeredView : (
          // ── Active chat messages ─────────────────────────────────────
          <div className="mx-auto px-4 py-6 space-y-4" style={{ maxWidth: 720 }}>
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex flex-col items-end gap-1">
                  <div
                    className="max-w-[80%] px-4 py-2.5 text-sm leading-relaxed"
                    style={{ backgroundColor: theme.accentColor, color: accentText, borderRadius: "1.2rem 0.2rem 1.2rem 1.2rem" }}
                  >
                    {m.text}
                  </div>
                  <span className="text-[10px] px-1" style={{ color: msgDim }}>{m.time}</span>
                </div>
              ) : (
                <div key={i} className="flex items-end gap-2.5">
                  <div
                    className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold mb-5"
                    style={{ backgroundColor: avatarBg, color: avatarText }}
                  >
                    {initials(salon.name)[0]}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {m.tool && (
                      <div
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[11px] font-medium"
                        style={{
                          backgroundColor: m.tool.done ? `${theme.accentColor}10` : asBubbleBg,
                          borderColor:     m.tool.done ? `${theme.accentColor}30` : inputBorder,
                          color:           m.tool.done ? theme.accentColor : topDim,
                        }}
                      >
                        <Wrench className={`w-3 h-3 ${!m.tool.done ? "animate-spin" : ""}`} />
                        <span className="font-mono">{m.tool.name}</span>
                        <span>{m.tool.done ? "✓ done" : m.tool.label}</span>
                      </div>
                    )}
                    {m.text && (
                      <div
                        className="inline-block max-w-[90%] px-4 py-2.5"
                        style={{
                          backgroundColor: asBubbleBg,
                          color: msgText,
                          borderRadius: "0.2rem 1.2rem 1.2rem 1.2rem",
                          border: `1px solid ${bubbleBorder}`,
                          boxShadow: bubbleShadow,
                        }}
                      >
                        <MessageText text={m.text} />
                        {(m as Extract<Message, { role: "assistant" }>).cta === "book" && bookCtaBtn}
                      </div>
                    )}
                    {m.text && (
                      <span className="block text-[10px] pl-1" style={{ color: msgDim }}>{m.time}</span>
                    )}
                  </div>
                </div>
              )
            )}

            {thinking && (
              <div className="flex items-end gap-2.5">
                <div
                  className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold"
                  style={{ backgroundColor: avatarBg, color: avatarText }}
                >
                  {initials(salon.name)[0]}
                </div>
                <div
                  className="px-4 py-3 flex items-center gap-1"
                  style={{
                    backgroundColor: asBubbleBg,
                    borderRadius: "0.2rem 1.2rem 1.2rem 1.2rem",
                    border: `1px solid ${bubbleBorder}`,
                    boxShadow: bubbleShadow,
                  }}
                >
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      className="w-2 h-2 rounded-full animate-bounce"
                      style={{ backgroundColor: theme.accentColor, animationDelay: `${delay}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── Bottom input dock — visible only in chatting phase ── */}
      {questionPhase === "chatting" && (
        <div className="shrink-0 px-4 pb-6 pt-8">
          <div className="mx-auto" style={{ maxWidth: 720 }}>
            {inputCard}
            {!isBooking && footerStrip}
          </div>
        </div>
      )}
    </div>
    </>
  );

  if (isBooking) {
    return (
      <div
        className="min-h-[100dvh] flex flex-col"
        style={{ fontFamily: font.stack, background: pageBg }}
      >
        {innerContent}
        <SiteFooter
          salon={salon}
          theme={theme}
          current="book"
          onBack={onSwitchToWizard ?? (() => {})}
          standalone
        />
      </div>
    );
  }

  return innerContent;
}
