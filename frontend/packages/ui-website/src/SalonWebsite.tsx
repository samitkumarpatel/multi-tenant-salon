import { useEffect, useRef, useState } from "react";
import {
  MapPin, Phone, Mail, Globe, Clock, Timer,
  ChevronRight, CalendarCheck, ArrowUp,
} from "lucide-react";
import { FEATURE_LABEL, DAY_SHORT, STAFF_ROLE_LABEL, CATEGORY_LABEL, formatPrice } from "./constants";
import { DEFAULT_THEME, fontStack, loadGoogleFont, isLightColor, contrastText } from "./theme";
import { FeatureView, FEATURE_VIEWS } from "./FeatureView";
import { BookingWizard } from "./BookingWizard";
import { FEATURE_NAV } from "./SiteChrome";
import { apiFetch, API_BASE } from "./api";
import type { Salon, StaffMember, ServiceItem, OperatingHours, WebsiteTheme, SalonHoliday } from "./types";

export type { Salon, StaffMember, ServiceItem, OperatingHours, WebsiteTheme };

const SALON_DOMAIN = import.meta.env.VITE_SALON_DOMAIN || "salonsaas.org";

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

const CARD_COLORS = ["#7C3AED", "#0284C7", "#D97706", "#DC2626", "#059669", "#EA580C", "#4F46E5"];
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

// ── Scroll animation helpers ──────────────────────────────────────────────────

function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
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

function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useInView();
  return (
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(22px)",
      transition: `opacity 0.55s ease ${delay}ms, transform 0.55s ease ${delay}ms`,
    }}>
      {children}
    </div>
  );
}

function CountUp({ target, duration = 900, style }: { target: number; duration?: number; style?: React.CSSProperties }) {
  const { ref, visible } = useInView(0.5);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!visible) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min((t - start) / duration, 1);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible, target, duration]);
  return <p ref={ref} className="text-xl font-black tabular-nums" style={style}>{n}</p>;
}

function RotatingWord({ words, color }: { words: string[]; color: string }) {
  const [idx, setIdx] = useState(0);
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
    <span className="inline-block font-semibold" style={{
      color, opacity: show ? 1 : 0,
      transform: show ? "translateY(0)" : "translateY(8px)",
      transition: "opacity 0.25s ease, transform 0.25s ease",
    }}>
      {words[idx]}
    </span>
  );
}

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
      <div className="h-full origin-left" style={{ backgroundColor: color, transform: `scaleX(${progress})`, transition: "transform 80ms linear" }} />
    </div>
  );
}

// ── Error page ────────────────────────────────────────────────────────────────

export function SalonErrorPage({ is404 }: { is404: boolean }) {
  return (
    <div className="min-h-[100dvh] relative flex flex-col items-center justify-center px-6 text-center overflow-hidden select-none"
      style={{ backgroundColor: "#0F172A", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @keyframes snip { 0%,100% { transform: rotate(-12deg) scale(1); } 50% { transform: rotate(12deg) scale(1.1); } }
        @keyframes float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
        .scissors-snip { animation: snip 2.6s ease-in-out infinite; }
        .scissors-float { animation: float 4s ease-in-out infinite; }
      `}</style>
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.035, backgroundImage: "repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)", backgroundSize: "28px 28px" }} />
      <div className="scissors-float mb-8"><div className="scissors-snip text-6xl leading-none">✂️</div></div>
      <p className="font-black leading-none mb-3 pointer-events-none" style={{ fontSize: "clamp(88px,22vw,172px)", color: "transparent", WebkitTextStroke: "2px #1E293B", letterSpacing: "-6px" }}>
        {is404 ? "404" : "500"}
      </p>
      <h1 className="text-xl sm:text-2xl font-bold text-white mb-3 leading-snug">{is404 ? "This chair's vacant." : "Something snapped."}</h1>
      <p className="text-sm text-slate-400 leading-relaxed max-w-xs mb-10">
        {is404 ? "We couldn't find the salon you're looking for. The link might be wrong, or the salon may have moved."
          : "An unexpected error occurred while loading this page. Refresh or try again in a moment."}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <a href="/" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white text-slate-900 text-sm font-semibold no-underline hover:opacity-90 transition-opacity">← Go home</a>
        {!is404 && (
          <button onClick={() => window.location.reload()} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm font-semibold hover:bg-slate-800/60 transition-colors cursor-pointer">
            ↻ Try again
          </button>
        )}
      </div>
      <p className="absolute bottom-7 text-[11px] font-medium tracking-widest uppercase text-slate-700">{SALON_DOMAIN}</p>
    </div>
  );
}

export function SalonDisabledPage({ salonName }: { salonName?: string }) {
  return (
    <div
      className="min-h-[100dvh] relative flex flex-col items-center justify-center px-6 text-center overflow-hidden select-none"
      style={{ backgroundColor: "#0F172A", fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <style>{`
        @keyframes comb-sway { 0%,100% { transform: rotate(-8deg) scale(1); } 50% { transform: rotate(8deg) scale(1.05); } }
        @keyframes comb-float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
        .comb-sway { animation: comb-sway 3s ease-in-out infinite; }
        .comb-float { animation: comb-float 4s ease-in-out infinite; }
      `}</style>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ opacity: 0.035, backgroundImage: "repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)", backgroundSize: "28px 28px" }}
      />
      <div className="comb-float mb-8">
        <div className="comb-sway text-6xl leading-none">💈</div>
      </div>
      <h1 className="text-2xl sm:text-3xl font-black text-white mb-3 leading-snug">
        {salonName ? `${salonName} is coming soon` : "We're getting ready"}
      </h1>
      <p className="text-sm text-slate-400 leading-relaxed max-w-xs mb-10">
        This salon's website hasn't been published yet. Check back soon — good things take a little time to set up.
      </p>
      <p className="absolute bottom-7 text-[11px] font-medium tracking-widest uppercase text-slate-700">{SALON_DOMAIN}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export interface SalonWebsiteProps {
  salon: Salon;
  staff: StaffMember[];
  services: ServiceItem[];
  theme: WebsiteTheme;
  /** Current page key: "book" | "shop" | "membership" | "loyalty" | undefined (home) */
  activePage?: string;
  /** Navigate to a page ("book", "shop", etc.) or null to go home */
  onNavigate?: (page: string | null) => void;
  /** Build the href for a given page key */
  getPagePath?: (page: string) => string;
}

export function SalonWebsite({ salon, staff, services, theme: themeProp, activePage, onNavigate, getPagePath }: SalonWebsiteProps) {
  const theme = { ...DEFAULT_THEME, ...themeProp };
  const bookUrl = getPagePath ? getPagePath("book") : "/book";

  const [selectedCat, setSelectedCat]     = useState<string | null>(null);
  const [showAllServices, setShowAllServices] = useState(false);
  const [expandedStaff, setExpandedStaff] = useState<Set<number>>(new Set());
  const [hoursExpanded, setHoursExpanded] = useState(false);
  const [heroVisible, setHeroVisible]     = useState(true);
  const [bookServiceId, setBookServiceId] = useState<number | null>(null);
  const [bookStaffId, setBookStaffId]     = useState<number | null>(null);
  const [mounted, setMounted]             = useState(false);
  const [holidays, setHolidays]           = useState<SalonHoliday[]>([]);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    apiFetch<SalonHoliday[]>(`${API_BASE}/api/salon/${salon.id}/holidays`)
      .then(setHolidays)
      .catch(() => {});
  }, [salon.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setMounted(true);
    document.documentElement.style.scrollBehavior = "smooth";
    return () => { document.documentElement.style.scrollBehavior = ""; };
  }, []);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setHeroVisible(e.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => { loadGoogleFont(theme.fontFamily); }, [theme.fontFamily]);

  const fontStackCss = fontStack(theme.fontFamily);
  const open = isOpenNow(salon.operatingHours);
  const todayName = DAY_ORDER[new Date().getDay()];
  const city = [salon.location?.city, salon.location?.country].filter(Boolean).join(", ");
  const activeStaff = staff.filter((m) => m.status === "ACTIVE");
  const activeServices = services.filter((s) => s.active);
  const grouped = groupByCategory(activeServices);
  const visibleServices = selectedCat ? activeServices.filter((s) => s.category === selectedCat) : activeServices;
  const manyServices = visibleServices.length > 5;
  const manyStaff = activeStaff.length > 5;
  const SERVICE_MOBILE_PREVIEW = 4;
  const hasHiddenServicesOnMobile = visibleServices.length > SERVICE_MOBILE_PREVIEW;
  const openHours = salon.operatingHours?.filter((h) => !h.closed) ?? [];
  const hasBooking = salon.features?.includes("BOOKING");

  const todayDate = new Date();
  const todayHoliday = holidays.find((h) =>
    h.month === todayDate.getMonth() + 1 &&
    h.day === todayDate.getDate() &&
    (h.year == null || h.year === todayDate.getFullYear())
  ) ?? null;

  const upcomingHolidays = (() => {
    const now = todayDate.getTime();
    const windowEnd = now + 90 * 24 * 60 * 60 * 1000;
    const yr = todayDate.getFullYear();
    return holidays
      .flatMap((h) => {
        const years = h.year != null ? [h.year] : [yr, yr + 1];
        return years.map((y) => {
          const d = new Date(y, h.month - 1, h.day);
          return { h, ts: d.getTime() };
        });
      })
      .filter(({ ts }) => ts >= now && ts <= windowEnd)
      .sort((a, b) => a.ts - b.ts)
      .map(({ h }) => h);
  })();
  const featureBadges = (salon.features ?? []).filter((f) => f !== "STATIC_WEBSITE" && f !== "ANALYTICS");
  const statusDetail = openStatusDetail(salon.operatingHours);
  const currentPage = activePage ?? "";
  const featurePages = (salon.features ?? []).filter((f) => FEATURE_NAV[f]).map((f) => FEATURE_NAV[f]);
  const rotatingWords = (() => {
    const catWords = grouped
      .filter(([cat]) => cat !== "OTHER")
      .map(([cat]) => (CATEGORY_LABEL[cat] ?? cat).toLowerCase());
    if (catWords.length > 0) return catWords;
    // Fall back to comma-separated description terms (e.g. "Haircut, Coloring, Facial and more")
    return activeServices
      .flatMap((s) =>
        s.description
          ? s.description.split(",").map((t) => t.replace(/\s*and\s+more\s*$/i, "").trim()).filter((t) => t.length > 2)
          : []
      )
      .map((w) => w.toLowerCase());
  })();

  const heroLight = isLightColor(theme.heroBg);
  const accentText = contrastText(theme.accentColor);
  const headerBg = theme.headerBg ?? "#FFFFFF";
  const headerIsLight = isLightColor(headerBg);
  const headerText = headerIsLight ? "#0F172A" : "#FFFFFF";
  const headerBorder = headerIsLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.12)";
  const footerBg = theme.footerBg ?? "#1E293B";
  const footerIsLight = isLightColor(footerBg);
  const footerText = footerIsLight ? "#374151" : "#CBD5E1";
  const footerBright = footerIsLight ? "#111827" : "#FFFFFF";
  const footerDim = footerIsLight ? "#9CA3AF" : "#64748B";
  const footerBorder = footerIsLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.08)";
  const hero = {
    sub: heroLight ? "#475569" : "#94A3B8",
    chipBg: heroLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.08)",
    chipBorder: heroLight ? "rgba(15,23,42,0.14)" : "rgba(255,255,255,0.16)",
    cardBg: heroLight ? "rgba(15,23,42,0.045)" : "rgba(255,255,255,0.07)",
    cardBorder: heroLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.12)",
    divider: heroLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.10)",
  };

  function toggleStaff(id: number) {
    setExpandedStaff((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  if (currentPage === "book" && hasBooking) {
    return (
      <div style={{ fontFamily: fontStackCss }}>
        <BookingWizard
          salon={salon} services={activeServices} staff={activeStaff} theme={theme}
          initialServiceId={bookServiceId} initialStaffId={bookStaffId}
          getPagePath={getPagePath}
          onExit={() => { setBookServiceId(null); setBookStaffId(null); onNavigate?.(null); }}
        />
      </div>
    );
  }

  const featureViewKey = featurePages.some((fp) => fp.path === currentPage) && FEATURE_VIEWS[currentPage] ? currentPage : null;
  if (featureViewKey) {
    return (
      <FeatureView
        salon={salon} theme={theme} pageKey={featureViewKey} bookUrl={bookUrl}
        getPagePath={getPagePath}
        onBack={() => onNavigate?.(null)}
      />
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-white text-slate-900" style={{ fontFamily: fontStackCss }}>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-md border-b" style={{ backgroundColor: `${headerBg}CC`, borderColor: headerBorder }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4 sm:gap-6">
          <div className="flex items-center gap-8 min-w-0">
            <a href="#top" className="flex items-center gap-2 no-underline group shrink-0">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center group-hover:opacity-80 transition-opacity" style={{ backgroundColor: theme.logoBgColor }}>
                <span className="text-[10px] font-bold leading-none" style={{ color: contrastText(theme.logoBgColor) }}>{initials(salon.name)}</span>
              </div>
              <span className="text-sm font-bold" style={{ color: headerText }}>{salon.name}</span>
            </a>
            {featurePages.length > 0 && (
              <nav className="hidden md:flex items-center gap-6 text-sm">
                {featurePages.map((fp) => (
                  <a key={fp.path} href={getPagePath ? getPagePath(fp.path) : `/${fp.path}`} className="no-underline transition-colors font-medium text-slate-500 hover:text-slate-900">{fp.label}</a>
                ))}
              </nav>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${open ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-50 text-slate-400 border-slate-200"}`}>
              {open && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
              {open ? "Open now" : "Closed"}
            </span>
            {hasBooking && (
              <a href={bookUrl} className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl no-underline transition-opacity hover:opacity-80"
                style={{ backgroundColor: theme.accentColor, color: accentText }}>
                Book now
              </a>
            )}
          </div>
        </div>
        <ScrollProgress color={theme.accentColor} />
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section ref={heroRef} id="top" style={{ backgroundColor: theme.heroBg }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-14">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-10 items-start">

            <div style={{ opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(18px)", transition: "opacity 0.6s ease, transform 0.6s ease" }}>
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
                {city && <span className="flex items-center gap-1.5 text-xs" style={{ color: hero.sub }}><MapPin className="w-3 h-3" /> {city}</span>}
              </div>

              <h1 className="text-4xl sm:text-6xl font-bold leading-[0.95] tracking-tight" style={{ color: theme.heroTextColor }}>{salon.name}</h1>

              {rotatingWords.length > 0 && (
                <p className="text-base sm:text-lg mt-3" style={{ color: `${theme.heroTextColor}99` }}>
                  Your place for <RotatingWord words={rotatingWords} color={theme.accentColor} />
                </p>
              )}

              <div className="w-14 h-0.5 mt-4" style={{ backgroundColor: theme.accentColor }} />

              {featureBadges.length > 0 && activeServices.length === 0 && (
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
                  <a href={bookUrl} className="inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-xl no-underline transition-all hover:opacity-90 hover:scale-[1.03]"
                    style={{ backgroundColor: theme.accentColor, color: accentText }}>
                    <CalendarCheck className="w-4 h-4" /> Book an appointment <ChevronRight className="w-4 h-4" />
                  </a>
                )}
                {salon.contact?.phone && (
                  <a href={`tel:${salon.contact.phone}`} className="inline-flex items-center gap-2 border text-sm font-medium px-6 py-3 rounded-xl no-underline transition-all hover:opacity-75"
                    style={{ color: hero.sub, borderColor: hero.chipBorder }}>
                    <Phone className="w-4 h-4" /> {salon.contact.phone}
                  </a>
                )}
              </div>
            </div>

            {/* Quick-info card */}
            <div className="rounded-2xl border p-5 space-y-4 text-sm" style={{
              backgroundColor: hero.cardBg, borderColor: hero.cardBorder,
              opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(18px)",
              transition: "opacity 0.6s ease 0.15s, transform 0.6s ease 0.15s",
            }}>
              {(() => {
                const today = salon.operatingHours?.find((h) => h.day === todayName);
                if (!today) return null;
                const week = DAY_ORDER.map((d) => salon.operatingHours?.find((h) => h.day === d)).filter(Boolean) as OperatingHours[];
                return (
                  <div>
                    <button type="button" onClick={() => setHoursExpanded((v) => !v)}
                      className="flex items-start gap-3 w-full text-left cursor-pointer group/hrs" aria-expanded={hoursExpanded}>
                      <Clock className="w-4 h-4 mt-0.5 shrink-0" style={{ color: theme.accentColor }} />
                      <div className="flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: `${theme.heroTextColor}70` }}>
                          Today · {DAY_SHORT[today.day] ?? today.day}
                          {todayHoliday && <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[8px] font-bold" style={{ backgroundColor: `${theme.accentColor}30`, color: theme.accentColor }}>Holiday</span>}
                        </p>
                        <p className="font-semibold" style={{ color: theme.heroTextColor }}>
                          {todayHoliday ? `Closed — ${todayHoliday.name}` : today.closed ? "Closed today" : `${today.openTime} – ${today.closeTime}`}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 mt-1 shrink-0 transition-transform" style={{ color: `${theme.heroTextColor}70`, transform: hoursExpanded ? "rotate(-90deg)" : "rotate(90deg)" }} />
                    </button>
                    <div className="overflow-hidden transition-all" style={{ maxHeight: hoursExpanded ? 220 : 0, opacity: hoursExpanded ? 1 : 0, transition: "max-height 0.3s ease, opacity 0.25s ease" }}>
                      <div className="pt-2 pl-7 space-y-0.5">
                        {week.map((h) => {
                          const isToday = h.day === todayName;
                          const dayIdx = DAY_ORDER.indexOf(h.day);
                          const offset = dayIdx - todayDate.getDay();
                          const slotDate = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() + offset);
                          const dayHoliday = holidays.find(
                            (hol) =>
                              hol.month === slotDate.getMonth() + 1 &&
                              hol.day === slotDate.getDate() &&
                              (hol.year == null || hol.year === slotDate.getFullYear())
                          ) ?? null;
                          return (
                            <div key={h.day} className="flex items-center gap-3 text-xs py-0.5"
                              style={{ color: isToday ? theme.accentColor : `${theme.heroTextColor}90`, fontWeight: isToday ? 700 : 400 }}>
                              <span className="w-8 shrink-0">{DAY_SHORT[h.day] ?? h.day}</span>
                              {dayHoliday ? (
                                <>
                                  <span className="font-mono opacity-40 line-through">{h.closed ? "Closed" : `${h.openTime}–${h.closeTime}`}</span>
                                  <span className="px-1 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide" style={{ backgroundColor: `${theme.accentColor}25`, color: theme.accentColor }}>
                                    {dayHoliday.name}
                                  </span>
                                </>
                              ) : (
                                <span className="font-mono">{h.closed ? "Closed" : `${h.openTime}–${h.closeTime}`}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {salon.contact?.phone && (
                <a href={`tel:${salon.contact.phone}`} className="flex items-center gap-3 no-underline group" style={{ color: theme.heroTextColor }}>
                  <Phone className="w-4 h-4 shrink-0 transition-opacity group-hover:opacity-60" style={{ color: theme.accentColor }} />
                  <span className="font-medium group-hover:opacity-70 transition-opacity truncate">{salon.contact.phone}</span>
                </a>
              )}

              {salon.contact?.email && (
                <a href={`mailto:${salon.contact.email}`} className="flex items-center gap-3 no-underline group" style={{ color: theme.heroTextColor }}>
                  <Mail className="w-4 h-4 shrink-0 transition-opacity group-hover:opacity-60" style={{ color: theme.accentColor }} />
                  <span className="font-medium group-hover:opacity-70 transition-opacity truncate">{salon.contact.email}</span>
                </a>
              )}

              {salon.location?.address && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([salon.location.address, salon.location.zipCode, salon.location.city, salon.location.country].filter(Boolean).join(", "))}`}
                  target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 no-underline group" style={{ color: theme.heroTextColor }}>
                  <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: theme.accentColor }} />
                  <p className="font-medium leading-snug group-hover:opacity-70 transition-opacity">
                    {salon.location.address}{salon.location.city ? `, ${salon.location.city}` : ""}
                    <span className="block text-[10px] font-semibold uppercase tracking-wide mt-0.5" style={{ color: `${theme.heroTextColor}55` }}>Open in Maps ↗</span>
                  </p>
                </a>
              )}

              {(activeServices.length > 0 || activeStaff.length > 0) && (
                <div className="flex items-center gap-6 pt-1 border-t" style={{ borderColor: hero.divider }}>
                  {activeServices.length > 0 && (
                    <div>
                      <CountUp target={activeServices.length} style={{ color: theme.accentColor }} />
                      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: `${theme.heroTextColor}55` }}>services</p>
                    </div>
                  )}
                  {activeStaff.length > 0 && (
                    <div>
                      <CountUp target={activeStaff.length} style={{ color: theme.accentColor }} />
                      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: `${theme.heroTextColor}55` }}>staff</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Services + Team ─────────────────────────────────────────────── */}
      {(activeServices.length > 0 || activeStaff.length > 0) && (
        <section id="services" className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 w-full scroll-mt-16">
          <div className={`grid grid-cols-1 gap-10 md:gap-12 items-start ${activeServices.length > 0 && activeStaff.length > 0 ? "md:grid-cols-2" : ""}`}>

            {activeServices.length > 0 && (
              <div>
                <FadeIn>
                  <div className="mb-6">
                    <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: theme.accentColor }}>What we offer</p>
                    <h2 className="text-2xl font-bold text-slate-900">Services &amp; pricing</h2>
                  </div>
                </FadeIn>
                {grouped.length > 1 && (
                  <FadeIn delay={60}>
                    <div className="flex flex-wrap gap-2 mb-5">
                      <button onClick={() => { setSelectedCat(null); setShowAllServices(false); }}
                        className="px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer"
                        style={selectedCat === null ? { backgroundColor: theme.accentColor, color: accentText } : { backgroundColor: "#f1f5f9", color: "#64748b" }}>
                        All
                      </button>
                      {grouped.map(([cat]) => (
                        <button key={cat} onClick={() => { setSelectedCat(cat === selectedCat ? null : cat); setShowAllServices(false); }}
                          className="px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer"
                          style={selectedCat === cat ? { backgroundColor: theme.accentColor, color: accentText } : { backgroundColor: "#f1f5f9", color: "#64748b" }}>
                          {CATEGORY_LABEL[cat] ?? cat}
                        </button>
                      ))}
                    </div>
                  </FadeIn>
                )}
                <FadeIn delay={80}>
                  <div className="relative">
                    <div className={`${manyServices
                      ? "grid grid-cols-1 sm:grid-cols-2 gap-3"
                      : "bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100"} ${
                      hasHiddenServicesOnMobile && !showAllServices ? "max-h-[380px] overflow-hidden sm:max-h-none sm:overflow-visible" : ""}`}>
                      {visibleServices.map((s) => (
                        <div key={s.id} className={manyServices
                          ? "group/svc flex flex-col gap-2.5 p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all"
                          : "group/svc flex flex-col gap-2.5 p-4 hover:bg-slate-50/60 transition-colors"}>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900">{s.name}</p>
                            {s.description && <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{s.description}</p>}
                          </div>
                          <div className="flex items-center flex-wrap gap-2">
                            <span className="inline-flex items-center gap-1 text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full shrink-0">
                              <Timer className="w-3 h-3 shrink-0" /> {s.durationMinutes ?? 30} min
                            </span>
                            <span className="text-xs text-slate-400">-</span>
                            <span className="text-xs font-semibold text-slate-900 tabular-nums">{formatPrice(s.price, s.currency)}</span>
                            {hasBooking && (
                              <a href={bookUrl} onClick={(e) => { e.preventDefault(); setBookServiceId(s.id); onNavigate?.("book"); }}
                                className="ml-auto inline-flex items-center justify-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg no-underline opacity-100 sm:opacity-0 sm:group-hover/svc:opacity-100 sm:group-focus-within/svc:opacity-100 transition-opacity shrink-0"
                                style={{ backgroundColor: theme.accentColor, color: accentText }}>
                                Book <ChevronRight className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {hasHiddenServicesOnMobile && !showAllServices && (
                      <div className="sm:hidden absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none rounded-b-2xl" />
                    )}
                  </div>
                  {hasHiddenServicesOnMobile && (
                    <button onClick={() => setShowAllServices((v) => !v)}
                      className="sm:hidden mt-3 w-full text-center text-xs font-semibold py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer">
                      {showAllServices ? "Show less" : `Show all ${visibleServices.length} services`}
                    </button>
                  )}
                </FadeIn>
              </div>
            )}

            {activeStaff.length > 0 && (
              <aside id="team" className="md:sticky md:top-20 scroll-mt-16">
                <FadeIn delay={100}>
                  <div className="mb-4">
                    <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: theme.accentColor }}>The people behind your look</p>
                    <h2 className="text-2xl font-bold text-slate-900">Meet our team</h2>
                  </div>
                  <div className="sm:hidden -mx-4 px-4">
                    <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1">
                      {activeStaff.map((m) => {
                        const photos = m.photoUrls?.length ? m.photoUrls : m.photoUrl ? [m.photoUrl] : [];
                        return (
                          <div key={m.id} className="snap-start shrink-0 w-32 rounded-xl border border-slate-200 bg-slate-50 p-3 flex flex-col items-center text-center gap-1.5">
                            <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 overflow-hidden" style={{ backgroundColor: cardColor(m.name) }}>
                              {photos[0] ? (
                                <img src={photos[0]} alt={m.name} className="w-full h-full object-cover" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                              ) : (
                                <span className="text-sm font-black text-white">{initials(m.name)}</span>
                              )}
                            </div>
                            <p className="text-xs font-bold text-slate-900 leading-tight truncate w-full">{m.name}</p>
                            <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">{STAFF_ROLE_LABEL[m.role] ?? m.role}</p>
                            {hasBooking && (
                              <a href={bookUrl} onClick={(e) => { e.preventDefault(); setBookStaffId(m.id!); onNavigate?.("book"); }}
                                className="mt-1 w-full inline-flex items-center justify-center text-[11px] font-semibold py-1.5 rounded-lg no-underline"
                                style={{ backgroundColor: theme.accentColor, color: accentText }}>
                                Book
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="hidden sm:block">
                  <div className={manyStaff
                    ? "grid grid-cols-1 sm:grid-cols-2 gap-3"
                    : "bg-slate-50 rounded-2xl border border-slate-200 divide-y divide-slate-200/70 overflow-hidden"}>
                    {activeStaff.map((m) => {
                      const isExpanded = expandedStaff.has(m.id!);
                      const photos = m.photoUrls?.length ? m.photoUrls : m.photoUrl ? [m.photoUrl] : [];
                      const hasDetails = photos.length > 0 || !!m.bio || (m.specializations?.length ?? 0) > 0;
                      return (
                        <div key={m.id} role="button" tabIndex={0}
                          onClick={() => toggleStaff(m.id!)}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleStaff(m.id!); } }}
                          className={manyStaff
                            ? "group/staff w-full text-left p-3.5 bg-slate-50 rounded-xl border border-slate-200 hover:bg-white hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset"
                            : "group/staff w-full text-left p-3.5 hover:bg-white transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset"}
                          aria-expanded={isExpanded}>
                          <div className="flex items-center flex-wrap gap-x-3 gap-y-1.5">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden" style={{ backgroundColor: cardColor(m.name) }}>
                                {photos[0] ? (
                                  <img src={photos[0]} alt={m.name} className="w-full h-full object-cover" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                                ) : (
                                  <span className="text-xs font-black text-white">{initials(m.name)}</span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-900 leading-tight truncate max-w-[160px] sm:max-w-[220px]">{m.name}</p>
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mt-0.5">{STAFF_ROLE_LABEL[m.role] ?? m.role}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-auto shrink-0">
                              {hasBooking && (
                                <a href={bookUrl} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setBookStaffId(m.id!); onNavigate?.("book"); }}
                                  className="shrink-0 inline-flex items-center justify-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg no-underline opacity-100 sm:opacity-0 sm:group-hover/staff:opacity-100 sm:group-focus-within/staff:opacity-100 transition-opacity whitespace-nowrap"
                                  style={{ backgroundColor: theme.accentColor, color: accentText }}>
                                  Book
                                </a>
                              )}
                              <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""} ${hasDetails ? "text-slate-300" : "invisible"}`} />
                            </div>
                          </div>
                          {isExpanded && hasDetails && (
                            <div className="mt-2.5 pl-[52px]">
                              {photos.length === 1 && (
                                <img src={photos[0]} alt={m.name} className="w-full h-36 object-cover rounded-xl mb-2.5" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                              )}
                              {photos.length > 1 && (
                                <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory mb-2.5 pb-1 -mr-3.5 pr-3.5">
                                  {photos.map((url, pi) => (
                                    <img key={url} src={url} alt={`${m.name} — photo ${pi + 1}`} className="h-32 w-40 shrink-0 object-cover rounded-xl snap-start" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                                  ))}
                                </div>
                              )}
                              {m.bio && <p className="text-xs text-slate-500 leading-relaxed mb-2">{m.bio}</p>}
                              {m.specializations && m.specializations.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {m.specializations.map((s) => (
                                    <span key={s} className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: theme.accentColor, color: accentText }}>
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
                  </div>
                </FadeIn>
              </aside>
            )}
          </div>
        </section>
      )}

      {/* ── Floating actions ─────────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-[100]" style={{
        opacity: heroVisible ? 0 : 1, transform: heroVisible ? "translateY(12px) scale(0.95)" : "translateY(0) scale(1)",
        pointerEvents: heroVisible ? "none" : "auto", transition: "opacity 0.3s ease, transform 0.3s ease",
      }}>
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="w-11 h-11 rounded-full bg-white border border-slate-200 shadow-lg flex items-center justify-center text-slate-500 hover:text-slate-900 hover:scale-105 transition-all cursor-pointer"
          aria-label="Back to top">
          <ArrowUp className="w-4 h-4" />
        </button>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer id="contact" className="mt-auto scroll-mt-16" style={{ backgroundColor: footerBg, color: footerText, ...(footerIsLight ? { borderTop: "1px solid #E2E8F0" } : {}) }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 lg:flex lg:items-start lg:justify-between lg:gap-12">

            <div className="lg:max-w-[220px]">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: theme.logoBgColor }}>
                  <span className="text-[10px] font-bold leading-none" style={{ color: contrastText(theme.logoBgColor) }}>{initials(salon.name)}</span>
                </div>
                <span className="text-sm font-bold" style={{ color: footerBright }}>{salon.name}</span>
              </div>
              {city && <p className="text-xs leading-relaxed" style={{ color: footerDim }}>{city}</p>}
            </div>

            {openHours.length > 0 && (
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: footerDim }}>
                  <Clock className="w-3.5 h-3.5" /> Opening hours
                </h3>
                <div className="space-y-1">
                  {openHours.map((h) => {
                    const isToday = h.day === todayName;
                    const dayIdx = DAY_ORDER.indexOf(h.day);
                    const offset = dayIdx - todayDate.getDay();
                    const slotDate = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() + offset);
                    const dayHoliday = holidays.find(
                      (hol) =>
                        hol.month === slotDate.getMonth() + 1 &&
                        hol.day === slotDate.getDate() &&
                        (hol.year == null || hol.year === slotDate.getFullYear())
                    ) ?? null;
                    return (
                      <div key={h.day} className={`flex items-center gap-3 text-xs ${isToday ? "font-semibold" : ""}`} style={isToday ? { color: theme.accentColor } : { color: footerDim }}>
                        <span className="w-8 shrink-0">{DAY_SHORT[h.day] ?? h.day}</span>
                        {dayHoliday ? (
                          <>
                            <span className="font-mono opacity-40 line-through">{h.openTime}–{h.closeTime}</span>
                            <span className="text-[9px] font-bold uppercase tracking-wide px-1 py-0.5 rounded" style={{ backgroundColor: `${theme.accentColor}25`, color: theme.accentColor }}>{dayHoliday.name}</span>
                          </>
                        ) : (
                          <span className="font-mono">{h.openTime}–{h.closeTime}</span>
                        )}
                        {isToday && !dayHoliday && <span className="text-[9px] font-bold uppercase tracking-wider">today</span>}
                      </div>
                    );
                  })}
                </div>
                {upcomingHolidays.length > 0 && (
                  <div className="mt-3 pt-2 space-y-1" style={{ borderTop: `1px solid ${footerBorder}` }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: footerDim }}>Upcoming holidays</p>
                    {upcomingHolidays.map((h, i) => {
                      const yr = h.year ?? new Date().getFullYear();
                      const start = new Date(yr, h.month - 1, h.day);
                      const startLabel = start.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                      const isRange = h.endMonth != null && h.endDay != null && (h.endMonth !== h.month || h.endDay !== h.day);
                      let dateLabel = startLabel;
                      if (isRange) {
                        const endYr = (h.endMonth! < h.month || (h.endMonth === h.month && h.endDay! < h.day)) ? yr + 1 : yr;
                        const end = new Date(endYr, h.endMonth! - 1, h.endDay!);
                        dateLabel = `${startLabel} – ${end.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
                      }
                      return (
                        <div key={`${h.id}-${i}`} className="flex items-center gap-2 text-xs" style={{ color: footerDim }}>
                          <span className="font-mono shrink-0">{dateLabel}</span>
                          <span>·</span>
                          <span className="truncate">{h.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {salon.location && (salon.location.address || salon.location.city) && (
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: footerDim }}>
                  <MapPin className="w-3.5 h-3.5" /> Find us
                </h3>
                <address className="not-italic flex flex-col gap-0.5 text-xs">
                  {salon.location.address && <p className="font-semibold" style={{ color: footerBright }}>{salon.location.address}</p>}
                  {(salon.location.zipCode || salon.location.city) && (
                    <p style={{ color: footerDim }}>{[salon.location.zipCode, salon.location.city].filter(Boolean).join(" ")}{salon.location.state ? `, ${salon.location.state}` : ""}</p>
                  )}
                  {salon.location.country && <p style={{ color: footerDim }}>{salon.location.country}</p>}
                </address>
                {salon.location.address && (
                  <a href={theme.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([salon.location.address, salon.location.zipCode, salon.location.city, salon.location.country].filter(Boolean).join(", "))}`}
                    target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold no-underline hover:opacity-80 transition-opacity"
                    style={{ color: theme.accentColor }}>
                    Open in Maps <ChevronRight className="w-3 h-3" />
                  </a>
                )}
                {salon.showBusinessId && salon.businessRegistrationId && (
                  <p className="text-[11px] mt-3" style={{ color: footerDim }}>{salon.businessIdLabel ?? "Reg. No."} {salon.businessRegistrationId}</p>
                )}
              </div>
            )}
          </div>

          <div className="mt-10 pt-5 border-t flex flex-wrap items-center justify-between gap-3" style={{ borderColor: footerBorder }}>
            <div>
              <p className="text-[11px]" style={{ color: footerDim }}>© {new Date().getFullYear()} {salon.name} · All rights reserved.</p>
            </div>
            <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="text-[11px] hover:opacity-80 transition-opacity cursor-pointer inline-flex items-center gap-1" style={{ color: footerDim }}>
              Back to top <ArrowUp className="w-3 h-3" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
