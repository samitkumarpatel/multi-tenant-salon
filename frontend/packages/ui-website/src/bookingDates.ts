import type { OperatingHours, SalonHoliday } from "./types";

// Shared date-availability logic for the customer-facing booking surfaces (the step-by-step
// BookingWizard and the Generative-UI BookingPickerCard). The server is the source of truth —
// `/booking/slots` returns nothing and `POST /booking` 400s for a closed date — this just keeps the
// calendars from offering dates that would be rejected.

export type ClosureRange = { startDate: string; endDate: string };

const WEEKDAY = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const pad2 = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** ISO `yyyy-mm-dd` falls inside one of the (inclusive) closure/holiday ranges. */
export function isClosedByRange(isoDate: string, ranges: ClosureRange[]): boolean {
  return ranges.some((r) => isoDate >= r.startDate && isoDate <= r.endDate);
}

/**
 * A slot on `isoDate` starting at `startTime` (`HH:mm` or `HH:mm:ss`) has already passed. Only
 * ever true when `isoDate` is today — a time earlier today can't be booked, so the pickers must
 * not offer it even though `/booking/slots` (which doesn't know the wall clock) still returns it.
 */
export function isPastSlot(isoDate: string, startTime: string, now: Date = new Date()): boolean {
  if (isoDate !== iso(now)) return false;
  return startTime.slice(0, 5) <= `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
}

/** Weekday names (e.g. "MONDAY") the salon marks `closed` in its operating hours. */
export function closedWeekdays(hours?: OperatingHours[]): Set<string> {
  return new Set((hours ?? []).filter((h) => h.closed).map((h) => h.day));
}

/**
 * Expand named holidays into concrete date ranges within [today, maxDate]. A holiday with a
 * null `year` recurs every year (generated for every year the window touches); one with a
 * `year` is that year only. `endMonth`/`endDay`, when set, make it a multi-day range.
 */
export function resolveHolidayRanges(holidays: SalonHoliday[], maxDate: Date): ClosureRange[] {
  const todayISO = iso(new Date());
  const maxISO = iso(maxDate);
  const ranges: ClosureRange[] = [];

  const addForYear = (h: SalonHoliday, year: number) => {
    const start = `${year}-${pad2(h.month)}-${pad2(h.day)}`;
    const endMonth = h.endMonth ?? h.month;
    const endDay = h.endDay ?? h.day;
    let end = `${year}-${pad2(endMonth)}-${pad2(endDay)}`;
    if (end < start) end = `${year}-12-31`; // ignore year-wrapping tail rather than mis-block January
    if (end < todayISO || start > maxISO) return;
    ranges.push({ startDate: start < todayISO ? todayISO : start, endDate: end > maxISO ? maxISO : end });
  };

  for (const h of holidays) {
    if (h.year == null) {
      for (let y = new Date().getFullYear(); y <= maxDate.getFullYear() + 1; y++) addForYear(h, y);
    } else {
      addForYear(h, h.year);
    }
  }
  return ranges;
}

/** True when `date` (ISO) can't be booked: a closed weekday or inside a closure/holiday range. */
export function isDateClosed(date: string, closedDays: Set<string>, ranges: ClosureRange[]): boolean {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  return closedDays.has(WEEKDAY[d.getDay()]) || isClosedByRange(date, ranges);
}

/**
 * First bookable date at or after `from`, scanning up to `maxDate`. Falls back to `from` if the
 * whole window is closed (the calendar will still block it — better than an invalid start).
 */
export function firstBookableDate(from: Date, maxDate: Date, closedDays: Set<string>, ranges: ClosureRange[]): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; i <= 366 && d <= maxDate; i++) {
    const s = iso(d);
    if (!isDateClosed(s, closedDays, ranges)) return s;
    d.setDate(d.getDate() + 1);
  }
  return iso(from);
}
