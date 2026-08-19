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

export type SalonStatus = "ACTIVE" | "DISABLED";

export type SalonFeature =
  | "STATIC_WEBSITE"
  | "BOOKING"
  | "MEMBERSHIP"
  | "WEBSHOP"
  | "ANALYTICS"
  | "LOYALTY_PROGRAM";

export interface Salon {
  id: string;
  name: string;
  handler: string;
  owner?: Owner;
  location?: Location;
  contact?: ContactInfo;
  operatingHours?: OperatingHours[];
  features?: SalonFeature[];
  bookingAdvanceDays?: number;
  businessRegistrationId?: string;
  showBusinessId?: boolean;
  bookingRequiresConfirmation?: boolean;
  createdAt?: string;
  status: SalonStatus;
}

export interface Country {
  name: string;
  code: string;
  dialCode: string;
  currencyCode: string;
  currencyName: string | null;
  currencySymbol: string | null;
  businessIdLabel?: string | null;
  businessIdPlaceholder?: string | null;
}

export interface ServiceItem {
  id: number;
  salonId: number;
  name: string;
  description?: string;
  price: number;
  currency: string;
  durationMinutes: number;
  category: string;
  active: boolean;
  assignedStaffIds?: string[];
  createdAt?: string;
}

export interface StaffMember {
  id: number;
  salonId: number;
  name: string;
  email: string;
  phone?: string;
  role: string;
  status: string;
  isOwner?: boolean;
  availableForBooking?: boolean;
  specializations?: string[];
  photoUrl?: string;
  bio?: string;
  createdAt?: string;
}

export type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";

export interface Booking {
  id: number;
  salonId: string;
  serviceId: number;
  staffId: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  notes?: string;
  createdAt: string;
}

export interface SalonHoliday {
  id: number;
  salonId: string;
  name: string;
  month: number;
  day: number;
  endMonth?: number | null;
  endDay?: number | null;
  year?: number | null;
}

export interface SalonManageContext {
  salon: Salon;
  setSalon: (s: Salon) => void;
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

export const SALON_DOMAIN = import.meta.env.VITE_SALON_DOMAIN ?? "salonsaas.org";
export const SUPER_ADMIN_EMAIL = `admin@${SALON_DOMAIN}`;
export const DUMMY_OTP = "123456";

export const ALL_FEATURES: SalonFeature[] = [
  "STATIC_WEBSITE",
  "BOOKING",
  "MEMBERSHIP",
  "WEBSHOP",
  "ANALYTICS",
  "LOYALTY_PROGRAM",
];

export const FEATURE_LABEL: Record<SalonFeature, string> = {
  STATIC_WEBSITE: "Website",
  BOOKING: "Booking",
  MEMBERSHIP: "Membership",
  WEBSHOP: "Web Shop",
  ANALYTICS: "Analytics",
  LOYALTY_PROGRAM: "Loyalty Program",
};
