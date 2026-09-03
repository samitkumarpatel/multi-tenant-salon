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

export interface Currency {
  code: string;
  name: string;
  symbol: string;
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
  /** Social profile URLs plus a per-platform `*Visible` flag: the owner opts each platform
   *  into the public website footer independently; a visible platform with no URL renders as a
   *  disabled icon. */
  facebook?: string;
  facebookVisible?: boolean;
  instagram?: string;
  instagramVisible?: boolean;
  tiktok?: string;
  tiktokVisible?: boolean;
  youtube?: string;
  youtubeVisible?: boolean;
  x?: string;
  xVisible?: boolean;
}

export interface OperatingHours {
  day: string;
  openTime: string;
  closeTime: string;
  closed: boolean;
}

export interface Salon {
  id: number;
  name: string;
  handler?: string;
  owner: Owner;
  location?: Location;
  contact?: ContactInfo;
  operatingHours?: OperatingHours[];
  features?: string[];
  bookingAdvanceDays?: number;
  bookingRequiresConfirmation?: boolean;
  businessRegistrationId?: string;
  showBusinessId?: boolean;
  businessIdLabel?: string;
  createdAt?: string;
  status?: "ACTIVE" | "DISABLED";
}

export type WebsiteMode = "STATIC_WEBSITE" | "GENERATIVE_UI" | "CUSTOMISE_WEBSITE_CONTACT_US";

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
  avatarUrl?: string;
  workMedia?: string[];
  bio?: string;
  createdAt?: string;
}

export interface WebsiteTheme {
  salonId?: string;
  heroBg: string;
  heroTextColor: string;
  accentColor: string;
  fontFamily: string;
  logoBgColor: string;
  headerBg: string;
  footerBg: string;
  mapsUrl?: string;
  websiteType?: string;
  /** How the Generative-UI chat opens. "windowed" = the constrained card; anything else
   *  (incl. the legacy "app" value and undefined) = fullscreen. */
  chatLayout?: "fullscreen" | "windowed" | "app";
  chatBg?: string;
  updatedAt?: string;
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

export interface AvailableSlot {
  staffId: number;
  startTime: string;
  endTime: string;
  booked?: boolean;
}

/** A staff member's non-working days: recurring weekdays off, plus one-off unavailable dates. */
export interface StaffSchedule {
  closedWeekdays: string[];
  closedDates: string[];
}

export interface StaffAvailability {
  id: number;
  salonId: string;
  staffId: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  available: boolean;
}

export interface StaffAvailabilityOverride {
  id: number;
  salonId: string;
  staffId: number;
  overrideDate: string;
  startTime?: string;
  endTime?: string;
  available: boolean;
  reason?: string;
}

export interface SalonClosure {
  id: number;
  salonId: string;
  startDate: string;
  endDate: string;
  reason?: string;
  holidayId?: number | null;
}

/** A named holiday. When {@code year} is null/undefined it repeats every year. */
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

// ── Shop / web-shop ─────────────────────────────────────────────────────────

export type ShopOrderActivityType =
  | "ORDER_PLACED" | "INVOICE_SENT" | "STATUS_CHANGED"
  | "REFUND_INITIATED" | "REFUND_ACCEPTED" | "REFUND_REJECTED"
  | "CREDIT_NOTE_CREATED" | "CREDIT_PAID"
  | "WORK_NOTE" | "SHIPMENT_CREATED" | "CUSTOMER_NOTIFIED";

export interface ShopOrderActivity {
  id: number;
  orderId: number;
  salonId?: string;
  type: ShopOrderActivityType;
  message?: string | null;
  actor?: string | null;
  notified: boolean;
  /** CUSTOMER_NOTIFIED only — the exact message the customer received. */
  channel?: string | null;
  subject?: string | null;
  body?: string | null;
  status?: string | null;
  createdAt: string;
}

export type ShopRefundStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export interface ShopRefund {
  id: number;
  salonId?: string;
  orderId: number;
  amount: number;
  reason?: string | null;
  status: ShopRefundStatus;
  createdAt: string;
}

export interface ShopCreditNote {
  id: number;
  salonId?: string;
  orderId: number;
  amount: number;
  reason?: string | null;
  reference?: string | null;
  status?: string | null;
  createdAt: string;
}

export type ShopOrderStatus = "NEW" | "PROCESSING" | "SHIPPED" | "FULFILLED" | "CANCELLED";
export type ShopPaymentStatus = "PENDING" | "PAID";
export type OrderLineActivityType = "LINE_CREATED" | "STATUS_CHANGED" | "USER_NOTIFIED" | "NOTE_ADDED";

export interface ShopBrand {
  id: number;
  salonId?: string;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  active: boolean;
  createdAt?: string;
}

export interface ShopCategory {
  id: number;
  salonId?: string;
  name: string;
  description?: string | null;
  active: boolean;
  createdAt?: string;
}

export interface ShopVariant {
  id: number;
  productId: number;
  salonId?: string;
  sku?: string | null;
  label?: string | null;
  price: number;
  compareAtPrice?: number | null;
  currency: string;
  quantityOnHand: number;
  reorderLevel: number;
  active: boolean;
}

export interface ShopProduct {
  id: number;
  salonId?: string;
  brandId?: number | null;
  brandName?: string | null;
  categoryId?: number | null;
  categoryName?: string | null;
  name: string;
  description?: string | null;
  /** Cover image — always mirrors `images[0]`. */
  imageUrl?: string | null;
  /** Ordered gallery (includes the cover as the first entry). */
  images?: string[] | null;
  active: boolean;
  createdAt?: string;
  variants: ShopVariant[];
}

export interface ShopInventoryRow {
  variantId: number;
  productId: number;
  productName: string;
  productActive: boolean;
  sku?: string | null;
  label?: string | null;
  price: number;
  currency: string;
  quantityOnHand: number;
  reorderLevel: number;
  active: boolean;
}

export interface ShopShippingAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
}

export interface OrderLineActivity {
  id: number;
  orderLineId: number;
  type: OrderLineActivityType;
  message?: string | null;
  actor?: string | null;
  createdAt: string;
}

export interface ShopOrderLine {
  id: number;
  productId?: number | null;
  variantId?: number | null;
  productName: string;
  variantLabel?: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  activities: OrderLineActivity[];
}

export interface ShopOrder {
  id: number;
  salonId?: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  shippingAddress?: ShopShippingAddress | null;
  status: ShopOrderStatus;
  paymentStatus: ShopPaymentStatus;
  paymentReference?: string;
  subtotal: number;
  currency: string;
  createdAt: string;
  trackingCarrier?: string | null;
  trackingNumber?: string | null;
  lines: ShopOrderLine[];
  activities?: ShopOrderActivity[];
}

/** A single line held in the browser-side shopping cart (localStorage). */
export interface CartLine {
  variantId: number;
  productId: number;
  productName: string;
  variantLabel?: string | null;
  unitPrice: number;
  currency: string;
  quantity: number;
  imageUrl?: string | null;
  /** Stock ceiling captured when the item was added, so the stepper can't exceed it. */
  maxQuantity: number;
}
