import { addDays, dateLabel, timeLabel, todayIso } from "./format";
import type { SalonApp } from "./runtime";

export type NextSlot = { date: string; startTime: string; staffId?: number };
export type OpenDay = { date: string; weekday?: string; firstOpenTime?: string; openSlotCount?: number };
/** A `salon_next_available` result. */
export type NextAvailability = {
  serviceId?: number;
  staffId?: number;
  firstAvailable?: NextSlot;
  openDays?: OpenDay[];
  byStaff?: { staffId: number; date?: string; startTime?: string }[];
};

/**
 * "Next free" hints for cards and rows. Each service/stylist pair is fetched once per app
 * session through the app-only `salon_next_available` tool; the app re-renders when it lands.
 * Hints are best-effort — a failed lookup just shows nothing.
 */
export class NextAvailable {
  private results = new Map<string, NextAvailability | null>();
  private pending = new Set<string>();

  /** The cached result, starting a fetch the first time; undefined while loading (null = failed). */
  get(rt: SalonApp<any>, query: { serviceId?: number; staffId?: number; days?: number }) {
    const key = `${query.serviceId ?? ""}|${query.staffId ?? ""}|${query.days ?? ""}`;
    if (this.results.has(key)) return this.results.get(key);
    if (!this.pending.has(key) && rt.data?.bookingEnabled !== false) {
      this.pending.add(key);
      void rt.call<NextAvailability>("salon_next_available", query).then((outcome) => {
        this.pending.delete(key);
        this.results.set(key, outcome.ok ? outcome.data : null);
        rt.render();
      });
    }
    return undefined;
  }

  /** Forget everything — after a booking, times have changed. */
  clear() {
    this.results.clear();
  }
}

/** "Today 3:00 PM", "Tomorrow 10:00 AM", "Thu, 29 Oct · 2:00 PM". */
export function slotLabel(date: string, time?: string) {
  const today = todayIso();
  const day = date === today ? "Today" : date === addDays(today, 1) ? "Tomorrow" : dateLabel(date);
  return time ? `${day}${date === today || date === addDays(today, 1) ? " " : " · "}${timeLabel(time)}` : day;
}
