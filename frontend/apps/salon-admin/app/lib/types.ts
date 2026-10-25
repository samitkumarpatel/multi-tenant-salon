export type {
  Country, Currency, Owner, Location, ContactInfo, OperatingHours, Salon, WebsiteMode,
  StaffMember, WebsiteTheme, ServiceItem, BookingStatus, Booking,
  AvailableSlot, StaffAvailability, StaffAvailabilityOverride, SalonClosure, SalonHoliday,
  ShopBrand, ShopCategory, ShopVariant, ShopProduct, ShopInventoryRow,
  ShopShippingAddress, ShopShippingMethod, ShopShippingOption, ShopShippingQuote, ShippingDeliveryType, ShopOrder, ShopOrderLine, ShopOrderStatus, ShopPaymentStatus,
  OrderLineActivity, OrderLineActivityType, ShopRefundStatus, ShopReturnStatus, ShopCreditNoteStatus,
  ShopOrderActivity, ShopOrderActivityType,
  CommunicationPreference,
  MembershipBillingInterval, MembershipPlanStatus, MembershipStatus, MembershipPaymentStatus,
  MembershipActivityType, MembershipIncludedService, MembershipPlan, MembershipCatalog,
  MembershipSubscription, MembershipPayment, MembershipActivity, MembershipDetail, MembershipRenewal,
  MembershipMoney, MembershipOverview,
} from "@salon/ui-website";

import type { Salon, WebsiteMode } from "@salon/ui-website";

export interface LayoutContext {
  salon: Salon;
  setSalon: (s: Salon) => void;
  websiteMode: WebsiteMode | null;
  setWebsiteMode: (m: WebsiteMode | null) => void;
  pendingServices: boolean;
  pendingStaff: boolean;
  pendingWebsite: boolean;
}

// ── Customers ────────────────────────────────────────────────────────────────

export interface SalonCustomer {
  id: number;
  salonId: string;
  name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
}

export interface SalonCustomerPage {
  content: SalonCustomer[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/** What the salon holds under a customer's email — the shape of the customer's own account. */
export interface SalonCustomerHistory {
  bookings: { id: number; serviceName: string | null; staffName: string | null; appointmentDate: string; startTime: string; status: string }[];
  orders: { id: number; orderNumber: string; createdAt: string; status: string; currency: string; total: number }[];
  memberships: { id: number; planName: string; status: string; currentPeriodEnd: string | null }[];
}

export interface SalonCustomerDetail {
  customer: SalonCustomer;
  history: SalonCustomerHistory;
  canDelete: boolean;
  deleteBlockedReason: string | null;
}
