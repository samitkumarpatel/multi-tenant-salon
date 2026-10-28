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
  /** Custom "Open in Maps" link; when unset the website builds a Google Maps search for the address. */
  mapsUrl?: string;
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
  rating?: number;
  ratingCount?: number;
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
  /** #RRGGBB the booking calendars draw this stylist's appointments in; absent = a palette colour. */
  calendarColor?: string | null;
  /** Public review summary, when supplied by the salon API. */
  rating?: number;
  reviewCount?: number;
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
  websiteType?: string;
  /** How the Generative-UI chat opens. "windowed" = the constrained card; anything else
   *  (incl. the legacy "app" value and undefined) = fullscreen. */
  chatLayout?: "fullscreen" | "windowed" | "app";
  chatBg?: string;
  /** Per-menu footer links, keyed by FOOTER_LINK_KEYS; a missing key = shown with its default label. */
  footerLinks?: Record<string, FooterLinkSetting> | null;
  updatedAt?: string;
}

export interface FooterLinkSetting {
  visible?: boolean;
  /** Owner's wording; blank = the default label. */
  label?: string;
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
  paymentStatus?: "NOT_REQUIRED" | "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  paymentReference?: string | null;
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

export type CommunicationPreference = "ALL" | "IMPORTANT_ONLY";

export type ShopOrderActivityType =
  | "ORDER_PLACED" | "INVOICE_SENT" | "STATUS_CHANGED"
  | "REFUND_INITIATED" | "REFUND_APPROVED" | "REFUND_ACCEPTED" | "REFUND_REJECTED"
  | "CREDIT_NOTE_CREATED" | "CREDIT_PAID"
  | "WORK_NOTE" | "SHIPMENT_CREATED" | "CUSTOMER_NOTIFIED"
  | "RETURN_REQUESTED" | "RETURN_UPDATED";

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

export type ShopRefundStatus = "PENDING" | "APPROVED" | "REJECTED" | "ACCEPTED";

export type ShopOrderStatus =
  | "NEW" | "CONFIRMED" | "PROCESSING" | "READY_TO_SHIP"
  | "SHIPPED" | "DELIVERED" | "FULFILLED"
  | "CANCELLED" | "FAILED" | "ON_HOLD";
export type ShopPaymentStatus = "PENDING" | "AUTHORIZED" | "CAPTURED" | "PAID" | "SETTLED" | "FAILED" | "VOIDED";
export type ShopReturnStatus = "REQUESTED" | "APPROVED" | "REJECTED" | "ITEM_SHIPPED" | "RECEIVED" | "INSPECTING" | "ACCEPTED" | "CLOSED";
export type ShopCreditNoteStatus = "PENDING" | "PAID";
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
  /** Gross shipping weight of one unit in grams. */
  weightGrams?: number | null;
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
  communicationPreference: CommunicationPreference;
  /** Inline refund lifecycle */
  refundAmount?: number | null;
  refundReason?: string | null;
  refundStatus?: ShopRefundStatus | null;
  /** Inline return lifecycle */
  returnStatus?: ShopReturnStatus | null;
  returnReason?: string | null;
  returnNotes?: string | null;
  returnUpdatedAt?: string | null;
  /** Inline credit note */
  creditNoteRef?: string | null;
  creditNoteStatus?: ShopCreditNoteStatus | null;
  creditNoteAt?: string | null;
  /** Shipping chosen at checkout (snapshot). total = subtotal + shippingCost. */
  shippingMethodId?: number | null;
  shippingMethodName?: string | null;
  shippingCost?: number;
  total?: number;
  /** Gross weight of the order in grams. */
  totalWeightGrams?: number | null;
  lines: ShopOrderLine[];
  activities?: ShopOrderActivity[];
}

export type ShippingDeliveryType = "HOME" | "PICKUP_POINT" | "BUSINESS";

/** One shipping method a cart qualifies for, priced for that cart. */
export interface ShopShippingOption {
  id: number;
  name: string;
  description?: string | null;
  carrier?: string | null;
  deliveryType: ShippingDeliveryType;
  cost: number;
  currency: string;
  free: boolean;
  minDeliveryDays?: number | null;
  maxDeliveryDays?: number | null;
}

/** A shipping method as the owner configures it. Unset criteria don't restrict; empty countries = everywhere. */
export interface ShopShippingMethod {
  id: number;
  salonId?: string;
  name: string;
  description?: string | null;
  carrier?: string | null;
  deliveryType: ShippingDeliveryType;
  price: number;
  freeOver?: number | null;
  minOrderValue?: number | null;
  maxOrderValue?: number | null;
  minItems?: number | null;
  maxItems?: number | null;
  minWeightGrams?: number | null;
  maxWeightGrams?: number | null;
  /** The price's currency; only carts in it are offered the method. */
  currency?: string | null;
  minDeliveryDays?: number | null;
  maxDeliveryDays?: number | null;
  sortOrder: number;
  active: boolean;
  createdAt?: string;
  /** ISO 3166-1 alpha-2 codes. */
  countries: string[];
}

/** configured=false: the salon set up no methods and shipping is free. */
export interface ShopShippingQuote {
  configured: boolean;
  options: ShopShippingOption[];
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

// ── Membership ───────────────────────────────────────────────────────────────

export type MembershipBillingInterval = "MONTHLY" | "QUARTERLY" | "YEARLY";
export type MembershipPlanStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type MembershipStatus = "PENDING_PAYMENT" | "ACTIVE" | "EXPIRED" | "CANCELLED" | "INCOMPLETE";
export type MembershipPaymentStatus = "PENDING" | "PAID" | "FAILED";
export type MembershipActivityType =
  | "CHECKOUT_STARTED" | "CHECKOUT_FAILED" | "ACTIVATED" | "RENEWAL_STARTED" | "RENEWED" | "PAYMENT_FAILED" | "EXPIRED"
  | "CANCELLATION_SCHEDULED" | "CANCELLATION_UNDONE" | "CANCELLED" | "CUSTOMER_NOTIFIED" | "NOTE"
  | "CONTACT_UPDATED" | "REFUNDED";

/** A service included in a plan every billing period, with its live name and list price. */
export interface MembershipIncludedService {
  serviceId: number;
  name: string;
  durationMinutes?: number | null;
  price?: number | null;
  currency?: string | null;
  quantityPerCycle: number;
}

export interface MembershipPlan {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  currency: string;
  billingInterval: MembershipBillingInterval;
  signupFee?: number | null;
  serviceDiscountPercent?: number | null;
  productDiscountPercent?: number | null;
  /** Cap on members at once; null = unlimited. */
  maxMembers?: number | null;
  /** Set for capped plans only. */
  spotsLeft?: number | null;
  soldOut: boolean;
  highlighted: boolean;
  sortOrder: number;
  status: MembershipPlanStatus;
  perks: string[];
  includedServices: MembershipIncludedService[];
  /** List price of the included services per period, in the plan's currency. */
  includedValue?: number | null;
  /** Admin only. */
  activeMembers?: number;
  createdAt?: string;
  updatedAt?: string;
}

/** The public catalogue: plans on sale, and whether visitors can join online right now. */
export interface MembershipCatalog {
  plans: MembershipPlan[];
  onlineSignup: boolean;
}

export interface MembershipSubscription {
  id: number;
  salonId: string;
  planId: number;
  planName: string;
  memberCode: string;
  /** Secret in the renewal link the member is emailed. */
  renewalToken: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  status: MembershipStatus;
  price: number;
  currency: string;
  billingInterval: MembershipBillingInterval;
  signupFee?: number | null;
  source: "ONLINE" | "ADMIN";
  startedAt?: string | null;
  /** Paid through — each payment buys one billing period. */
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd: boolean;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  endedAt?: string | null;
  /** The period end the last renewal reminder was sent for. */
  renewalReminderFor?: string | null;
  lastPaymentStatus?: MembershipPaymentStatus | null;
  lastPaymentAt?: string | null;
  lastPaymentAmount?: number | null;
  createdAt: string;
}

/** One one-time Stripe Checkout for one billing period (sign-up or renewal). */
export interface MembershipPayment {
  id: number;
  subscriptionId: number;
  kind: "SIGNUP" | "RENEWAL";
  status: MembershipPaymentStatus;
  /** CARD is a Stripe Checkout; CASH/OTHER were taken at the salon desk. */
  method: "CARD" | "CASH" | "OTHER";
  amount: number;
  currency: string;
  checkoutSessionId?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  paidAt?: string | null;
  createdAt: string;
  /** Running total given back to the member; repeated partial refunds accumulate here. */
  refundedAmount?: number | null;
  refundedAt?: string | null;
  refundReason?: string | null;
}

/** What a renewal link shows (public, by token). */
export interface MembershipRenewal {
  subscriptionId: number;
  planName: string;
  firstName: string;
  price: number;
  currency: string;
  billingInterval: MembershipBillingInterval;
  status: MembershipStatus;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd: boolean;
  canRenewNow: boolean;
  onlinePayment: boolean;
}

export interface MembershipActivity {
  id: number;
  subscriptionId: number;
  type: MembershipActivityType;
  message: string;
  actor: string;
  createdAt: string;
}

export interface MembershipDetail {
  subscription: MembershipSubscription;
  payments: MembershipPayment[];
  activity: MembershipActivity[];
}

export interface MembershipMoney {
  currency: string;
  amount: number;
}

export interface MembershipOverview {
  activeMembers: number;
  /** Lapsed without renewing; can still renew from their link. */
  expiredMembers: number;
  pendingCheckouts: number;
  newThisMonth: number;
  cancelledThisMonth: number;
  renewalsNext7Days: number;
  renewalsNext30Days: number;
  monthlyRecurringRevenue: MembershipMoney[];
  collectedThisMonth: MembershipMoney[];
  plans: { planId: number; name: string; status: MembershipPlanStatus; activeMembers: number; maxMembers?: number | null; monthlyRecurringRevenue: MembershipMoney }[];
  upcomingRenewals: MembershipSubscription[];
  recentActivity: (MembershipActivity & { customerName: string; planName: string })[];
}

// ── Customer self-service account ─────────────────────────────────────────────

export interface CustomerSession {
  sessionToken: string;
  email: string;
  expiresAt: string;
}

export interface CustomerBooking {
  id: number;
  serviceName: string | null;
  durationMinutes: number | null;
  price: number | null;
  currency: string | null;
  staffName: string | null;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  paymentStatus: string | null;
  notes: string | null;
  createdAt: string;
  /** What the salon's policy lets the customer do to this appointment right now. */
  canCancel: boolean;
  canReschedule: boolean;
  /** Why an upcoming appointment can't be cancelled and/or moved online. */
  blockedReason: "TOO_LATE" | "PAID" | "DISABLED" | null;
  serviceId: number | null;
  staffId: number | null;
}

export interface CustomerRatingOption {
  bookingId: number;
  staffId: number | null;
  serviceName: string | null;
  staffName: string | null;
  appointmentDate: string;
  submitted: boolean;
  salonFeedback: string | null;
  staffFeedback: string | null;
  /** The salon owner's answer, if any. */
  reply: string | null;
  repliedAt: string | null;
}

export interface LoyaltyProgram {
  enabled: boolean;
  pointsPerUnit: number;
  earnOnBookings: boolean;
  earnOnOrders: boolean;
  expiryMonths: number | null;
}

export interface LoyaltyReward {
  id: number;
  name: string;
  description: string | null;
  pointsCost: number;
  type: "DISCOUNT_AMOUNT" | "FREE_SERVICE" | "FREE_PRODUCT" | "CUSTOM";
  value: number | null;
  active: boolean;
}

export interface LoyaltyEntry {
  id: number;
  delta: number;
  reason: string;
  note: string | null;
  createdAt: string;
  expiresAt: string | null;
}

export interface LoyaltyRedemption {
  id: number;
  rewardName: string;
  points: number;
  code: string;
  status: "ISSUED" | "USED" | "CANCELLED";
  createdAt: string;
  usedAt: string | null;
}

/** `GET /api/salon/{id}/loyalty` (rules only, balance 0) and `GET …/account/loyalty` (the signed-in customer's own data). */
export interface CustomerLoyalty {
  enabled: boolean;
  balance: number;
  program: LoyaltyProgram;
  rewards: LoyaltyReward[];
  history: LoyaltyEntry[];
  redemptions: LoyaltyRedemption[];
}

export interface CustomerSelfServicePolicy {
  allowCancel: boolean;
  cancelNoticeHours: number;
  allowReschedule: boolean;
  rescheduleNoticeHours: number;
}

export interface CustomerOrder {
  id: number;
  orderNumber: string;
  createdAt: string;
  status: ShopOrderStatus;
  paymentStatus: ShopPaymentStatus;
  currency: string;
  subtotal: number;
  shippingCost: number;
  total: number;
  shippingMethodName: string | null;
  shippingAddress: ShopShippingAddress | null;
  trackingCarrier: string | null;
  trackingNumber: string | null;
  refundStatus: string | null;
  refundAmount: number | null;
  returnStatus: string | null;
  lines: { productName: string; variantLabel: string | null; unitPrice: number; quantity: number; lineTotal: number }[];
  timeline: { type: string; message: string | null; createdAt: string }[];
}

export interface CustomerMembership {
  id: number;
  planName: string;
  memberCode: string;
  status: MembershipStatus;
  price: number;
  currency: string;
  billingInterval: MembershipBillingInterval;
  startedAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  endedAt: string | null;
  /** Present only while the membership can be renewed; opens the website's renewal screen. */
  renewalToken: string | null;
  /** PNG data URL of the check-in QR code, while the membership is active. */
  qrCode: string | null;
  payments: {
    kind: "SIGNUP" | "RENEWAL";
    status: MembershipPaymentStatus;
    method: "CARD" | "CASH" | "OTHER";
    amount: number;
    currency: string;
    periodStart: string | null;
    periodEnd: string | null;
    paidAt: string | null;
    refundedAmount: number | null;
    createdAt: string;
  }[];
}

export interface CustomerAccount {
  profile: { email: string; name: string | null; phone: string | null };
  bookings: CustomerBooking[];
  orders: CustomerOrder[];
  memberships: CustomerMembership[];
  selfService: CustomerSelfServicePolicy;
}
