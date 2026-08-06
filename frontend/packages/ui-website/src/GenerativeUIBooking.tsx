import { GenerativeUIWebsite } from "./GenerativeUIWebsite";
import type { Saloon, ServiceItem, StaffMember, WebsiteTheme } from "./types";

export interface GenerativeUIBookingProps {
  saloon: Saloon;
  staff: StaffMember[];
  services: ServiceItem[];
  theme: WebsiteTheme;
  onSwitchToWizard: () => void;
}

/** Booking-focused generative UI — shares all chat logic with GenerativeUIWebsite */
export function GenerativeUIBooking({ saloon, staff, services, theme, onSwitchToWizard }: GenerativeUIBookingProps) {
  return (
    <GenerativeUIWebsite
      saloon={saloon}
      staff={staff}
      services={services}
      theme={theme}
      context="booking"
      onSwitchToWizard={onSwitchToWizard}
    />
  );
}
