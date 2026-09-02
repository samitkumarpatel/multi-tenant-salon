/**
 * Customer-facing booking wizard — themed by the salon's Design settings.
 * Shared by the /:salonId/book route and the salon website's #book hash view.
 *
 * Steps:
 *  1 – Pick a service   (skipped when initialServiceId is valid)
 *  2 – Pick a date (+ optional staff member). Three views:
 *      "Pick a date" (date input → step 3), "Week view" (Teams-style week grid),
 *      or "By stylist" (date + time-per-stylist grid). Grid views pick date + time
 *      in one go and skip step 3.
 *  3 – Pick an available time slot
 *  4 – Enter contact details
 *  5 – Confirmation
 */

import React, { useState, useEffect } from "react";
import {
  ArrowLeft, ArrowRight, CalendarCheck, Users, Clock, Check, Search,
} from "lucide-react";
import { apiFetch, API_BASE } from "./api";
import { SiteHeader, SiteFooter } from "./SiteChrome";
import { CATEGORY_LABEL, STAFF_ROLE_LABEL, isVideoUrl, formatPrice } from "./constants";
import { CategoryIcon } from "./CategoryIcon";
import { fontStack, loadGoogleFont, contrastText } from "./theme";
import PhoneInput from "./PhoneInput";
import { type ClosureRange, isClosedByRange, resolveHolidayRanges } from "./bookingDates";
import type {
  Salon, ServiceItem, StaffMember, AvailableSlot, Booking, WebsiteTheme, OperatingHours, Country, SalonHoliday,
} from "./types";

const CUSTOMER_API = `${API_BASE}/api/salon`;

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function fmtDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric",
  });
}

function initials(name: string) {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

/** The staff member's profile avatar, falling back to the first image (not video)
 *  from their work gallery when no dedicated avatar is set. */
function staffAvatar(m: { workMedia?: string[]; avatarUrl?: string }) {
  return (m.avatarUrl && !isVideoUrl(m.avatarUrl) ? m.avatarUrl : undefined)
    ?? (m.workMedia ?? []).find((u) => !isVideoUrl(u));
}

const inputCls =
  "w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm outline-none transition bg-white text-slate-900 focus:ring-2 placeholder:text-slate-300 hover:border-slate-300";

type Accent = { color: string; text: string; tint: string; border: string };

/** Shared style for the primary CTA — accent fill + soft glow */
const primaryBtnCls =
  "rounded-xl text-sm font-semibold cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2";
const primaryBtnStyle = (accent: Accent, enabled = true) => ({
  backgroundColor: accent.color,
  color: accent.text,
  boxShadow: enabled ? `0 8px 20px -8px ${accent.color}aa` : "none",
});

const backBtnCls =
  "flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer";

// ── Step indicator ────────────────────────────────────────────────────────────

const STEP_LABELS = ["Service", "Date", "Time", "Details"];

function StepBar({ current, accent }: { current: number; accent: Accent }) {
  return (
    <div className="flex items-center gap-1.5 justify-center mb-4">
      {STEP_LABELS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <div key={n} className="flex items-center gap-1.5">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${active ? "scale-110" : ""}`}
                style={
                  done
                    ? { backgroundColor: accent.color, color: accent.text }
                    : active
                    ? { backgroundColor: accent.tint, color: accent.color, boxShadow: `0 0 0 2px ${accent.color}, 0 4px 12px -2px ${accent.color}66` }
                    : { backgroundColor: "#f1f5f9", color: "#94a3b8" }
                }
              >
                {done ? <Check className="w-4 h-4" /> : n}
              </div>
              <span
                className="text-[9px] font-semibold uppercase tracking-wider transition-colors duration-300"
                style={{ color: active ? accent.color : done ? "#475569" : "#cbd5e1" }}
              >
                {label}
              </span>
            </div>
            {n < STEP_LABELS.length && (
              <div className="h-1 w-8 mb-4 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ backgroundColor: accent.color, width: done ? "100%" : "0%" }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Running selection summary ─────────────────────────────────────────────────

function SelectionSummary({
  service, date, slot, staffName, accent,
}: {
  service: ServiceItem | null;
  date: string;
  slot: AvailableSlot | null;
  staffName?: string;
  accent: Accent;
}) {
  const chips = [
    service && `${service.name} · ${formatPrice(service.price, service.currency)}`,
    date && fmtDate(date),
    slot && fmt12(slot.startTime),
    staffName,
  ].filter(Boolean) as string[];
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 mb-6">
      {chips.map((c) => (
        <span
          key={c}
          className="text-[11px] font-semibold px-2.5 py-1 rounded-full border"
          style={{ backgroundColor: accent.tint, color: accent.color, borderColor: accent.border }}
        >
          {c}
        </span>
      ))}
    </div>
  );
}

// ── Step 1: Service selection ─────────────────────────────────────────────────

function StepService({
  services, selected, accent, onSelect, onNext,
}: {
  services: ServiceItem[];
  selected: ServiceItem | null;
  accent: Accent;
  onSelect: (s: ServiceItem) => void;
  onNext: () => void;
}) {
  const [query, setQuery] = useState("");

  const single = services.length === 1;
  const showSearch = services.length > 5;

  useEffect(() => {
    if (single) onSelect(services[0]);
  }, [single, services, onSelect]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? services.filter((s) =>
        [s.name, s.description ?? "", CATEGORY_LABEL[s.category] ?? s.category]
          .some((f) => f.toLowerCase().includes(q))
      )
    : services;

  return (
    <div>
      <h2 className="text-lg font-bold text-slate-900 mb-1">Choose a service</h2>
      <p className="text-sm text-slate-500 mb-4">Select the service you'd like to book.</p>

      {services.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-10">No services available yet.</p>
      ) : (
        <>
          {/* Search — only shown when more than 5 services */}
          {showSearch && (
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search services…"
                className={`${inputCls} pl-9`}
                style={{ ["--tw-ring-color" as string]: `${accent.color}33` }}
              />
              {q && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400">
                  {filtered.length} {filtered.length === 1 ? "match" : "matches"}
                </span>
              )}
            </div>
          )}

          {filtered.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-10">
              No services match "{query}".
            </p>
          ) : (
            <div className="relative">
              <div className="space-y-2 overflow-y-auto pr-1 max-h-[45vh] sm:max-h-[400px]">
                {filtered.map((s) => {
                  const isSel = selected?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => onSelect(s)}
                      className="w-full text-left p-4 rounded-xl border transition-colors cursor-pointer bg-white hover:border-slate-300"
                      style={isSel ? { borderColor: accent.color, backgroundColor: accent.tint, boxShadow: `0 0 0 1px ${accent.color}` } : { borderColor: "#e2e8f0" }}
                    >
                      <div className="flex items-start gap-3">
                        {/* Radio indicator */}
                        <span
                          className="w-4 h-4 mt-0.5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors"
                          style={isSel ? { borderColor: accent.color, backgroundColor: accent.color } : { borderColor: "#cbd5e1" }}
                        >
                          {isSel && <Check className="w-2.5 h-2.5" style={{ color: accent.text }} />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <p className="font-semibold text-slate-900 text-sm">{s.name}</p>
                            <p className="font-bold text-sm shrink-0 tabular-nums" style={{ color: accent.color }}>
                              {formatPrice(s.price, s.currency)}
                            </p>
                          </div>
                          {s.description && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{s.description}</p>}
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {s.durationMinutes} min
                            </span>
                            <span className="inline-flex items-center gap-1 text-[0.65rem] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                              <CategoryIcon category={s.category} className="w-3 h-3" />
                              {CATEGORY_LABEL[s.category] ?? s.category}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {/* Scroll-hint gradient — visible when list overflows */}
              {services.length > 4 && (
                <div className="pointer-events-none absolute bottom-0 left-0 right-1 h-10 bg-gradient-to-t from-white to-transparent" />
              )}
            </div>
          )}
        </>
      )}

      {/* Sticky Next button — sticks to bottom of the main scroll area */}
      <div className="sticky bottom-0 -mx-5 sm:-mx-6 -mb-5 sm:-mb-6 mt-4 bg-white border-t border-slate-100 rounded-b-2xl px-5 sm:px-6 pb-5 sm:pb-6 pt-3">
        <button
          onClick={onNext}
          disabled={!selected}
          className={`w-full py-3 ${primaryBtnCls}`}
          style={primaryBtnStyle(accent, !!selected)}
        >
          Next <ArrowRight className="w-4 h-4" />
        </button>
        {!selected && (
          <p className="text-center text-[11px] text-slate-400 mt-2">Select a service above to continue</p>
        )}
      </div>
    </div>
  );
}

// ── Week availability grid (Teams/Outlook-style: days as columns) ────────────

const JS_DAY_NAME = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

const pad2 = (n: number) => String(n).padStart(2, "0");
const toISODate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** Monday of the week containing `d` */
function mondayOf(d: Date) {
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}

/** Drop slots that are already in the past when `date` is today */
function futureSlots(date: string, slots: AvailableSlot[]): AvailableSlot[] {
  if (date !== toISODate(new Date())) return slots;
  const now = new Date().toTimeString().slice(0, 8);
  return slots.filter((s) => s.startTime > now);
}

/**
 * Deduplicate slots by startTime, preferring available (booked=false) over booked ones.
 * Used in views where we show one slot per time regardless of which staff member fills it.
 */
function dedupeByTime(slots: AvailableSlot[]): AvailableSlot[] {
  const map = new Map<string, AvailableSlot>();
  for (const s of slots) {
    const existing = map.get(s.startTime);
    if (!existing || existing.booked) map.set(s.startTime, s);
  }
  return [...map.values()];
}

/**
 * Default booking date: today — unless the salon is closed today or already
 * past closing time, in which case the next working day is used.
 */
function defaultBookingDate(hours: OperatingHours[]): string {
  const now = new Date();
  const byDay = new Map(hours.map((h) => [h.day, h]));
  for (let i = 0; i < 14; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const h = byDay.get(JS_DAY_NAME[d.getDay()]);
    if (!h) { if (hours.length === 0) return toISODate(d); continue; } // no schedule for this day
    if (h.closed) continue;
    // Today: skip if we're already past closing time
    if (i === 0 && h.closeTime && now.toTimeString().slice(0, 8) >= h.closeTime) continue;
    return toISODate(d);
  }
  return toISODate(now);
}

function WeekGrid({
  salonId, serviceId, staffId, date, setDate, selectedSlot, accent, closedDays, closedDateRanges, maxDate, onPick,
}: {
  salonId: string;
  serviceId: number;
  staffId: number | null;
  date: string;
  setDate: (d: string) => void;
  selectedSlot: AvailableSlot | null;
  accent: Accent;
  /** Weekday names (e.g. "MONDAY") on which the salon is closed */
  closedDays: Set<string>;
  closedDateRanges: ClosureRange[];
  maxDate: Date;
  onPick: (date: string, slot: AvailableSlot) => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [weekStart, setWeekStart] = useState(() => mondayOf(date ? new Date(`${date}T00:00:00`) : today));
  const [slotsByDate, setSlotsByDate] = useState<Record<string, AvailableSlot[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const canPrev = weekStart > mondayOf(today);
  const canNext = days[6] < maxDate;
  const rangeLabel = `${days[0].toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${days[6].toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const fetchable = days.filter((d) => d >= today && !closedDays.has(JS_DAY_NAME[d.getDay()]) && !isClosedByRange(toISODate(d), closedDateRanges));
    Promise.all(
      fetchable.map((d) => {
        const iso = toISODate(d);
        const params = new URLSearchParams({ serviceId: String(serviceId), date: iso });
        if (staffId) params.set("staffId", String(staffId));
        return apiFetch<AvailableSlot[]>(`${CUSTOMER_API}/${salonId}/booking/slots?${params}`)
          .then((slots) => [iso, futureSlots(iso, slots)] as const)
          .catch(() => [iso, []] as const);
      })
    )
      .then((entries) => { if (!cancelled) setSlotsByDate(Object.fromEntries(entries)); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load availability"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salonId, serviceId, staffId, weekStart.getTime()]);

  const hasAny = Object.values(slotsByDate).some((s) => s.length > 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3">
      {/* Week navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setWeekStart((w) => { const p = new Date(w); p.setDate(p.getDate() - 7); return p; })}
          disabled={!canPrev}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          aria-label="Previous week"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-sm font-bold text-slate-900">{rangeLabel}</span>
        <button
          type="button"
          onClick={() => setWeekStart((w) => { const n = new Date(w); n.setDate(n.getDate() + 7); return n; })}
          disabled={!canNext}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          aria-label="Next week"
        >
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Day columns */}
      <div className="overflow-x-auto -mx-3 px-3">
      <div className="grid grid-cols-7 gap-1 min-w-[280px]">
        {days.map((d) => {
          const iso      = toISODate(d);
          const isPast   = d < today;
          const isBeyond = d > maxDate;
          const isClosed = closedDays.has(JS_DAY_NAME[d.getDay()]) || isClosedByRange(iso, closedDateRanges);
          const isToday  = d.getTime() === today.getTime();
          const isSelDay = date === iso;
          const slots     = slotsByDate[iso] ?? [];
          const available = slots.filter((s) => !s.booked).length;
          const clickable = !isPast && !isBeyond && !isClosed && (loading || slots.length > 0);
          return (
            <div key={iso} className="min-w-0">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => setDate(iso)}
                className={`w-full flex flex-col items-center py-1.5 mb-1 rounded-lg transition-all ${clickable ? "cursor-pointer hover:bg-slate-100" : "cursor-not-allowed opacity-60"}`}
                style={
                  isSelDay
                    ? { backgroundColor: accent.tint, boxShadow: `inset 0 0 0 1.5px ${accent.color}` }
                    : isToday
                    ? { backgroundColor: accent.tint }
                    : {}
                }
                title={clickable ? `Show times for ${d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}` : undefined}
              >
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  {d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2)}
                </span>
                <span
                  className="text-sm font-bold"
                  style={{ color: isSelDay || isToday ? accent.color : isPast || isBeyond || isClosed ? "#cbd5e1" : "#0f172a" }}
                >
                  {d.getDate()}
                </span>
                {/* Availability hint — times for the selected day show below */}
                <span className="text-[9px] font-semibold mt-0.5" style={{ color: !clickable || loading ? "#e2e8f0" : available > 0 ? accent.color : "#cbd5e1" }}>
                  {isClosed && !isPast ? "Closed" : isPast || isBeyond ? "—" : loading ? "·" : available > 0 ? `${available} free` : slots.length > 0 ? "Full" : "—"}
                </span>
              </button>
            </div>
          );
        })}
      </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-6">
          <div className="w-6 h-6 border-2 rounded-full animate-spin"
            style={{ borderColor: accent.tint, borderTopColor: accent.color }} />
        </div>
      )}
      {error && <p className="text-xs text-red-500 text-center py-4">{error}</p>}
      {!loading && !error && !hasAny && (
        <p className="text-xs text-slate-400 text-center py-4">No availability this week — try the next one.</p>
      )}

      {/* Times for the clicked day */}
      {!loading && !error && date && slotsByDate[date] !== undefined && (
        <div className="mt-3 pt-3 border-t border-slate-100" key={date} style={{ animation: "fade-in 0.25s ease-out both" }}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
            Times · {fmtDate(date)}
          </p>
          {(slotsByDate[date] ?? []).length === 0 ? (
            <p className="text-xs text-slate-400">No available times on this day.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              {dedupeByTime(slotsByDate[date] ?? []).map((s) => {
                const isSel = selectedSlot?.startTime === s.startTime;
                const isBooked = s.booked;
                return (
                  <button
                    key={s.startTime}
                    type="button"
                    onClick={() => !isBooked && onPick(date, s)}
                    disabled={isBooked}
                    className={`py-2 rounded-lg text-xs font-semibold transition-all border ${isBooked ? "cursor-not-allowed" : "cursor-pointer hover:scale-[1.04]"}`}
                    style={
                      isBooked
                        ? { backgroundColor: "#f1f5f9", color: "#94a3b8", borderColor: "#e2e8f0" }
                        : isSel
                        ? { backgroundColor: accent.color, color: accent.text, borderColor: accent.color }
                        : { backgroundColor: accent.tint, color: accent.color, borderColor: "transparent" }
                    }
                    title={isBooked ? `${fmt12(s.startTime)} – Booked` : `${fmt12(s.startTime)} – ${fmt12(s.endTime)}`}
                  >
                    {isBooked ? <span className="line-through opacity-60">{fmt12(s.startTime)}</span> : fmt12(s.startTime)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Month calendar (compact date picker) ─────────────────────────────────────

function MonthCalendar({
  date, setDate, accent, closedDays, closedDateRanges, maxDate,
}: {
  date: string;
  setDate: (d: string) => void;
  accent: Accent;
  closedDays: Set<string>;
  closedDateRanges: ClosureRange[];
  maxDate: Date;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sel = date ? new Date(`${date}T00:00:00`) : today;
  const [month, setMonth] = useState(() => new Date(sel.getFullYear(), sel.getMonth(), 1));
  const canPrev = month > new Date(today.getFullYear(), today.getMonth(), 1);
  const canNext = new Date(month.getFullYear(), month.getMonth() + 1, 1) <= new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
  const offset = (month.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          disabled={!canPrev}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          aria-label="Previous month"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-sm font-bold text-slate-900">
          {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </span>
        <button
          type="button"
          onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          disabled={!canNext}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          aria-label="Next month"
        >
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((w) => (
          <span key={w} className="text-[9px] font-bold uppercase tracking-wider text-slate-400 text-center py-1">{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {Array.from({ length: offset }).map((_, i) => <span key={`x${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const d = new Date(month.getFullYear(), month.getMonth(), i + 1);
          const iso = toISODate(d);
          const disabled = d < today || d > maxDate || closedDays.has(JS_DAY_NAME[d.getDay()]) || isClosedByRange(iso, closedDateRanges);
          const isSel = date === iso;
          const isToday = d.getTime() === today.getTime();
          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => setDate(iso)}
              className={`h-8 w-8 mx-auto rounded-full text-xs font-semibold transition-colors flex items-center justify-center ${
                disabled ? "text-slate-300 cursor-not-allowed" : "cursor-pointer hover:bg-slate-100 text-slate-700"
              }`}
              style={
                isSel
                  ? { backgroundColor: accent.color, color: accent.text }
                  : isToday
                  ? { boxShadow: `inset 0 0 0 1.5px ${accent.color}`, color: accent.color }
                  : {}
              }
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Designer/day grid (X axis = time, Y axis = designer) ─────────────────────

function DesignerGrid({
  salonId, serviceId, staff, date, selectedSlot, accent, closedDays, closedDateRanges, onPick,
}: {
  salonId: string;
  serviceId: number;
  staff: StaffMember[];
  date: string;
  selectedSlot: AvailableSlot | null;
  accent: Accent;
  closedDays: Set<string>;
  closedDateRanges: ClosureRange[];
  onPick: (date: string, slot: AvailableSlot) => void;
}) {
  const [slots, setSlots] = useState<AvailableSlot[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isClosed = date
    ? closedDays.has(JS_DAY_NAME[new Date(`${date}T00:00:00`).getDay()]) || isClosedByRange(date, closedDateRanges)
    : false;

  useEffect(() => {
    if (!date || isClosed) { setSlots(null); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ serviceId: String(serviceId), date });
    apiFetch<AvailableSlot[]>(`${CUSTOMER_API}/${salonId}/booking/slots?${params}`)
      .then((s) => { if (!cancelled) setSlots(futureSlots(date, s)); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load availability"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [salonId, serviceId, date, isClosed]);

  // X axis: sorted union of start times; Y axis: designers
  const times = slots ? [...new Set(slots.map((s) => s.startTime))].sort() : [];
  const byStaff = new Map<number, Map<string, AvailableSlot>>();
  for (const s of slots ?? []) {
    if (!byStaff.has(s.staffId)) byStaff.set(s.staffId, new Map());
    byStaff.get(s.staffId)!.set(s.startTime, s);
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3">
      {!date && <p className="text-xs text-slate-400 text-center py-6">Pick a date to see each stylist's availability.</p>}
        {date && isClosed && <p className="text-xs text-slate-400 text-center py-6">The salon is closed on {fmtDate(date)} — try another date.</p>}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 rounded-full animate-spin"
              style={{ borderColor: accent.tint, borderTopColor: accent.color }} />
          </div>
        )}
        {error && <p className="text-xs text-red-500 text-center py-6">{error}</p>}

        {!loading && !error && date && !isClosed && slots !== null && (
          times.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">No available times on {fmtDate(date)} — try another date.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
            <div style={{ minWidth: `calc(3.25rem + ${staff.length} * 5rem)` }}>
              {/* Header: time gutter + one column per designer, stretching full width */}
              <div
                className="grid bg-slate-50/70 border-b border-slate-200"
                style={{ gridTemplateColumns: `3.25rem repeat(${staff.length}, minmax(0, 1fr))` }}
              >
                <div />
                {staff.map((m) => (
                  <div key={m.id} className="flex flex-col items-center gap-1 py-2.5 px-1 border-l border-slate-200 min-w-0">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 overflow-hidden"
                      style={{ backgroundColor: accent.tint, color: accent.color }}
                    >
                      {staffAvatar(m) ? (
                        <img src={staffAvatar(m)} alt={m.name}
                          className="w-full h-full object-cover" loading="lazy"
                          onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      ) : (
                        initials(m.name)
                      )}
                    </div>
                    <p className="text-xs font-semibold text-slate-800 truncate max-w-full">{m.name}</p>
                    <p className="text-[9px] text-slate-400 truncate max-w-full -mt-1">{STAFF_ROLE_LABEL[m.role] ?? m.role}</p>
                  </div>
                ))}
              </div>

              {/* Time rows */}
              {times.map((t, ri) => (
                <div
                  key={t}
                  className={`grid ${ri > 0 ? "border-t border-slate-100" : ""}`}
                  style={{ gridTemplateColumns: `3.25rem repeat(${staff.length}, minmax(0, 1fr))` }}
                >
                  <div className="flex items-center justify-end pr-2">
                    <span className="text-[10px] font-semibold text-slate-400 tabular-nums">{t.slice(0, 5)}</span>
                  </div>
                  {staff.map((m) => {
                    const slot = byStaff.get(m.id)?.get(t);
                    if (!slot) {
                      return (
                        <div key={m.id} className="h-10 border-l border-slate-100 p-0.5">
                          <button
                            type="button"
                            disabled
                            aria-disabled="true"
                            className="w-full h-full rounded-md text-[10px] font-semibold cursor-not-allowed flex items-center justify-center bg-slate-100 text-slate-300"
                            title={`${m.name} · ${t.slice(0, 5)} unavailable`}
                          >
                            Unavailable
                          </button>
                        </div>
                      );
                    }
                    if (slot.booked) {
                      return (
                        <div key={m.id} className="h-10 border-l border-slate-100 p-0.5">
                          <button
                            type="button"
                            disabled
                            aria-disabled="true"
                            className="w-full h-full rounded-md text-[10px] font-semibold cursor-not-allowed flex items-center justify-center bg-slate-50 text-slate-400 line-through"
                            title={`${m.name} · ${fmt12(slot.startTime)} – Booked`}
                          >
                            Booked
                          </button>
                        </div>
                      );
                    }
                    const isSel = selectedSlot?.staffId === slot.staffId && selectedSlot?.startTime === slot.startTime;
                    return (
                      <div key={m.id} className="h-10 border-l border-slate-100 p-0.5">
                        <button
                          type="button"
                          onClick={() => onPick(date, slot)}
                          className="w-full h-full rounded-md text-[10px] font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1"
                          style={
                            isSel
                              ? { backgroundColor: accent.color, color: accent.text }
                              : { backgroundColor: accent.tint, color: accent.color, boxShadow: `inset 2px 0 0 ${accent.color}` }
                          }
                          title={`${m.name} · ${fmt12(slot.startTime)} – ${fmt12(slot.endTime)}`}
                        >
                          {isSel ? <><Check className="w-3 h-3" /> Selected</> : "Available"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            </div>
          )
        )}
    </div>
  );
}

// ── Inline day slots (auto-loads for the picked date + staff) ────────────────

function DaySlots({
  salonId, serviceId, date, staffId, staff, selectedSlot, accent, closedDays, closedDateRanges, onPick,
}: {
  salonId: string;
  serviceId: number;
  date: string;
  staffId: number | null;
  staff: StaffMember[];
  selectedSlot: AvailableSlot | null;
  accent: Accent;
  closedDays: Set<string>;
  closedDateRanges: ClosureRange[];
  onPick: (date: string, slot: AvailableSlot) => void;
}) {
  const [slots, setSlots] = useState<AvailableSlot[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const staffMap = new Map(staff.map((s) => [s.id, s]));

  const isClosed = date
    ? closedDays.has(JS_DAY_NAME[new Date(`${date}T00:00:00`).getDay()]) || isClosedByRange(date, closedDateRanges)
    : false;

  useEffect(() => {
    if (!date || isClosed) { setSlots(null); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ serviceId: String(serviceId), date });
    if (staffId) params.set("staffId", String(staffId));
    apiFetch<AvailableSlot[]>(`${CUSTOMER_API}/${salonId}/booking/slots?${params}`)
      .then((s) => { if (!cancelled) setSlots(futureSlots(date, s)); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load slots"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [salonId, serviceId, date, staffId, isClosed]);

  const groups: [string, AvailableSlot[]][] = slots
    ? (
        [
          ["Morning",   slots.filter((s) => Number(s.startTime.split(":")[0]) < 12)],
          ["Afternoon", slots.filter((s) => { const h = Number(s.startTime.split(":")[0]); return h >= 12 && h < 17; })],
          ["Evening",   slots.filter((s) => Number(s.startTime.split(":")[0]) >= 17)],
        ] as [string, AvailableSlot[]][]
      ).filter(([, list]) => list.length > 0)
    : [];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
        Available times{date ? ` · ${fmtDate(date)}` : ""}
        {staffId && staffMap.get(staffId) ? ` · ${staffMap.get(staffId)!.name}` : ""}
      </p>

      {!date && <p className="text-xs text-slate-400 py-4 text-center">Pick a date to see available times.</p>}
      {date && isClosed && <p className="text-xs text-slate-400 py-4 text-center">The salon is closed on {fmtDate(date)} — pick another date.</p>}

      {loading && (
        <div className="flex items-center justify-center py-6">
          <div className="w-6 h-6 border-2 rounded-full animate-spin"
            style={{ borderColor: accent.tint, borderTopColor: accent.color }} />
        </div>
      )}
      {error && <p className="text-xs text-red-500 py-4 text-center">{error}</p>}

      {!loading && !error && date && !isClosed && slots !== null && (
        slots.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">No available times on {fmtDate(date)} — try another date.</p>
        ) : (
          <div className="space-y-4">
            {groups.map(([label, list]) => (
              <div key={label}>
                <p className="text-[10px] font-semibold text-slate-400 mb-1.5">{label}</p>
                <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-1.5">
                  {dedupeByTime(list).map((s) => {
                    const member = staffMap.get(s.staffId);
                    const isSel = selectedSlot?.startTime === s.startTime;
                    const isBooked = s.booked;
                    return (
                      <button
                        key={s.startTime}
                        type="button"
                        onClick={() => !isBooked && onPick(date, s)}
                        disabled={isBooked}
                        className={`py-2 rounded-lg text-xs font-semibold transition-all border flex flex-col items-center ${isBooked ? "cursor-not-allowed" : "cursor-pointer hover:scale-[1.03]"}`}
                        style={
                          isBooked
                            ? { backgroundColor: "#f1f5f9", color: "#94a3b8", borderColor: "#e2e8f0" }
                            : isSel
                            ? { backgroundColor: accent.color, color: accent.text, borderColor: accent.color }
                            : { backgroundColor: accent.tint, color: accent.color, borderColor: "transparent" }
                        }
                        title={isBooked ? `${fmt12(s.startTime)} – Booked` : `${fmt12(s.startTime)} – ${fmt12(s.endTime)}${member ? ` · ${member.name}` : ""}`}
                      >
                        {isBooked ? <span className="line-through opacity-60">{fmt12(s.startTime)}</span> : fmt12(s.startTime)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

// ── Step 2: Date + staff selection ────────────────────────────────────────────

function StepDate({
  salonId, serviceId, staff, date, setDate, staffId, setStaffId, selectedSlot, accent, closedDays, closedDateRanges, maxDate, defaultMode = "designer", onBack, onNext, onPickSlot,
}: {
  salonId: string;
  serviceId: number;
  staff: StaffMember[];
  date: string;
  setDate: (d: string) => void;
  staffId: number | null;
  setStaffId: (id: number | null) => void;
  selectedSlot: AvailableSlot | null;
  accent: Accent;
  closedDays: Set<string>;
  closedDateRanges: ClosureRange[];
  maxDate: Date;
  /** Initial view — "week" when a stylist was preselected via "Book with me" */
  defaultMode?: "input" | "week" | "designer";
  onBack: () => void;
  onNext: () => void;
  /** Week view: picking a slot selects date + time in one go */
  onPickSlot: (date: string, slot: AvailableSlot) => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [dateMode, setDateMode] = useState<"input" | "week" | "designer">(defaultMode);
  const MODE_LABEL = { input: "Pick a date", week: "Week view", designer: "By stylist" } as const;
  const selStyle = { borderColor: accent.color, backgroundColor: accent.tint, boxShadow: `0 0 0 1px ${accent.color}` };
  const unselStyle = { borderColor: "#e2e8f0" };

  const staffPicker = staff.length > 0 && (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
        Preferred staff member <span className="font-normal normal-case">— optional</span>
      </label>
      <div className="flex flex-wrap gap-2">
        {/* Anyone available */}
        <button
          onClick={() => setStaffId(null)}
          className="relative flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all cursor-pointer hover:shadow-sm bg-white"
          style={staffId === null ? selStyle : unselStyle}
        >
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <span className="text-[11px] font-semibold text-slate-700 text-center w-14">Anyone</span>
          {staffId === null && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: accent.color }}>
              <Check className="w-3 h-3" style={{ color: accent.text }} />
            </span>
          )}
        </button>

        {staff.map((s) => (
          <button
            key={s.id}
            onClick={() => setStaffId(s.id)}
            className="relative flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all cursor-pointer hover:shadow-sm bg-white"
            style={staffId === s.id ? selStyle : unselStyle}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden shrink-0"
              style={{ backgroundColor: accent.tint, color: accent.color }}
            >
              {staffAvatar(s) ? (
                <img
                  src={staffAvatar(s)}
                  alt={s.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              ) : (
                initials(s.name)
              )}
            </div>
            <span className="text-[11px] font-semibold text-slate-700 text-center w-14 truncate">{s.name.split(" ")[0]}</span>
            <span className="text-[9px] text-slate-400 -mt-0.5 w-14 truncate text-center">{STAFF_ROLE_LABEL[s.role] ?? s.role}</span>
            {staffId === s.id && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: accent.color }}>
                <Check className="w-3 h-3" style={{ color: accent.text }} />
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-0.5">
        <h2 className="text-lg font-bold text-slate-900">Pick a date</h2>
        <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5 shrink-0">
          {(["designer", "week", "input"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setDateMode(m)}
              className="px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer"
              style={dateMode === m
                ? { backgroundColor: "#ffffff", color: accent.color, boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }
                : { color: "#64748b" }}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-slate-500 mb-3">
        {dateMode === "week"
          ? "Pick an available time straight from the week overview."
          : dateMode === "designer"
          ? "Pick a date, then choose a time with the stylist you prefer."
          : "Choose when you'd like your appointment."}
      </p>

      <div className="space-y-3 mb-4">
        {/* Staff selection comes first — who you want determines when they're free */}
        {dateMode !== "designer" && staffPicker}

        <div>
          <div className="mb-1.5">
            <label className="block text-sm font-medium text-slate-700">Date &amp; time <span className="text-red-500">*</span></label>
          </div>
          {dateMode === "week" ? (
            <WeekGrid
              salonId={salonId}
              serviceId={serviceId}
              staffId={staffId}
              date={date}
              setDate={setDate}
              selectedSlot={selectedSlot}
              accent={accent}
              closedDays={closedDays}
              closedDateRanges={closedDateRanges}
              maxDate={maxDate}
              onPick={onPickSlot}
            />
          ) : dateMode === "designer" ? (
            <div className="grid lg:grid-cols-[17rem_1fr] gap-3 items-start">
              <MonthCalendar
                date={date}
                setDate={setDate}
                accent={accent}
                closedDays={closedDays}
                closedDateRanges={closedDateRanges}
                maxDate={maxDate}
              />
              <DesignerGrid
                salonId={salonId}
                serviceId={serviceId}
                staff={staff}
                date={date}
                selectedSlot={selectedSlot}
                accent={accent}
                closedDays={closedDays}
                closedDateRanges={closedDateRanges}
                onPick={onPickSlot}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <MonthCalendar
                date={date}
                setDate={setDate}
                accent={accent}
                closedDays={closedDays}
                closedDateRanges={closedDateRanges}
                maxDate={maxDate}
              />
              <DaySlots
                salonId={salonId}
                serviceId={serviceId}
                date={date}
                staffId={staffId}
                staff={staff}
                selectedSlot={selectedSlot}
                accent={accent}
                closedDays={closedDays}
                closedDateRanges={closedDateRanges}
                onPick={onPickSlot}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className={backBtnCls}>
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex-1 flex items-center justify-center gap-1.5 text-xs text-slate-400">
          <Clock className="w-3.5 h-3.5" /> Select a time above to continue
        </div>
      </div>
    </div>
  );
}

// ── Step 3: Slot selection ────────────────────────────────────────────────────

function StepSlots({
  salonId, serviceId, date, staffId, staffMap, selectedSlot, accent, onSelect, onBack, onNext,
}: {
  salonId: string;
  serviceId: number;
  date: string;
  staffId: number | null;
  staffMap: Map<number, StaffMember>;
  selectedSlot: AvailableSlot | null;
  accent: Accent;
  onSelect: (s: AvailableSlot) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [slots, setSlots] = useState<AvailableSlot[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setSlots(null);
    const params = new URLSearchParams({ serviceId: String(serviceId), date });
    if (staffId) params.set("staffId", String(staffId));
    apiFetch<AvailableSlot[]>(`${CUSTOMER_API}/${salonId}/booking/slots?${params}`)
      .then((s) => setSlots(futureSlots(date, s)))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load slots"))
      .finally(() => setLoading(false));
  }, [salonId, serviceId, date, staffId]);

  // Group slots by morning / afternoon / evening for easier scanning
  const groups: [string, AvailableSlot[]][] = slots
    ? (
        [
          ["Morning",   slots.filter((s) => Number(s.startTime.split(":")[0]) < 12)],
          ["Afternoon", slots.filter((s) => { const h = Number(s.startTime.split(":")[0]); return h >= 12 && h < 17; })],
          ["Evening",   slots.filter((s) => Number(s.startTime.split(":")[0]) >= 17)],
        ] as [string, AvailableSlot[]][]
      ).filter(([, list]) => list.length > 0)
    : [];

  return (
    <div>
      <h2 className="text-lg font-bold text-slate-900 mb-1">Choose a time</h2>
      <p className="text-sm text-slate-500 mb-5">
        Available slots for <strong>{fmtDate(date)}</strong>
        {staffId && staffMap.get(staffId) ? ` with ${staffMap.get(staffId)!.name}` : ""}
      </p>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 rounded-full animate-spin"
            style={{ borderColor: accent.tint, borderTopColor: accent.color }} />
        </div>
      )}

      {error && <p className="text-sm text-red-500 text-center py-8">{error}</p>}

      {!loading && !error && slots !== null && (
        slots.length === 0 ? (
          <div className="text-center py-10">
            <CalendarCheck className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-500">No available slots for this date and service.</p>
            <p className="text-xs text-slate-400 mt-1">Try a different date or staff member.</p>
          </div>
        ) : (
          <div className="space-y-5 mb-6 overflow-y-auto pr-1 max-h-[380px]">
            {groups.map(([label, list]) => (
              <div key={label}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{label}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {list.map((s, i) => {
                    const member = staffMap.get(s.staffId);
                    const isSel = selectedSlot?.startTime === s.startTime && selectedSlot?.staffId === s.staffId;
                    const isBooked = s.booked;
                    return (
                      <button
                        key={`${s.staffId}-${s.startTime}-${i}`}
                        onClick={() => !isBooked && onSelect(s)}
                        disabled={isBooked}
                        className={`flex flex-col items-center p-3 rounded-xl border transition-all bg-white ${isBooked ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-slate-300 hover:shadow-sm hover:-translate-y-px"}`}
                        style={
                          isBooked
                            ? { borderColor: "#e2e8f0", backgroundColor: "#f8fafc" }
                            : isSel
                            ? { borderColor: accent.color, backgroundColor: accent.tint, boxShadow: `0 0 0 1px ${accent.color}` }
                            : { borderColor: "#e2e8f0" }
                        }
                        title={isBooked ? `${fmt12(s.startTime)} – Booked` : undefined}
                      >
                        <span className={`text-sm font-bold ${isBooked ? "text-slate-400 line-through" : "text-slate-900"}`}>{fmt12(s.startTime)}</span>
                        <span className="text-xs text-slate-400 mt-0.5">{isBooked ? "Booked" : fmt12(s.endTime)}</span>
                        {!staffId && member && !isBooked && (
                          <span className="text-[0.6rem] font-semibold mt-1 px-1.5 py-0.5 rounded-full"
                            style={{ backgroundColor: accent.tint, color: accent.color }}>
                            {member.name.split(" ")[0]}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      <div className="flex gap-3 mt-4">
        <button onClick={onBack} className={backBtnCls}>
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button onClick={onNext} disabled={!selectedSlot}
          className={`flex-1 py-3 ${primaryBtnCls}`}
          style={primaryBtnStyle(accent, !!selectedSlot)}>
          Continue <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Step 4: Customer details ──────────────────────────────────────────────────

function StepDetails({
  form, setForm, countries, salonCountry, accent, onBack, onSubmit, busy,
}: {
  form: { name: string; email: string; phone: string; notes: string };
  setForm: (f: { name: string; email: string; phone: string; notes: string }) => void;
  countries: Country[];
  salonCountry?: string;
  accent: Accent;
  onBack: () => void;
  onSubmit: () => void;
  busy: boolean;
}) {
  const [contactTab, setContactTab] = useState<"email" | "phone">("email");
  const ringStyle = { ["--tw-ring-color" as string]: `${accent.color}33` };

  function switchTab(tab: "email" | "phone") {
    setContactTab(tab);
    if (tab === "email") setForm({ ...form, phone: "" });
    else setForm({ ...form, email: "" });
  }

  const contactValid = contactTab === "email"
    ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
    : form.phone.trim().length > 4;
  const valid = form.name.trim() && contactValid;

  return (
    <div>
      <h2 className="text-lg font-bold text-slate-900 mb-1">Your details</h2>
      <p className="text-sm text-slate-500 mb-5">We'll use this to confirm your appointment.</p>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Full name <span className="text-red-500">*</span></label>
          <input className={inputCls} style={ringStyle} placeholder="Jane Smith" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>

        <div>
          <div className="flex rounded-xl bg-slate-100 p-1 mb-3 gap-1">
            {(["email", "phone"] as const).map((tab) => (
              <button key={tab} type="button" onClick={() => switchTab(tab)}
                className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all ${contactTab === tab ? "bg-white shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                style={contactTab === tab ? { color: accent.color } : {}}>
                {tab === "email" ? "Email" : "Phone"}
              </button>
            ))}
          </div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            {contactTab === "email" ? "Email address" : "Phone number"} <span className="text-red-500">*</span>
          </label>
          {contactTab === "email" ? (
            <input type="email" className={inputCls} style={ringStyle} placeholder="jane@example.com" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          ) : (
            <PhoneInput value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} countries={countries} defaultCountry={salonCountry} />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
          <textarea className={`${inputCls} resize-none`} style={ringStyle} rows={2} placeholder="Anything we should know?" value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className={backBtnCls}>
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button onClick={onSubmit} disabled={!valid || busy}
          className={`flex-1 py-3 ${primaryBtnCls}`}
          style={primaryBtnStyle(accent, !!valid && !busy)}>
          {busy ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Booking…</>
          ) : (
            <>Confirm booking <Check className="w-4 h-4" /></>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Step 5: Confirmation ──────────────────────────────────────────────────────

function StepConfirm({
  booking, service, staff, salon, accent, onExit, standalone = false,
}: {
  booking: Booking;
  service: ServiceItem;
  staff: StaffMember | undefined;
  salon: Salon;
  accent: Accent;
  onExit: () => void;
  standalone?: boolean;
}) {
  const isPending = booking.status === "PENDING";
  return (
    <div className="text-center" style={{ animation: "pop 0.4s ease-out both" }}>
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
        style={{ backgroundColor: accent.tint, boxShadow: `0 0 0 8px ${accent.color}0c` }}
      >
        <Check className="w-8 h-8" style={{ color: accent.color }} />
      </div>
      {isPending ? (
        <>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Request received!</h2>
          <p className="text-sm text-slate-500 mb-6">
            Your booking is <strong>pending confirmation</strong>. We'll notify <strong>{booking.customerEmail}</strong> once it's confirmed.
          </p>
        </>
      ) : (
        <>
          <h2 className="text-xl font-bold text-slate-900 mb-1">You're booked!</h2>
          <p className="text-sm text-slate-500 mb-6">
            A confirmation has been sent to <strong>{booking.customerEmail}</strong>.
          </p>
        </>
      )}

      <div className="rounded-2xl border border-slate-200 overflow-hidden mb-8 text-left shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: accent.tint }}>
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: accent.color }}>
            Appointment
          </span>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/70" style={{ color: accent.color }}>
            #{booking.id} · {isPending ? "Pending" : "Confirmed"}
          </span>
        </div>
        <div className="bg-white p-4 space-y-2.5">
          <Row label="Salon" value={salon.name} />
          <Row label="Service" value={`${service.name} (${service.durationMinutes} min)`} />
          <Row label="Date" value={fmtDate(booking.appointmentDate)} />
          <Row label="Time" value={`${fmt12(booking.startTime)} – ${fmt12(booking.endTime)}`} />
          {staff && <Row label="Staff" value={staff.name} />}
        </div>
      </div>

      <button
        onClick={onExit}
        className={`inline-flex px-6 py-3 ${primaryBtnCls}`}
        style={primaryBtnStyle(accent)}
      >
        {standalone
          ? <><CalendarCheck className="w-4 h-4" /> Book new appointment</>
          : <><ArrowLeft className="w-4 h-4" /> Back to {salon.name}</>}
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-semibold text-slate-400 w-24 shrink-0">{label}</span>
      <span className="text-sm text-slate-800 font-medium">{value}</span>
    </div>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────────

export function BookingWizard({
  salon, services, staff, theme, countries: countriesProp = [], initialServiceId = null, initialStaffId = null, onExit, onNavigate, getPagePath, standalone = false, headerExtra,
}: {
  salon: Salon;
  services: ServiceItem[];
  staff: StaffMember[];
  theme: WebsiteTheme;
  countries?: Country[];
  /** Preselects the service and starts at step 2 */
  initialServiceId?: number | null;
  /** Preselects the staff member ("Book with me") — calendar opens filtered to them */
  initialStaffId?: number | null;
  /** Called when the visitor leaves the wizard (logo / back after confirmation) */
  onExit: () => void;
  /** Client-side navigation for header feature links (Shop, Membership, etc.) */
  onNavigate?: (page: string) => void;
  /** Builds a path for a given page key (e.g. "shop" → "/shop") */
  getPagePath?: (page: string) => string;
  /** Hides "Back to website" chrome — use when serving from the standalone booking subdomain */
  standalone?: boolean;
  /** Extra content rendered in the header's right side (standalone mode only) */
  headerExtra?: React.ReactNode;
}) {
  const preselected = services.find((s) => s.id === initialServiceId) ?? null;
  const preStaff    = staff.find((s) => s.id === initialStaffId) ?? null;

  const [closedDateRanges, setClosedDateRanges] = useState<ClosureRange[]>([]);
  const [holidayRanges, setHolidayRanges] = useState<ClosureRange[]>([]);
  const [step, setStep] = useState(preselected ? 2 : 1);
  const [fetchedCountries, setFetchedCountries] = useState<Country[]>([]);
  const countries = countriesProp.length > 0 ? countriesProp : fetchedCountries;
  const [service, setService] = useState<ServiceItem | null>(preselected);
  const [date, setDate] = useState(() => defaultBookingDate(salon.operatingHours ?? [])); // today, or next working day if closed/past hours
  const [staffId, setStaffId] = useState<number | null>(preStaff?.id ?? null);
  const [slot, setSlot] = useState<AvailableSlot | null>(null);
  const [viaWeek, setViaWeek] = useState(false); // slot picked from the week grid (skips step 3)
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGoogleFont(theme.fontFamily);
  }, [theme.fontFamily]);

  useEffect(() => {
    if (countriesProp.length > 0) return;
    apiFetch<Country[]>(`${API_BASE}/api/salon-utility/countries`)
      .then(setFetchedCountries)
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    apiFetch<ClosureRange[]>(`${CUSTOMER_API}/${salon.id}/closures`)
      .then(setClosedDateRanges)
      .catch(() => {});
    apiFetch<SalonHoliday[]>(`${CUSTOMER_API}/${salon.id}/holidays`)
      .then((hs) => setHolidayRanges(resolveHolidayRanges(hs, maxDate)))
      .catch(() => {});
  }, [salon.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fontStackCss = fontStack(theme.fontFamily);
  const accent: Accent = {
    color:  theme.accentColor,
    text:   contrastText(theme.accentColor),
    tint:   `${theme.accentColor}18`,
    border: `${theme.accentColor}44`,
  };
  const staffMap = new Map(staff.map((s) => [s.id, s]));
  const bookableStaff = staff.filter((s) => s.availableForBooking !== false);
  const allClosedRanges = [...closedDateRanges, ...holidayRanges];
  const closedDays = new Set(
    (salon.operatingHours ?? []).filter((h) => h.closed).map((h) => h.day)
  );
  const maxDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + (salon.bookingAdvanceDays ?? 60));
    d.setHours(23, 59, 59, 999);
    return d;
  })();

  async function submitBooking() {
    if (!service || !slot) return;
    // Guard: never allow booking a time that has already passed
    if (new Date(`${date}T${slot.startTime}`) <= new Date()) {
      setError("That time has already passed — please pick another slot.");
      setSlot(null);
      setStep(2);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const booking = await apiFetch<Booking>(`${CUSTOMER_API}/${salon.id}/booking`, {
        method: "POST",
        body: JSON.stringify({
          serviceId: service.id,
          staffId: slot.staffId,
          customerName: form.name,
          customerEmail: form.email || null,
          customerPhone: form.phone || null,
          appointmentDate: date,
          startTime: slot.startTime,
          notes: form.notes || null,
        }),
      });
      setConfirmed(booking);
      setStep(5);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Booking failed";
      setError(
        /409|no longer available/i.test(msg)
          ? "Sorry, that slot was just taken. Please pick another time."
          : msg
      );
      if (/409|no longer available/i.test(msg)) {
        setSlot(null);
        setStep(viaWeek ? 2 : 3);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-[100dvh] bg-slate-50 flex flex-col overflow-hidden" style={{ fontFamily: fontStackCss }}>
      {/* Accent ribbon */}
      <div className="h-1 shrink-0" style={{ background: `linear-gradient(90deg, ${accent.color}, ${accent.color}88)` }} />

      {/* Header — same chrome as the salon website (Book link swapped for Back) */}
      <SiteHeader salon={salon} theme={theme} current="book" onBack={onExit} onNavigate={onNavigate} getPagePath={getPagePath} standalone={standalone} headerExtra={headerExtra} />

      {/* Body */}
      <main
        className="flex-1 flex items-start justify-center px-4 sm:px-6 py-4 sm:py-6 overflow-y-auto"
        style={{ background: `radial-gradient(80% 50% at 50% 0%, ${accent.color}0a, transparent 70%)` }}
      >
        {/* Step 2 hosts the calendar grids — stretch to align with header/footer */}
        <div className={`w-full transition-all duration-300 ${step === 2 ? "max-w-5xl" : "max-w-lg"}`}>
          {step < 5 && <StepBar current={step} accent={accent} />}
          {step < 5 && (
            <SelectionSummary
              service={service}
              date={step > 2 ? date : ""}
              slot={step > 3 ? slot : null}
              staffName={step > 3 && slot ? staffMap.get(slot.staffId)?.name : undefined}
              accent={accent}
            />
          )}

          {error && (
            <div
              className="mb-5 px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-sm text-red-700"
              style={{ animation: "shake 0.4s ease-in-out" }}
            >
              {error}
            </div>
          )}

          <div
            key={step}
            className={`relative ${step < 5 ? "bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6" : ""}`}
            style={{ animation: "fade-in 0.3s ease-out both" }}
          >
          {step === 1 && (
            <StepService
              services={services}
              selected={service}
              accent={accent}
              onSelect={(s) => { setService(s); setSlot(null); }}
              onNext={() => setStep(2)}
            />
          )}

          {step === 2 && service && (
            <StepDate
              salonId={String(salon.id)}
              serviceId={service.id}
              staff={bookableStaff}
              date={date}
              setDate={(d) => { setDate(d); setSlot(null); setViaWeek(false); }}
              staffId={staffId}
              setStaffId={(id) => { setStaffId(id); setSlot(null); }}
              selectedSlot={slot}
              accent={accent}
              closedDays={closedDays}
              closedDateRanges={allClosedRanges}
              maxDate={maxDate}
              defaultMode={preStaff ? "week" : "designer"}
              onBack={() => setStep(1)}
              onNext={() => { setViaWeek(false); setStep(3); }}
              onPickSlot={(d, s) => { setDate(d); setSlot(s); setViaWeek(true); setStep(4); }}
            />
          )}

          {step === 3 && service && (
            <StepSlots
              salonId={String(salon.id)}
              serviceId={service.id}
              date={date}
              staffId={staffId}
              staffMap={staffMap}
              selectedSlot={slot}
              accent={accent}
              onSelect={setSlot}
              onBack={() => setStep(2)}
              onNext={() => { setViaWeek(false); setStep(4); }}
            />
          )}

          {step === 4 && (
            <StepDetails
              form={form}
              setForm={setForm}
              countries={countries}
              salonCountry={salon.location?.country}
              accent={accent}
              onBack={() => setStep(viaWeek ? 2 : 3)}
              onSubmit={submitBooking}
              busy={busy}
            />
          )}

          {step === 5 && confirmed && service && (
            <StepConfirm
              booking={confirmed}
              service={service}
              staff={staffMap.get(confirmed.staffId)}
              salon={salon}
              accent={accent}
              standalone={standalone}
              onExit={onExit}
            />
          )}
          </div>
        </div>
      </main>

      {/* Footer — same chrome as the salon website */}
      <SiteFooter salon={salon} theme={theme} current="book" onBack={onExit} getPagePath={getPagePath} standalone={standalone} />
    </div>
  );
}
