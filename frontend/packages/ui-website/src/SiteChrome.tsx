import { LanguageSelector, useI18n } from "@salon/i18n";
import React from "react";
import {
  ArrowLeft, ArrowUp, CalendarCheck, ChevronRight, Clock, MapPin, Phone, ShoppingCart, User,
} from "lucide-react";
import { DAY_SHORT } from "./constants";
import { contrastText, isLightColor } from "./theme";
import { SocialLinksRow } from "./SocialIcons";
import { useIsScrollable } from "./useIsScrollable";
import { SalonPolicyLinks } from "./SalonPolicyLinks";
import type { SalonPolicy } from "./SalonPolicyLinks";
import { apiFetch, API_BASE } from "./api";
import type { OperatingHours, Salon, SalonHoliday, WebsiteTheme } from "./types";

const DAY_ORDER = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

/** Features that get their own path-routed view + header nav link */
export const FEATURE_NAV: Record<string, { label: string; path: string }> = {
  WEBSHOP:         { label: "Shop",       path: "shop" },
  MEMBERSHIP:      { label: "Membership", path: "membership" },
  LOYALTY_PROGRAM: { label: "Loyalty",    path: "loyalty" },
};

/** Features whose customers have something to see in their account (bookings, orders, memberships). */
const ACCOUNT_FEATURES = ["BOOKING", "WEBSHOP", "MEMBERSHIP", "LOYALTY_PROGRAM"];

export function hasCustomerAccount(salon: Salon) {
  return (salon.features ?? []).some((f) => ACCOUNT_FEATURES.includes(f));
}

/** The round avatar button that opens the customer's account — a drawer, a page, or a link. */
export function AccountButton({ theme, onClick, href, headerBg }: {
  theme: WebsiteTheme;
  onClick?: () => void;
  href?: string;
  /** Background it sits on; defaults to the theme's header. */
  headerBg?: string;
}) {
  const { t: translateUi } = useI18n();
  const light = isLightColor(headerBg ?? theme.headerBg ?? "#FFFFFF");
  const style: React.CSSProperties = {
    backgroundColor: light ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.10)",
    border: `1.5px solid ${light ? "rgba(15,23,42,0.12)" : "rgba(255,255,255,0.18)"}`,
    color: light ? "#0F172A" : "#FFFFFF",
  };
  const className = "shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-80 cursor-pointer";
  if (href) {
    return (
      <a href={href} aria-label={translateUi("My account")} title={translateUi("My account")} className={className} style={style}
        onClick={onClick ? (e) => { e.preventDefault(); onClick(); } : undefined}>
        <User className="w-4 h-4" />
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={translateUi("My account")} title={translateUi("My account")} className={className} style={style}>
      <User className="w-4 h-4" />
    </button>
  );
}

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
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

/** The salon's named closure days. Every surface that shows opening hours loads them through
 *  this hook so the website, shop and membership pages can't drift apart. A failed fetch keeps
 *  the list empty, which degrades to plain weekly hours. Pass no id to skip the request on a
 *  surface that doesn't show hours. */
export function useSalonHolidays(salonId?: number | string): SalonHoliday[] {
  const [holidays, setHolidays] = React.useState<SalonHoliday[]>([]);
  React.useEffect(() => {
    if (salonId == null) return;
    let cancelled = false;
    apiFetch<SalonHoliday[]>(`${API_BASE}/api/salon/${salonId}/holidays`)
      .then((hs) => { if (!cancelled) setHolidays(hs ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [salonId]);
  return holidays;
}

/** The holiday closing `date`, if any — one with no `year` repeats every year. */
export function holidayOn(holidays: SalonHoliday[], date: Date): SalonHoliday | null {
  return holidays.find((h) =>
    h.month === date.getMonth() + 1 &&
    h.day === date.getDate() &&
    (h.year == null || h.year === date.getFullYear())
  ) ?? null;
}

/** The footer's "Opening hours" column: this week's open days — a day the salon is closed for a
 *  holiday struck through with its name — plus the holidays falling in the next 90 days. Shared
 *  by the website footer (SalonWebsite) and the feature-page footer below. */
export function FooterOpeningHours({ salon, theme, holidays }: {
  salon: Salon;
  theme: WebsiteTheme;
  holidays: SalonHoliday[];
}) {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const openHours = salon.operatingHours?.filter((h) => !h.closed) ?? [];
  if (openHours.length === 0) return null;

  const footerIsLight = isLightColor(theme.footerBg ?? "#1E293B");
  const footerDim     = footerIsLight ? "#9CA3AF" : "#64748B";
  const footerBorder  = footerIsLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.08)";

  const todayDate = new Date();
  const todayName = DAY_ORDER[todayDate.getDay()];

  const upcomingHolidays = (() => {
    const now = todayDate.getTime();
    const windowEnd = now + 90 * 24 * 60 * 60 * 1000;
    const yr = todayDate.getFullYear();
    return holidays
      .flatMap((h) => {
        const years = h.year != null ? [h.year] : [yr, yr + 1];
        return years.map((y) => ({ h, ts: new Date(y, h.month - 1, h.day).getTime() }));
      })
      .filter(({ ts }) => ts >= now && ts <= windowEnd)
      .sort((a, b) => a.ts - b.ts)
      .map(({ h }) => h);
  })();

  return (
    <div className="min-w-0 lg:order-2">
      <h3 className="text-[11px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: footerDim }}>
        <Clock className="w-3.5 h-3.5" /> {translateUi("Opening hours ")}</h3>
      <div className="space-y-1">
        {openHours.map((h) => {
          const isToday = h.day === todayName;
          const offset = DAY_ORDER.indexOf(h.day) - todayDate.getDay();
          const slotDate = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() + offset);
          const dayHoliday = holidayOn(holidays, slotDate);
          return (
            <div key={h.day} className={`flex items-center flex-wrap gap-x-2 gap-y-0.5 text-xs ${isToday ? "font-semibold" : ""}`} style={isToday ? { color: theme.accentColor } : { color: footerDim }}>
              <span className="w-8 shrink-0">{translateUi(DAY_SHORT[h.day] ?? h.day)}</span>
              {dayHoliday ? (
                <>
                  <span className="font-mono opacity-40 line-through">{h.openTime}–{h.closeTime}</span>
                  <span className="text-[9px] font-bold uppercase tracking-wide px-1 py-0.5 rounded" style={{ backgroundColor: `${theme.accentColor}25`, color: theme.accentColor }}>{dayHoliday.name}</span>
                </>
              ) : (
                <span className="font-mono">{h.openTime}–{h.closeTime}</span>
              )}
              {isToday && !dayHoliday && <span className="text-[9px] font-bold uppercase tracking-wider">{translateUi("today")}</span>}
            </div>
          );
        })}
      </div>
      {upcomingHolidays.length > 0 && (
        <div className="mt-3 pt-2 space-y-1" style={{ borderTop: `1px solid ${footerBorder}` }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: footerDim }}>{translateUi("Upcoming holidays")}</p>
          {upcomingHolidays.map((h, i) => {
            const yr = h.year ?? new Date().getFullYear();
            const start = new Date(yr, h.month - 1, h.day);
            const startLabel = start.toLocaleDateString(uiLocale, { day: "numeric", month: "short" });
            const isRange = h.endMonth != null && h.endDay != null && (h.endMonth !== h.month || h.endDay !== h.day);
            let dateLabel = startLabel;
            if (isRange) {
              const endYr = (h.endMonth! < h.month || (h.endMonth === h.month && h.endDay! < h.day)) ? yr + 1 : yr;
              const end = new Date(endYr, h.endMonth! - 1, h.endDay!);
              dateLabel = `${startLabel} – ${end.toLocaleDateString(uiLocale, { day: "numeric", month: "short" })}`;
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
  );
}

/** Small pill flagging a feature (or the whole site) as still in beta. */
function BetaBadge({ color }: { color: string }) {
  const { t: translateUi, locale: uiLocale } = useI18n();
  return (
    <span
      className="hidden sm:inline-block shrink-0 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full border"
      style={{ color, borderColor: color }}
    >
      {translateUi("Beta ")}</span>
  );
}

export function SiteHeader({
  salon, theme, current, onBack, getPagePath, onNavigate, standalone = false, headerExtra,
  cartCount, onCartOpen, onAvatarOpen,
}: {
  salon: Salon;
  theme: WebsiteTheme;
  current: string;
  onBack: () => void;
  getPagePath?: (page: string) => string;
  onNavigate?: (page: string) => void;
  /** Hide "Back to website" nav — use when there is no website to return to */
  standalone?: boolean;
  /** Extra content rendered on the right side (standalone mode only) */
  headerExtra?: React.ReactNode;
  /** When in shop, show a cart icon in the header */
  cartCount?: number;
  onCartOpen?: () => void;
  /** Open the customer's account; without it the avatar navigates to the "account" page. */
  onAvatarOpen?: () => void;
}) {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const open        = isOpenNow(salon.operatingHours);
  const hasBooking  = salon.features?.includes("BOOKING");
  const accentText  = contrastText(theme.accentColor);
  const featurePages = (salon.features ?? [])
    .filter((f) => FEATURE_NAV[f])
    .map((f) => FEATURE_NAV[f])
    .filter((fp) => fp.path !== current);

  const headerBg      = theme.headerBg ?? "#FFFFFF";
  const headerIsLight = isLightColor(headerBg);
  const headerText    = headerIsLight ? "#0F172A" : "#FFFFFF";
  const headerBorder  = headerIsLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.12)";

  return (
    <header className="sticky top-0 z-30 backdrop-blur-sm border-b" style={{ backgroundColor: `${headerBg}F2`, borderColor: headerBorder }}>
      {/* Standalone mode: logo left, toggle right */}
      {standalone ? (
        <div className="max-w-5xl 2xl:max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Left: logo + salon name */}
          <button onClick={onBack} className="flex items-center gap-2 cursor-pointer group min-w-0">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 group-hover:opacity-80 transition-opacity"
              style={{ backgroundColor: theme.logoBgColor }}
            >
              <span className="text-[10px] font-bold leading-none" style={{ color: contrastText(theme.logoBgColor) }}>
                {initials(salon.name)}
              </span>
            </div>
            <span className="text-sm font-bold truncate" style={{ color: headerText }}>{salon.name}</span>
            <BetaBadge color={theme.accentColor} />
          </button>
          {/* Right: language and mode controls */}
          <div className="flex items-center gap-2 shrink-0">
            {headerExtra}
            <LanguageSelector compact />
          </div>
        </div>
      ) : (
      <div className="max-w-5xl 2xl:max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-6">
        <div className="flex items-center gap-2 sm:gap-8 min-w-0 flex-1">
          {/* Mobile: the "Back to website" text link below is sm+ only and doesn't fit
              beside the shop's cart/avatar icons — give small screens an icon button so
              there's always a visible way back. */}
          {!standalone && (
            <button
              onClick={onBack}
              aria-label={translateUi("Back to website")}
              className="sm:hidden shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-80 cursor-pointer"
              style={{
                backgroundColor: headerIsLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.10)",
                border: `1.5px solid ${headerIsLight ? "rgba(15,23,42,0.12)" : "rgba(255,255,255,0.18)"}`,
                color: headerText,
              }}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <button onClick={onBack} className="flex items-center gap-2 cursor-pointer group min-w-0">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 group-hover:opacity-80 transition-opacity"
              style={{ backgroundColor: theme.logoBgColor }}
            >
              <span className="text-[10px] font-bold leading-none" style={{ color: contrastText(theme.logoBgColor) }}>
                {initials(salon.name)}
              </span>
            </div>
            <span className="text-sm font-bold truncate" style={{ color: headerText }}>{salon.name}</span>
            <BetaBadge color={theme.accentColor} />
          </button>

          <nav className="flex items-center gap-4 sm:gap-6 text-sm min-w-0 shrink-0">
            {/* Tapping the logo already goes back — this text link is redundant (and doesn't
                fit) once the shop's avatar/cart icons are on screen too, so keep it sm+ only. */}
            <button
              onClick={onBack}
              className="hidden sm:flex no-underline transition-colors font-medium text-slate-500 hover:text-slate-900 cursor-pointer items-center gap-1.5 shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{translateUi("Back to website")}</span>
            </button>
            {featurePages.map((fp) => (
              <a
                key={fp.path}
                href={getPagePath ? getPagePath(fp.path) : `/${fp.path}`}
                className="hidden md:inline no-underline transition-colors font-medium text-slate-500 hover:text-slate-900"
                onClick={onNavigate ? (e) => { e.preventDefault(); onNavigate(fp.path); } : undefined}
              >
                {translateUi(fp.label)}
              </a>
            ))}
          </nav>
        </div>

          <div className="flex items-center gap-3 shrink-0">
            {current !== "shop" && (
              <span className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
                open
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-slate-50 text-slate-400 border-slate-200"
              }`}>
                {open && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                {open ? translateUi("Open now") : translateUi("Closed")}
              </span>
            )}
            {current === "shop" && onCartOpen ? (
              <>
                <AccountButton theme={theme} onClick={onAvatarOpen} />
                <button
                  onClick={onCartOpen}
                  className="relative inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-opacity hover:opacity-90 cursor-pointer"
                  style={{ backgroundColor: theme.accentColor, color: accentText }}
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span className="hidden sm:inline">{translateUi("Cart")}</span>
                  {(cartCount ?? 0) > 0 && (
                    <span
                      className="min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold flex items-center justify-center"
                      style={{ backgroundColor: accentText, color: theme.accentColor }}
                    >
                      {cartCount}
                    </span>
                  )}
                </button>
              </>
            ) : current === "book" ? (
              <span
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0"
                style={{ backgroundColor: `${theme.accentColor}18`, color: theme.accentColor }}
              >
                <CalendarCheck className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{translateUi("Book appointment")}</span>
              </span>
            ) : hasBooking ? (
              <a href={getPagePath ? getPagePath("book") : "/book"}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl no-underline transition-opacity hover:opacity-80"
                style={{ backgroundColor: theme.accentColor, color: accentText }}
                onClick={onNavigate ? (e) => { e.preventDefault(); onNavigate("book"); } : undefined}>
                {translateUi("Book now ")}</a>
            ) : null}
            {current !== "shop" && current !== "account" && hasCustomerAccount(salon) && (onAvatarOpen || onNavigate || getPagePath) && (
              <AccountButton theme={theme}
                href={getPagePath ? getPagePath("account") : undefined}
                onClick={onAvatarOpen ?? (onNavigate ? () => onNavigate("account") : undefined)} />
            )}
            <LanguageSelector compact />
          </div>
        </div>
      )}
    </header>
  );
}

export function SiteFooter({
  salon, theme, current, onBack, getPagePath, standalone = false, policies = [],
}: {
  salon: Salon;
  theme: WebsiteTheme;
  current: string;
  onBack: () => void;
  getPagePath?: (page: string) => string;
  /** Hide "Back to website" link — use when there is no website to return to */
  standalone?: boolean;
  policies?: SalonPolicy[];
}) {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const accentText = contrastText(theme.accentColor);
  const isScrollable = useIsScrollable();
  const hasBooking = salon.features?.includes("BOOKING");
  // The slim booking-page footer below has no hours column, so don't fetch for it.
  const holidays   = useSalonHolidays(current === "book" ? undefined : salon.id);
  const city       = [salon.location?.city, salon.location?.country].filter(Boolean).join(", ");

  const footerBg      = theme.footerBg ?? "#1E293B";
  const footerIsLight = isLightColor(footerBg);
  const footerText    = footerIsLight ? "#374151" : "#CBD5E1";
  const footerBright  = footerIsLight ? "#111827" : "#FFFFFF";
  const footerDim     = footerIsLight ? "#9CA3AF" : "#64748B";
  const footerBorder  = footerIsLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.08)";

  if (current === "book") {
    return (
      <footer
        className="shrink-0 border-t"
        style={{
          backgroundColor: footerBg,
          color: footerDim,
          borderColor: footerBorder,
        }}
      >
        <div className="max-w-5xl 2xl:max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-4 flex-wrap">
            <p className="text-[11px]" style={{ color: footerDim }}>
              © {new Date().getFullYear()} {salon.name}
            </p>
            {standalone && (salon.location?.city || salon.location?.country) && (
              <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: footerDim }}>
                <MapPin className="w-3 h-3 opacity-60" />
                {[salon.location.city, salon.location.country].filter(Boolean).join(", ")}
              </span>
            )}
            {!standalone && salon.contact?.phone && (
              <a
                href={`tel:${salon.contact.phone}`}
                className="inline-flex items-center gap-1.5 text-[11px] no-underline hover:opacity-80 transition-opacity"
                style={{ color: footerDim }}
              >
                <Phone className="w-3 h-3" /> {salon.contact.phone}
              </a>
            )}
          </div>
          {standalone ? (
            <div className="ml-auto flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
              <SalonPolicyLinks policies={policies} color={footerDim} salonName={salon.name} />
              {salon.contact?.phone && (
                <a
                  href={`tel:${salon.contact.phone}`}
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium no-underline hover:opacity-80 transition-opacity"
                  style={{ color: theme.accentColor }}
                >
                  <Phone className="w-3 h-3" /> {salon.contact.phone}
                </a>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <button
                onClick={onBack}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold hover:opacity-80 transition-opacity cursor-pointer"
                style={{ color: theme.accentColor }}
              >
                <ArrowLeft className="w-3 h-3" /> {translateUi("Back to website ")}</button>
              <SalonPolicyLinks policies={policies} color={footerDim} salonName={salon.name} />
            </div>
          )}
        </div>
      </footer>
    );
  }

  return (
    <footer className="mt-auto" style={{ backgroundColor: footerBg, color: footerText, ...(footerIsLight ? { borderTop: "1px solid #E2E8F0" } : {}) }}>
      <div className="max-w-5xl 2xl:max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
        <div className="grid grid-cols-2 items-start gap-x-4 gap-y-8 sm:gap-x-8 lg:flex lg:items-start lg:justify-between lg:gap-12">

          {/* Left column: brand (desktop only) + find us + social — mirrors the home-page
              footer (SalonWebsite.tsx). Contact details are intentionally not repeated here. */}
          <div className="min-w-0 flex flex-col lg:contents">
            <div className="hidden lg:block min-w-0 lg:order-1 lg:max-w-[220px]">
              <div className="flex items-center gap-2.5 mb-3 min-w-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: theme.logoBgColor }}>
                  <span className="text-[10px] font-bold leading-none" style={{ color: contrastText(theme.logoBgColor) }}>
                    {initials(salon.name)}
                  </span>
                </div>
                <span className="text-sm font-bold truncate min-w-0" style={{ color: footerBright }}>{salon.name}</span>
              </div>
              {city && <p className="text-xs leading-relaxed" style={{ color: footerDim }}>{city}</p>}
              <SocialLinksRow contact={salon.contact} color={footerText} />
              {current === "book" && (
                <button onClick={onBack} className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity cursor-pointer" style={{ backgroundColor: theme.accentColor, color: accentText }}>
                  <ArrowLeft className="w-3.5 h-3.5" /> {translateUi("Back to website ")}</button>
              )}
            </div>

            {salon.location && (salon.location.address || salon.location.city) && (
              <div className="min-w-0 lg:order-4">
                <h3 className="text-[11px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: footerDim }}>
                  <MapPin className="w-3.5 h-3.5" /> {translateUi("Find us ")}</h3>
                <address className="not-italic flex flex-col gap-0.5 text-xs">
                  {salon.location.address && <p className="font-semibold" style={{ color: footerBright }}>{salon.location.address}</p>}
                  {(salon.location.zipCode || salon.location.city) && (
                    <p style={{ color: footerDim }}>
                      {[salon.location.zipCode, salon.location.city].filter(Boolean).join(" ")}
                      {salon.location.state ? `, ${salon.location.state}` : ""}
                    </p>
                  )}
                  {salon.location.country && <p style={{ color: footerDim }}>{salon.location.country}</p>}
                </address>
                {salon.location.address && (
                  <span className="mt-3 inline-flex items-center flex-wrap gap-1.5 text-xs font-semibold select-none opacity-40 cursor-not-allowed" style={{ color: theme.accentColor }}>
                    {translateUi("Open in Maps ")}<ChevronRight className="w-3 h-3" />
                    <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full border border-current">{translateUi("soon")}</span>
                  </span>
                )}
                <div className="lg:hidden pt-3">
                  <SocialLinksRow contact={salon.contact} color={footerText} />
                </div>
              </div>
            )}
          </div>

          {/* Right column: opening hours, matched in width to the left column and stretched to its height */}
          <FooterOpeningHours salon={salon} theme={theme} holidays={holidays} />
        </div>

        <div className="mt-10 pt-5 border-t flex flex-wrap items-center justify-between gap-3" style={{ borderColor: footerBorder }}>
          <p className="text-[11px]" style={{ color: footerDim }}>
            © {new Date().getFullYear()} {salon.name} {translateUi("· All rights reserved. ")}</p>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-x-5 gap-y-3">
            <SalonPolicyLinks policies={policies} color={footerDim} salonName={salon.name} />
            {current !== "account" && hasCustomerAccount(salon) && getPagePath && (
              <a href={getPagePath("account")} className="text-[11px] font-semibold no-underline hover:opacity-80" style={{ color: theme.accentColor }}>
                {translateUi("Rate your visit")}
              </a>
            )}
            {isScrollable && (
              <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="text-[11px] hover:opacity-80 transition-opacity cursor-pointer inline-flex items-center gap-1" style={{ color: footerDim }}>
                {translateUi("Back to top ")}<ArrowUp className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
