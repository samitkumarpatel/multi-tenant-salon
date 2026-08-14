export { SalonWebsite, SalonErrorPage, SalonDisabledPage } from "./SalonWebsite";
export { GenerativeUIWebsite } from "./GenerativeUIWebsite";
export type { GenerativeUIWebsiteProps } from "./GenerativeUIWebsite";
export { GenerativeUIBooking } from "./GenerativeUIBooking";
export type { GenerativeUIBookingProps } from "./GenerativeUIBooking";
export type { SalonWebsiteProps } from "./SalonWebsite";

export { BookingWizard } from "./BookingWizard";
export { FeatureView, FEATURE_VIEWS } from "./FeatureView";
export { SiteHeader, SiteFooter, FEATURE_NAV } from "./SiteChrome";

export { DEFAULT_THEME, FONTS, loadGoogleFont, isLightColor, contrastText, relLuminance } from "./theme";
export { FEATURE_LABEL, DAY_SHORT, STAFF_ROLE_LABEL, CATEGORY_LABEL, formatPrice, formatDate, openDays } from "./constants";
export { apiFetch, API_BASE } from "./api";

export type {
  Salon, Owner, Location, ContactInfo, OperatingHours,
  StaffMember, ServiceItem, WebsiteTheme, WebsiteMode,
  Booking, BookingStatus, AvailableSlot, StaffAvailability, StaffAvailabilityOverride,
  SalonClosure, SalonHoliday,
  Country, Currency,
} from "./types";
