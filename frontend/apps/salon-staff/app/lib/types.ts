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
  /** Free-text "About me" blurb shown on the public website. */
  bio?: string;
  /** Image and video URLs of the staff member's work, shown on the public website. */
  photoUrls?: string[];
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
  /** All staff accounts (across salons) this person signed in with — lets the
   *  portal offer a switcher instead of only picking once at login. */
  accounts?: StaffMember[];
}
