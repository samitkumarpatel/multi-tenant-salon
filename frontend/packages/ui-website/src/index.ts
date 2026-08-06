export { SaloonWebsite, SalonErrorPage, SaloonDisabledPage } from "./SaloonWebsite";
export { GenerativeUIWebsite } from "./GenerativeUIWebsite";
export type { GenerativeUIWebsiteProps } from "./GenerativeUIWebsite";
export { GenerativeUIBooking } from "./GenerativeUIBooking";
export type { GenerativeUIBookingProps } from "./GenerativeUIBooking";
export type { SaloonWebsiteProps } from "./SaloonWebsite";

export { BookingWizard } from "./BookingWizard";
export { FeatureView, FEATURE_VIEWS } from "./FeatureView";
export { SiteHeader, SiteFooter, FEATURE_NAV } from "./SiteChrome";

export { DEFAULT_THEME, FONTS, loadGoogleFont, isLightColor, contrastText, relLuminance } from "./theme";
export { FEATURE_LABEL, DAY_SHORT, STAFF_ROLE_LABEL, CATEGORY_LABEL, formatPrice, formatDate, openDays } from "./constants";
export { apiFetch, API_BASE } from "./api";

export type {
  Saloon, Owner, Location, ContactInfo, OperatingHours,
  StaffMember, ServiceItem, WebsiteTheme, WebsiteMode,
  Booking, BookingStatus, AvailableSlot, StaffAvailability, StaffAvailabilityOverride,
  SaloonClosure, SaloonHoliday,
  Country, Currency,
} from "./types";
