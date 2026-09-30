import type { OperatingHours } from "./types";

export {
  FEATURE_LABEL, DAY_SHORT, STAFF_ROLE_LABEL, CATEGORY_LABEL, formatPrice, formatDate, openDays,
} from "@salon/ui-website";

export const FEATURES = [
  "STATIC_WEBSITE", "BOOKING", "DASHBOARD", "MEMBERSHIP", "WEBSHOP", "ANALYTICS", "LOYALTY_PROGRAM",
] as const;

export const FEATURE_DESCRIPTION: Record<string, string> = {
  STATIC_WEBSITE: "Your public-facing site — a fast static website or an AI-generated (Gen UI) one.",
  BOOKING: "Let clients book appointments online and choose their preferred stylist.",
  DASHBOARD: "View and manage bookings and in-salon cashier sales from one dashboard.",
  MEMBERSHIP: "Offer paid membership plans with recurring perks for your regulars.",
  WEBSHOP: "Sell products online with your own catalogue, cart and checkout.",
  ANALYTICS: "Track how visitors use your website and which services get the most interest.",
  LOYALTY_PROGRAM: "Reward repeat clients with points they earn on visits and purchases.",
};

export const DAYS = [
  "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY",
] as const;

export const STAFF_ROLES = [
  "MANAGER", "STYLIST", "COLORIST", "MAKEUP_ARTIST", "NAIL_TECHNICIAN", "RECEPTIONIST", "ASSISTANT",
] as const;

export const STAFF_STATUSES = ["ACTIVE", "INACTIVE", "ON_LEAVE"] as const;

export const STAFF_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active", INACTIVE: "Inactive", ON_LEAVE: "On Leave",
};

export const SERVICE_CATEGORIES = [
  "HAIR", "MAKEUP", "NAILS", "SKIN_CARE", "BEARD", "MASSAGE", "WAXING", "OTHER",
] as const;

export const SPECIALIZATION_OPTIONS = SERVICE_CATEGORIES;

export const defaultHours = (): OperatingHours[] =>
  DAYS.map((day) => ({ day, openTime: "09:00", closeTime: "18:00", closed: day === "SUNDAY" }));

export const cloneHours = (src?: OperatingHours[]): OperatingHours[] =>
  src ? src.map((h) => ({ ...h })) : defaultHours();

export function toggleList(list: string[], val: string): string[] {
  const i = list.indexOf(val);
  return i === -1 ? [...list, val] : list.filter((_, idx) => idx !== i);
}
