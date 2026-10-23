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
