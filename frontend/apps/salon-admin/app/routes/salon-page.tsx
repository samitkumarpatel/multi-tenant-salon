import { useI18n } from "@salon/i18n";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useLoaderData, useRouteError, isRouteErrorResponse, useNavigate, useLocation, useParams } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { X, Palette, Check, Wand2, RotateCcw, ChevronDown, Sparkles } from "lucide-react";
import {
  SalonWebsite, GenerativeUIWebsite, SalonErrorPage, DEFAULT_THEME, FONTS,
  loadGoogleFont, fontStack, isLightColor, contrastText,
} from "@salon/ui-website";
import { FOOTER_LINK_MENUS } from "@salon/ui-website";
import type { WebsiteTheme, Salon, StaffMember, ServiceItem } from "@salon/ui-website";
import { GOOGLE_FONTS, type GoogleFontCategory } from "@salon/ui-website/google-fonts";
import { CUSTOMER_API, ADMIN_API, apiFetch } from "~/lib/api";
import { SALON_DOMAIN } from "~/lib/config";
import { useEffect, useMemo, useRef } from "react";

// ── Loader ────────────────────────────────────────────────────────────────────

// Prevent re-fetching when navigating to sub-pages (book, shop…) within the same salon preview
export function shouldRevalidate({ currentParams, nextParams }: { currentParams: Record<string,string>; nextParams: Record<string,string> }) {
  return currentParams.salonId !== nextParams.salonId;
}

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const id = params.salonId!;
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  // single endpoint handles both UUID and handler
  const salon = await apiFetch<Salon>(`${CUSTOMER_API}/${id}`);
  const [staff, services, theme] = await Promise.all([
    apiFetch<StaffMember[]>(`${CUSTOMER_API}/${salon.id}/staff`).catch((): StaffMember[] => []),
    apiFetch<ServiceItem[]>(`${CUSTOMER_API}/${salon.id}/services`).catch((): ServiceItem[] => []),
    apiFetch<WebsiteTheme>(`${CUSTOMER_API}/${salon.id}/website`).catch((): WebsiteTheme => DEFAULT_THEME),
  ]);
  return { salon, staff, services, theme };
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

// ── Admin-only: color picker ──────────────────────────────────────────────────

const PRESET_COLORS = [
  "#0F172A", "#1E293B", "#374151", "#4B5563", "#FFFFFF", "#F8FAFC", "#F1F5F9", "#E2E8F0",
  "#F59E0B", "#D97706", "#B45309", "#78350F", "#EF4444", "#DC2626", "#B91C1C", "#7F1D1D",
  "#3B82F6", "#2563EB", "#1D4ED8", "#1E3A8A", "#10B981", "#059669", "#047857", "#065F46",
  "#8B5CF6", "#7C3AED", "#6D28D9", "#4C1D95", "#EC4899", "#DB2777", "#BE185D", "#831843",
];

function ColorPicker({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const [open, setOpen]           = useState(false);
  const [draft, setDraft]         = useState(value);
  const [pos, setPos]             = useState({ top: 0, left: 0 });
  const [prevValue, setPrevValue] = useState<string | undefined>(undefined);
  const btnRef    = useRef<HTMLButtonElement>(null);
  const popRef    = useRef<HTMLDivElement>(null);
  const nativeRef = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(value), [value]);

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
      const r = btnRef.current.getBoundingClientRect();
      const popW = 232; const popH = 270;
      let left = r.left - popW - 8;
      if (left < 8) left = r.right + 8;
      let top = r.top;
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

  const canUndo = prevValue !== undefined && prevValue !== value;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">{translateUi(label)}</p>
        <button
          onClick={handleUndo} disabled={!canUndo}
          className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded transition-all cursor-pointer ${
            canUndo
              ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50 opacity-100"
              : "text-slate-300 opacity-0 pointer-events-none"
          }`}
        >
          <RotateCcw className="w-2.5 h-2.5" /> {translateUi("Undo ")}</button>
      </div>
      <div className="flex items-center gap-2">
        <button
          ref={btnRef} onClick={openPopover}
          className="w-9 h-9 rounded-lg border border-slate-300 shadow-sm cursor-pointer shrink-0 transition-all hover:scale-105 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-amber-400"
          style={{ backgroundColor: value }} title={translateUi("Pick colour")}
        />
        <input
          type="text" value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commitDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && commitDraft(draft)}
          className="flex-1 font-mono text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/20"
          placeholder={"#000000"} maxLength={7}
        />
        <input
          ref={nativeRef} type="color" value={value}
          onChange={(e) => applyChange(e.target.value)}
          className="sr-only"
        />
      </div>

      {open && createPortal(
        <div
          ref={popRef}
          className="fixed z-[9999] bg-white border border-slate-200 rounded-2xl shadow-2xl p-3"
          style={{ top: pos.top, left: pos.left, width: 232 }}
        >
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2 px-0.5">{translateUi(label)}</p>
          <div className="grid grid-cols-8 gap-1 mb-3">
            {PRESET_COLORS.map((c) => (
              <button
                key={c} onClick={() => { applyChange(c); setOpen(false); }}
                className="w-6 h-6 rounded-md cursor-pointer transition-transform hover:scale-110 focus:outline-none"
                style={{
                  backgroundColor: c,
                  boxShadow: c.toLowerCase() === value.toLowerCase()
                    ? "0 0 0 2px #fff, 0 0 0 3.5px #F59E0B"
                    : "inset 0 0 0 1px rgba(0,0,0,0.08)",
                }}
              />
            ))}
          </div>
          <div className="border-t border-slate-100 pt-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded border border-slate-200 shrink-0" style={{ backgroundColor: value }} />
              <input
                type="text" value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={(e) => commitDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { commitDraft(draft); setOpen(false); } }}
                className="flex-1 font-mono text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/20"
                placeholder={"#000000"} maxLength={7}
              />
            </div>
            <button
              onClick={() => { setOpen(false); setTimeout(() => nativeRef.current?.click(), 50); }}
              className="w-full text-xs text-slate-500 hover:text-slate-800 py-1.5 px-2 rounded-lg hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors border border-slate-100 hover:border-slate-200"
            >
              <span className="text-sm leading-none">🎨</span> {translateUi("Open colour wheel… ")}</button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Admin-only: font picker (one dropdown: 14 presets first, then all of Google Fonts) ─

const FONT_CATEGORIES = ["All", "Sans Serif", "Serif", "Display", "Handwriting", "Monospace"] as const;
const LIST_LIMIT = 60;

/** Presets as dropdown rows: the family they render in (for search/subtitle) and a category for the filter chips. */
const PRESET_ROWS = Object.entries(FONTS).map(([id, font]) => {
  const family = /'([^']+)'/.exec(font.stack)?.[1] ?? (id === "georgia" ? "Georgia" : "System UI");
  const category: GoogleFontCategory = font.stack.includes("cursive") ? "Handwriting"
    : /(^|[^-])serif/.test(font.stack) ? "Serif" : "Sans Serif";
  return { id, label: font.label, stack: font.stack, family, category };
});
const PRESET_FAMILIES = new Set(PRESET_ROWS.map((p) => p.family.toLowerCase()));

function FontField({ value, onChange, accent }: {
  value: string;
  onChange: (v: string) => void;
  accent: "violet" | "amber";
}) {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<GoogleFontCategory | "All">("All");

  const preset = PRESET_ROWS.find((p) => p.id === value);
  const selCls = accent === "violet"
    ? "border-violet-400 bg-violet-50 text-violet-800"
    : "border-amber-400 bg-amber-50 text-amber-800";
  const rowSel = accent === "violet" ? "bg-violet-50 text-violet-800 font-semibold" : "bg-amber-50 text-amber-800 font-semibold";

  const needle = query.trim().toLowerCase();
  const presetMatches = useMemo(() => PRESET_ROWS.filter((p) =>
    (cat === "All" || p.category === cat) &&
    (!needle || p.label.toLowerCase().includes(needle) || p.family.toLowerCase().includes(needle)),
  ), [needle, cat]);

  // Preset families (Inter, Lato…) are listed once, as their preset, so a pick always stores the slug.
  const googleMatches = useMemo(() => GOOGLE_FONTS
    .filter((f) => !PRESET_FAMILIES.has(f.family.toLowerCase()) &&
      (cat === "All" || f.category === cat) && (!needle || f.family.toLowerCase().includes(needle)))
    .slice(0, LIST_LIMIT), [needle, cat]);

  // Load the CSS for the rows currently shown, and for the active non-preset selection so its
  // preview renders in its own face.
  useEffect(() => { if (open) googleMatches.forEach((f) => loadGoogleFont(f.family)); }, [open, googleMatches]);
  useEffect(() => { if (!preset) loadGoogleFont(value); }, [value, preset]);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    setQuery("");
  }

  const groupCls = "px-3 pt-2.5 pb-1 text-[9px] font-bold uppercase tracking-widest text-slate-400";

  return (
    <section>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">{translateUi("Font")}</p>

      <button
        type="button" onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm rounded-lg border transition-all cursor-pointer ${selCls}`}
        style={{ fontFamily: fontStack(value) }}
      >
        <span className="truncate font-semibold">{preset ? translateUi(preset.label) : value}</span>
        <span className="flex items-center gap-1.5 shrink-0">
          {preset && <span className="text-[10px] font-normal opacity-60" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>{preset.family}</span>}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div className="mt-1.5 rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="p-2 border-b border-slate-100 space-y-1.5">
            <input
              autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${(GOOGLE_FONTS.length).toLocaleString(uiLocale)} fonts…`}
              className="w-full text-xs px-2 py-1.5 rounded-md border border-slate-200 outline-none focus:ring-1 focus:ring-slate-300"
            />
            <div className="flex flex-wrap gap-1">
              {FONT_CATEGORIES.map((c) => (
                <button
                  key={c} type="button" onClick={() => setCat(c)}
                  className={`px-2 py-0.5 rounded-full text-[10px] border cursor-pointer ${
                    cat === c ? "border-slate-400 bg-slate-100 text-slate-700" : "border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {presetMatches.length === 0 && googleMatches.length === 0 && (
              <p className="text-[11px] text-slate-400 px-3 py-3">{translateUi("No fonts match.")}</p>
            )}
            {presetMatches.length > 0 && (
              <>
                <p className={groupCls}>{translateUi("Curated")}</p>
                {presetMatches.map((p) => (
                  <button
                    key={p.id} type="button" onClick={() => pick(p.id)}
                    className={`w-full flex items-baseline justify-between gap-2 text-left px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer ${
                      value === p.id ? rowSel : "text-slate-700"
                    }`}
                    style={{ fontFamily: p.stack }}
                  >
                    <span className="truncate">{translateUi(p.label)}</span>
                    <span className="text-[10px] text-slate-400 shrink-0" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>{p.family}</span>
                  </button>
                ))}
              </>
            )}
            {googleMatches.length > 0 && (
              <>
                <p className={`${groupCls} ${presetMatches.length ? "border-t border-slate-100 mt-1" : ""}`}>{translateUi("All Google Fonts")}</p>
                {googleMatches.map((f) => (
                  <button
                    key={f.family} type="button" onClick={() => pick(f.family)}
                    className={`w-full flex items-baseline justify-between gap-2 text-left px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer ${
                      value === f.family ? rowSel : "text-slate-700"
                    }`}
                    style={{ fontFamily: fontStack(f.family) }}
                  >
                    <span className="truncate">{f.family}</span>
                    <span className="text-[10px] text-slate-400 shrink-0" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>{f.category}</span>
                  </button>
                ))}
              </>
            )}
            {googleMatches.length === LIST_LIMIT && (
              <p className="text-[10px] text-slate-400 px-3 py-2 border-t border-slate-100">{translateUi("Showing the first 60 — refine your search to see more.")}</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// ── Admin-only: AI palette matcher ────────────────────────────────────────────

type ThemeSuggestion = Pick<WebsiteTheme,
  "heroBg" | "heroTextColor" | "accentColor" | "logoBgColor" | "headerBg" | "footerBg" | "chatBg" | "fontFamily"
> & { name: string; mood: string };

/**
 * Asks the backend for three coordinated palettes (hero, branding, header/footer, chat + font)
 * and applies the picked one to the live preview. Nothing is persisted until "Save Changes".
 */
function AiThemeMatcher({ salonId, salonName, services, theme, onChange, accent }: {
  salonId: string; salonName: string; services: ServiceItem[];
  theme: WebsiteTheme; onChange: (t: WebsiteTheme) => void; accent: "violet" | "amber";
}) {
  const { t: translateUi } = useI18n();
  const [style, setStyle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ThemeSuggestion[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  // Theme as it was before the first AI pick, so the admin can back out of all suggestions.
  const [before, setBefore] = useState<WebsiteTheme | null>(null);

  const btn = accent === "violet" ? "bg-violet-600 hover:bg-violet-700" : "bg-amber-500 hover:bg-amber-600";
  const ring = accent === "violet" ? "border-violet-400 ring-2 ring-violet-200" : "border-amber-400 ring-2 ring-amber-200";

  useEffect(() => { suggestions.forEach((s) => loadGoogleFont(s.fontFamily)); }, [suggestions]);

  async function suggest() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ suggestions: ThemeSuggestion[] }>(`${ADMIN_API}/${salonId}/ai/website-theme`, {
        method: "POST",
        body: JSON.stringify({
          salonName,
          style: style.trim() || undefined,
          services: [...new Set(services.map((s) => s.name).filter(Boolean))].slice(0, 40),
          websiteType: theme.websiteType,
        }),
      });
      setSuggestions(res.suggestions);
      setPicked(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : translateUi("AI suggestions failed — try again"));
    } finally {
      setLoading(false);
    }
  }

  function apply(i: number) {
    const { name: _name, mood: _mood, ...colours } = suggestions[i];
    if (!before) setBefore(theme);
    setPicked(i);
    onChange({ ...theme, ...colours });
  }

  function undo() {
    if (before) onChange(before);
    setBefore(null);
    setPicked(null);
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
          <Sparkles className="w-3 h-3" /> {translateUi("Match with AI")}
        </p>
        {before && (
          <button onClick={undo} className="flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-slate-800 cursor-pointer">
            <RotateCcw className="w-2.5 h-2.5" /> {translateUi("Undo")}
          </button>
        )}
      </div>
      <p className="text-[11px] text-slate-400 leading-relaxed">
        {translateUi("Picks colours for every section and a font that match each other and your salon.")}
      </p>
      <input
        value={style} onChange={(e) => setStyle(e.target.value)} maxLength={300}
        onKeyDown={(e) => e.key === "Enter" && !loading && suggest()}
        placeholder={translateUi("Style (optional) — e.g. luxury, minimal, bold barber")}
        className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 outline-none focus:ring-1 focus:ring-slate-300"
      />
      <button
        onClick={suggest} disabled={loading}
        className={`w-full inline-flex items-center justify-center gap-2 text-xs font-semibold py-2 rounded-lg text-white transition-all cursor-pointer disabled:opacity-60 disabled:cursor-default ${btn}`}
      >
        {loading
          ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {translateUi("Designing…")}</>
          : <><Sparkles className="w-3.5 h-3.5" /> {suggestions.length ? translateUi("Suggest again") : translateUi("Suggest matching design")}</>}
      </button>
      {error && <p className="text-[11px] text-red-600">{error}</p>}

      {suggestions.length > 0 && (
        <div className="space-y-2">
          {suggestions.map((s, i) => (
            <button
              key={`${s.name}-${i}`} onClick={() => apply(i)}
              className={`w-full text-left rounded-lg border overflow-hidden bg-white transition-all cursor-pointer hover:shadow-md ${
                picked === i ? ring : "border-slate-200 hover:border-slate-300"
              }`}
            >
              {/* Mini site mock: header / hero with accent CTA + logo badge / footer */}
              <div style={{ background: s.headerBg }} className="h-2.5" />
              <div style={{ background: s.heroBg, color: s.heroTextColor, fontFamily: fontStack(s.fontFamily) }} className="px-2.5 py-2 flex items-center gap-2">
                <span style={{ background: s.logoBgColor, color: contrastText(s.logoBgColor) }}
                  className="w-5 h-5 rounded-md shrink-0 flex items-center justify-center text-[9px] font-bold">
                  {salonName.charAt(0).toUpperCase()}
                </span>
                <span className="text-sm font-semibold truncate flex-1">{s.name}</span>
                <span style={{ background: s.accentColor, color: contrastText(s.accentColor) }}
                  className="text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0">
                  {translateUi("Book")}
                </span>
              </div>
              <div style={{ background: s.footerBg }} className="h-2.5" />
              <div className="px-2.5 py-1.5 flex items-start gap-1.5">
                {picked === i && <Check className="w-3 h-3 mt-0.5 shrink-0 text-emerald-500" />}
                <p className="text-[10px] text-slate-500 leading-snug">
                  <span className="font-semibold text-slate-600">{FONTS[s.fontFamily]?.label ?? s.fontFamily}</span> · {s.mood}
                </p>
              </div>
            </button>
          ))}
          <p className="text-[10px] text-slate-400">{translateUi("Click a design to preview it, then Save Changes to publish.")}</p>
        </div>
      )}
    </section>
  );
}

// ── Admin-only: theme panel ───────────────────────────────────────────────────

type SaveState = "idle" | "saving" | "saved" | "error";

function ThemePanel({ salonId, salonName, features, services, theme, onChange, onClose }: {
  salonId: string; salonName: string; features: string[]; services: ServiceItem[];
  theme: WebsiteTheme; onChange: (t: WebsiteTheme) => void; onClose: () => void;
}) {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const isGenUI = theme.websiteType === "GENERATIVE_UI";

  useEffect(() => { Object.keys(FONTS).forEach(loadGoogleFont); }, []);

  async function handleSave() {
    setSaveState("saving");
    try {
      await apiFetch<WebsiteTheme>(`${ADMIN_API}/${salonId}/website`, {
        method: "PUT",
        body: JSON.stringify({
          heroBg: theme.heroBg, heroTextColor: theme.heroTextColor, accentColor: theme.accentColor,
          fontFamily: theme.fontFamily, logoBgColor: theme.logoBgColor,
          headerBg: theme.headerBg, footerBg: theme.footerBg,
          chatBg: theme.chatBg ?? null, chatLayout: theme.chatLayout ?? "fullscreen",
          footerLinks: theme.footerLinks ?? null,
        }),
      });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 2500);
    }
  }

  const saveBtn    = isGenUI
    ? "bg-violet-600 hover:bg-violet-700"
    : "bg-amber-500 hover:bg-amber-600";

  return (
    <div
      className="fixed inset-x-0 bottom-0 max-h-[85dvh] md:inset-x-auto md:top-0 md:right-0 md:bottom-0 md:w-72 md:max-h-none bg-white border-t md:border-t-0 md:border-l border-slate-200 shadow-2xl z-[200] flex flex-col rounded-t-2xl md:rounded-none"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <div className="flex justify-center pt-2.5 pb-1 md:hidden shrink-0">
        <div className="w-10 h-1 rounded-full bg-slate-200" />
      </div>
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50 shrink-0">
        <div className="flex items-center gap-2">
          {isGenUI
            ? <Wand2 className="w-4 h-4 text-violet-500" />
            : <Palette className="w-4 h-4 text-amber-500" />
          }
          <h2 className="text-sm font-bold text-slate-900">
            {isGenUI ? translateUi("Chat Window Design") : translateUi("Website Design")}
          </h2>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5 rounded hover:bg-slate-100">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
        {isGenUI && (
          <p className="text-[11px] text-slate-400 leading-relaxed bg-violet-50 border border-violet-100 rounded-lg px-3 py-2.5">
            {translateUi("These settings style the ")}<span className="font-semibold text-violet-700">{translateUi("chat window shell")}</span> {translateUi("your AI Receptionist greets visitors in. ")}</p>
        )}

        {/* Site-wide choices first (AI match, font); section-by-section colours follow. */}
        <AiThemeMatcher
          salonId={salonId} salonName={salonName} services={services}
          theme={theme} onChange={onChange} accent={isGenUI ? "violet" : "amber"}
        />

        <FontField
          value={theme.fontFamily}
          onChange={(v) => onChange({ ...theme, fontFamily: v })}
          accent={isGenUI ? "violet" : "amber"}
        />

        {isGenUI ? (
          // ── AI Receptionist palette — only what affects the chat shell ────
          <>
            <section>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">{translateUi("Colours")}</p>
              <div className="space-y-4">
                <ColorPicker label={translateUi("Page Background")} value={theme.heroBg} onChange={(v) => onChange({ ...theme, heroBg: v })} />
                <ColorPicker label={translateUi("Chat Background")} value={theme.chatBg ?? theme.heroBg} onChange={(v) => onChange({ ...theme, chatBg: v })} />
                <ColorPicker label={translateUi("Accent Color")} value={theme.accentColor} onChange={(v) => onChange({ ...theme, accentColor: v })} />
                <ColorPicker label={translateUi("Avatar Color")} value={theme.logoBgColor} onChange={(v) => onChange({ ...theme, logoBgColor: v })} />
              </div>
            </section>

            <section>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">{translateUi("Layout")}</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: "fullscreen", label: "Fullscreen", desc: "Fills the screen" },
                  { id: "windowed", label: "Windowed", desc: "Centered card" },
                ] as const).map((opt) => {
                  const selected = (theme.chatLayout ?? "fullscreen") === "windowed" ? "windowed" : "fullscreen";
                  return (
                    <button
                      key={opt.id} onClick={() => onChange({ ...theme, chatLayout: opt.id })}
                      className={`px-3 py-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                        selected === opt.id
                          ? "border-violet-400 bg-violet-50 text-violet-800"
                          : "border-slate-200 hover:border-slate-300 text-slate-600"
                      }`}
                    >
                      <span className="block text-xs font-semibold">{translateUi(opt.label)}</span>
                      <span className="block text-[10px] opacity-70">{opt.desc}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          </>
        ) : (
          // ── Static website palette — full controls ───────────────────────
          <>
            <section>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">{translateUi("Hero Section")}</p>
              <div className="space-y-4">
                <ColorPicker label={translateUi("Background")} value={theme.heroBg} onChange={(v) => onChange({ ...theme, heroBg: v })} />
                <ColorPicker label={translateUi("Text Color")} value={theme.heroTextColor} onChange={(v) => onChange({ ...theme, heroTextColor: v })} />
                <ColorPicker label={translateUi("Accent / CTA")} value={theme.accentColor} onChange={(v) => onChange({ ...theme, accentColor: v })} />
                {(() => {
                  const suggested = contrastText(theme.heroBg);
                  const isOptimal = suggested.toLowerCase() === theme.heroTextColor.toLowerCase();
                  return (
                    <button
                      onClick={() => onChange({ ...theme, heroTextColor: suggested })} disabled={isOptimal}
                      className={`w-full flex items-center gap-2 text-xs px-3 py-2 rounded-lg border transition-all ${
                        isOptimal
                          ? "border-emerald-200 bg-emerald-50 text-emerald-600 cursor-default"
                          : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 cursor-pointer"
                      }`}
                    >
                      {isOptimal
                        ? <><Check className="w-3.5 h-3.5 shrink-0" /> {translateUi("Text contrast looks great")}</>
                        : <><Wand2 className="w-3.5 h-3.5 shrink-0" /> {translateUi("Auto-fix text contrast for this background")}</>
                      }
                    </button>
                  );
                })()}
              </div>
            </section>

            <section>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">{translateUi("Branding")}</p>
              <ColorPicker label={translateUi("Logo Background")} value={theme.logoBgColor} onChange={(v) => onChange({ ...theme, logoBgColor: v })} />
            </section>

            <section>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">{translateUi("Header & Footer")}</p>
              <div className="space-y-4">
                <ColorPicker label={translateUi("Header Background")} value={theme.headerBg} onChange={(v) => onChange({ ...theme, headerBg: v })} />
                <ColorPicker label={translateUi("Footer Background")} value={theme.footerBg} onChange={(v) => onChange({ ...theme, footerBg: v })} />
              </div>
            </section>

            <section>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{translateUi("Footer links")}</p>
              <p className="text-[11px] text-slate-400 mb-3">{translateUi("Choose which menus link from the footer and what the link says.")}</p>
              <div className="space-y-3">
                {FOOTER_LINK_MENUS.filter((m) => !m.feature || features.includes(m.feature)).map((m) => {
                  const cfg = theme.footerLinks?.[m.key] ?? {};
                  const set = (patch: { visible?: boolean; label?: string }) =>
                    onChange({ ...theme, footerLinks: { ...(theme.footerLinks ?? {}), [m.key]: { ...cfg, ...patch } } });
                  const on = cfg.visible !== false;
                  return (
                    <div key={m.key} className="flex items-center gap-2">
                      <input type="checkbox" checked={on} onChange={(e) => set({ visible: e.target.checked })}
                        aria-label={translateUi(m.label)} className="w-4 h-4 shrink-0 cursor-pointer" />
                      <input type="text" value={cfg.label ?? ""} disabled={!on} maxLength={60}
                        placeholder={translateUi(m.label)} onChange={(e) => set({ label: e.target.value })}
                        className="flex-1 min-w-0 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 disabled:opacity-40" />
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        <button
          onClick={() => onChange({
            ...DEFAULT_THEME,
            // Reset the visual settings only — keep the salon's identity and which
            // website experience it uses, or a Gen-UI salon would flip to STATIC_WEBSITE.
            salonId: theme.salonId,
            websiteType: theme.websiteType,
          })}
          className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer hover:underline"
        >
          {translateUi("Reset to defaults ")}</button>
      </div>

      <div className="px-4 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
        <button
          onClick={handleSave} disabled={saveState === "saving"}
          className={`w-full inline-flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl transition-all cursor-pointer disabled:cursor-default disabled:opacity-50 ${
            saveState === "saved" ? "bg-emerald-500 text-white"
            : saveState === "error" ? "bg-red-500 text-white"
            : `${saveBtn} text-white`
          }`}
        >
          {saveState === "saving"
            ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {translateUi("Saving…")}</>
            : saveState === "saved" ? <><Check className="w-4 h-4" /> {translateUi("Saved!")}</>
            : saveState === "error" ? <>{translateUi("Failed — try again")}</>
            : <>{translateUi("Save Changes")}</>
          }
        </button>
        <p className="text-[10px] text-slate-400 text-center mt-2">{translateUi("Changes are applied immediately to the customer website.")}</p>
      </div>
    </div>
  );
}

// ── Admin-only: preview banner ────────────────────────────────────────────────

function PreviewBanner({ handler, onDesign }: {
  handler: string; onDesign: () => void;
}) {
  const { t: translateUi, locale: uiLocale } = useI18n();
  return (
    <div
      className="bg-slate-950 text-white px-4 py-2.5 flex items-center justify-between gap-4 text-xs"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse shrink-0" />
        <span className="text-slate-400 truncate">
          {translateUi("Admin preview — customers see this at")}{" "}
          <span className="text-white font-mono font-medium">{handler}.{SALON_DOMAIN}</span>
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onDesign}
          className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer"
        >
          <Palette className="w-3 h-3" /> {translateUi("Design ")}</button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SalonPreviewPage() {
  const { salon, staff, services, theme: loaderTheme } = useLoaderData<typeof clientLoader>();
  const navigate = useNavigate();
  const location = useLocation();

  const initialTheme = { ...DEFAULT_THEME, ...(loaderTheme ?? {}) };
  const [theme, setTheme]           = useState<WebsiteTheme>(initialTheme);
  const [showDesign, setShowDesign] = useState(true);

  const handler =
    (salon as Salon & { handler?: string }).handler ??
    salon.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  const salonId = String(salon.id);
  const { salonId: salonParam } = useParams<{ salonId: string }>();

  // Hash-based sub-page navigation keeps the admin preview URL stable at /:salonId/website-preview
  // so that <a href> links inside SalonWebsite never trigger a React Router route change.
  const activePage = location.hash ? location.hash.replace(/^#/, "") : undefined;

  return (
    <div className="flex flex-col" style={{ height: "100dvh", overflow: "hidden" }}>
      {/* Banner — always visible, never scrolls */}
      <div className="shrink-0">
        <PreviewBanner
          handler={handler}
          onDesign={() => setShowDesign((v) => !v)}
        />
      </div>

      {/* Theme panel — fixed overlay, unaffected by flex layout */}
      {showDesign && (
        <ThemePanel
          salonId={salonId}
          salonName={salon.name}
          features={salon.features ?? []}
          services={services}
          theme={theme}
          onChange={setTheme}
          onClose={() => setShowDesign(false)}
        />
      )}

      {/* Preview content — fills remaining height; only this area scrolls */}
      {theme.websiteType === "GENERATIVE_UI" ? (
        <div
          className="flex-1 min-h-0 overflow-auto flex items-center justify-center p-6"
          style={{
            background: `radial-gradient(ellipse 110% 60% at 50% 0%, ${theme.accentColor}20 0%, transparent 55%), radial-gradient(ellipse 60% 40% at 80% 110%, ${theme.accentColor}0c 0%, transparent 50%), ${theme.heroBg ?? "#EEF2F4"}`,
          }}
        >
          <div
            className="w-full sm:max-w-[700px] lg:max-w-[1080px] rounded-2xl overflow-hidden shadow-2xl"
            style={{ height: "calc(100% - 48px)", flexShrink: 0 }}
          >
            <GenerativeUIWebsite
              salon={salon} staff={staff} services={services} theme={theme}
              getPagePath={(page) => `/${salonParam}/website-preview#${page}`}
              onNavigate={(page) => navigate(`/${salonParam}/website-preview${page ? `#${page}` : ""}`)}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden">
          <div className="h-full overflow-y-auto">
            <SalonWebsite
              salon={salon} staff={staff} services={services} theme={theme}
              activePage={activePage}
              getPagePath={(page) => `/${salonParam}/website-preview#${page}`}
              onNavigate={(page) => navigate(`/${salonParam}/website-preview${page ? `#${page}` : ""}`)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
