/**
 * Shared site chrome — header + footer matching the saloon landing page.
 * Used by sub-pages (booking wizard, shop, membership, loyalty) so every view
 * carries the same navigation and footer content. The link to the *current*
 * page is dropped and replaced with a "Back to website" action.
 */

import {
  ArrowLeft, ArrowUp, CalendarCheck, ChevronRight, Clock, Globe, Mail, MapPin, Phone,
} from "lucide-react";
import { DAY_SHORT } from "~/lib/constants";
import { contrastText, isLightColor } from "~/lib/theme";
import type { OperatingHours, Saloon, WebsiteTheme } from "~/lib/types";

const DAY_ORDER = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

/** Features that get their own hash-routed view + header nav link */
export const FEATURE_NAV: Record<string, { label: string; hash: string }> = {
  WEBSHOP:         { label: "Shop",       hash: "shop" },
  MEMBERSHIP:      { label: "Membership", hash: "membership" },
  LOYALTY_PROGRAM: { label: "Loyalty",    hash: "loyalty" },
};

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

/** Header identical to the landing page nav; current page's link is swapped for "Back to website". */
export function SiteHeader({
  saloon, theme, current, onBack,
}: {
  saloon: Saloon;
  theme: WebsiteTheme;
  /** "book" | "shop" | "membership" | "loyalty" */
  current: string;
  onBack: () => void;
}) {
  const open        = isOpenNow(saloon.operatingHours);
  const hasBooking  = saloon.features?.includes("BOOKING");
  const accentText  = contrastText(theme.accentColor);
  const featurePages = (saloon.features ?? [])
    .filter((f) => FEATURE_NAV[f])
    .map((f) => FEATURE_NAV[f])
    .filter((fp) => fp.hash !== current);

  const headerBg      = theme.headerBg ?? "#FFFFFF";
  const headerIsLight = isLightColor(headerBg);
  const headerText    = headerIsLight ? "#0F172A" : "#FFFFFF";
  const headerBorder  = headerIsLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.12)";

  return (
    <header className="sticky top-0 z-30 backdrop-blur-sm border-b" style={{ backgroundColor: `${headerBg}F2`, borderColor: headerBorder }}>
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between gap-6">
        <div className="flex items-center gap-4 sm:gap-8 min-w-0">
          <button onClick={onBack} className="flex items-center gap-2 cursor-pointer group shrink-0">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center group-hover:opacity-80 transition-opacity"
              style={{ backgroundColor: theme.logoBgColor }}
            >
              <span className="text-[10px] font-bold leading-none" style={{ color: contrastText(theme.logoBgColor) }}>
                {initials(saloon.name)}
              </span>
            </div>
            <span className="text-sm font-bold truncate" style={{ color: headerText }}>{saloon.name}</span>
          </button>

          <nav className="flex items-center gap-4 sm:gap-6 text-sm min-w-0">
            <button
              onClick={onBack}
              className="no-underline transition-colors font-medium text-slate-500 hover:text-slate-900 cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Back to website</span>
              <span className="sm:hidden">Back</span>
            </button>
            {featurePages.map((fp) => (
              <a
                key={fp.hash}
                href={`#${fp.hash}`}
                className="hidden md:inline no-underline transition-colors font-medium text-slate-500 hover:text-slate-900"
              >
                {fp.label}
              </a>
            ))}
          </nav>
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
          {current === "book" ? (
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ backgroundColor: `${theme.accentColor}18`, color: theme.accentColor }}
            >
              <CalendarCheck className="w-3.5 h-3.5" /> Book appointment
            </span>
          ) : hasBooking ? (
            <a href="#book"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl no-underline transition-opacity hover:opacity-80"
              style={{ backgroundColor: theme.accentColor, color: accentText }}>
              Book now
            </a>
          ) : null}
        </div>
      </div>
    </header>
  );
}

/** Footer identical to the landing page footer (hours, contact, address). */
export function SiteFooter({
  saloon, theme, current, onBack,
}: {
  saloon: Saloon;
  theme: WebsiteTheme;
  current: string;
  onBack: () => void;
}) {
  const accentText = contrastText(theme.accentColor);
  const hasBooking = saloon.features?.includes("BOOKING");
  const todayName  = DAY_ORDER[new Date().getDay()];
  const openHours  = saloon.operatingHours?.filter((h) => !h.closed) ?? [];
  const city       = [saloon.location?.city, saloon.location?.country].filter(Boolean).join(", ");

  const footerBg      = theme.footerBg ?? "#1E293B";
  const footerIsLight = isLightColor(footerBg);
  const footerText    = footerIsLight ? "#374151" : "#CBD5E1";
  const footerBright  = footerIsLight ? "#111827" : "#FFFFFF";
  const footerDim     = footerIsLight ? "#9CA3AF" : "#64748B";
  const footerBorder  = footerIsLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.08)";

  return (
    <footer className="mt-auto" style={{ backgroundColor: footerBg, color: footerText, ...(footerIsLight ? { borderTop: "1px solid #E2E8F0" } : {}) }}>
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
            {current === "book" ? (
              <button
                onClick={onBack}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
                style={{ backgroundColor: theme.accentColor, color: accentText }}
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to website
              </button>
            ) : hasBooking ? (
              <a
                href="#book"
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg no-underline hover:opacity-90 transition-opacity"
                style={{ backgroundColor: theme.accentColor, color: accentText }}
              >
                <CalendarCheck className="w-3.5 h-3.5" /> Book now
              </a>
            ) : null}
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
  );
}
