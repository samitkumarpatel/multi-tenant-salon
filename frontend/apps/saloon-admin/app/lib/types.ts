export type {
  Country, Currency, Owner, Location, ContactInfo, OperatingHours, Saloon, WebsiteMode,
  StaffMember, WebsiteTheme, ServiceItem, BookingStatus, Booking,
  AvailableSlot, StaffAvailability, StaffAvailabilityOverride,
} from "@saloon/ui-website";

import type { Saloon, WebsiteMode } from "@saloon/ui-website";

export interface LayoutContext {
  saloon: Saloon;
  setSaloon: (s: Saloon) => void;
  websiteMode: WebsiteMode | null;
  setWebsiteMode: (m: WebsiteMode | null) => void;
  pendingServices: boolean;
  pendingStaff: boolean;
}
