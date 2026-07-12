import React, { useState } from "react";
import { useOutletContext } from "react-router";
import {
  Monitor, Wand2, Check, Zap, ExternalLink,
  Sparkles, User, ChevronRight, Loader, RefreshCw,
} from "lucide-react";
import type { LayoutContext, WebsiteMode } from "~/lib/types";

type Mode = WebsiteMode;

// ── MCP mock panel ────────────────────────────────────────────────────────────

const MOCK_CUSTOMERS = [
  { name: "Emma Larsen",   email: "emma@example.com",   visits: 14, fav: "Colour & Highlights", next: "20 Jul" },
  { name: "Jonas Møller",  email: "jonas@example.com",  visits: 3,  fav: "Men's Cut",           next: "28 Jul" },
  { name: "Sara Andersen", email: "sara@example.com",   visits: 27, fav: "Keratin Treatment",   next: "15 Jul" },
];

const MOCK_PAGES: Record<string, { headline: string; intro: string; offer: string; services: string[] }> = {
  "emma@example.com": {
    headline: "Welcome back, Emma — your colour awaits.",
    intro:    "Based on your last visit, we've prepared a look upgrade just for you. Your stylist has set aside time for a full colour refresh.",
    offer:    "20% off your next Colour & Highlights — valid until 31 Jul",
    services: ["Colour & Highlights", "Deep Conditioning Treatment", "Blow-dry & Style"],
  },
  "jonas@example.com": {
    headline: "Hi Jonas, fresh cut time?",
    intro:    "You're due for a trim! We've spotted a new fade technique that'd suit your style perfectly.",
    offer:    "Free beard shaping with your next Men's Cut",
    services: ["Men's Cut", "Beard Grooming", "Scalp Treatment"],
  },
  "sara@example.com": {
    headline: "Sara, your locks deserve the best.",
    intro:    "As one of our most loyal guests, your next Keratin session has been prioritised with our senior stylist.",
    offer:    "Complimentary deep mask with your next Keratin Treatment",
    services: ["Keratin Treatment", "Olaplex Bond Repair", "Gloss & Shine"],
  },
};

function McpMockPanel({ saloonName }: { saloonName: string }) {
  const [selected, setSelected] = useState<string>("");
  const [phase, setPhase]       = useState<"idle" | "generating" | "done">("idle");
  const [page, setPage]         = useState<typeof MOCK_PAGES[string] | null>(null);

  const customer = MOCK_CUSTOMERS.find((c) => c.email === selected);

  function handleGenerate() {
    if (!selected) return;
    setPhase("generating");
    setTimeout(() => { setPage(MOCK_PAGES[selected] ?? null); setPhase("done"); }, 1800);
  }
  function reset() { setPhase("idle"); setPage(null); setSelected(""); }

  return (
    <div className="space-y-4">
      {phase !== "done" && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500 leading-relaxed">
            Select a customer — the MCP app generates a personalised page for them using visit history, preferences, and smart recommendations.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {MOCK_CUSTOMERS.map((c) => (
              <button
                key={c.email}
                onClick={() => { setSelected(c.email); setPhase("idle"); }}
                className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
                  selected === c.email
                    ? "border-violet-400 bg-violet-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5 text-violet-500" />
                  </div>
                  <span className="text-xs font-semibold text-slate-800 truncate">{c.name}</span>
                </div>
                <p className="text-[10px] text-slate-400">{c.visits} visits · next {c.next}</p>
                <p className="text-[10px] text-violet-500 mt-0.5 truncate">♥ {c.fav}</p>
              </button>
            ))}
          </div>
          <button
            onClick={handleGenerate}
            disabled={!selected || phase === "generating"}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            {phase === "generating"
              ? <><Loader className="w-3.5 h-3.5 animate-spin" /> Generating…</>
              : <><Sparkles className="w-3.5 h-3.5" /> Generate page</>}
          </button>
        </div>
      )}

      {phase === "done" && page && customer && (
        <div className="rounded-2xl border border-violet-200 bg-white overflow-hidden">
          {/* Browser chrome */}
          <div className="bg-slate-100 border-b border-slate-200 px-3 py-2 flex items-center gap-2">
            <div className="flex gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 bg-white rounded border border-slate-200 px-2 py-0.5 text-[10px] text-slate-400 font-mono truncate">
              {saloonName.toLowerCase().replace(/\s+/g, "-")}.my-saloon.dk/{customer.email.split("@")[0]}
            </div>
            <span className="text-[9px] font-bold uppercase tracking-widest text-violet-600 bg-violet-100 px-1.5 py-0.5 rounded border border-violet-200">MCP</span>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 leading-tight">{page.headline}</h3>
              <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{page.intro}</p>
            </div>
            <div className="flex items-start gap-3 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3">
              <Zap className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
              <p className="text-xs font-semibold text-violet-800">{page.offer}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Recommended for you</p>
              <div className="space-y-1.5">
                {page.services.map((s) => (
                  <div key={s} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-sm text-slate-700 font-medium">{s}</span>
                    <span className="text-xs text-violet-600 font-semibold flex items-center gap-0.5">
                      Book <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="px-5 pb-4 flex items-center justify-between">
            <button onClick={reset} className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer hover:underline inline-flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Try another customer
            </button>
            <span className="text-[10px] text-slate-300 italic">Mocked — real generation coming soon</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Selectable card shell ─────────────────────────────────────────────────────

interface ModeCardProps {
  id: Mode;
  active: Mode | null;
  onSelect: (m: Mode) => void;
  accent: "amber" | "violet";
  icon: React.ReactNode;
  title: string;
  badge: string;
  description: string;
  features: string[];
  checkColor: string;
  children: React.ReactNode;
}

function ModeCard({ id, active, onSelect, accent, icon, title, badge, description, features, checkColor, children }: ModeCardProps) {
  const selected = active === id;
  const borderClass = selected
    ? accent === "amber" ? "border-amber-400" : "border-violet-400"
    : "border-slate-200";
  const bgClass = selected
    ? accent === "amber" ? "bg-amber-50/50" : "bg-violet-50/50"
    : "bg-white";
  const iconBgClass = selected
    ? accent === "amber" ? "bg-amber-100" : "bg-violet-100"
    : accent === "amber" ? "bg-amber-50" : "bg-violet-50";
  const badgeClass = accent === "amber"
    ? "bg-amber-100 text-amber-700 border-amber-200"
    : "bg-violet-100 text-violet-700 border-violet-200";

  return (
    <div className={`rounded-2xl border-2 transition-all duration-200 overflow-hidden ${borderClass} ${bgClass}`}>
      {/* Header — always visible, clickable */}
      <button
        onClick={() => onSelect(id)}
        className="w-full text-left p-5 sm:p-6 cursor-pointer"
      >
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 transition-colors ${iconBgClass} ${accent === "amber" ? "border-amber-100" : "border-violet-100"}`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className="text-base font-bold text-slate-900">{title}</h2>
              <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${badgeClass}`}>
                {badge}
              </span>
              {selected && (
                <span className="ml-auto text-[10px] font-semibold text-slate-400">Selected ✓</span>
              )}
            </div>
            <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
            {!selected && (
              <ul className="mt-3 space-y-1">
                {features.map((f) => (
                  <li key={f} className={`flex items-center gap-2 text-xs text-slate-500`}>
                    <span className={`w-3 h-3 shrink-0 ${checkColor}`}>✓</span> {f}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {selected && (
        <div className={`border-t px-5 sm:px-6 py-5 space-y-4 ${accent === "amber" ? "border-amber-100" : "border-violet-100"}`}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WebsiteManagement() {
  const { saloon, websiteMode: mode, setWebsiteMode: setMode } = useOutletContext<LayoutContext>();

  const previewUrl = `/${saloon.handler ?? saloon.id}/c`;
  const designUrl  = `${previewUrl}?design=1`;

  return (
    <div className="max-w-2xl">
      <div className="mb-7">
        <h1 className="text-xl font-bold text-slate-900">Customer Website</h1>
        <p className="text-sm text-slate-500 mt-1">
          Choose how to present <span className="font-medium text-slate-700">{saloon.name}</span> to visitors online.
        </p>
      </div>

      <div className="flex flex-col gap-4">

        <ModeCard
          id="static"
          active={mode}
          onSelect={setMode}
          accent="amber"
          icon={<Monitor className="w-5 h-5 text-amber-600" />}
          title="Static Website"
          badge="Live"
          description="A clean, customisable page with your salon's services, team, hours, and contact details."
          features={["Services & pricing", "Team profiles", "Location & hours", "Design customisation"]}
          checkColor="text-amber-500"
        >
          {/* Expanded: CTA + live preview iframe */}
          <div className="flex items-center gap-3 flex-wrap">
            <a
              href={designUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors no-underline"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open &amp; Design
            </a>
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-slate-400 hover:text-slate-600 hover:underline no-underline"
            >
              View live page ↗
            </a>
          </div>

          {/* Live preview iframe */}
          <div className="rounded-xl border border-amber-100 overflow-hidden bg-white">
            <div className="bg-slate-100 border-b border-slate-200 px-3 py-1.5 flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="w-2 h-2 rounded-full bg-green-400" />
              </div>
              <span className="text-[10px] text-slate-400 font-mono flex-1 truncate">
                {typeof window !== "undefined" ? `${window.location.origin}${previewUrl}` : previewUrl}
              </span>
            </div>
            <div className="relative w-full" style={{ paddingBottom: "62.5%" }}>
              <iframe
                src={previewUrl}
                title="Website preview"
                className="absolute inset-0 w-full h-full border-0"
                loading="lazy"
              />
            </div>
          </div>
        </ModeCard>

        <ModeCard
          id="ai"
          active={mode}
          onSelect={setMode}
          accent="violet"
          icon={<Wand2 className="w-5 h-5 text-violet-600" />}
          title="AI-Generated per Customer"
          badge="MCP · Preview"
          description="MCP-powered pages that generate a unique experience tailored to each visitor's history and preferences."
          features={[
            "Personalised content per visitor",
            "AI-curated service recommendations",
            "Dynamic promotions & loyalty offers",
            "Booking intelligence",
          ]}
          checkColor="text-violet-400"
        >
          <McpMockPanel saloonName={saloon.name} />
        </ModeCard>

      </div>
    </div>
  );
}
