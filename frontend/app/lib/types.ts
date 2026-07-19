export interface Country {
  name: string;
  code: string;
  dialCode: string;
  currencyCode: string;
  currencyName: string | null;
  currencySymbol: string | null;
}

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
  openTime: string;
  closeTime: string;
  closed: boolean;
}

export interface Saloon {
  id: number;
  name: string;
  handler?: string;
  owner: Owner;
  location?: Location;
  contact?: ContactInfo;
  operatingHours?: OperatingHours[];
  features?: string[];
  bookingAdvanceDays?: number;
  createdAt?: string;
}

export type WebsiteMode = "STATIC_WEBSITE" | "GENERATIVE_UI" | "CUSTOMISE_WEBSITE_CONTACT_US";

export interface LayoutContext {
  saloon: Saloon;
  setSaloon: (s: Saloon) => void;
  websiteMode: WebsiteMode | null;
  setWebsiteMode: (m: WebsiteMode | null) => void;
}

export interface StaffMember {
  id: number;
  saloonId: number;
  name: string;
  email: string;
  phone?: string;
  role: string;
  status: string;
  isOwner?: boolean;
  availableForBooking?: boolean;
  specializations?: string[];
  /** Single photo (legacy) — prefer photoUrls going forward */
  photoUrl?: string;
  /** One or more photos of the staff member */
  photoUrls?: string[];
  /** Short bio / description shown on the website */
  bio?: string;
  createdAt?: string;
}

export interface WebsiteTheme {
  saloonId?: string;
  heroBg: string;
  heroTextColor: string;
  accentColor: string;
  fontFamily: string;
  logoBgColor: string;
  headerBg: string;
  footerBg: string;
  mapsUrl?: string;
  websiteType?: WebsiteMode;
  updatedAt?: string;
}

export interface ServiceItem {
  id: number;
  saloonId: number;
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

export type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";

export interface Booking {
  id: number;
  saloonId: string;
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

export interface AvailableSlot {
  staffId: number;
  startTime: string;
  endTime: string;
  booked?: boolean;
}

export interface StaffAvailability {
  id: number;
  saloonId: string;
  staffId: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  available: boolean;
}

export interface StaffAvailabilityOverride {
  id: number;
  saloonId: string;
  staffId: number;
  overrideDate: string;
  startTime?: string;
  endTime?: string;
  available: boolean;
  reason?: string;
}
