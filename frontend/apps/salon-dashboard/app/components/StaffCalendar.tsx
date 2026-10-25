import { useI18n } from "@salon/i18n";
import type {
  Booking, OperatingHours, SalonClosure, SalonHoliday, ServiceItem, StaffMember,
} from "@salon/ui-website";
import { ChevronLeft, ChevronRight, Eye, EyeOff, Maximize2, Minimize2, Palette, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  JS_DAYS, STAFF_PALETTE, addDays, formatTime, hasBookableServiceAtTime, isSalonOpenAt, isTimeInPast, layoutLanes,
  localDateKey, parseDate, prettyDate, restrictionFor, staffColorMap, staffOffRanges, startOfWeek, toMinutes,
  withAlpha, type StaffScheduleData,
} from "~/lib/calendar";

type CalendarView = "day" | "week" | "month";
type DayLayout = "overall" | "stylist";

const HOUR_H = 56;
const SNAP_CLICK = 30;
const SNAP_DRAG = 15;
const FALLBACK_COLOR = "#94a3b8";
const PREFS_KEY = "desk-calendar-prefs";

interface Prefs { layout: DayLayout; showCancelled: boolean; hidden: number[] }

function loadPrefs(): Prefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Prefs>;
      return {
        layout: parsed.layout === "stylist" ? "stylist" : "overall",
        showCancelled: parsed.showCancelled === true,
        hidden: Array.isArray(parsed.hidden) ? parsed.hidden.filter((id): id is number => typeof id === "number") : [],
      };
    }
  } catch { /* storage unavailable — defaults */ }
  return { layout: "overall", showCancelled: false, hidden: [] };
}

function savePrefs(prefs: Prefs) {
  try { window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
}

export interface StaffCalendarProps {
  bookings: Booking[];
  staff: StaffMember[];
  services: ServiceItem[];
  operatingHours?: OperatingHours[];
  closures: SalonClosure[];
  holidays: SalonHoliday[];
  schedules: StaffScheduleData[];
  bookingAdvanceDays?: number;
  /** Chosen colours that are newer than the loaded staff list. */
  colorOverrides: Record<number, string | null | undefined>;
  searchParams: URLSearchParams;
  setSearchParams: (next: URLSearchParams) => void;
  onNew: (date: string, time?: string, staffId?: number) => void;
  onSelect: (booking: Booking) => void;
  /** Moves an appointment; rejects with a readable message when the server refuses. */
  onMove: (booking: Booking, target: { date: string; startTime: string; staffId: number }) => Promise<void>;
  onColorChange: (staffId: number, color: string | null) => Promise<void>;
}

interface Column {
  key: string;
  date: string;
  staff?: StaffMember;
  bookings: Booking[];
  label: React.ReactNode;
}

interface DragState { booking: Booking; grab: number }

/** Closed by the salon (holiday, closure, weekly day off) — as opposed to merely in the past or too far ahead. */
const isClosedDay = (restriction: string | null | undefined) =>
  Boolean(restriction) && restriction !== "Past date" && restriction !== "Outside booking window";

const canMove = (booking: Booking) =>
  (booking.status === "PENDING" || booking.status === "CONFIRMED") && !isTimeInPast(booking.appointmentDate, booking.endTime);

export function StaffCalendar(props: StaffCalendarProps) {
  const { bookings, staff, services, operatingHours, closures, holidays, schedules, bookingAdvanceDays, colorOverrides,
    searchParams, setSearchParams, onNew, onSelect, onMove, onColorChange } = props;
  const { t: translateUi } = useI18n();
  const [prefs, setPrefs] = useState<Prefs>({ layout: "overall", showCancelled: false, hidden: [] });
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [colorEditor, setColorEditor] = useState<number | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [drag, setDrag] = useState<DragState | null>(null);
  const [preview, setPreview] = useState<{ key: string; minutes: number } | null>(null);
  const [hover, setHover] = useState<{ key: string; minutes: number } | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // localStorage is read after mount so server and first client render agree.
  useEffect(() => { setPrefs(loadPrefs()); setPrefsLoaded(true); }, []);
  useEffect(() => { if (prefsLoaded) savePrefs(prefs); }, [prefs, prefsLoaded]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const view: CalendarView = (["day", "week", "month"] as const).find((v) => v === searchParams.get("cal")) ?? "day";
  const requestedDate = searchParams.get("date");
  const selectedDate = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : localDateKey();
  const selectedDay = parseDate(selectedDate);
  const today = localDateKey(now);

  const colors = useMemo(() => staffColorMap(staff, colorOverrides), [staff, colorOverrides]);
  const activeStaff = useMemo(() => staff.filter((member) => member.status === "ACTIVE"), [staff]);
  const staffMap = useMemo(() => new Map(staff.map((member) => [member.id, member])), [staff]);
  const serviceMap = useMemo(() => new Map(services.map((service) => [service.id, service.name])), [services]);
  const hidden = useMemo(() => new Set(prefs.hidden), [prefs.hidden]);
  const colorOf = (staffId: number) => colors.get(staffId) ?? FALLBACK_COLOR;

  function setParams(update: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams);
    params.set("view", "appointments");
    params.delete("range");
    update(params);
    setSearchParams(params);
  }
  const chooseDate = (date: string) => setParams((params) => params.set("date", date));
  const chooseView = (next: CalendarView) => setParams((params) => params.set("cal", next));
  const openDay = (date: string) => setParams((params) => { params.set("date", date); params.set("cal", "day"); });

  function step(direction: -1 | 1) {
    if (view === "day") return chooseDate(localDateKey(addDays(selectedDay, direction)));
    if (view === "week") return chooseDate(localDateKey(addDays(selectedDay, 7 * direction)));
    const next = new Date(selectedDay.getFullYear(), selectedDay.getMonth() + direction, 1, 12);
    chooseDate(localDateKey(next));
  }

  // ── Range, filtering ──────────────────────────────────────────────────────
  const weekStart = startOfWeek(selectedDay);
  const monthFirst = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), 1, 12);
  const monthGridStart = startOfWeek(monthFirst);
  const rangeDates = useMemo(() => {
    if (view === "day") return [selectedDate];
    if (view === "week") return Array.from({ length: 7 }, (_, i) => localDateKey(addDays(weekStart, i)));
    return Array.from({ length: 42 }, (_, i) => localDateKey(addDays(monthGridStart, i)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selectedDate]);

  const visible = useMemo(() => {
    const dates = new Set(rangeDates);
    return bookings.filter((booking) => dates.has(booking.appointmentDate)
      && !hidden.has(booking.staffId)
      && (prefs.showCancelled || booking.status !== "CANCELLED"));
  }, [bookings, rangeDates, hidden, prefs.showCancelled]);

  const restrictions = useMemo(() => new Map(rangeDates.map((date) =>
    [date, restrictionFor(date, operatingHours, closures, holidays, bookingAdvanceDays)])),
  [rangeDates, operatingHours, closures, holidays, bookingAdvanceDays]);

  // ── Time grid bounds ──────────────────────────────────────────────────────
  const { gridStart, gridEnd } = useMemo(() => {
    let open = Number.POSITIVE_INFINITY;
    let close = Number.NEGATIVE_INFINITY;
    for (const date of rangeDates) {
      const hours = operatingHours?.find((item) => item.day === JS_DAYS[parseDate(date).getDay()]);
      if (hours && !hours.closed) { open = Math.min(open, toMinutes(hours.openTime)); close = Math.max(close, toMinutes(hours.closeTime)); }
    }
    if (!Number.isFinite(open)) { open = 8 * 60; close = 20 * 60; }
    for (const booking of visible) {
      open = Math.min(open, toMinutes(booking.startTime));
      close = Math.max(close, toMinutes(booking.endTime));
    }
    return { gridStart: Math.floor(open / 60) * 60, gridEnd: Math.min(24 * 60, Math.ceil(close / 60) * 60) };
  }, [rangeDates, operatingHours, visible]);

  // Bring the working day into view: now when looking at today, otherwise the first appointment.
  useEffect(() => {
    if (view === "month" || !scrollRef.current) return;
    const first = visible.length ? Math.min(...visible.map((b) => toMinutes(b.startTime))) : gridStart;
    const focus = rangeDates.includes(today) ? now.getHours() * 60 + now.getMinutes() - 60 : first - 30;
    scrollRef.current.scrollTop = Math.max(0, ((Math.max(focus, gridStart) - gridStart) / 60) * HOUR_H);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selectedDate, prefs.layout]);

  // ── Columns ───────────────────────────────────────────────────────────────
  const columns: Column[] = useMemo(() => {
    if (view === "week") {
      return rangeDates.map((date) => ({
        key: date, date, bookings: visible.filter((b) => b.appointmentDate === date),
        label: <button type="button" onClick={() => openDay(date)} className="w-full text-center">
          <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">{prettyDate(parseDate(date), { weekday: "short" })}</span>
          <span className={`mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${date === today ? "bg-matcha-700 text-white" : "text-slate-700"}`}>{parseDate(date).getDate()}</span>
          {isClosedDay(restrictions.get(date)) && <span className="block max-w-full truncate text-[9px] font-semibold uppercase text-amber-600" title={restrictions.get(date) ?? undefined}>{restrictions.get(date)}</span>}
        </button>,
      }));
    }
    if (prefs.layout === "stylist") {
      return activeStaff.filter((member) => !hidden.has(member.id)).map((member) => {
        const own = visible.filter((b) => b.staffId === member.id);
        return {
          key: String(member.id), date: selectedDate, staff: member, bookings: own,
          label: <span className="flex min-w-0 items-center justify-center gap-2 text-xs font-bold text-slate-700">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: colorOf(member.id) }}>{initials(member.name)}</span>
            <span className="truncate">{member.name}</span><span className="shrink-0 font-normal text-slate-400">{own.filter((b) => b.status !== "CANCELLED").length}</span>
          </span>,
        };
      });
    }
    return [{ key: "all", date: selectedDate, bookings: visible, label: <span className="text-xs font-bold text-slate-700">{translateUi("All stylists")}</span> }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, prefs.layout, visible, activeStaff, hidden, selectedDate, colors, today, rangeDates, restrictions]);

  // ── Actions ───────────────────────────────────────────────────────────────
  function bookable(date: string, time: string, member?: StaffMember) {
    if (restrictions.get(date) || isTimeInPast(date, time) || !isSalonOpenAt(date, time, operatingHours)) return false;
    const dayBookings = bookings.filter((b) => b.appointmentDate === date);
    return (member ? [member] : activeStaff).some((m) => hasBookableServiceAtTime(m, date, time, schedules, services, dayBookings, operatingHours));
  }

  async function dropOn(column: Column, minutes: number) {
    if (!drag) return;
    const { booking } = drag;
    setDrag(null); setPreview(null);
    const target = { date: column.date, startTime: formatTime(minutes), staffId: column.staff?.id ?? booking.staffId };
    if (target.date === booking.appointmentDate && target.startTime === booking.startTime.slice(0, 5) && target.staffId === booking.staffId) return;
    const where = `${prettyDate(parseDate(target.date), { weekday: "short", day: "numeric", month: "short" })} ${target.startTime}${column.staff ? ` · ${column.staff.name}` : ""}`;
    if (!window.confirm(translateUi("Move {name} to {where}?", { name: booking.customerName, where }))) return;
    setMoveError(null);
    try { await onMove(booking, target); }
    catch (error) { setMoveError(error instanceof Error ? error.message : translateUi("Could not move the appointment.")); }
  }

  const minutesFromPointer = (event: React.DragEvent, element: HTMLElement, duration: number, grab: number) => {
    const top = event.clientY - element.getBoundingClientRect().top - grab;
    const snapped = Math.round(((top / HOUR_H) * 60) / SNAP_DRAG) * SNAP_DRAG + gridStart;
    return Math.max(gridStart, Math.min(gridEnd - Math.min(duration, gridEnd - gridStart), snapped));
  };

  // ── Header texts ──────────────────────────────────────────────────────────
  const title = view === "day"
    ? prettyDate(selectedDay, { weekday: "long", day: "numeric", month: "long" })
    : view === "week"
      ? `${prettyDate(weekStart, { day: "numeric", month: "short" })} – ${prettyDate(addDays(weekStart, 6), { day: "numeric", month: "short", year: "numeric" })}`
      : prettyDate(selectedDay, { month: "long", year: "numeric" });
  const countable = visible.filter((b) => b.status !== "CANCELLED").length;
  const counts = new Map<number, number>();
  for (const booking of bookings) {
    if (booking.status === "CANCELLED" || !rangeDates.includes(booking.appointmentDate)) continue;
    counts.set(booking.staffId, (counts.get(booking.staffId) ?? 0) + 1);
  }

  const segment = (active: boolean) => `rounded-md px-3 py-1.5 text-xs font-semibold ${active ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`;
  const dayRestriction = view === "day" ? restrictions.get(selectedDate) : null;

  return <div className={expanded ? "fixed inset-3 z-50 flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl" : "rounded-xl border border-slate-200 bg-white shadow-sm"}>
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
      <div className="flex items-center gap-1">
        <button onClick={() => step(-1)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label={translateUi("Previous")}><ChevronLeft className="h-4 w-4" /></button>
        <button onClick={() => chooseDate(localDateKey())} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">{translateUi("Today")}</button>
        <button onClick={() => step(1)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label={translateUi("Next")}><ChevronRight className="h-4 w-4" /></button>
      </div>
      <div className="min-w-[190px] flex-1">
        <h2 className="text-sm font-bold capitalize text-slate-800">{title}</h2>
        <p className="text-xs text-slate-400">{countable} {countable === 1 ? translateUi("appointment") : translateUi("appointments")}</p>
      </div>
      <div className="flex rounded-lg bg-slate-100 p-1" role="group" aria-label={translateUi("Calendar view")}>
        {(["day", "week", "month"] as const).map((option) => <button key={option} type="button" onClick={() => chooseView(option)} aria-pressed={view === option} className={segment(view === option)}>
          {option === "day" ? translateUi("Day") : option === "week" ? translateUi("Week") : translateUi("Month")}</button>)}
      </div>
      {view === "day" && <div className="flex rounded-lg bg-slate-100 p-1" role="group" aria-label={translateUi("Booking calendar layout")}>
        <button type="button" onClick={() => setPrefs({ ...prefs, layout: "overall" })} aria-pressed={prefs.layout === "overall"} className={segment(prefs.layout === "overall")}>{translateUi("Overall")}</button>
        <button type="button" onClick={() => setPrefs({ ...prefs, layout: "stylist" })} aria-pressed={prefs.layout === "stylist"} className={segment(prefs.layout === "stylist")}>{translateUi("By Stylist")}</button>
      </div>}
      <input type="date" value={selectedDate} onChange={(event) => event.target.value && chooseDate(event.target.value)} aria-label={translateUi("Choose date")} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 outline-none focus:border-matcha-500" />
      <button type="button" onClick={() => setExpanded((current) => !current)} aria-label={expanded ? translateUi("Exit expanded calendar") : translateUi("Expand calendar")} title={expanded ? translateUi("Exit expanded calendar") : translateUi("Expand calendar")} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">{expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>
    </div>

    <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5">
      {activeStaff.map((member) => {
        const off = hidden.has(member.id);
        const color = colorOf(member.id);
        return <div key={member.id} className="relative">
          <div className={`flex items-center gap-1.5 rounded-full border py-1 pl-1.5 pr-2.5 text-xs font-semibold transition ${off ? "border-slate-200 bg-slate-50 text-slate-400" : "text-slate-700"}`} style={off ? undefined : { borderColor: withAlpha(color, 0.5), background: withAlpha(color, 0.1) }}>
            <button type="button" onClick={() => setColorEditor(colorEditor === member.id ? null : member.id)} title={translateUi("Change colour")} aria-label={`${translateUi("Change colour")} — ${member.name}`} className="flex h-5 w-5 items-center justify-center rounded-full ring-1 ring-white" style={{ background: off ? "#cbd5e1" : color }}><Palette className="h-3 w-3 text-white" /></button>
            <button type="button" onClick={() => setPrefs({ ...prefs, hidden: off ? prefs.hidden.filter((id) => id !== member.id) : [...prefs.hidden, member.id] })} aria-pressed={!off} title={off ? translateUi("Show {name}", { name: member.name }) : translateUi("Hide {name}", { name: member.name })} className="flex items-center gap-1.5">
              <span className={off ? "line-through" : ""}>{member.name}</span>
              <span className="font-normal text-slate-400">{counts.get(member.id) ?? 0}</span>
              {off ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3 text-slate-400" />}
            </button>
          </div>
          {colorEditor === member.id && <ColorPopover current={color} custom={(member.id in colorOverrides ? colorOverrides[member.id] : member.calendarColor) != null}
            onPick={(next) => { void onColorChange(member.id, next); setColorEditor(null); }} onClose={() => setColorEditor(null)} />}
        </div>;
      })}
      {!activeStaff.length && <span className="text-xs text-slate-400">{translateUi("No active stylists are available.")}</span>}
      <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-xs text-slate-500">
        <input type="checkbox" checked={prefs.showCancelled} onChange={(event) => setPrefs({ ...prefs, showCancelled: event.target.checked })} />
        {translateUi("Show cancelled")}
      </label>
    </div>

    {dayRestriction && <div className="flex items-center gap-3 border-b border-amber-100 bg-amber-50 px-4 py-3"><XCircle className="h-4 w-4 shrink-0 text-amber-500" /><div><p className="text-xs font-semibold text-amber-800">{dayRestriction}</p><p className="text-[11px] text-amber-600">{translateUi("Existing appointments are shown; new appointments cannot be added for this date.")}</p></div></div>}
    {moveError && <div role="alert" className="flex items-center justify-between gap-3 border-b border-red-100 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-700"><span>{moveError}</span><button type="button" onClick={() => setMoveError(null)} className="font-semibold underline">{translateUi("Dismiss")}</button></div>}

    {view === "month"
      ? <MonthGrid gridStart={monthGridStart} monthIndex={selectedDay.getMonth()} today={today} bookings={visible} restrictions={restrictions} colorOf={colorOf}
          serviceMap={serviceMap} onOpenDay={openDay} onSelect={onSelect} expanded={expanded} />
      : <div ref={scrollRef} className={`${expanded ? "min-h-0 flex-1" : "max-h-[72vh]"} overflow-auto`}>
          {columns.length === 0
            ? <p className="px-4 py-12 text-center text-sm text-slate-400">{translateUi("No active stylists are available.")}</p>
            : <div className="grid" style={{ gridTemplateColumns: `56px repeat(${columns.length}, minmax(${view === "week" ? 128 : prefs.layout === "stylist" ? 190 : 260}px, 1fr))`, minWidth: 56 + columns.length * (view === "week" ? 128 : prefs.layout === "stylist" ? 190 : 260) }}>
              <div className="sticky left-0 top-0 z-30 h-12 border-b border-r border-slate-200 bg-slate-50" />
              {columns.map((column) => <div key={column.key} className="sticky top-0 z-20 flex h-12 items-center justify-center border-b border-r border-slate-200 bg-slate-50 px-2">{column.label}</div>)}
              <div className="sticky left-0 z-10 border-r border-slate-200 bg-white" style={{ height: ((gridEnd - gridStart) / 60) * HOUR_H }}>
                {Array.from({ length: (gridEnd - gridStart) / 60 }, (_, i) => <div key={i} className="absolute right-2 -translate-y-2 text-[10px] font-medium tabular-nums text-slate-400" style={{ top: i * HOUR_H + (i === 0 ? 8 : 0) }}>{formatTime(gridStart + i * 60)}</div>)}
              </div>
              {columns.map((column) => {
                const lanes = layoutLanes(column.bookings);
                const restriction = restrictions.get(column.date);
                const closedAllDay = isClosedDay(restriction);
                const hours = operatingHours?.find((item) => item.day === JS_DAYS[parseDate(column.date).getDay()]);
                const open = hours && !hours.closed ? toMinutes(hours.openTime) : null;
                const close = hours && !hours.closed ? toMinutes(hours.closeTime) : null;
                const isToday = column.date === today;
                const nowMinutes = now.getHours() * 60 + now.getMinutes();
                const pastUntil = column.date < today ? gridEnd : isToday ? Math.min(Math.max(nowMinutes, gridStart), gridEnd) : gridStart;
                const offRanges = column.staff ? staffOffRanges(column.staff, column.date, gridStart, gridEnd, schedules) : [];
                const shade: [number, number, string][] = [];
                if (closedAllDay || open === null) shade.push([gridStart, gridEnd, "closed"]);
                else { if (open > gridStart) shade.push([gridStart, open, "closed"]); if (close! < gridEnd) shade.push([close!, gridEnd, "closed"]); }
                for (const [from, to] of offRanges) shade.push([from, to, "off"]);
                const pos = (minutes: number) => ((minutes - gridStart) / 60) * HOUR_H;
                return <div key={column.key} className={`relative border-r border-slate-100 ${drag && preview?.key === column.key ? "bg-matcha-50/40" : ""}`} style={{ height: ((gridEnd - gridStart) / 60) * HOUR_H }}
                  onMouseMove={(event) => {
                    if (event.target !== event.currentTarget) { if (hover) setHover(null); return; }
                    const y = event.clientY - event.currentTarget.getBoundingClientRect().top;
                    const minutes = gridStart + Math.floor(((y / HOUR_H) * 60) / SNAP_CLICK) * SNAP_CLICK;
                    if (!hover || hover.key !== column.key || hover.minutes !== minutes) setHover({ key: column.key, minutes });
                  }}
                  onMouseLeave={() => setHover(null)}
                  onClick={(event) => {
                    if (event.target !== event.currentTarget) return;
                    const y = event.clientY - event.currentTarget.getBoundingClientRect().top;
                    const minutes = gridStart + Math.floor(((y / HOUR_H) * 60) / SNAP_CLICK) * SNAP_CLICK;
                    const time = formatTime(minutes);
                    if (bookable(column.date, time, column.staff)) onNew(column.date, time, column.staff?.id);
                  }}
                  onDragOver={(event) => {
                    if (!drag) return;
                    event.preventDefault();
                    const duration = toMinutes(drag.booking.endTime) - toMinutes(drag.booking.startTime);
                    const minutes = minutesFromPointer(event, event.currentTarget, duration, drag.grab);
                    if (!preview || preview.key !== column.key || preview.minutes !== minutes) setPreview({ key: column.key, minutes });
                  }}
                  onDrop={(event) => {
                    if (!drag) return;
                    event.preventDefault();
                    const duration = toMinutes(drag.booking.endTime) - toMinutes(drag.booking.startTime);
                    void dropOn(column, minutesFromPointer(event, event.currentTarget, duration, drag.grab));
                  }}>
                  {Array.from({ length: (gridEnd - gridStart) / 60 }, (_, i) => <div key={i} className="pointer-events-none absolute inset-x-0 border-t border-slate-100" style={{ top: i * HOUR_H }}><div className="absolute inset-x-0 border-t border-dashed border-slate-50" style={{ top: HOUR_H / 2 }} /></div>)}
                  {shade.map(([from, to, kind], i) => <div key={i} className={`pointer-events-none absolute inset-x-0 ${kind === "closed" ? "bg-slate-100/80" : "bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,rgba(148,163,184,0.18)_6px,rgba(148,163,184,0.18)_7px)]"}`} style={{ top: pos(from), height: pos(to) - pos(from) }} title={kind === "closed" ? translateUi("Salon closed") : translateUi("Not working")} />)}
                  {pastUntil > gridStart && <div className="pointer-events-none absolute inset-x-0 bg-slate-50/60" style={{ top: 0, height: pos(pastUntil) }} />}
                  {hover?.key === column.key && !drag && bookable(column.date, formatTime(hover.minutes), column.staff) && <div className="pointer-events-none absolute inset-x-1 flex items-center rounded bg-matcha-50 px-2 text-[10px] font-semibold text-matcha-700" style={{ top: pos(hover.minutes), height: (SNAP_CLICK / 60) * HOUR_H }}>+ {translateUi("Book at ")}{formatTime(hover.minutes)}</div>}
                  {isToday && nowMinutes >= gridStart && nowMinutes <= gridEnd && <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-red-500" style={{ top: pos(nowMinutes) }}><span className="absolute -left-1 -top-1.5 h-2.5 w-2.5 rounded-full bg-red-500" /></div>}
                  {drag && preview?.key === column.key && <div className="pointer-events-none absolute inset-x-1 z-20 rounded-md border-2 border-dashed border-matcha-600 bg-matcha-100/60 px-2 py-1 text-[10px] font-bold text-matcha-800" style={{ top: pos(preview.minutes), height: Math.max(22, ((toMinutes(drag.booking.endTime) - toMinutes(drag.booking.startTime)) / 60) * HOUR_H) }}>{formatTime(preview.minutes)}</div>}
                  {column.bookings.map((booking) => {
                    const lane = lanes.get(booking.id) ?? { lane: 0, lanes: 1 };
                    const start = toMinutes(booking.startTime);
                    const end = toMinutes(booking.endTime);
                    const height = Math.max(22, ((end - start) / 60) * HOUR_H - 2);
                    const color = colorOf(booking.staffId);
                    const cancelled = booking.status === "CANCELLED";
                    const movable = canMove(booking);
                    const member = staffMap.get(booking.staffId);
                    return <button key={booking.id} type="button" draggable={movable}
                      onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(booking.id)); setDrag({ booking, grab: event.nativeEvent.offsetY }); setHover(null); }}
                      onDragEnd={() => { setDrag(null); setPreview(null); }}
                      onClick={(event) => { event.stopPropagation(); onSelect(booking); }}
                      title={`${booking.startTime.slice(0, 5)}–${booking.endTime.slice(0, 5)} ${booking.customerName} · ${serviceMap.get(booking.serviceId) ?? ""}${member ? ` · ${member.name}` : ""}${movable ? `\n${translateUi("Drag to move")}` : ""}`}
                      className={`absolute z-[5] overflow-hidden rounded-md px-2 py-1 text-left text-[10px] leading-tight text-slate-900 shadow-sm transition hover:z-10 hover:shadow-md ${movable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${cancelled ? "opacity-50" : ""} ${drag?.booking.id === booking.id ? "opacity-40" : ""}`}
                      style={{
                        top: pos(start) + 1, height,
                        left: `calc(${(lane.lane / lane.lanes) * 100}% + 2px)`, width: `calc(${100 / lane.lanes}% - 4px)`,
                        background: withAlpha(color, cancelled ? 0.08 : 0.2),
                        border: `1px ${booking.status === "PENDING" ? "dashed" : "solid"} ${withAlpha(color, 0.55)}`,
                        borderLeft: `4px solid ${color}`,
                      }}>
                      <span className={`block truncate font-bold ${cancelled ? "line-through" : ""}`}>{booking.startTime.slice(0, 5)}–{booking.endTime.slice(0, 5)} · {booking.customerName}</span>
                      {height >= 38 && <span className="block truncate opacity-75">{serviceMap.get(booking.serviceId)}{!column.staff && view === "day" && member ? ` · ${member.name}` : ""}</span>}
                      {height >= 52 && <StatusTags booking={booking} />}
                    </button>;
                  })}
                </div>;
              })}
            </div>}
        </div>}
  </div>;
}

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "?";
}

function StatusTags({ booking }: { booking: Booking }) {
  const { t: translateUi } = useI18n();
  const tags: [string, string][] = [];
  if (booking.status === "PENDING") tags.push([translateUi("Pending"), "bg-amber-100 text-amber-800"]);
  if (booking.status === "COMPLETED") tags.push([translateUi("Completed"), "bg-green-100 text-green-800"]);
  if (booking.status === "NO_SHOW") tags.push([translateUi("No-show"), "bg-red-100 text-red-700"]);
  if (booking.status === "CANCELLED") tags.push([translateUi("Cancelled"), "bg-slate-200 text-slate-600"]);
  if (booking.paymentStatus === "PAID") tags.push([translateUi("Paid"), "bg-emerald-100 text-emerald-800"]);
  else if (booking.paymentStatus === "PENDING") tags.push([translateUi("Awaiting payment"), "bg-amber-100 text-amber-800"]);
  if (!tags.length) return null;
  return <span className="mt-0.5 flex flex-wrap gap-1">{tags.map(([label, tone]) => <span key={label} className={`rounded px-1 py-px text-[9px] font-bold ${tone}`}>{label}</span>)}</span>;
}

function ColorPopover({ current, custom, onPick, onClose }: { current: string; custom: boolean; onPick: (color: string | null) => void; onClose: () => void }) {
  const { t: translateUi } = useI18n();
  return <>
    <button type="button" aria-label={translateUi("Close")} className="fixed inset-0 z-40 cursor-default" onClick={onClose} />
    <div role="dialog" aria-label={translateUi("Pick a colour")} className="absolute left-0 top-full z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
      <p className="mb-2 text-[11px] font-semibold text-slate-500">{translateUi("Pick a colour")}</p>
      <div className="grid grid-cols-6 gap-1.5">
        {STAFF_PALETTE.map((color) => <button key={color} type="button" onClick={() => onPick(color)} aria-label={color} className={`h-7 w-7 rounded-full ring-offset-1 transition hover:scale-110 ${current.toLowerCase() === color ? "ring-2 ring-slate-700" : ""}`} style={{ background: color }} />)}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">{translateUi("Custom")}
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(current) ? current : "#6366f1"} onChange={(event) => onPick(event.target.value)} className="h-7 w-9 cursor-pointer rounded border border-slate-200 bg-white p-0.5" />
        </label>
        {custom && <button type="button" onClick={() => onPick(null)} className="text-[11px] font-semibold text-slate-500 underline hover:text-slate-700">{translateUi("Reset")}</button>}
      </div>
    </div>
  </>;
}

function MonthGrid({ gridStart, monthIndex, today, bookings, restrictions, colorOf, serviceMap, onOpenDay, onSelect, expanded }: {
  gridStart: Date; monthIndex: number; today: string; bookings: Booking[]; restrictions: Map<string, string | null>;
  colorOf: (staffId: number) => string; serviceMap: Map<number, string>; onOpenDay: (date: string) => void; onSelect: (booking: Booking) => void; expanded: boolean;
}) {
  const { t: translateUi } = useI18n();
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const byDate = new Map<string, Booking[]>();
  for (const booking of bookings) byDate.set(booking.appointmentDate, [...(byDate.get(booking.appointmentDate) ?? []), booking]);
  return <div className={`${expanded ? "min-h-0 flex-1" : ""} overflow-auto`}>
    <div className="grid min-w-[720px] grid-cols-7">
      {days.slice(0, 7).map((day) => <div key={day.getDay()} className="border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400">{prettyDate(day, { weekday: "short" })}</div>)}
      {days.map((day) => {
        const key = localDateKey(day);
        const list = (byDate.get(key) ?? []).sort((a, b) => a.startTime.localeCompare(b.startTime));
        const restriction = restrictions.get(key);
        const closed = isClosedDay(restriction);
        const inMonth = day.getMonth() === monthIndex;
        return <div key={key} role="button" tabIndex={0} onClick={() => onOpenDay(key)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpenDay(key); } }}
          className={`min-h-28 cursor-pointer border-b border-r border-slate-100 p-1.5 text-left transition hover:bg-matcha-50/40 ${closed ? "bg-slate-100/70" : inMonth ? "bg-white" : "bg-slate-50/70"}`} title={closed ? restriction ?? undefined : undefined}>
          <div className="mb-1 flex items-center justify-between">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${key === today ? "bg-matcha-700 text-white" : inMonth ? "text-slate-700" : "text-slate-300"}`}>{day.getDate()}</span>
            {closed && <span className="truncate text-[9px] font-semibold uppercase text-slate-400">{restriction}</span>}
          </div>
          <div className="space-y-0.5">
            {list.slice(0, 3).map((booking) => <button key={booking.id} type="button" onClick={(event) => { event.stopPropagation(); onSelect(booking); }}
              title={`${booking.startTime.slice(0, 5)} ${booking.customerName} · ${serviceMap.get(booking.serviceId) ?? ""}`}
              className={`flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] text-slate-800 ${booking.status === "CANCELLED" ? "line-through opacity-50" : ""}`}
              style={{ background: withAlpha(colorOf(booking.staffId), 0.18), borderLeft: `3px solid ${colorOf(booking.staffId)}` }}>
              <span className="font-bold tabular-nums">{booking.startTime.slice(0, 5)}</span><span className="truncate">{booking.customerName}</span>
            </button>)}
            {list.length > 3 && <p className="px-1 text-[10px] font-semibold text-slate-500">{translateUi("+{n} more", { n: list.length - 3 })}</p>}
          </div>
        </div>;
      })}
    </div>
  </div>;
}
