import type { OperatingHours } from "./types";

export const FEATURES = [
  "STATIC_WEBSITE",
  "BOOKING",
  "MEMBERSHIP",
  "WEBSHOP",
  "ANALYTICS",
  "LOYALTY_PROGRAM",
];

export const FEATURE_LABELS: Record<string, string> = {
  STATIC_WEBSITE: "Website",
  BOOKING: "Booking",
  MEMBERSHIP: "Membership",
  WEBSHOP: "Web Shop",
  ANALYTICS: "Analytics",
  LOYALTY_PROGRAM: "Loyalty",
};

export const DAY_SHORT: Record<string, string> = {
  MONDAY: "Mon", TUESDAY: "Tue", WEDNESDAY: "Wed", THURSDAY: "Thu",
  FRIDAY: "Fri", SATURDAY: "Sat", SUNDAY: "Sun",
};

export const DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

export function defaultHours(): OperatingHours[] {
  return DAYS.map((day) => ({
    day,
    openTime: "09:00",
    closeTime: "18:00",
    closed: day === "SUNDAY",
  }));
}

export function cloneHours(hours: OperatingHours[]): OperatingHours[] {
  return hours.map((h) => ({ ...h }));
}

export function toggleList<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}
