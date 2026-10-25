import type {
  Booking, OperatingHours, SalonClosure, SalonHoliday, ServiceItem, StaffAvailability, StaffAvailabilityOverride, StaffMember,
} from "@salon/ui-website";

export const JS_DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function nextDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return localDateKey(date);
}
export function parseDate(value: string) { return new Date(`${value}T12:00:00`); }
export function addDays(date: Date, amount: number) { const next = new Date(date); next.setDate(next.getDate() + amount); return next; }
export function prettyDate(date: Date, options: Intl.DateTimeFormatOptions) { return new Intl.DateTimeFormat(undefined, options).format(date); }
export function isTimeInPast(date: string, time: string, now = new Date()) {
  if (date < localDateKey(now)) return true;
  if (date > localDateKey(now)) return false;
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) < now.getHours() * 60 + now.getMinutes();
}

export function holidayApplies(date: Date, holiday: SalonHoliday) {
  const year = date.getFullYear();
  if (holiday.year != null && holiday.year !== year) return false;
  const md = (date.getMonth() + 1) * 100 + date.getDate();
  const start = holiday.month * 100 + holiday.day;
  const end = (holiday.endMonth ?? holiday.month) * 100 + (holiday.endDay ?? holiday.day);
  return end >= start ? md >= start && md <= end : md >= start || md <= end;
}

export function restrictionFor(dateKey: string, hours: OperatingHours[] | undefined, closures: SalonClosure[], holidays: SalonHoliday[], bookingAdvanceDays?: number) {
  const date = parseDate(dateKey);
  if (dateKey < localDateKey()) return "Past date";
  if (bookingAdvanceDays && dateKey > localDateKey(addDays(new Date(), bookingAdvanceDays))) return "Outside booking window";
  const holiday = holidays.find((item) => holidayApplies(date, item));
  if (holiday) return holiday.name;
  const closure = closures.find((item) => dateKey >= item.startDate && dateKey <= item.endDate);
  if (closure) return closure.reason || "Salon closure";
  const dayHours = hours?.find((item) => item.day === JS_DAYS[date.getDay()]);
  if (hours?.length && (!dayHours || dayHours.closed)) return "Closed";
  return null;
}

export type StaffScheduleData = { staffId: number; availability: StaffAvailability[]; overrides: StaffAvailabilityOverride[] };

export function isSalonOpenAt(dateKey: string, time: string, hours?: OperatingHours[]) {
  if (!hours?.length) return true;
  const dayHours = hours.find((item) => item.day === JS_DAYS[parseDate(dateKey).getDay()]);
  if (!dayHours || dayHours.closed) return false;
  const minutes = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  const opening = Number(dayHours.openTime.slice(0, 2)) * 60 + Number(dayHours.openTime.slice(3, 5));
  const closing = Number(dayHours.closeTime.slice(0, 2)) * 60 + Number(dayHours.closeTime.slice(3, 5));
  return minutes >= opening && minutes < closing;
}

export function staffWindowAt(member: StaffMember, dateKey: string, time: string, schedules: StaffScheduleData[]) {
  if (member.status !== "ACTIVE" || member.availableForBooking === false) return null;
  const schedule = schedules.find((item) => item.staffId === member.id);
  if (!schedule) return null;
  const toMinutes = (value?: string) => value ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5)) : null;
  const minutes = toMinutes(time)!;
  const override = schedule.overrides.find((item) => item.overrideDate === dateKey);
  if (override) {
    const start = toMinutes(override.startTime);
    const end = toMinutes(override.endTime);
    return override.available && start !== null && end !== null && minutes >= start && minutes < end ? { start, end } : null;
  }
  const weekday = JS_DAYS[parseDate(dateKey).getDay()];
  const workingWindows = schedule.availability.filter((item) => item.dayOfWeek === weekday && item.available);
  for (const window of workingWindows) {
    const start = toMinutes(window.startTime);
    const end = toMinutes(window.endTime);
    if (start !== null && end !== null && minutes >= start && minutes < end) return { start, end };
  }
  return null;
}

export function hasBookableServiceAtTime(member: StaffMember, date: string, time: string, schedules: StaffScheduleData[], services: ServiceItem[], bookings: Booking[], hours?: OperatingHours[]) {
  const window = staffWindowAt(member, date, time, schedules);
  if (!window) return false;
  const start = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  const dayHours = hours?.find((item) => item.day === JS_DAYS[parseDate(date).getDay()]);
  const salonClose = dayHours && !dayHours.closed
    ? Number(dayHours.closeTime.slice(0, 2)) * 60 + Number(dayHours.closeTime.slice(3, 5))
    : Number.POSITIVE_INFINITY;
  return services.some((service) => {
    const assignedIds = (service.assignedStaffIds ?? []).map(Number);
    const end = start + service.durationMinutes;
    if (!service.active || (assignedIds.length > 0 && !assignedIds.includes(member.id)) || end > window.end || end > salonClose) return false;
    return !bookings.some((booking) => booking.staffId === member.id && booking.status !== "CANCELLED"
      && start < Number(booking.endTime.slice(0, 2)) * 60 + Number(booking.endTime.slice(3, 5))
      && end > Number(booking.startTime.slice(0, 2)) * 60 + Number(booking.startTime.slice(3, 5)));
  });
}


export const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
export const formatTime = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** Monday of the week containing {@code date} (weeks start on Monday, like the salon-admin calendar). */
export function startOfWeek(date: Date) { return addDays(date, -((date.getDay() + 6) % 7)); }

/** The colours a stylist gets until they choose one — the same palette salon-admin uses. */
export const STAFF_PALETTE = [
  "#6366f1", "#ec4899", "#0d9488", "#d97706", "#7c3aed", "#dc2626",
  "#0284c7", "#059669", "#ea580c", "#65a30d", "#db2777", "#0891b2",
] as const;

/** id → colour for every active stylist: the chosen {@code calendarColor}, else a palette colour by position. */
export function staffColorMap(staff: StaffMember[], overrides: Record<number, string | null | undefined> = {}) {
  const active = staff.filter((member) => member.status === "ACTIVE");
  return new Map(active.map((member, index) => [
    member.id,
    // A key in overrides (even null = "reset") is newer than the loaded staff record.
    (member.id in overrides ? overrides[member.id] : member.calendarColor) ?? STAFF_PALETTE[index % STAFF_PALETTE.length],
  ]));
}

/** "#rrggbb" + opacity 0..1 → "#rrggbbaa". */
export function withAlpha(hex: string, opacity: number) {
  return `${hex}${Math.round(Math.max(0, Math.min(1, opacity)) * 255).toString(16).padStart(2, "0")}`;
}

/**
 * Side-by-side columns for appointments that overlap in time within one calendar column: each gets its
 * own lane ({@code lane} of {@code lanes}) so none is hidden behind another.
 */
export function layoutLanes(bookings: Booking[]) {
  const sorted = [...bookings].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime) || toMinutes(b.endTime) - toMinutes(a.endTime));
  const result = new Map<number, { lane: number; lanes: number }>();
  let cluster: Booking[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const laneEnds: number[] = [];
    const assigned = new Map<number, number>();
    for (const booking of cluster) {
      const start = toMinutes(booking.startTime);
      let lane = laneEnds.findIndex((end) => end <= start);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(0); }
      laneEnds[lane] = toMinutes(booking.endTime);
      assigned.set(booking.id, lane);
    }
    for (const booking of cluster) result.set(booking.id, { lane: assigned.get(booking.id)!, lanes: laneEnds.length });
    cluster = [];
  };
  for (const booking of sorted) {
    if (cluster.length && toMinutes(booking.startTime) >= clusterEnd) { flush(); clusterEnd = -1; }
    cluster.push(booking);
    clusterEnd = Math.max(clusterEnd, toMinutes(booking.endTime));
  }
  if (cluster.length) flush();
  return result;
}

/** The stretches of {@code date} (as minute pairs) in which a stylist is not working, scanned every 15 minutes. */
export function staffOffRanges(member: StaffMember, date: string, from: number, to: number, schedules: StaffScheduleData[]) {
  const ranges: [number, number][] = [];
  let open: number | null = null;
  for (let minutes = from; minutes < to; minutes += 15) {
    const working = staffWindowAt(member, date, formatTime(minutes), schedules) !== null;
    if (!working && open === null) open = minutes;
    if (working && open !== null) { ranges.push([open, minutes]); open = null; }
  }
  if (open !== null) ranges.push([open, to]);
  return ranges;
}
