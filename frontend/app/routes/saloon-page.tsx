import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLoaderData, useLocation, useSearchParams } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import {
  MapPin, Phone, Mail, Globe, Clock, Timer,
  X, ChevronRight, Rocket, Palette, Check, RotateCcw,
  Monitor, Wand2, ArrowLeft, User,
} from "lucide-react";
import { API, HANDLER_API, apiFetch } from "~/lib/api";
import { FEATURE_LABEL, DAY_SHORT, STAFF_ROLE_LABEL, CATEGORY_LABEL, formatPrice } from "~/lib/constants";
import type { Saloon, StaffMember, ServiceItem, OperatingHours, WebsiteTheme } from "~/lib/types";

// ── Loader ────────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const id = params.saloonId!;
  const saloon = await apiFetch<Saloon>(
    UUID_RE.test(id) ? `${API}/${id}` : `${HANDLER_API}/${id}`
  );
  const [staff, services, theme] = await Promise.all([
    apiFetch<StaffMember[]>(`${API}/${saloon.id}/staff`).catch((): StaffMember[] => []),
    apiFetch<ServiceItem[]>(`${API}/${saloon.id}/services`).catch((): ServiceItem[] => []),
    apiFetch<WebsiteTheme>(`${API}/${saloon.id}/theme`).catch((): WebsiteTheme => DEFAULT_THEME),
  ]);
  return { saloon, staff, services, theme };
}

// ── Theme ─────────────────────────────────────────────────────────────────────

const DEFAULT_THEME: WebsiteTheme = {
  heroBg: "#0F172A",
  heroTextColor: "#FFFFFF",
  accentColor: "#F59E0B",
  fontFamily: "inter",
  logoBgColor: "#F59E0B",
};

const FONTS: Record<string, { label: string; stack: string; google?: string }> = {
  inter:    { label: "Modern",   stack: "'Inter', system-ui, sans-serif",         google: "Inter:wght@400;600;700;900" },
  playfair: { label: "Elegant",  stack: "'Playfair Display', Georgia, serif",     google: "Playfair+Display:wght@400;700;900" },
  raleway:  { label: "Raleway",  stack: "'Raleway', system-ui, sans-serif",       google: "Raleway:wght@400;600;700" },
  lato:     { label: "Friendly", stack: "'Lato', system-ui, sans-serif",          google: "Lato:wght@400;700;900" },
  system:   { label: "System",   stack: "system-ui, -apple-system, sans-serif",   google: undefined },
  georgia:  { label: "Classic",  stack: "Georgia, 'Times New Roman', serif",      google: undefined },
};

function loadGoogleFont(fontId: string) {
  const font = FONTS[fontId];
  if (!font?.google) return;
  const linkId = `gfont-${fontId}`;
  if (document.getElementById(linkId)) return;
  const link = document.createElement("link");
  link.id = linkId;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`;
  document.head.appendChild(link);
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
    <div className="fixed inset-x-0 bottom-0 max-h-[85dvh] md:inset-x-auto md:top-0 md:right-0 md:bottom-0 md:w-72 md:max-h-none bg-white border-t md:border-t-0 md:border-l border-slate-200 shadow-2xl z-[200] flex flex-col rounded-t-2xl md:rounded-none">
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
          </div>
        </section>

        {/* Branding */}
        <section>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Branding</p>
          <ColorPicker label="Logo Background" value={theme.logoBgColor}
            onChange={(v) => onChange({ ...theme, logoBgColor: v })} />
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

// ── AI modal ──────────────────────────────────────────────────────────────────



// ── Preview banner ────────────────────────────────────────────────────────────

type PublishState = "idle" | "loading" | "done" | "error";

function PreviewBanner({
  handler,
  saloonId,
  onDesign,
}: {
  handler: string;
  saloonId: string;
  onDesign: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [publish, setPublish]     = useState<PublishState>("idle");

  async function handlePublish() {
    setPublish("loading");
    try {
      const res = await fetch(`${API}/${saloonId}/publish`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPublish("done");
    } catch {
      setPublish("error");
      setTimeout(() => setPublish("idle"), 3000);
    }
  }

  if (dismissed) return null;

  return (
    <div className="bg-slate-950 text-white px-4 py-2.5 flex items-center justify-between gap-4 text-xs">
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

{/* Publish */}
        <button
          onClick={handlePublish}
          disabled={publish === "loading" || publish === "done"}
          className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer disabled:cursor-default ${
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

        <button onClick={() => setDismissed(true)} className="text-slate-500 hover:text-slate-300 cursor-pointer ml-1">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SaloonPage() {
  const { saloon, staff, services, theme: loaderTheme } = useLoaderData<typeof clientLoader>();
  const location     = useLocation();
  const [searchParams] = useSearchParams();
  const isPreview    = location.pathname.endsWith("/c");

  const [showDesign, setShowDesign] = useState(() => isPreview && searchParams.get("design") === "1");
  const [theme, setTheme]           = useState<WebsiteTheme>(loaderTheme ?? DEFAULT_THEME);

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
  const openHours      = saloon.operatingHours?.filter((h) => !h.closed) ?? [];
  const hasBooking     = saloon.features?.includes("BOOKING");
  const featureBadges  = (saloon.features ?? []).filter((f) => f !== "STATIC_WEBSITE" && f !== "ANALYTICS");

  return (
    <div className="min-h-[100dvh] flex flex-col bg-white text-slate-900">
      {isPreview && (
        <PreviewBanner
          handler={saloon.handler ?? saloon.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}
          saloonId={String(saloon.id)}
          onDesign={() => setShowDesign((v) => !v)}
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
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between gap-6">
          <a href="#top" className="flex items-center gap-2 no-underline group shrink-0">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center group-hover:opacity-80 transition-opacity"
              style={{ backgroundColor: theme.logoBgColor }}
            >
              <span className="text-[10px] font-bold text-white leading-none">{initials(saloon.name)}</span>
            </div>
            <span className="text-sm font-bold text-slate-900">{saloon.name}</span>
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-500">
            {activeServices.length > 0 && <a href="#services" className="hover:text-slate-900 no-underline transition-colors">Services</a>}
            {activeStaff.length > 0   && <a href="#team"     className="hover:text-slate-900 no-underline transition-colors">Team</a>}
          </nav>

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
              <a href="#contact"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white px-4 py-2 rounded-xl no-underline transition-opacity hover:opacity-80"
                style={{ backgroundColor: theme.accentColor }}>
                Book now
              </a>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section
        id="top"
        style={{ backgroundColor: theme.heroBg, fontFamily: fontStack }}
      >
        <div className="max-w-5xl mx-auto px-6 py-20 sm:py-28">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-3 mb-6">
              {open ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border"
                  style={{ color: theme.accentColor, backgroundColor: `${theme.accentColor}22`, borderColor: `${theme.accentColor}55` }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: theme.accentColor }} /> Open now
                </span>
              ) : (
                <span className="text-xs text-slate-500 bg-slate-800 border border-slate-700 px-3 py-1 rounded-full">
                  Currently closed
                </span>
              )}
              {city && (
                <span className="flex items-center gap-1.5 text-xs text-slate-400">
                  <MapPin className="w-3 h-3" /> {city}
                </span>
              )}
            </div>

            <h1 className="text-5xl sm:text-7xl font-bold leading-[0.95] tracking-tight"
              style={{ color: theme.heroTextColor }}>
              {saloon.name}
            </h1>

            <div className="w-16 h-0.5 mt-6" style={{ backgroundColor: theme.accentColor }} />

            {featureBadges.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-5">
                {featureBadges.map((f) => (
                  <span key={f} className="text-[11px] font-medium px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    {FEATURE_LABEL[f] ?? f}
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-3 mt-8">
              {hasBooking && (
                <a href="#contact"
                  className="inline-flex items-center gap-2 text-white text-sm font-semibold px-6 py-3 rounded-xl no-underline transition-opacity hover:opacity-80"
                  style={{ backgroundColor: theme.accentColor }}>
                  Book an appointment <ChevronRight className="w-4 h-4" />
                </a>
              )}
              {saloon.contact?.phone && (
                <a href={`tel:${saloon.contact.phone}`}
                  className="inline-flex items-center gap-2 border border-slate-600 hover:border-amber-500 text-slate-300 hover:text-amber-300 text-sm font-medium px-6 py-3 rounded-xl no-underline transition-colors">
                  <Phone className="w-4 h-4" /> {saloon.contact.phone}
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Services ────────────────────────────────────────────────────── */}
      {activeServices.length > 0 && (
        <section id="services" className="max-w-5xl mx-auto px-6 py-6 sm:py-10 w-full">
          <div className="mb-7">
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: theme.accentColor }}>What we offer</p>
            <h2 className="text-3xl font-bold text-slate-900">Services &amp; pricing</h2>
          </div>
          <div className="space-y-8">
            {grouped.map(([cat, items]) => (
              <div key={cat}>
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 pb-2.5 border-b border-slate-200 mb-0">
                  {CATEGORY_LABEL[cat] ?? cat}
                </h3>
                {items.map((s) => (
                  <div key={s.id} className="flex items-center gap-4 py-3.5 border-b border-slate-100 last:border-0 hover:bg-slate-50/60 -mx-3 px-3 rounded-lg transition-colors">
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
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Team ────────────────────────────────────────────────────────── */}
      {activeStaff.length > 0 && (
        <section id="team" className="bg-slate-50 border-y border-slate-100">
          <div className="max-w-5xl mx-auto px-6 py-6 sm:py-10">
            <div className="mb-7">
              <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: theme.accentColor }}>The people behind your look</p>
              <h2 className="text-3xl font-bold text-slate-900">Meet our team</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {activeStaff.map((m) => (
                <div key={m.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all group">
                  {/* Photo banner */}
                  <div
                    className="h-36 flex items-center justify-center relative"
                    style={{ backgroundColor: cardColor(m.name) }}
                  >
                    <span className="text-5xl font-black text-white/25 absolute select-none tracking-tight">
                      {initials(m.name)}
                    </span>
                    <div className="relative z-10 w-16 h-16 rounded-full border-4 border-white/30 flex items-center justify-center">
                      <span className="text-xl font-black text-white">{initials(m.name)}</span>
                    </div>
                  </div>
                  {/* Info */}
                  <div className="p-4">
                    <p className="text-sm font-bold text-slate-900 leading-tight">{m.name}</p>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mt-0.5">
                      {STAFF_ROLE_LABEL[m.role] ?? m.role}
                    </p>
                    {m.specializations && m.specializations.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {m.specializations.slice(0, 3).map((s) => (
                          <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                            {CATEGORY_LABEL[s] ?? s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Contact / Hours / Location ───────────────────────────────────── */}
      <section id="contact" className="max-w-5xl mx-auto px-6 py-6 sm:py-10 w-full">
        <div className="mb-7">
          <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: theme.accentColor }}>Get in touch</p>
          <h2 className="text-3xl font-bold text-slate-900">Find us</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">

          {openHours.length > 0 && (
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" /> Opening hours
              </h3>
              <div className="space-y-0.5">
                {openHours.map((h) => {
                  const isToday = h.day === todayName;
                  return (
                    <div key={h.day}
                      className={`flex items-center gap-3 text-sm rounded-md py-1.5 px-2 -mx-2 ${
                        isToday ? "font-semibold" : "text-slate-600"
                      }`}
                      style={isToday ? { backgroundColor: `${theme.accentColor}18`, color: theme.accentColor } : {}}>
                      <span className="w-7 shrink-0 text-xs">{DAY_SHORT[h.day] ?? h.day}</span>
                      <span className="font-mono text-xs">{h.openTime}–{h.closeTime}</span>
                      {isToday && <span className="ml-auto text-[9px] font-bold uppercase tracking-wider">today</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {saloon.contact && (saloon.contact.phone || saloon.contact.email || saloon.contact.website) && (
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                <Phone className="w-3.5 h-3.5" /> Contact
              </h3>
              <div className="flex flex-col gap-2.5">
                {saloon.contact.phone && (
                  <a href={`tel:${saloon.contact.phone}`} className="flex items-center gap-2.5 group no-underline">
                    <Phone className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-500 shrink-0 transition-colors" />
                    <span className="text-sm text-slate-700 group-hover:text-amber-600 transition-colors">{saloon.contact.phone}</span>
                  </a>
                )}
                {saloon.contact.email && (
                  <a href={`mailto:${saloon.contact.email}`} className="flex items-center gap-2.5 group no-underline">
                    <Mail className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-500 shrink-0 transition-colors" />
                    <span className="text-sm text-slate-700 group-hover:text-amber-600 transition-colors">{saloon.contact.email}</span>
                  </a>
                )}
                {saloon.contact.website && (
                  <a href={saloon.contact.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 group no-underline">
                    <Globe className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-500 shrink-0 transition-colors" />
                    <span className="text-sm text-slate-700 group-hover:text-amber-600 transition-colors truncate">{saloon.contact.website}</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {saloon.location && (saloon.location.address || saloon.location.city) && (
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5" /> Address
              </h3>
              <address className="not-italic flex flex-col gap-0.5">
                {saloon.location.address && <p className="text-sm font-semibold text-slate-900">{saloon.location.address}</p>}
                {(saloon.location.zipCode || saloon.location.city) && (
                  <p className="text-sm text-slate-600">
                    {[saloon.location.zipCode, saloon.location.city].filter(Boolean).join(" ")}
                    {saloon.location.state ? `, ${saloon.location.state}` : ""}
                  </p>
                )}
                {saloon.location.country && <p className="text-sm text-slate-500">{saloon.location.country}</p>}
              </address>
            </div>
          )}
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="mt-auto bg-white border-t border-slate-100">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <p className="text-[11px] text-slate-400" style={{ fontFamily: FONTS[theme.fontFamily]?.stack ?? FONTS.inter.stack }}>
            © {new Date().getFullYear()} {saloon.name} · All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
