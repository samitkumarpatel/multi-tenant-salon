import { useState } from "react";
import { Sparkles, Wand2, Loader, Send } from "lucide-react";
import { SiteHeader, SiteFooter } from "./SiteChrome";
import { FONTS, loadGoogleFont, contrastText } from "./theme";
import type { Saloon, StaffMember, ServiceItem, WebsiteTheme } from "./types";

export interface GenerativeUIWebsiteProps {
  saloon: Saloon;
  staff: StaffMember[];
  services: ServiceItem[];
  theme: WebsiteTheme;
  getPagePath?: (page: string) => string;
  onNavigate?: (page: string | null) => void;
}

type Message = { role: "user" | "assistant"; text: string };

const OPENING_MESSAGE = (saloonName: string): Message => ({
  role: "assistant",
  text: `Hi! I'm the AI assistant for ${saloonName}. Tell me what you're looking for and I'll create a personalised experience just for you. ✨\n\n(This feature is coming soon — I'm a preview.)`,
});

const COMING_SOON_REPLY: Message = {
  role: "assistant",
  text: "Thanks for trying this out! 🙏 Our AI-powered personalisation is coming soon — stay tuned. In the meantime, feel free to browse the website or book an appointment directly.",
};

export function GenerativeUIWebsite({
  saloon,
  staff,
  services,
  theme,
  getPagePath,
  onNavigate,
}: GenerativeUIWebsiteProps) {
  const [messages, setMessages] = useState<Message[]>([OPENING_MESSAGE(saloon.name)]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);

  const font = FONTS[theme.fontFamily as keyof typeof FONTS] ?? FONTS.system;
  if (font.google) loadGoogleFont(font.google);

  const accentText = contrastText(theme.accentColor);

  function send() {
    const text = input.trim();
    if (!text || thinking) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setThinking(true);
    setTimeout(() => {
      setMessages((prev) => [...prev, COMING_SOON_REPLY]);
      setThinking(false);
    }, 1200);
  }

  return (
    <div style={{ fontFamily: font.stack }}>
      <SiteHeader
        saloon={saloon}
        theme={theme}
        current=""
        onBack={() => onNavigate?.(null)}
        getPagePath={getPagePath}
      />

      {/* ── Hero badge ── */}
      <section
        className="px-6 pt-12 pb-6 text-center"
        style={{ backgroundColor: theme.heroBg, color: theme.heroTextColor }}
      >
        <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold tracking-wide"
            style={{ borderColor: `${theme.accentColor}40`, backgroundColor: `${theme.accentColor}10`, color: theme.accentColor }}>
            <Sparkles className="w-3 h-3" />
            AI-powered · Generative UI
          </div>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-blue-100 text-blue-700 border border-blue-200">
            Beta
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: theme.heroTextColor }}>
          Your personal {saloon.name} assistant
        </h1>
        <p className="text-sm opacity-60 max-w-md mx-auto" style={{ color: theme.heroTextColor }}>
          Describe what you're looking for and get a personalised recommendation.
        </p>
      </section>

      {/* ── Chat window ── */}
      <section className="px-4 pb-16 flex justify-center" style={{ backgroundColor: theme.heroBg }}>
        <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">

          {/* chrome bar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50">
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: theme.accentColor }}
            >
              <Wand2 className="w-3.5 h-3.5" style={{ color: accentText }} />
            </div>
            <span className="text-xs font-semibold text-slate-700">{saloon.name} · AI Chat</span>
            <span
              className="ml-auto text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border"
              style={{ backgroundColor: `${theme.accentColor}10`, color: theme.accentColor, borderColor: `${theme.accentColor}30` }}
            >
              Coming Soon
            </span>
          </div>

          {/* messages */}
          <div className="px-4 py-4 space-y-3 min-h-[260px] max-h-[380px] overflow-y-auto">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-line"
                  style={
                    m.role === "user"
                      ? { backgroundColor: theme.accentColor, color: accentText, borderRadius: "1rem 1rem 0.25rem 1rem" }
                      : { backgroundColor: "#F1F5F9", color: "#1E293B", borderRadius: "1rem 1rem 1rem 0.25rem" }
                  }
                >
                  {m.text}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex justify-start">
                <div className="px-4 py-3 rounded-2xl bg-slate-100 flex items-center gap-1.5" style={{ borderRadius: "1rem 1rem 1rem 0.25rem" }}>
                  <Loader className="w-3.5 h-3.5 animate-spin text-slate-400" />
                  <span className="text-xs text-slate-400">Thinking…</span>
                </div>
              </div>
            )}
          </div>

          {/* input */}
          <div className="px-4 py-3 border-t border-slate-100 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask anything about your visit…"
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-slate-400 transition bg-slate-50 text-slate-800 placeholder:text-slate-400"
            />
            <button
              onClick={send}
              disabled={!input.trim() || thinking}
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-opacity disabled:opacity-35 cursor-pointer"
              style={{ backgroundColor: theme.accentColor }}
            >
              <Send className="w-4 h-4" style={{ color: accentText }} />
            </button>
          </div>
        </div>
      </section>

      <SiteFooter
        saloon={saloon}
        theme={theme}
        current=""
        onBack={() => onNavigate?.(null)}
        getPagePath={getPagePath}
      />
    </div>
  );
}
