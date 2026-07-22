import type { OperatingHours } from "./types";

export const FEATURE_LABEL: Record<string, string> = {
  STATIC_WEBSITE: "Website", BOOKING: "Booking", MEMBERSHIP: "Membership",
  WEBSHOP: "Shop", ANALYTICS: "Analytics", LOYALTY_PROGRAM: "Loyalty",
};

export const DAY_SHORT: Record<string, string> = {
  MONDAY: "Mon", TUESDAY: "Tue", WEDNESDAY: "Wed", THURSDAY: "Thu",
  FRIDAY: "Fri", SATURDAY: "Sat", SUNDAY: "Sun",
};

export const STAFF_ROLE_LABEL: Record<string, string> = {
  MANAGER: "Manager", STYLIST: "Stylist", COLORIST: "Colorist", MAKEUP_ARTIST: "Makeup Artist",
  NAIL_TECHNICIAN: "Nail Tech", RECEPTIONIST: "Receptionist", ASSISTANT: "Assistant",
};

export const CATEGORY_LABEL: Record<string, string> = {
  HAIR: "Hair", MAKEUP: "Makeup", NAILS: "Nails", SKIN_CARE: "Skin Care",
  BEARD: "Beard", MASSAGE: "Massage", WAXING: "Waxing", OTHER: "Other",
};

export const formatPrice = (price: number | null | undefined, currency: string | null = "USD") => {
  if (price == null) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency ?? "USD" }).format(price);
};

export const formatDate = (ts?: string) =>
  ts ? new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

export function openDays(operatingHours?: OperatingHours[]) {
  if (!operatingHours?.length) return null;
  return operatingHours.filter((h) => !h.closed).map((h) => DAY_SHORT[h.day] || h.day).join(", ");
}
