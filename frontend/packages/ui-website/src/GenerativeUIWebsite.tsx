import React, { useEffect, useRef, useState } from "react";
import {
  Calendar, Clock, MapPin, Phone, Send, Sparkles, SquarePen, Users, Wrench,
} from "lucide-react";
import { FONTS, loadGoogleFont, contrastText, isLightColor } from "./theme";
import type { Saloon, ServiceItem, StaffMember, WebsiteTheme } from "./types";

export interface GenerativeUIWebsiteProps {
  saloon: Saloon;
  staff: StaffMember[];
  services: ServiceItem[];
  theme: WebsiteTheme;
  getPagePath?: (page: string) => string;
  onNavigate?: (page: string | null) => void;
}

// ── Types ──────────────────────────────────────────────────────────────────

type ToolCard = { name: string; label: string; done: boolean };
type Message =
  | { role: "user"; text: string; time: string }
  | { role: "assistant"; text: string; tool?: ToolCard; time: string };

// ── Constants ──────────────────────────────────────────────────────────────

const DAY_ORDER = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

// ── Helpers ────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}
function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function isOpenNow(saloon: Saloon): boolean {
  const hours = saloon.operatingHours;
  if (!hours?.length) return false;
  const d = new Date();
  const today = hours.find((h) => h.day === DAY_ORDER[d.getDay()]);
  if (!today || today.closed) return false;
  const [oh, om] = today.openTime.split(":").map(Number);
  const [ch, cm] = today.closeTime.split(":").map(Number);
  const cur = d.getHours() * 60 + d.getMinutes();
  return cur >= oh * 60 + om && cur < ch * 60 + cm;
}
function todayHours(saloon: Saloon): string | null {
  const hours = saloon.operatingHours;
  if (!hours?.length) return null;
  const today = hours.find((h) => h.day === DAY_ORDER[new Date().getDay()]);
  if (!today || today.closed) return "Closed today";
  return `${today.openTime} – ${today.closeTime}`;
}
function mockReply(input: string, saloon: Saloon, services: ServiceItem[], staff: StaffMember[]): string {
  const lower = input.toLowerCase();
  const name  = saloon.name;
  const phone = saloon.contact?.phone;
  const email = saloon.contact?.email;
  const contact = phone ? `call us at ${phone}` : email ? `email us at ${email}` : "contact us directly";
  if (/service|treatment|offer|menu|price|cost/.test(lower)) {
    const names = services.filter((s) => s.active).slice(0, 5).map((s) => s.name);
    return names.length
      ? `At ${name} we offer: **${names.join(", ")}** and more.\n\nFull AI-powered service search via MCP is coming soon! 🎉`
      : `${name} offers a range of beauty & wellness services. AI browsing via MCP is coming soon!`;
  }
  if (/book|appointment|schedule|slot|reserv/.test(lower))
    return `To book at ${name}, please ${contact}.\n\nOur AI booking assistant via MCP is on its way — you'll book directly here soon! 📅`;
  if (/staff|stylist|team|who|person|employ/.test(lower)) {
    const names = staff.slice(0, 3).map((s) => s.name);
    return names.length
      ? `Our team at ${name} includes **${names.join(", ")}** and more.\n\nAI staff matching via MCP is coming soon!`
      : `${name} has a dedicated team. AI staff matching via MCP is coming soon!`;
  }
  if (/hour|open|close|time|when/.test(lower)) {
    const h = todayHours(saloon);
    const currently = isOpenNow(saloon) ? "We're **currently open**." : "We're **currently closed**.";
    const line = h ? `\n\n${currently} Today: ${h === "Closed today" ? "**closed all day**" : `**${h}**`}.` : "";
    return `You can find our full hours on our website.${line}\n\nReal-time availability via MCP is coming soon! 🕐`;
  }
  if (/location|address|where|find|direction|map/.test(lower)) {
    const loc  = saloon.location;
    const parts = [loc?.address, loc?.city, loc?.country].filter(Boolean).join(", ");
    return parts
      ? `Find us at **${parts}**.${phone ? ` Call ahead: ${phone}.` : ""}\n\nNavigation MCP coming soon!`
      : `Please ${contact} for our address. Location MCP coming soon!`;
  }
  if (/contact|phone|email|reach|call/.test(lower)) {
    const lines: string[] = [];
    if (phone) lines.push(`📞 ${phone}`);
    if (email) lines.push(`📧 ${email}`);
    return lines.length
      ? `You can reach ${name} at:\n\n${lines.join("\n")}\n\nMCP contact integration is coming soon!`
      : `Visit our website for contact details. MCP integration coming soon!`;
  }
  return `Thanks for reaching out to **${name}**! I'm your AI assistant (via MCP) and still being configured. For immediate help, please ${contact}.\n\nFull AI capabilities are coming soon! ✨`;
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

export function GenerativeUIWebsite({ saloon, staff, services, theme }: GenerativeUIWebsiteProps) {
  const font = FONTS[theme.fontFamily as keyof typeof FONTS] ?? FONTS.system;
  loadGoogleFont(theme.fontFamily);

  const accentText = contrastText(theme.accentColor);
  const avatarBg   = theme.logoBgColor;
  const avatarText = contrastText(theme.logoBgColor);

  const openingMsg: Message = {
    role: "assistant",
    time: nowTime(),
    text: `Hi! 👋 I'm the AI assistant for **${saloon.name}**, powered by MCP.\n\nAsk me anything — services, team, hours, or how to book.\n\n*(Full AI capabilities are coming soon — this is a preview.)*`,
  };

  const [messages, setMessages]   = useState<Message[]>([openingMsg]);
  const [input, setInput]         = useState("");
  const [thinking, setThinking]   = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  // Typewriter animation
  const fullTitle = `Welcome to ${saloon.name}`;
  const [typedTitle, setTypedTitle]     = useState("");
  const [titleDone, setTitleDone]       = useState(false);
  const [cursorHidden, setCursorHidden] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  // Refocus the input after it moves from center to bottom dock
  useEffect(() => {
    if (hasStarted) {
      inputRef.current?.focus();
    }
  }, [hasStarted]);

  // Typewriter effect — runs once on mount (or if saloon name changes)
  useEffect(() => {
    let i = 0;
    let iv: ReturnType<typeof setInterval>;
    setTypedTitle("");
    setTitleDone(false);
    setCursorHidden(false);
    const start = setTimeout(() => {
      iv = setInterval(() => {
        i++;
        setTypedTitle(fullTitle.slice(0, i));
        if (i >= fullTitle.length) {
          clearInterval(iv);
          setTitleDone(true);
          setTimeout(() => setCursorHidden(true), 2500);
        }
      }, 55);
    }, 350);
    return () => { clearTimeout(start); clearInterval(iv); };
  }, [fullTitle]); // eslint-disable-line react-hooks/exhaustive-deps

  function startInteraction() {
    if (!hasStarted) setHasStarted(true);
  }

  function dispatch(text: string) {
    if (!text.trim() || thinking) return;
    startInteraction();
    setMessages((prev) => [...prev, { role: "user", text, time: nowTime() }]);
    setThinking(true);
    setTimeout(() => {
      const tool: ToolCard = { name: "saloon-data", label: "Querying saloon data…", done: false };
      setMessages((prev) => [...prev, { role: "assistant", text: "", tool, time: nowTime() }]);
      setTimeout(() => {
        const reply = mockReply(text, saloon, services, staff);
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", text: reply, tool: { ...tool, done: true, label: "saloon-data" }, time: nowTime() };
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

  const chatBg      = theme.heroBg ?? "#F8FAFC";
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
  const isEmptyChat = messages.length === 1 && !thinking;

  const chatBorder = isLightColor(chatBg) ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)";

  const pageBg = `radial-gradient(ellipse 80% 50% at 50% -10%, ${theme.accentColor}18 0%, transparent 60%), ${chatBg}`;

  // ── Dynamic action buttons (based on available saloon data) ────────────

  type ActionButton = {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    question: string;
    iconAnim: string;
  };
  const actionButtons: ActionButton[] = [
    saloon.features?.includes("BOOKING") && {
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
    (saloon.operatingHours?.length ?? 0) > 0 && {
      label: "Opening Hours",
      icon: Clock,
      question: "What are your opening hours?",
      iconAnim: "group-hover:rotate-45",
    },
    (saloon.location?.address || saloon.location?.city) && {
      label: "Find Us",
      icon: MapPin,
      question: "Where are you located?",
      iconAnim: "group-hover:-translate-y-1 group-hover:scale-110",
    },
    (saloon.contact?.phone || saloon.contact?.email) && {
      label: "Contact Us",
      icon: Phone,
      question: "How can I contact you?",
      iconAnim: "group-hover:rotate-12 group-hover:scale-110",
    },
  ].filter(Boolean) as ActionButton[];

  const inputCard = (
    <div
      className="flex items-end gap-3 px-4 py-3 rounded-2xl"
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

  const actionButtonsPanel = actionButtons.length > 0 ? (
    <div className="flex gap-2 mb-3">
      {actionButtons.map((btn) => (
        <button
          key={btn.label}
          onClick={() => dispatch(btn.question)}
          title={btn.label}
          className="group flex-1 inline-flex items-center justify-center gap-1.5 p-2 sm:py-1.5 rounded-lg border text-xs font-medium transition-all duration-200 hover:scale-105 hover:shadow-md active:scale-95 cursor-pointer"
          style={{
            backgroundColor: `${theme.accentColor}10`,
            borderColor: `${theme.accentColor}35`,
            color: theme.accentColor,
            boxShadow: `0 1px 3px ${theme.accentColor}15`,
          }}
        >
          <btn.icon className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${btn.iconAnim}`} />
          <span className="hidden sm:inline">{btn.label}</span>
        </button>
      ))}
    </div>
  ) : null;

  const footerStrip = (
    <div className="flex items-center justify-between flex-wrap gap-x-3 mt-2 px-1">
      <div className="flex items-center gap-2.5">
        <span className="text-[9px]" style={{ color: msgDim }}>© {new Date().getFullYear()} {saloon.name}.</span>
        {saloon.contact?.phone && (
          <a
            href={`tel:${saloon.contact.phone}`}
            className="inline-flex items-center gap-0.5 text-[9px] no-underline hover:opacity-70"
            style={{ color: msgDim }}
          >
            <Phone className="w-2.5 h-2.5" /> {saloon.contact.phone}
          </a>
        )}
        <span className="text-[9px]" style={{ color: msgDim }}>AI responses are for guidance only.</span>
      </div>
      <div className="flex items-center gap-2">
        <a href="#" className="text-[9px] hover:opacity-70 no-underline" style={{ color: msgDim }}>Privacy</a>
        <a href="#" className="text-[9px] hover:opacity-70 no-underline" style={{ color: msgDim }}>Terms</a>
        <span className="text-[9px] opacity-40" style={{ color: msgDim }}>My Saloon</span>
      </div>
    </div>
  );

  // ── Welcome view (shown when no user messages yet) ─────────────────────

  const welcomeView = (
    <div
      className="flex flex-col items-start justify-center px-8 py-12"
      style={{ minHeight: "100%", maxWidth: 680, margin: "0 auto", width: "100%" }}
    >
      {/* Avatar + typewriter title — side by side */}
      <div className="flex items-center gap-4 mb-3">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold shrink-0"
          style={{
            backgroundColor: avatarBg,
            color: avatarText,
            boxShadow: `0 0 0 4px ${theme.accentColor}20, 0 6px 20px ${theme.accentColor}30`,
            animation: "gai-scale-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
            opacity: 0,
          }}
        >
          {initials(saloon.name)}
        </div>

        <h1 className="text-3xl font-bold" style={{ color: msgText, minHeight: "2.5rem" }}>
        {typedTitle || " "}
        {!cursorHidden && (
          <span
            aria-hidden
            className="inline-block w-[2px] h-7 ml-0.5 rounded-sm"
            style={{
              backgroundColor: msgText,
              animation: "gai-cursor-blink 0.65s ease-in-out infinite",
              verticalAlign: "middle",
            }}
          />
        )}
        </h1>
      </div>

      {/* Subtitle + status — cascade in after typing finishes */}
      <div
        style={{
          opacity: titleDone ? 1 : 0,
          transform: titleDone ? "translateY(0)" : "translateY(10px)",
          transition: "opacity 0.5s ease, transform 0.5s ease",
        }}
      >
        <p className="text-base mb-1" style={{ color: msgText, opacity: 0.8 }}>
          I'm your AI assistant — here to help with anything you need.
        </p>
        <p className="flex items-center gap-2 text-sm mb-8 justify-start" style={{ color: msgDim }}>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block shrink-0" />
          Online · How can I help you today?
        </p>
      </div>

      {/* Input + action buttons — slide up after typing, only before user has started */}
      {!hasStarted && (
        <div
          className="w-full"
          style={{
            maxWidth: 620,
            opacity: titleDone ? 1 : 0,
            transform: titleDone ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.6s ease 0.15s, transform 0.6s ease 0.15s",
          }}
        >
          {actionButtonsPanel}
          {inputCard}
          {footerStrip}
        </div>
      )}
    </div>
  );

  return (
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
    `}</style>
    <div
      className="flex flex-col"
      style={{ height: "100%", overflow: "hidden", background: pageBg, fontFamily: font.stack, border: `1px solid ${chatBorder}` }}
    >
      {/* ── Chat header — fixed in flow, slides in when chat starts ── */}
      {hasStarted && (
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
                {initials(saloon.name)}
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
              <p className="text-sm font-semibold truncate" style={{ color: topText }}>{saloon.name}</p>
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
                    {isOpenNow(saloon) ? "Open now · AI Assistant" : "AI Assistant · Online"}
                  </>
                )}
              </div>
            </div>
            <button
              onClick={() => { setMessages([openingMsg]); setHasStarted(false); }}
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
        {isEmptyChat ? welcomeView : (
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
                    {initials(saloon.name)[0]}
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
                        style={{ backgroundColor: asBubbleBg, color: msgText, borderRadius: "0.2rem 1.2rem 1.2rem 1.2rem" }}
                      >
                        <MessageText text={m.text} />
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
                  {initials(saloon.name)[0]}
                </div>
                <div
                  className="px-4 py-3 flex items-center gap-1"
                  style={{ backgroundColor: asBubbleBg, borderRadius: "0.2rem 1.2rem 1.2rem 1.2rem" }}
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

      {/* ── Bottom input dock — visible only after user has started ── */}
      {hasStarted && (
        <div className="shrink-0 px-4 pb-5 pt-2">
          <div className="mx-auto" style={{ maxWidth: 720 }}>
            {actionButtonsPanel}
            {inputCard}
            {footerStrip}
          </div>
        </div>
      )}
    </div>
    </>
  );
}
