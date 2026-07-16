import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLoaderData, useLocation, useSearchParams, useRouteError, isRouteErrorResponse } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import {
  MapPin, Phone, Mail, Globe, Clock, Timer,
  X, ChevronRight, Rocket, Palette, Check, RotateCcw,
  Monitor, Wand2, ArrowLeft, User, ArrowUp, CalendarCheck,
} from "lucide-react";
import { API, HANDLER_API, apiFetch } from "~/lib/api";
import { FEATURE_LABEL, DAY_SHORT, STAFF_ROLE_LABEL, CATEGORY_LABEL, formatPrice } from "~/lib/constants";
import { DEFAULT_THEME, FONTS, loadGoogleFont, isLightColor, contrastText } from "~/lib/theme";
import { FeatureView, FEATURE_VIEWS } from "~/components/FeatureView";
import { BookingWizard } from "~/components/BookingWizard";
import { FEATURE_NAV } from "~/components/SiteChrome";
import type { Saloon, StaffMember, ServiceItem, OperatingHours, WebsiteTheme } from "~/lib/types";

// ── Loader ────────────────────────────────────────────────────────────────────

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const id = params.saloonId!;
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const saloon = await apiFetch<Saloon>(
    (isUUID || /^\d+$/.test(id)) ? `${API}/${id}` : `${HANDLER_API}/${id}`
  );
  const [staff, services, theme] = await Promise.all([
    apiFetch<StaffMember[]>(`${API}/${saloon.id}/staff`).catch((): StaffMember[] => []),
    apiFetch<ServiceItem[]>(`${API}/${saloon.id}/services`).catch((): ServiceItem[] => []),
    apiFetch<WebsiteTheme>(`${API}/${saloon.id}/theme`).catch((): WebsiteTheme => DEFAULT_THEME),
  ]);
  return { saloon, staff, services, theme };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_ORDER = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

function isOpenNow(hours?: OperatingHours[]): boolean {
  if (!hours?.length) return false;
  const now = new Date();
  const today = hours.find((h) => h.day === DAY_ORDER[now.getDay()]);
  if (!today || today.closed) return false;
  const [oh, om] = today.openTime.split(":").map(Number);
  const [ch, cm] = today.closeTime.split(":").map(Number);
  const cur = now.getHours() * 60 + now.getMinutes();
  return cur >= oh * 60 + om && cur < ch * 60 + cm;
}

/** "closes 18:00" when open · "opens 09:00" / "opens Mon 09:00" when closed */
function openStatusDetail(hours?: OperatingHours[]): string | null {
  if (!hours?.length) return null;
  const now = new Date();
  const curMin = now.getHours() * 60 + now.getMinutes();
  const todayIdx = now.getDay();
  const today = hours.find((h) => h.day === DAY_ORDER[todayIdx]);

  if (today && !today.closed) {
    const [oh, om] = today.openTime.split(":").map(Number);
    const [ch, cm] = today.closeTime.split(":").map(Number);
    if (curMin >= oh * 60 + om && curMin < ch * 60 + cm) return `closes ${today.closeTime}`;
    if (curMin < oh * 60 + om) return `opens ${today.openTime}`;
  }
  // Find next open day
  for (let i = 1; i <= 7; i++) {
    const d = hours.find((h) => h.day === DAY_ORDER[(todayIdx + i) % 7]);
    if (d && !d.closed) {
      const dayLabel = i === 1 ? "tomorrow" : (DAY_SHORT[d.day] ?? d.day);
      return `opens ${dayLabel} ${d.openTime}`;
    }
  }
  return null;
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

const CARD_COLORS = [
  "#7C3AED", "#0284C7", "#D97706",
  "#DC2626", "#059669", "#EA580C", "#4F46E5",
];
function cardColor(name: string) {
  return CARD_COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % CARD_COLORS.length];
}

function groupByCategory(list: ServiceItem[]): [string, ServiceItem[]][] {
  const map = new Map<string, ServiceItem[]>();
  for (const s of list) {
    const cat = s.category ?? "OTHER";
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(s);
  }
  return [...map.entries()];
}

// ── Theme Panel ───────────────────────────────────────────────────────────────

type SaveState = "idle" | "saving" | "saved" | "error";

const PRESET_COLORS = [
  // Neutrals / darks
  "#0F172A", "#1E293B", "#374151", "#4B5563",
  "#FFFFFF", "#F8FAFC", "#F1F5F9", "#E2E8F0",
  // Ambers / golds
  "#F59E0B", "#D97706", "#B45309", "#78350F",
  // Reds
  "#EF4444", "#DC2626", "#B91C1C", "#7F1D1D",
  // Blues
  "#3B82F6", "#2563EB", "#1D4ED8", "#1E3A8A",
  // Greens
  "#10B981", "#059669", "#047857", "#065F46",
  // Purples
  "#8B5CF6", "#7C3AED", "#6D28D9", "#4C1D95",
  // Pinks
  "#EC4899", "#DB2777", "#BE185D", "#831843",
];

function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen]           = useState(false);
  const [draft, setDraft]         = useState(value);
  const [pos, setPos]             = useState({ top: 0, left: 0 });
  const [prevValue, setPrevValue] = useState<string | undefined>(undefined);
  const btnRef                    = useRef<HTMLButtonElement>(null);
  const popRef                    = useRef<HTMLDivElement>(null);
  const nativeRef                 = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(value), [value]);

  // All colour changes go through here so we record one level of undo
  function applyChange(next: string) {
    if (next === value) return;
    setPrevValue(value);
    onChange(next);
    setDraft(next);
  }

  function handleUndo() {
    if (prevValue === undefined) return;
    onChange(prevValue);
    setDraft(prevValue);
    setPrevValue(undefined);
  }

  function openPopover() {
    if (btnRef.current) {
      const r    = btnRef.current.getBoundingClientRect();
      const popW = 232;
      const popH = 270;
      let left   = r.left - popW - 8;
      if (left < 8) left = r.right + 8;
      let top    = r.top;
      if (top + popH > window.innerHeight - 8) top = window.innerHeight - popH - 8;
      setPos({ top, left });
    }
    setOpen((v) => !v);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (
        !popRef.current?.contains(e.target as Node) &&
        !btnRef.current?.contains(e.target as Node)
      ) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function commitDraft(raw: string) {
    const v = raw.startsWith("#") ? raw : `#${raw}`;
    if (/^#[0-9a-fA-F]{6}$/.test(v)) applyChange(v);
    else setDraft(value);
  }

  function pickPreset(c: string) {
    applyChange(c);
    setOpen(false);
  }

  const canUndo = prevValue !== undefined && prevValue !== value;

  return (
    <div>
      {/* Label row with undo button */}
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">{label}</p>
        <button
          onClick={handleUndo}
          disabled={!canUndo}
          title={canUndo ? `Undo — revert to ${prevValue}` : "Nothing to undo"}
          className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded transition-all cursor-pointer ${
            canUndo
              ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50 opacity-100"
              : "text-slate-300 opacity-0 pointer-events-none"
          }`}
        >
          <RotateCcw className="w-2.5 h-2.5" />
          Undo
        </button>
      </div>

      <div className="flex items-center gap-2">
        {/* Swatch button — clicking opens popover */}
        <button
          ref={btnRef}
          onClick={openPopover}
          className="w-9 h-9 rounded-lg border border-slate-300 shadow-sm cursor-pointer shrink-0 transition-all hover:scale-105 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-amber-400"
          style={{ backgroundColor: value }}
          title="Pick colour"
        />
        {/* Inline hex input */}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commitDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && commitDraft(draft)}
          className="flex-1 font-mono text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/20"
          placeholder="#000000"
          maxLength={7}
        />
        {/* Hidden native input for colour wheel */}
        <input
          ref={nativeRef}
          type="color"
          value={value}
          onChange={(e) => applyChange(e.target.value)}
          className="sr-only"
        />
      </div>

      {/* Popover — rendered in a portal so it's never clipped by the panel scroll */}
      {open && createPortal(
        <div
          ref={popRef}
          className="fixed z-[9999] bg-white border border-slate-200 rounded-2xl shadow-2xl p-3"
          style={{ top: pos.top, left: pos.left, width: 232 }}
        >
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2 px-0.5">{label}</p>

          {/* Preset grid */}
          <div className="grid grid-cols-8 gap-1 mb-3">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => pickPreset(c)}
                className="w-6 h-6 rounded-md cursor-pointer transition-transform hover:scale-110 focus:outline-none"
                style={{
                  backgroundColor: c,
                  boxShadow:
                    c.toLowerCase() === value.toLowerCase()
                      ? "0 0 0 2px #fff, 0 0 0 3.5px #F59E0B"
                      : "inset 0 0 0 1px rgba(0,0,0,0.08)",
                }}
                title={c}
              />
            ))}
          </div>

          {/* Hex input + colour wheel in popover */}
          <div className="border-t border-slate-100 pt-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <span
                className="w-5 h-5 rounded border border-slate-200 shrink-0"
                style={{ backgroundColor: value }}
              />
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={(e) => commitDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { commitDraft(draft); setOpen(false); }
                }}
                className="flex-1 font-mono text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/20"
                placeholder="#000000"
                maxLength={7}
              />
            </div>
            <button
              onClick={() => { setOpen(false); setTimeout(() => nativeRef.current?.click(), 50); }}
              className="w-full text-xs text-slate-500 hover:text-slate-800 py-1.5 px-2 rounded-lg hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors border border-slate-100 hover:border-slate-200"
            >
              <span className="text-sm leading-none">🎨</span>
              Open colour wheel…
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function ThemePanel({
  saloonId,
  theme,
  onChange,
  onClose,
}: {
  saloonId: string;
  theme: WebsiteTheme;
  onChange: (t: WebsiteTheme) => void;
  onClose: () => void;
}) {
  const [saveState, setSaveState] = useState<SaveState>("idle");

  // Preload all fonts so the picker previews render in their real typefaces
  useEffect(() => {
    Object.keys(FONTS).forEach(loadGoogleFont);
  }, []);

  async function handleSave() {
    setSaveState("saving");
    try {
      await apiFetch<WebsiteTheme>(`${API}/${saloonId}/theme`, {
        method: "PUT",
        body: JSON.stringify({
          heroBg: theme.heroBg,
          heroTextColor: theme.heroTextColor,
          accentColor: theme.accentColor,
          fontFamily: theme.fontFamily,
          logoBgColor: theme.logoBgColor,
          headerBg: theme.headerBg,
          footerBg: theme.footerBg,
          mapsUrl: theme.mapsUrl ?? null,
        }),
      });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 2500);
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 max-h-[85dvh] md:inset-x-auto md:top-0 md:right-0 md:bottom-0 md:w-72 md:max-h-none bg-white border-t md:border-t-0 md:border-l border-slate-200 shadow-2xl z-[200] flex flex-col rounded-t-2xl md:rounded-none" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Drag handle — mobile only */}
      <div className="flex justify-center pt-2.5 pb-1 md:hidden shrink-0">
        <div className="w-10 h-1 rounded-full bg-slate-200" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50 shrink-0">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-bold text-slate-900">Website Design</h2>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5 rounded hover:bg-slate-100">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Controls */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">

        {/* Hero Colors */}
        <section>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Hero Section</p>
          <div className="space-y-4">
            <ColorPicker label="Background" value={theme.heroBg}
              onChange={(v) => onChange({ ...theme, heroBg: v })} />
            <ColorPicker label="Text Color" value={theme.heroTextColor}
              onChange={(v) => onChange({ ...theme, heroTextColor: v })} />
            <ColorPicker label="Accent / CTA" value={theme.accentColor}
              onChange={(v) => onChange({ ...theme, accentColor: v })} />

            {/* Smart contrast */}
            {(() => {
              const suggested = contrastText(theme.heroBg);
              const isOptimal = suggested.toLowerCase() === theme.heroTextColor.toLowerCase();
              return (
                <button
                  onClick={() => onChange({ ...theme, heroTextColor: suggested })}
                  disabled={isOptimal}
                  className={`w-full flex items-center gap-2 text-xs px-3 py-2 rounded-lg border transition-all ${
                    isOptimal
                      ? "border-emerald-200 bg-emerald-50 text-emerald-600 cursor-default"
                      : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 cursor-pointer"
                  }`}
                >
                  {isOptimal ? (
                    <><Check className="w-3.5 h-3.5 shrink-0" /> Text contrast looks great</>
                  ) : (
                    <><Wand2 className="w-3.5 h-3.5 shrink-0" /> Auto-fix text contrast for this background</>
                  )}
                </button>
              );
            })()}
          </div>
        </section>

        {/* Branding */}
        <section>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Branding</p>
          <ColorPicker label="Logo Background" value={theme.logoBgColor}
            onChange={(v) => onChange({ ...theme, logoBgColor: v })} />
        </section>

        {/* Header & Footer */}
        <section>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Header &amp; Footer</p>
          <div className="space-y-4">
            <ColorPicker label="Header Background" value={theme.headerBg}
              onChange={(v) => onChange({ ...theme, headerBg: v })} />
            <ColorPicker label="Footer Background" value={theme.footerBg}
              onChange={(v) => onChange({ ...theme, footerBg: v })} />
            <div>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1.5">Maps link URL</p>
              <input
                type="url"
                className="w-full font-mono text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/20"
                placeholder="https://maps.google.com/…"
                value={theme.mapsUrl ?? ""}
                onChange={(e) => onChange({ ...theme, mapsUrl: e.target.value || undefined })}
              />
              <p className="text-[10px] text-slate-400 mt-1">Leave empty to use auto-generated Google Maps link.</p>
            </div>
          </div>
        </section>

        {/* Typography */}
        <section>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Font</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(FONTS).map(([id, font]) => (
              <button
                key={id}
                onClick={() => onChange({ ...theme, fontFamily: id })}
                className={`px-3 py-2.5 text-xs rounded-lg border text-left transition-all cursor-pointer ${
                  theme.fontFamily === id
                    ? "border-amber-400 bg-amber-50 text-amber-800 font-semibold"
                    : "border-slate-200 hover:border-slate-300 text-slate-600"
                }`}
                style={{ fontFamily: font.stack }}
              >
                {font.label}
              </button>
            ))}
          </div>
        </section>

        {/* Reset */}
        <button
          onClick={() => onChange(DEFAULT_THEME)}
          className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer hover:underline"
        >
          Reset to defaults
        </button>
      </div>

      {/* Save */}
      <div className="px-4 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
        <button
          onClick={handleSave}
          disabled={saveState === "saving"}
          className={`w-full inline-flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl transition-all cursor-pointer disabled:cursor-default ${
            saveState === "saved"
              ? "bg-emerald-500 text-white"
              : saveState === "error"
              ? "bg-red-500 text-white"
              : "bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white"
          }`}
        >
          {saveState === "saving" ? (
            <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
          ) : saveState === "saved" ? (
            <><Check className="w-4 h-4" /> Saved!</>
          ) : saveState === "error" ? (
            <>Failed — try again</>
          ) : (
            <>Save Changes</>
          )}
        </button>
        <p className="text-[10px] text-slate-400 text-center mt-2">
          Save then use "Publish" in the top bar to go live.
        </p>
      </div>
    </div>
  );
}

// ── Shared salon error page ───────────────────────────────────────────────────

export function SalonErrorPage({ is404 }: { is404: boolean }) {
  return (
    <div
      className="min-h-[100dvh] relative flex flex-col items-center justify-center px-6 text-center overflow-hidden select-none"
      style={{ backgroundColor: "#0F172A", fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <style>{`
        @keyframes snip {
          0%,100% { transform: rotate(-12deg) scale(1); }
          50%      { transform: rotate(12deg)  scale(1.1); }
        }
        @keyframes float {
          0%,100% { transform: translateY(0px); }
          50%      { transform: translateY(-10px); }
        }
        .scissors-snip { animation: snip 2.6s ease-in-out infinite; }
        .scissors-float { animation: float 4s ease-in-out infinite; }
      `}</style>

      {/* Diagonal stripe texture */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.035,
          backgroundImage:
            "repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Scissors icon */}
      <div className="scissors-float mb-8">
        <div className="scissors-snip text-6xl leading-none">✂️</div>
      </div>

      {/* Large outlined number */}
      <p
        className="font-black leading-none mb-3 pointer-events-none"
        style={{
          fontSize: "clamp(88px,22vw,172px)",
          color: "transparent",
          WebkitTextStroke: "2px #1E293B",
          letterSpacing: "-6px",
        }}
      >
        {is404 ? "404" : "500"}
      </p>

      {/* Headline */}
      <h1 className="text-xl sm:text-2xl font-bold text-white mb-3 leading-snug">
        {is404 ? "This chair's vacant." : "Something snapped."}
      </h1>

      {/* Description */}
      <p className="text-sm text-slate-400 leading-relaxed max-w-xs mb-10">
        {is404
          ? "We couldn't find the salon you're looking for. The link might be wrong, or the salon may have moved."
          : "An unexpected error occurred while loading this page. Refresh or try again in a moment."}
      </p>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <a
          href="/"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white text-slate-900 text-sm font-semibold no-underline hover:opacity-90 transition-opacity"
        >
          ← Go home
        </a>
        {!is404 && (
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm font-semibold hover:bg-slate-800/60 transition-colors cursor-pointer"
          >
            ↻ Try again
          </button>
        )}
      </div>

      {/* Bottom tagline */}
      <p className="absolute bottom-7 text-[11px] font-medium tracking-widest uppercase text-slate-700">
        my-saloon.dk
      </p>
    </div>
  );
}

// ── Scroll animation helpers ──────────────────────────────────────────────────

function useInView(threshold = 0.12) {
  const ref     = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function FadeIn({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, visible } = useInView();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity:    visible ? 1 : 0,
        transform:  visible ? "translateY(0)" : "translateY(22px)",
        transition: `opacity 0.55s ease ${delay}ms, transform 0.55s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ── Count-up number ───────────────────────────────────────────────────────────

function CountUp({ target, duration = 900, style }: { target: number; duration?: number; style?: React.CSSProperties }) {
  const { ref, visible } = useInView(0.5);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!visible) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min((t - start) / duration, 1);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3)))); // ease-out cubic
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible, target, duration]);
  return <p ref={ref} className="text-xl font-black tabular-nums" style={style}>{n}</p>;
}

// ── Rotating word ─────────────────────────────────────────────────────────────

function RotatingWord({ words, color }: { words: string[]; color: string }) {
  const [idx, setIdx]   = useState(0);
  const [show, setShow] = useState(true);
  useEffect(() => {
    if (words.length < 2) return;
    const iv = setInterval(() => {
      setShow(false);
      setTimeout(() => { setIdx((i) => (i + 1) % words.length); setShow(true); }, 250);
    }, 2600);
    return () => clearInterval(iv);
  }, [words.length]);
  if (!words.length) return null;
  return (
    <span
      className="inline-block font-semibold"
      style={{
        color,
        opacity:    show ? 1 : 0,
        transform:  show ? "translateY(0)" : "translateY(8px)",
        transition: "opacity 0.25s ease, transform 0.25s ease",
      }}
    >
      {words[idx]}
    </span>
  );
}

// ── Scroll progress bar ───────────────────────────────────────────────────────

function ScrollProgress({ color }: { color: string }) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setProgress(max > 0 ? Math.min(window.scrollY / max, 1) : 0);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);
  return (
    <div className="h-0.5 w-full bg-transparent">
      <div
        className="h-full origin-left"
        style={{ backgroundColor: color, transform: `scaleX(${progress})`, transition: "transform 80ms linear" }}
      />
    </div>
  );
}

// ── Preview banner ────────────────────────────────────────────────────────────

type PublishState = "idle" | "loading" | "done" | "error";

function PreviewBanner({
  handler,
  saloonId,
  onDesign,
  hasChanges,
  onPublished,
}: {
  handler: string;
  saloonId: string;
  onDesign: () => void;
  hasChanges: boolean;
  onPublished: () => void;
}) {
  const [publish, setPublish] = useState<PublishState>("idle");

  async function handlePublish() {
    setPublish("loading");
    try {
      const res = await fetch(`${API}/${saloonId}/publish`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPublish("done");
      onPublished();
      setTimeout(() => setPublish("idle"), 2500);
    } catch {
      setPublish("error");
      setTimeout(() => setPublish("idle"), 3000);
    }
  }

  return (
    <div className="bg-slate-950 text-white px-4 py-2.5 flex items-center justify-between gap-4 text-xs" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse shrink-0" />
        <span className="text-slate-400 truncate">
          Admin preview — customers see this at{" "}
          <span className="text-white font-mono font-medium">{handler}.my-saloon.dk</span>
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Design panel button */}
        <button
          onClick={onDesign}
          className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer"
        >
          <Palette className="w-3 h-3" /> Design
        </button>

        {/* Publish — enabled only when there are changes since the last publish */}
        <button
          onClick={handlePublish}
          disabled={!hasChanges || publish === "loading"}
          title={!hasChanges ? "No changes to publish" : undefined}
          className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
            publish === "done"
              ? "bg-emerald-600 text-white"
              : publish === "error"
              ? "bg-red-600 text-white"
              : "bg-white/10 hover:bg-white/20 text-white border border-white/20 hover:border-white/40"
          }`}
        >
          {publish === "loading" ? (
            <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Publishing…</>
          ) : publish === "done" ? (
            <><Rocket className="w-3 h-3" /> Published!</>
          ) : publish === "error" ? (
            <>Failed — retry</>
          ) : (
            <><Rocket className="w-3 h-3" /> Publish</>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Error boundary ────────────────────────────────────────────────────────────

export function ErrorBoundary() {
  const error = useRouteError();
  const is404 =
    isRouteErrorResponse(error)
      ? error.status === 404
      : error instanceof Error
      ? /HTTP 404|not found/i.test(error.message)
      : false;
  return <SalonErrorPage is404={is404} />;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SaloonPage() {
  const { saloon, staff, services, theme: loaderTheme } = useLoaderData<typeof clientLoader>();
  const location     = useLocation();
  const [searchParams] = useSearchParams();
  const isPreview    = location.pathname.endsWith("/c");
  // Booking is hash-routed like the feature views (#shop etc.)
  const bookUrl      = "#book";

  const [showDesign, setShowDesign] = useState(() => isPreview && searchParams.get("design") === "1");
  // Merge loaded theme over defaults so new fields (headerBg, footerBg, etc.) always have a value
  const initialTheme = { ...DEFAULT_THEME, ...(loaderTheme ?? {}) };
  const [theme, setTheme]           = useState<WebsiteTheme>(initialTheme);
  // Tracks the last published/loaded state so Publish is only enabled when something changed
  const [baseTheme, setBaseTheme]   = useState<WebsiteTheme>(initialTheme);
  const hasChanges = JSON.stringify(theme) !== JSON.stringify(baseTheme);

  // Interactive state
  const [selectedCat, setSelectedCat]   = useState<string | null>(null);
  const [expandedStaff, setExpandedStaff] = useState<Set<number>>(new Set());
  const [hoursExpanded, setHoursExpanded] = useState(false);
  const [heroVisible, setHeroVisible]   = useState(true);
  const [bookServiceId, setBookServiceId] = useState<number | null>(null);
  const [bookStaffId, setBookStaffId]     = useState<number | null>(null);
  const [featureHash, setFeatureHash]   = useState<string>(() =>
    typeof window !== "undefined" ? window.location.hash.slice(1) : "");
  const [mounted, setMounted]          = useState(false);
  const heroRef = useRef<HTMLElement>(null);

  // Hero entrance animation + smooth anchor scrolling
  useEffect(() => {
    setMounted(true);
    document.documentElement.style.scrollBehavior = "smooth";
    return () => { document.documentElement.style.scrollBehavior = ""; };
  }, []);

  // Hash router for feature views (#shop, #membership, #loyalty)
  useEffect(() => {
    const onHash = () => setFeatureHash(window.location.hash.slice(1));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Floating Book button: watch hero
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setHeroVisible(e.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Load Google Font whenever font selection changes
  useEffect(() => {
    loadGoogleFont(theme.fontFamily);
  }, [theme.fontFamily]);

  const fontStack = FONTS[theme.fontFamily]?.stack ?? FONTS.inter.stack;

  const open           = isOpenNow(saloon.operatingHours);
  const todayName      = DAY_ORDER[new Date().getDay()];
  const city           = [saloon.location?.city, saloon.location?.country].filter(Boolean).join(", ");
  const activeStaff    = staff.filter((m) => m.status === "ACTIVE");
  const activeServices = services.filter((s) => s.active);
  const grouped        = groupByCategory(activeServices);
  const visibleServices = selectedCat ? activeServices.filter((s) => s.category === selectedCat) : activeServices;
  const openHours      = saloon.operatingHours?.filter((h) => !h.closed) ?? [];
  const hasBooking     = saloon.features?.includes("BOOKING");
  const featureBadges  = (saloon.features ?? []).filter((f) => f !== "STATIC_WEBSITE" && f !== "ANALYTICS");
  const statusDetail   = openStatusDetail(saloon.operatingHours);
  const featurePages   = (saloon.features ?? [])
    .filter((f) => FEATURE_NAV[f])
    .map((f) => FEATURE_NAV[f]);
  const rotatingWords  = grouped.map(([cat]) => (CATEGORY_LABEL[cat] ?? cat).toLowerCase());
  const popularServices = [...activeServices].sort((a, b) => a.price - b.price).slice(0, 3);

  // Smart contrast — derived from hero background & accent (admin still controls base colors)
  const heroLight  = isLightColor(theme.heroBg);
  const accentText = contrastText(theme.accentColor);

  // Header tones
  const headerBg     = theme.headerBg ?? "#FFFFFF";
  const headerIsLight = isLightColor(headerBg);
  const headerText   = headerIsLight ? "#0F172A" : "#FFFFFF";
  const headerBorder = headerIsLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.12)";

  // Footer tones
  const footerBg     = theme.footerBg ?? "#1E293B";
  const footerIsLight = isLightColor(footerBg);
  const footerText   = footerIsLight ? "#374151" : "#CBD5E1";
  const footerBright = footerIsLight ? "#111827" : "#FFFFFF";
  const footerDim    = footerIsLight ? "#9CA3AF" : "#64748B";
  const footerBorder = footerIsLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.08)";
  const hero = {
    sub:        heroLight ? "#475569" : "#94A3B8",
    subMuted:   heroLight ? "#64748B" : "#64748B",
    chipBg:     heroLight ? "rgba(15,23,42,0.06)"  : "rgba(255,255,255,0.08)",
    chipBorder: heroLight ? "rgba(15,23,42,0.14)"  : "rgba(255,255,255,0.16)",
    cardBg:     heroLight ? "rgba(15,23,42,0.045)" : "rgba(255,255,255,0.07)",
    cardBorder: heroLight ? "rgba(15,23,42,0.10)"  : "rgba(255,255,255,0.12)",
    divider:    heroLight ? "rgba(15,23,42,0.10)"  : "rgba(255,255,255,0.10)",
  };

  function toggleStaff(id: number) {
    setExpandedStaff((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  // Hash-routed booking wizard (#book) — same pattern as the feature views
  if (featureHash === "book" && hasBooking) {
    return (
      <div style={{ fontFamily: fontStack }}>
        {isPreview && (
          <PreviewBanner
            handler={saloon.handler ?? saloon.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}
            saloonId={String(saloon.id)}
            onDesign={() => setShowDesign((v) => !v)}
            hasChanges={hasChanges}
            onPublished={() => setBaseTheme(theme)}
          />
        )}
        {isPreview && showDesign && (
          <ThemePanel
            saloonId={String(saloon.id)}
            theme={theme}
            onChange={setTheme}
            onClose={() => setShowDesign(false)}
          />
        )}
        <BookingWizard
          saloon={saloon}
          services={activeServices}
          staff={activeStaff}
          theme={theme}
          initialServiceId={bookServiceId}
          initialStaffId={bookStaffId}
          onExit={() => { setBookServiceId(null); setBookStaffId(null); window.location.hash = ""; }}
        />
      </div>
    );
  }

  // Hash-routed feature view (#shop, #membership, #loyalty) — only when the feature is enabled
  const featureViewKey =
    featurePages.some((fp) => fp.hash === featureHash) && FEATURE_VIEWS[featureHash] ? featureHash : null;

  if (featureViewKey) {
    return (
      <div>
        {isPreview && (
          <PreviewBanner
            handler={saloon.handler ?? saloon.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}
            saloonId={String(saloon.id)}
            onDesign={() => setShowDesign((v) => !v)}
            hasChanges={hasChanges}
            onPublished={() => setBaseTheme(theme)}
          />
        )}
        {isPreview && showDesign && (
          <ThemePanel
            saloonId={String(saloon.id)}
            theme={theme}
            onChange={setTheme}
            onClose={() => setShowDesign(false)}
          />
        )}
        <FeatureView
          saloon={saloon}
          theme={theme}
          pageKey={featureViewKey}
          bookUrl={bookUrl}
          onBack={() => { window.location.hash = ""; }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-white text-slate-900" style={{ fontFamily: fontStack }}>
      {isPreview && (
        <PreviewBanner
          handler={saloon.handler ?? saloon.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}
          saloonId={String(saloon.id)}
          onDesign={() => setShowDesign((v) => !v)}
          hasChanges={hasChanges}
          onPublished={() => setBaseTheme(theme)}
        />
      )}
      {isPreview && showDesign && (
        <ThemePanel
          saloonId={String(saloon.id)}
          theme={theme}
          onChange={setTheme}
          onClose={() => setShowDesign(false)}
        />
      )}

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-sm border-b" style={{ backgroundColor: `${headerBg}F2`, borderColor: headerBorder }}>
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between gap-6">
          <div className="flex items-center gap-8 min-w-0">
            <a href="#top" className="flex items-center gap-2 no-underline group shrink-0">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center group-hover:opacity-80 transition-opacity"
                style={{ backgroundColor: theme.logoBgColor }}
              >
                <span className="text-[10px] font-bold leading-none" style={{ color: contrastText(theme.logoBgColor) }}>{initials(saloon.name)}</span>
              </div>
              <span className="text-sm font-bold" style={{ color: headerText }}>{saloon.name}</span>
            </a>

            {featurePages.length > 0 && (
              <nav className="hidden md:flex items-center gap-6 text-sm">
                {featurePages.map((fp) => (
                  <a
                    key={fp.hash}
                    href={`#${fp.hash}`}
                    className="no-underline transition-colors font-medium text-slate-500 hover:text-slate-900"
                  >
                    {fp.label}
                  </a>
                ))}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
              open
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-slate-50 text-slate-400 border-slate-200"
            }`}>
              {open && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
              {open ? "Open now" : "Closed"}
            </span>
            {hasBooking && (
              <a href={bookUrl}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl no-underline transition-opacity hover:opacity-80"
                style={{ backgroundColor: theme.accentColor, color: accentText }}>
                Book now
              </a>
            )}
          </div>
        </div>
        {/* Reading progress */}
        <ScrollProgress color={theme.accentColor} />
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section
        ref={heroRef}
        id="top"
        style={{ backgroundColor: theme.heroBg }}
      >
        <div className="max-w-5xl mx-auto px-6 py-10 sm:py-14">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-10 items-start">

            {/* ── Left: identity + CTAs ─────────────────────────────── */}
            <div
              style={{
                opacity:    mounted ? 1 : 0,
                transform:  mounted ? "translateY(0)" : "translateY(18px)",
                transition: "opacity 0.6s ease, transform 0.6s ease",
              }}
            >
              <div className="flex flex-wrap items-center gap-3 mb-5">
                {open ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border"
                    style={{ color: theme.accentColor, backgroundColor: `${theme.accentColor}22`, borderColor: `${theme.accentColor}55` }}>
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: theme.accentColor }} />
                    Open now{statusDetail ? ` · ${statusDetail}` : ""}
                  </span>
                ) : (
                  <span className="text-xs font-medium px-3 py-1 rounded-full border"
                    style={{ color: hero.sub, backgroundColor: hero.chipBg, borderColor: hero.chipBorder }}>
                    Closed{statusDetail ? ` · ${statusDetail}` : ""}
                  </span>
                )}
                {city && (
                  <span className="flex items-center gap-1.5 text-xs" style={{ color: hero.sub }}>
                    <MapPin className="w-3 h-3" /> {city}
                  </span>
                )}
              </div>

              <h1 className="text-4xl sm:text-6xl font-bold leading-[0.95] tracking-tight"
                style={{ color: theme.heroTextColor }}>
                {saloon.name}
              </h1>

              {/* Rotating tagline */}
              {rotatingWords.length > 0 && (
                <p className="text-base sm:text-lg mt-3" style={{ color: `${theme.heroTextColor}99` }}>
                  Your place for <RotatingWord words={rotatingWords} color={theme.accentColor} />
                </p>
              )}

              <div className="w-14 h-0.5 mt-4" style={{ backgroundColor: theme.accentColor }} />

              {featureBadges.length > 0 && popularServices.length === 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {featureBadges.map((f) => (
                    <span key={f} className="text-[11px] font-medium px-3 py-1 rounded-full border"
                      style={{ color: hero.sub, backgroundColor: hero.chipBg, borderColor: hero.chipBorder }}>
                      {FEATURE_LABEL[f] ?? f}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-3 mt-6">
                {hasBooking && (
                  <a href={bookUrl}
                    className="inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-xl no-underline transition-all hover:opacity-90 hover:scale-[1.03]"
                    style={{ backgroundColor: theme.accentColor, color: accentText }}>
                    <CalendarCheck className="w-4 h-4" /> Book an appointment <ChevronRight className="w-4 h-4" />
                  </a>
                )}
                {saloon.contact?.phone && (
                  <a href={`tel:${saloon.contact.phone}`}
                    className="inline-flex items-center gap-2 border text-sm font-medium px-6 py-3 rounded-xl no-underline transition-all hover:opacity-75"
                    style={{ color: hero.sub, borderColor: hero.chipBorder }}>
                    <Phone className="w-4 h-4" /> {saloon.contact.phone}
                  </a>
                )}
              </div>
            </div>

            {/* ── Right: quick-info card ────────────────────────────── */}
            <div
              className="rounded-2xl border p-5 space-y-4 text-sm"
              style={{
                backgroundColor: hero.cardBg,
                borderColor: hero.cardBorder,
                opacity:    mounted ? 1 : 0,
                transform:  mounted ? "translateY(0)" : "translateY(18px)",
                transition: "opacity 0.6s ease 0.15s, transform 0.6s ease 0.15s",
              }}
            >
              {/* Hours — click to expand full week */}
              {(() => {
                const today = saloon.operatingHours?.find((h) => h.day === todayName);
                if (!today) return null;
                const week = DAY_ORDER.map((d) => saloon.operatingHours?.find((h) => h.day === d)).filter(Boolean) as OperatingHours[];
                return (
                  <div>
                    <button
                      type="button"
                      onClick={() => setHoursExpanded((v) => !v)}
                      className="flex items-start gap-3 w-full text-left cursor-pointer group/hrs"
                      aria-expanded={hoursExpanded}
                    >
                      <Clock className="w-4 h-4 mt-0.5 shrink-0" style={{ color: theme.accentColor }} />
                      <div className="flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: `${theme.heroTextColor}70` }}>
                          Today · {DAY_SHORT[today.day] ?? today.day}
                        </p>
                        <p className="font-semibold" style={{ color: theme.heroTextColor }}>
                          {today.closed ? "Closed today" : `${today.openTime} – ${today.closeTime}`}
                        </p>
                      </div>
                      <ChevronRight
                        className="w-4 h-4 mt-1 shrink-0 transition-transform group-hover/hrs:opacity-100"
                        style={{
                          color: `${theme.heroTextColor}70`,
                          transform: hoursExpanded ? "rotate(-90deg)" : "rotate(90deg)",
                        }}
                      />
                    </button>
                    {/* Full week */}
                    <div
                      className="overflow-hidden transition-all"
                      style={{ maxHeight: hoursExpanded ? 220 : 0, opacity: hoursExpanded ? 1 : 0, transition: "max-height 0.3s ease, opacity 0.25s ease" }}
                    >
                      <div className="pt-2 pl-7 space-y-0.5">
                        {week.map((h) => {
                          const isToday = h.day === todayName;
                          return (
                            <div key={h.day} className="flex items-center gap-3 text-xs py-0.5"
                              style={{ color: isToday ? theme.accentColor : `${theme.heroTextColor}90`, fontWeight: isToday ? 700 : 400 }}>
                              <span className="w-8 shrink-0">{DAY_SHORT[h.day] ?? h.day}</span>
                              <span className="font-mono">{h.closed ? "Closed" : `${h.openTime}–${h.closeTime}`}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Phone */}
              {saloon.contact?.phone && (
                <a href={`tel:${saloon.contact.phone}`}
                  className="flex items-center gap-3 no-underline group"
                  style={{ color: theme.heroTextColor }}>
                  <Phone className="w-4 h-4 shrink-0 transition-opacity group-hover:opacity-60" style={{ color: theme.accentColor }} />
                  <span className="font-medium group-hover:opacity-70 transition-opacity truncate">{saloon.contact.phone}</span>
                </a>
              )}

              {/* Email */}
              {saloon.contact?.email && (
                <a href={`mailto:${saloon.contact.email}`}
                  className="flex items-center gap-3 no-underline group"
                  style={{ color: theme.heroTextColor }}>
                  <Mail className="w-4 h-4 shrink-0 transition-opacity group-hover:opacity-60" style={{ color: theme.accentColor }} />
                  <span className="font-medium group-hover:opacity-70 transition-opacity truncate">{saloon.contact.email}</span>
                </a>
              )}

              {/* Address → opens in Maps */}
              {saloon.location?.address && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    [saloon.location.address, saloon.location.zipCode, saloon.location.city, saloon.location.country].filter(Boolean).join(", ")
                  )}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-start gap-3 no-underline group"
                  style={{ color: theme.heroTextColor }}
                >
                  <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: theme.accentColor }} />
                  <p className="font-medium leading-snug group-hover:opacity-70 transition-opacity">
                    {saloon.location.address}
                    {saloon.location.city ? `, ${saloon.location.city}` : ""}
                    <span className="block text-[10px] font-semibold uppercase tracking-wide mt-0.5" style={{ color: `${theme.heroTextColor}55` }}>
                      Open in Maps ↗
                    </span>
                  </p>
                </a>
              )}

              {/* Quick stats */}
              {(activeServices.length > 0 || activeStaff.length > 0) && (
                <div className="flex items-center gap-6 pt-1 border-t" style={{ borderColor: hero.divider }}>
                  {activeServices.length > 0 && (
                    <div>
                      <CountUp target={activeServices.length} style={{ color: theme.accentColor }} />
                      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: `${theme.heroTextColor}55` }}>
                        services
                      </p>
                    </div>
                  )}
                  {activeStaff.length > 0 && (
                    <div>
                      <CountUp target={activeStaff.length} style={{ color: theme.accentColor }} />
                      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: `${theme.heroTextColor}55` }}>
                        staff
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </section>

      {/* ── Services + Team (side by side) ──────────────────────────────── */}
      {(activeServices.length > 0 || activeStaff.length > 0) && (
        <section id="services" className="max-w-5xl mx-auto px-6 py-6 sm:py-10 w-full scroll-mt-16">
          <div className={`grid grid-cols-1 gap-10 lg:gap-12 items-start ${
            activeServices.length > 0 && activeStaff.length > 0 ? "lg:grid-cols-[1fr_300px]" : ""
          }`}>

            {/* ── Services column ── */}
            {activeServices.length > 0 && (
              <div>
                <FadeIn>
                  <div className="mb-6">
                    <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: theme.accentColor }}>What we offer</p>
                    <h2 className="text-2xl font-bold text-slate-900">Services &amp; pricing</h2>
                  </div>
                </FadeIn>

                {/* Category filter */}
                {grouped.length > 1 && (
                  <FadeIn delay={60}>
                    <div className="flex flex-wrap gap-2 mb-5">
                      <button
                        onClick={() => setSelectedCat(null)}
                        className="px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer"
                        style={selectedCat === null
                          ? { backgroundColor: theme.accentColor, color: accentText }
                          : { backgroundColor: "#f1f5f9", color: "#64748b" }}
                      >
                        All
                      </button>
                      {grouped.map(([cat]) => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCat(cat === selectedCat ? null : cat)}
                          className="px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer"
                          style={selectedCat === cat
                            ? { backgroundColor: theme.accentColor, color: accentText }
                            : { backgroundColor: "#f1f5f9", color: "#64748b" }}
                        >
                          {CATEGORY_LABEL[cat] ?? cat}
                        </button>
                      ))}
                    </div>
                  </FadeIn>
                )}

                {/* Flat service list — filtered by the pills above, no category headings */}
                <FadeIn delay={80}>
                  <div className="bg-white rounded-2xl border border-slate-200 px-3.5 overflow-hidden">
                    {visibleServices.map((s) => (
                      <div key={s.id} className="group/svc flex items-center gap-4 py-3.5 border-b border-slate-100 last:border-0 hover:bg-slate-50/60 -mx-1.5 px-1.5 rounded-lg transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900">{s.name}</p>
                          {s.description && (
                            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{s.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          <span className="flex items-center gap-1 text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                            <Timer className="w-3 h-3" /> {s.durationMinutes} min
                          </span>
                          <span className="text-sm font-bold text-slate-900 min-w-[60px] text-right tabular-nums">
                            {formatPrice(s.price, s.currency)}
                          </span>
                          {hasBooking && (
                            <a
                              href={bookUrl}
                              onClick={() => setBookServiceId(s.id)}
                              className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg no-underline opacity-0 group-hover/svc:opacity-100 transition-opacity"
                              style={{ backgroundColor: theme.accentColor, color: accentText }}
                              title={`Book ${s.name}`}
                            >
                              Book <ChevronRight className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </FadeIn>
              </div>
            )}

            {/* ── Team sidebar ── */}
            {activeStaff.length > 0 && (
              <aside id="team" className="lg:sticky lg:top-20 scroll-mt-16">
                <FadeIn delay={100}>
                  <div className="mb-4">
                    <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: theme.accentColor }}>The people behind your look</p>
                    <h2 className="text-2xl font-bold text-slate-900">Meet our team</h2>
                  </div>
                  <div className="bg-slate-50 rounded-2xl border border-slate-200 divide-y divide-slate-200/70 overflow-hidden">
                    {activeStaff.map((m) => {
                      const isExpanded = expandedStaff.has(m.id!);
                      const photos     = m.photoUrls?.length ? m.photoUrls : m.photoUrl ? [m.photoUrl] : [];
                      const hasDetails = photos.length > 0 || !!m.bio || (m.specializations?.length ?? 0) > 0;
                      return (
                        <div
                          key={m.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleStaff(m.id!)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleStaff(m.id!); }
                          }}
                          className="w-full text-left p-3.5 hover:bg-white transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset"
                          style={{ ["--tw-ring-color" as string]: theme.accentColor }}
                          aria-expanded={isExpanded}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden"
                              style={{ backgroundColor: cardColor(m.name) }}
                            >
                              {photos[0] ? (
                                <img
                                  src={photos[0]}
                                  alt={m.name}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                                />
                              ) : (
                                <span className="text-xs font-black text-white">{initials(m.name)}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-900 leading-tight truncate">{m.name}</p>
                              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mt-0.5">
                                {STAFF_ROLE_LABEL[m.role] ?? m.role}
                              </p>
                            </div>
                            {hasBooking && (
                              <a
                                href={bookUrl}
                                onClick={(e) => { e.stopPropagation(); setBookStaffId(m.id!); }}
                                className="shrink-0 text-[10px] font-bold px-2.5 py-1.5 rounded-full no-underline transition-opacity hover:opacity-85"
                                style={{ backgroundColor: `${theme.accentColor}18`, color: theme.accentColor }}
                                title={`See ${m.name.split(" ")[0]}'s available times`}
                              >
                                Book with me
                              </a>
                            )}
                            {hasDetails && (
                              <ChevronRight
                                className={`w-4 h-4 text-slate-300 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                              />
                            )}
                          </div>
                          {/* Expanded: photos + bio + specializations */}
                          {isExpanded && hasDetails && (
                            <div className="mt-2.5 pl-[52px]">
                              {photos.length === 1 && (
                                <img
                                  src={photos[0]}
                                  alt={m.name}
                                  className="w-full h-36 object-cover rounded-xl mb-2.5"
                                  loading="lazy"
                                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                                />
                              )}
                              {photos.length > 1 && (
                                <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory mb-2.5 pb-1 -mr-3.5 pr-3.5">
                                  {photos.map((url, pi) => (
                                    <img
                                      key={url}
                                      src={url}
                                      alt={`${m.name} — photo ${pi + 1}`}
                                      className="h-32 w-40 shrink-0 object-cover rounded-xl snap-start"
                                      loading="lazy"
                                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                                    />
                                  ))}
                                </div>
                              )}
                              {m.bio && (
                                <p className="text-xs text-slate-500 leading-relaxed mb-2">{m.bio}</p>
                              )}
                              {m.specializations && m.specializations.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {m.specializations.map((s) => (
                                    <span
                                      key={s}
                                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                                      style={{ backgroundColor: theme.accentColor, color: accentText }}
                                    >
                                      {CATEGORY_LABEL[s] ?? s}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {hasBooking && (
                    <a
                      href={bookUrl}
                      className="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-xl no-underline transition-opacity hover:opacity-90"
                      style={{ backgroundColor: theme.accentColor, color: accentText }}
                    >
                      Book with our team <ChevronRight className="w-3.5 h-3.5" />
                    </a>
                  )}
                </FadeIn>
              </aside>
            )}
          </div>
        </section>
      )}

      {/* ── Floating actions ─────────────────────────────────────────────── */}
      <div
        className="fixed bottom-6 right-6 z-[100] flex items-center gap-3"
        style={{
          opacity:    heroVisible ? 0 : 1,
          transform:  heroVisible ? "translateY(12px) scale(0.95)" : "translateY(0) scale(1)",
          pointerEvents: heroVisible ? "none" : "auto",
          transition: "opacity 0.3s ease, transform 0.3s ease",
        }}
      >
        {/* Back to top */}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="w-11 h-11 rounded-full bg-white border border-slate-200 shadow-lg flex items-center justify-center text-slate-500 hover:text-slate-900 hover:scale-105 transition-all cursor-pointer"
          title="Back to top"
          aria-label="Back to top"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
        {/* Book now */}
        {hasBooking && (
          <a
            href={bookUrl}
            className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-3 rounded-full shadow-xl no-underline hover:opacity-90 hover:scale-105 transition-all"
            style={{ backgroundColor: theme.accentColor, color: accentText }}
          >
            <CalendarCheck className="w-4 h-4" /> Book now
          </a>
        )}
      </div>

      {/* ── Footer (contact / hours / address) ──────────────────────────── */}
      <footer id="contact" className="mt-auto scroll-mt-16" style={{ backgroundColor: footerBg, color: footerText, ...(footerIsLight ? { borderTop: "1px solid #E2E8F0" } : {}) }}>
        <div className="max-w-5xl mx-auto px-6 py-10 sm:py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 lg:flex lg:items-start lg:justify-between lg:gap-12">

            {/* Brand */}
            <div className="lg:max-w-[220px]">
              <div className="flex items-center gap-2.5 mb-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: theme.logoBgColor }}
                >
                  <span className="text-[10px] font-bold leading-none" style={{ color: contrastText(theme.logoBgColor) }}>
                    {initials(saloon.name)}
                  </span>
                </div>
                <span className="text-sm font-bold" style={{ color: footerBright }}>{saloon.name}</span>
              </div>
              {city && <p className="text-xs leading-relaxed" style={{ color: footerDim }}>{city}</p>}
              {hasBooking && (
                <a
                  href={bookUrl}
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg no-underline hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: theme.accentColor, color: accentText }}
                >
                  <CalendarCheck className="w-3.5 h-3.5" /> Book now
                </a>
              )}
            </div>

            {/* Opening hours */}
            {openHours.length > 0 && (
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: footerDim }}>
                  <Clock className="w-3.5 h-3.5" /> Opening hours
                </h3>
                <div className="space-y-1">
                  {openHours.map((h) => {
                    const isToday = h.day === todayName;
                    return (
                      <div
                        key={h.day}
                        className={`flex items-center gap-3 text-xs ${isToday ? "font-semibold" : ""}`}
                        style={isToday ? { color: theme.accentColor } : { color: footerDim }}
                      >
                        <span className="w-8 shrink-0">{DAY_SHORT[h.day] ?? h.day}</span>
                        <span className="font-mono">{h.openTime}–{h.closeTime}</span>
                        {isToday && <span className="text-[9px] font-bold uppercase tracking-wider">today</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Contact */}
            {saloon.contact && (saloon.contact.phone || saloon.contact.email || saloon.contact.website) && (
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: footerDim }}>
                  <Phone className="w-3.5 h-3.5" /> Contact
                </h3>
                <div className="flex flex-col gap-2.5">
                  {saloon.contact.phone && (
                    <a href={`tel:${saloon.contact.phone}`} className="flex items-center gap-2.5 no-underline text-xs hover:opacity-80 transition-opacity" style={{ color: footerText }}>
                      <Phone className="w-3.5 h-3.5 shrink-0" style={{ color: footerDim }} /> {saloon.contact.phone}
                    </a>
                  )}
                  {saloon.contact.email && (
                    <a href={`mailto:${saloon.contact.email}`} className="flex items-center gap-2.5 no-underline text-xs hover:opacity-80 transition-opacity" style={{ color: footerText }}>
                      <Mail className="w-3.5 h-3.5 shrink-0" style={{ color: footerDim }} /> <span className="truncate">{saloon.contact.email}</span>
                    </a>
                  )}
                  {saloon.contact.website && (
                    <a href={saloon.contact.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 no-underline text-xs hover:opacity-80 transition-opacity" style={{ color: footerText }}>
                      <Globe className="w-3.5 h-3.5 shrink-0" style={{ color: footerDim }} /> <span className="truncate">{saloon.contact.website}</span>
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Address */}
            {saloon.location && (saloon.location.address || saloon.location.city) && (
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: footerDim }}>
                  <MapPin className="w-3.5 h-3.5" /> Find us
                </h3>
                <address className="not-italic flex flex-col gap-0.5 text-xs">
                  {saloon.location.address && <p className="font-semibold" style={{ color: footerBright }}>{saloon.location.address}</p>}
                  {(saloon.location.zipCode || saloon.location.city) && (
                    <p style={{ color: footerDim }}>
                      {[saloon.location.zipCode, saloon.location.city].filter(Boolean).join(" ")}
                      {saloon.location.state ? `, ${saloon.location.state}` : ""}
                    </p>
                  )}
                  {saloon.location.country && <p style={{ color: footerDim }}>{saloon.location.country}</p>}
                </address>
                {saloon.location.address && (
                  <a
                    href={theme.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      [saloon.location.address, saloon.location.zipCode, saloon.location.city, saloon.location.country].filter(Boolean).join(", ")
                    )}`}
                    target="_blank" rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold no-underline hover:opacity-80 transition-opacity"
                    style={{ color: theme.accentColor }}
                  >
                    Open in Maps <ChevronRight className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="mt-10 pt-5 border-t flex flex-wrap items-center justify-between gap-3" style={{ borderColor: footerBorder }}>
            <p className="text-[11px]" style={{ color: footerDim }}>
              © {new Date().getFullYear()} {saloon.name} · All rights reserved.
            </p>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="text-[11px] hover:opacity-80 transition-opacity cursor-pointer inline-flex items-center gap-1"
              style={{ color: footerDim }}
            >
              Back to top <ArrowUp className="w-3 h-3" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
