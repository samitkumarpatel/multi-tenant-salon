export interface Owner {
  name: string;
  email: string;
  phone?: string;
}

export interface Location {
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
}

export interface ContactInfo {
  phone?: string;
  email?: string;
  website?: string;
}

export interface OperatingHours {
  day: string;
  openTime?: string;
  closeTime?: string;
  closed: boolean;
}

export type SaloonStatus = "ACTIVE" | "DISABLED";

export type SaloonFeature =
  | "STATIC_WEBSITE"
  | "BOOKING"
  | "MEMBERSHIP"
  | "WEBSHOP"
  | "ANALYTICS"
  | "LOYALTY_PROGRAM";

export interface Saloon {
  id: string;
  name: string;
  handler: string;
  owner?: Owner;
  location?: Location;
  contact?: ContactInfo;
  operatingHours?: OperatingHours[];
  features?: SaloonFeature[];
  bookingAdvanceDays?: number;
  businessRegistrationId?: string;
  showBusinessId?: boolean;
  bookingRequiresConfirmation?: boolean;
  createdAt?: string;
  status: SaloonStatus;
}

export interface SuperAdminSession {
  email: string;
}

const SESSION_KEY = "super-admin-session";

export function getSession(): SuperAdminSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SuperAdminSession) : null;
  } catch {
    return null;
  }
}

export function setSession(s: SuperAdminSession) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export const SUPER_ADMIN_EMAIL = "admin@my-saloon.online";
export const DUMMY_OTP = "123456";

export const ALL_FEATURES: SaloonFeature[] = [
  "STATIC_WEBSITE",
  "BOOKING",
  "MEMBERSHIP",
  "WEBSHOP",
  "ANALYTICS",
  "LOYALTY_PROGRAM",
];

export const FEATURE_LABEL: Record<SaloonFeature, string> = {
  STATIC_WEBSITE: "Website",
  BOOKING: "Booking",
  MEMBERSHIP: "Membership",
  WEBSHOP: "Web Shop",
  ANALYTICS: "Analytics",
  LOYALTY_PROGRAM: "Loyalty Program",
};
