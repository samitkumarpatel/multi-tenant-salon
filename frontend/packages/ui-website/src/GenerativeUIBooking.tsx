import { GenerativeUIWebsite } from "./GenerativeUIWebsite";
import type { Salon, ServiceItem, StaffMember, WebsiteTheme } from "./types";

export interface GenerativeUIBookingProps {
  salon: Salon;
  staff: StaffMember[];
  services: ServiceItem[];
  theme: WebsiteTheme;
  onSwitchToWizard: () => void;
}

/** Booking-focused generative UI — shares all chat logic with GenerativeUIWebsite */
export function GenerativeUIBooking({ salon, staff, services, theme, onSwitchToWizard }: GenerativeUIBookingProps) {
  return (
    <GenerativeUIWebsite
      salon={salon}
      staff={staff}
      services={services}
      theme={theme}
      context="booking"
      onSwitchToWizard={onSwitchToWizard}
    />
  );
}
