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
  owner: Owner;
  location?: Location;
  contact?: ContactInfo;
  operatingHours?: OperatingHours[];
  features?: string[];
  createdAt?: string;
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

export interface LayoutContext {
  saloon: Saloon;
  setSaloon: (s: Saloon) => void;
}
