import React from "react";
import {
  ServicesCard, StaffCard, StaffProfileCard, HoursCard, LocationCard, ContactCard, type CardTokens,
} from "./GenerativeUICards";
import { DatePickerCard, TimeSlotPickerCard, FormCard, ChoiceCard } from "./GenerativeUIInteractive";
import type { ClosureRange } from "./bookingDates";
import type { Salon, ServiceItem, StaffMember } from "./types";

/**
 * One interactive element the assistant asked the frontend to render this turn, exactly as it
 * came back from `POST /chat` — `type` maps to a component here, `props` is model-authored UI
 * scaffolding (ids, flags, labels). Any `type` this registry doesn't know is ignored, so a
 * renamed or future component can never break a turn.
 */
export type UIComponent = { type: string; props: Record<string, unknown> };

/** Live salon data + handlers a rendered component may need to hydrate itself / act. */
export type GenUICtx = {
  salon: Salon;
  staff: StaffMember[];
  services: ServiceItem[];
  closedDateRanges: ClosureRange[];
  canBook: boolean;
};

const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

/**
 * Renders every Gen-UI component type EXCEPT `booking-picker` — that one is wired directly in
 * `GenerativeUIWebsite` because its callbacks (complete / cancel / progress / carry-forward)
 * are coupled to the message thread. Returns `null` when there's nothing to show (unknown type,
 * or the salon data behind a data card is empty) so the caller can fall back gracefully.
 */
export function GenUIComponent({
  component, tokens, ctx, onAnswer, onBookService, onBookStaff, onViewProfile,
}: {
  component: UIComponent;
  tokens: CardTokens;
  ctx: GenUICtx;
  onAnswer: (value: string) => void;
  onBookService: (service: ServiceItem, staffId?: number) => void;
  onBookStaff: (member: StaffMember) => void;
  onViewProfile?: (member: StaffMember) => void;
}): React.ReactElement | null {
  const { salon, staff, services, closedDateRanges, canBook } = ctx;
  const props = component.props ?? {};

  switch (component.type) {
    case "services": {
      const forStaffId = num(props.forStaffId);
      const filtered = forStaffId != null
        ? services.filter((s) => s.active && (!s.assignedStaffIds?.length || s.assignedStaffIds.includes(String(forStaffId))))
        : services;
      if (!filtered.some((s) => s.active)) return null;
      return <ServicesCard services={filtered} tokens={tokens} showBookPill={canBook} onBook={(s) => onBookService(s, forStaffId)} />;
    }
    case "staff": {
      const forServiceId = num(props.forServiceId);
      const svc = forServiceId != null ? services.find((s) => s.id === forServiceId) : undefined;
      const filtered = svc && svc.assignedStaffIds?.length
        ? staff.filter((m) => svc.assignedStaffIds!.includes(String(m.id)))
        : staff;
      if (!filtered.some((m) => m.status === "ACTIVE")) return null;
      return <StaffCard staff={filtered} tokens={tokens} showBookPill={canBook} onBook={onBookStaff} onViewProfile={onViewProfile} />;
    }
    case "staff-profile": {
      const staffId = num(props.staffId);
      const member = staff.find((m) => m.id === staffId && m.status === "ACTIVE");
      if (!member) return null;
      return <StaffProfileCard member={member} tokens={tokens} showBookPill={canBook} onBook={onBookStaff} />;
    }
    case "hours":
      return salon.operatingHours?.length ? <HoursCard salon={salon} tokens={tokens} /> : null;
    case "location":
      return salon.location?.address || salon.location?.city ? <LocationCard salon={salon} tokens={tokens} /> : null;
    case "contact":
      return salon.contact?.phone || salon.contact?.email || salon.contact?.website ? <ContactCard salon={salon} tokens={tokens} /> : null;

    case "date-picker":
      return <DatePickerCard props={props} tokens={tokens} salon={salon} closedDateRanges={closedDateRanges} onAnswer={onAnswer} />;
    case "time-slot-picker":
      return <TimeSlotPickerCard props={props} tokens={tokens} salon={salon} closedDateRanges={closedDateRanges} onAnswer={onAnswer} />;
    case "form":
      return <FormCard props={props} tokens={tokens} salon={salon} closedDateRanges={closedDateRanges} onAnswer={onAnswer} />;
    case "button-group":
    case "radio-group":
    case "checkbox-group":
    case "option-list":
      return (
        <ChoiceCard
          variant={component.type}
          props={props} tokens={tokens} salon={salon} closedDateRanges={closedDateRanges} onAnswer={onAnswer}
        />
      );

    default:
      return null;
  }
}
