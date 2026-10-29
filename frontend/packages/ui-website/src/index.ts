export { SalonWebsite, SalonErrorPage, SalonDisabledPage } from "./SalonWebsite";
export { GenerativeUIWebsite } from "./GenerativeUIWebsite";
export type { GenerativeUIWebsiteProps } from "./GenerativeUIWebsite";
export { GenerativeUIBooking } from "./GenerativeUIBooking";
export type { GenerativeUIBookingProps } from "./GenerativeUIBooking";
export type { SalonWebsiteProps } from "./SalonWebsite";

export { BookingWizard } from "./BookingWizard";
export { noShowFeeFor } from "./bookingFee";
export type { BookingFeePolicy } from "./bookingFee";
export { CustomerDetailsFields } from "./CustomerDetailsFields";
export type { CustomerBookingForm, ContactMethod } from "./CustomerDetailsFields";
export { FeatureView, FEATURE_VIEWS } from "./FeatureView";
export { SiteHeader, SiteFooter, FEATURE_NAV, FOOTER_LINK_MENUS, footerMenuLinks, AccountButton, hasCustomerAccount } from "./SiteChrome";
export { CustomerAccountView, CustomerAccountPanel, CustomerAccountDrawer, siteAccountLinks, useCustomerSession } from "./CustomerAccount";
export type { CustomerAccountViewProps, CustomerAccountPanelProps, CustomerAccountLinks, AccountPage } from "./CustomerAccount";
export { SalonPolicyLinks, policiesForSurface } from "./SalonPolicyLinks";
export type { SalonPolicy, PolicySurface } from "./SalonPolicyLinks";
export { SocialLinksRow, SOCIAL_PLATFORMS } from "./SocialIcons";
export type { SocialPlatform, SocialPlatformKey } from "./SocialIcons";
export { CategoryIcon, CATEGORY_ICON } from "./CategoryIcon";
export { useIsScrollable } from "./useIsScrollable";

export { DEFAULT_THEME, FONTS, loadGoogleFont, fontStack, isLightColor, contrastText, relLuminance } from "./theme";
// The full Google Fonts list is a large data module — imported directly from
// "@salon/ui-website/google-fonts" by the admin font picker, deliberately not re-exported here
// so it stays out of the public website bundle.
export { FEATURE_LABEL, DAY_SHORT, STAFF_ROLE_LABEL, CATEGORY_LABEL, isVideoUrl, formatPrice, formatDate, openDays } from "./constants";
export { apiFetch, API_BASE } from "./api";
export { beginCheckout, StripeCheckoutPanel } from "./StripeCheckout";
export type { CheckoutInstructions, CheckoutResult, CheckoutUi, CheckoutBranding, StripeCheckoutPanelProps } from "./StripeCheckout";
export { ApiError, errorFromResponse, networkError, friendlyMessage, isAuthError, isNotFoundError, reportApiError } from "./apiError";
export { ErrorState, ErrorNote, RouteErrorBoundary } from "./ErrorState";
export type { ErrorStateProps, ErrorNoteProps } from "./ErrorState";

export type {
  Salon, Owner, Location, ContactInfo, OperatingHours,
  StaffMember, ServiceItem, WebsiteTheme, FooterLinkSetting, WebsiteMode,
  Booking, BookingStatus, AvailableSlot, StaffAvailability, StaffAvailabilityOverride,
  SalonClosure, SalonHoliday,
  Country, Currency,
  ShopBrand, ShopCategory, ShopVariant, ShopProduct, ShopInventoryRow,
  ShopShippingAddress, ShopShippingMethod, ShopShippingOption, ShopShippingQuote, ShippingDeliveryType, ShopOrder, ShopOrderLine, ShopOrderStatus, ShopPaymentStatus,
  OrderLineActivity, OrderLineActivityType, CartLine,
  ShopRefundStatus, ShopReturnStatus, ShopCreditNoteStatus,
  ShopOrderActivity, ShopOrderActivityType,
  CommunicationPreference,
  MembershipBillingInterval, MembershipPlanStatus, MembershipStatus, MembershipPaymentStatus,
  MembershipActivityType, MembershipIncludedService, MembershipPlan, MembershipCatalog,
  MembershipSubscription, MembershipPayment, MembershipActivity, MembershipDetail, MembershipRenewal,
  MembershipMoney, MembershipOverview,
  CustomerSession, CustomerAccount, CustomerBooking, CustomerOrder, CustomerMembership,
  CustomerLoyalty, LoyaltyProgram, LoyaltyReward, LoyaltyEntry, LoyaltyRedemption,
} from "./types";

export { ShopView } from "./ShopView";
export { MembershipView, membershipBenefits } from "./MembershipView";
export { LoyaltyView } from "./LoyaltyView";
export type { LoyaltyViewProps } from "./LoyaltyView";
export type { MembershipViewProps } from "./MembershipView";
export type { ShopViewProps } from "./ShopView";
export {
  useCart, readCart, addToCart, setCartQty, removeFromCart, clearCart, cartCount, cartSubtotal,
} from "./shopCart";

export { FeedbackProvider, FeedbackLink, FeedbackView, FeedbackStars } from "./Feedback";
export type { FeedbackSettings } from "./Feedback";
