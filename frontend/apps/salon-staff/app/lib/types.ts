export interface Country {
  name: string;
  code: string;
  dialCode: string;
  currencyCode: string;
  currencyName: string | null;
  currencySymbol: string | null;
}

export interface StaffMember {
  id: number;
  salonId: string;
  salonName?: string;
  salonHandler?: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  status: string;
  isOwner?: boolean;
  availableForBooking?: boolean;
  specializations?: string[];
  photoUrl?: string;
  createdAt?: string;
}

export interface PresignedUpload {
  presignedUrl: string;
  publicUrl: string;
}

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
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
  notes?: string;
  createdAt: string;
}

export interface StaffHoliday {
  id: number;
  salonId: string;
  staffId: number;
  overrideDate: string;
  startTime?: string;
  endTime?: string;
  available: boolean;
  reason?: string;
}

export interface StaffSession {
  staffId: number;
  salonId: string;
  salonName?: string;
  salonHandler?: string;
  email: string;
  name: string;
  role: string;
}
