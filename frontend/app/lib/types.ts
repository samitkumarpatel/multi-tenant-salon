export interface Country {
  name: string;
  code: string;
  dialCode: string;
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
  createdAt?: string;
}

export type WebsiteMode = "static" | "ai";

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
  specializations?: string[];
  createdAt?: string;
}

export interface WebsiteTheme {
  saloonId?: string;
  heroBg: string;
  heroTextColor: string;
  accentColor: string;
  fontFamily: string;
  logoBgColor: string;
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
