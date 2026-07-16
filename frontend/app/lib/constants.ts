import type { OperatingHours } from "./types";

export const FEATURES = [
  "STATIC_WEBSITE", "BOOKING", "MEMBERSHIP", "WEBSHOP", "ANALYTICS", "LOYALTY_PROGRAM",
] as const;

export const FEATURE_LABEL: Record<string, string> = {
  STATIC_WEBSITE: "Website", BOOKING: "Booking", MEMBERSHIP: "Membership",
  WEBSHOP: "Shop", ANALYTICS: "Analytics", LOYALTY_PROGRAM: "Loyalty",
};

export const DAYS = [
  "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY",
] as const;

export const DAY_SHORT: Record<string, string> = {
  MONDAY: "Mon", TUESDAY: "Tue", WEDNESDAY: "Wed", THURSDAY: "Thu",
  FRIDAY: "Fri", SATURDAY: "Sat", SUNDAY: "Sun",
};

export const STAFF_ROLES = [
  "MANAGER", "STYLIST", "COLORIST", "MAKEUP_ARTIST", "NAIL_TECHNICIAN", "RECEPTIONIST", "ASSISTANT",
] as const;

export const STAFF_ROLE_LABEL: Record<string, string> = {
  MANAGER: "Manager", STYLIST: "Stylist", COLORIST: "Colorist", MAKEUP_ARTIST: "Makeup Artist",
  NAIL_TECHNICIAN: "Nail Tech", RECEPTIONIST: "Receptionist", ASSISTANT: "Assistant",
};

export const STAFF_STATUSES = ["ACTIVE", "INACTIVE", "ON_LEAVE"] as const;

export const STAFF_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active", INACTIVE: "Inactive", ON_LEAVE: "On Leave",
};

export const SERVICE_CATEGORIES = [
  "HAIR", "MAKEUP", "NAILS", "SKIN_CARE", "BEARD", "MASSAGE", "WAXING", "OTHER",
] as const;

export const CATEGORY_LABEL: Record<string, string> = {
  HAIR: "Hair", MAKEUP: "Makeup", NAILS: "Nails", SKIN_CARE: "Skin Care",
  BEARD: "Beard", MASSAGE: "Massage", WAXING: "Waxing", OTHER: "Other",
};

export const SPECIALIZATION_OPTIONS = SERVICE_CATEGORIES;

export const defaultHours = (): OperatingHours[] =>
  DAYS.map((day) => ({ day, openTime: "09:00", closeTime: "18:00", closed: day === "SUNDAY" }));

export const cloneHours = (src?: OperatingHours[]): OperatingHours[] =>
  src ? src.map((h) => ({ ...h })) : defaultHours();

export const formatDate = (ts?: string) =>
  ts ? new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

export const formatPrice = (price: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(price);

export function toggleList(list: string[], val: string): string[] {
  const i = list.indexOf(val);
  return i === -1 ? [...list, val] : list.filter((_, idx) => idx !== i);
}

export function openDays(operatingHours?: OperatingHours[]) {
  if (!operatingHours?.length) return null;
  return operatingHours.filter((h) => !h.closed).map((h) => DAY_SHORT[h.day] || h.day).join(", ");
}
