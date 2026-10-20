import { avatar, button, emptyState, h } from "./dom";
import { dateLabel, dayOfMonth, dayPart, duration, money, monthLabel, parseIso, timeLabel, toIso, todayIso, weekdayShort } from "./format";
import type { SalonApp } from "./runtime";
import { calendarClosures } from "./opening";
import { buildIcs } from "./calendar";

export type Service = { id: number; name: string; description?: string; price?: number; currency?: string; durationMinutes?: number; category?: string; staffIds?: number[] };
export type Staff = { id: number; name: string; role?: string; avatarUrl?: string; specializations?: string[]; bio?: string; workMedia?: string[]; availableForBooking?: boolean; serviceIds?: number[] };
export type Day = { date: string; weekday?: string; status: string; reason?: string; openSlotCount?: number; firstOpenTime?: string; slots?: Slot[] };
export type Slot = { startTime: string; endTime?: string; staffIds?: number[] };

/** Everything needed to book one appointment, collected by whichever app the visitor is in. */
export type Selection = {
  service: Service;
  date: string;
  startTime: string;
  endTime?: string;
  staff?: Staff;
};

const STATUS_HINT: Record<string, string> = {
  OPEN: "Open",
  SALON_CLOSED: "Closed",
  STAFF_OFF: "Off",
  FULLY_BOOKED: "Full",
  PAST: "Past",
  OUTSIDE_WINDOW: "—",
};

export function serviceSummary(service: Service) {
  return [duration(service.durationMinutes), money(service.price, service.currency)].filter(Boolean).join(" · ");
}

/** Service <select>, used where the service is a secondary filter (stylist and week apps). */
export function serviceSelect(services: Service[], selectedId: number | undefined, onChange: (id: number | undefined) => void, placeholder = "Choose a service") {
  return h("label", { class: "field-label" },
    h("span", null, "Service"),
    h("select", {
      class: "field",
      onChange: (event: Event) => {
        const value = (event.target as HTMLSelectElement).value;
        onChange(value ? Number(value) : undefined);
      },
    },
    h("option", { value: "", selected: selectedId === undefined }, placeholder),
    services.map((s) => h("option", { value: String(s.id), selected: s.id === selectedId }, `${s.name}${serviceSummary(s) ? ` — ${serviceSummary(s)}` : ""}`))));
}

/** Stylist <select> with an "any stylist" option. */
export function staffSelect(staff: Staff[], selectedId: number | undefined, onChange: (id: number | undefined) => void) {
  return h("label", { class: "field-label" },
    h("span", null, "Stylist"),
    h("select", {
      class: "field",
      onChange: (event: Event) => {
        const value = (event.target as HTMLSelectElement).value;
        onChange(value ? Number(value) : undefined);
      },
    },
    h("option", { value: "", selected: selectedId === undefined }, "Any available stylist"),
    staff.map((m) => h("option", { value: String(m.id), selected: m.id === selectedId }, m.name))));
}

/** Open times for one day, grouped Morning / Afternoon / Evening. */
export function slotGrid(slots: Slot[], selected: string | undefined, onPick: (slot: Slot) => void, disabled = false) {
  if (!slots.length) return emptyState("No open times this day", "Try another day — the calendar marks the days with availability.");
  const groups = new Map<string, Slot[]>();
  for (const slot of slots) {
    const part = dayPart(slot.startTime);
    groups.set(part, [...(groups.get(part) ?? []), slot]);
  }
  return h("div", { class: "slot-groups" }, [...groups].map(([part, list]) => h("section", { class: "slot-group" },
    h("h3", { class: "section-title" }, `${part} · ${list.length}`),
    h("div", { class: "slot-grid" }, list.map((slot) => button(timeLabel(slot.startTime), () => onPick(slot),
      `slot-card${selected === slot.startTime ? " selected" : ""}`, { disabled, "aria-pressed": String(selected === slot.startTime) }))))));
}

/**
 * A month calendar. Days outside `days` (past or beyond the booking window) are inert; the
 * rest carry their status so closed / off / full days are visibly unavailable with a reason.
 */
export function monthCalendar(opts: {
  month: string;
  days: Day[];
  selected?: string;
  window: { from: string; to: string };
  disabled?: boolean;
  onPick: (date: string) => void;
  onMonth: (month: string) => void;
}) {
  const byDate = new Map(opts.days.map((d) => [d.date, d]));
  const first = parseIso(`${opts.month}-01`);
  const lead = (first.getDay() + 6) % 7; // Monday-first grid
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: Node[] = [];
  for (let i = 0; i < lead; i++) cells.push(h("span", { class: "cal-cell blank", "aria-hidden": "true" }));
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = toIso(new Date(first.getFullYear(), first.getMonth(), d));
    const day = byDate.get(iso);
    const status = day?.status ?? (iso < opts.window.from ? "PAST" : "OUTSIDE_WINDOW");
    const open = status === "OPEN";
    const label = `${dateLabel(iso, "long")}: ${open ? `${day?.openSlotCount ?? ""} open times` : day?.reason ?? STATUS_HINT[status]}`;
    cells.push(h("button", {
      type: "button",
      class: `cal-cell status-${status.toLowerCase()}${opts.selected === iso ? " selected" : ""}${iso === todayIso() ? " today" : ""}`,
      disabled: !open || opts.disabled,
      title: label,
      "aria-label": label,
      onClick: () => opts.onPick(iso),
    }, h("span", { class: "cal-num" }, String(d)), open ? h("span", { class: "cal-dot", "aria-hidden": "true" }) : null));
  }
  const prevMonth = toIso(new Date(first.getFullYear(), first.getMonth() - 1, 1)).slice(0, 7);
  const nextMonth = toIso(new Date(first.getFullYear(), first.getMonth() + 1, 1)).slice(0, 7);
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return h("section", { class: "calendar" },
    h("div", { class: "cal-head" },
      button("‹", () => opts.onMonth(prevMonth), "icon-button", { disabled: opts.disabled || prevMonth < opts.window.from.slice(0, 7), "aria-label": "Previous month" }),
      h("strong", null, monthLabel(opts.month)),
      button("›", () => opts.onMonth(nextMonth), "icon-button", { disabled: opts.disabled || nextMonth > opts.window.to.slice(0, 7), "aria-label": "Next month" })),
    h("div", { class: "cal-grid" }, weekdays.map((w) => h("span", { class: "cal-weekday" }, w)), cells),
    h("div", { class: "cal-legend" },
      h("span", null, h("i", { class: "legend open" }), "Open"),
      h("span", null, h("i", { class: "legend full" }), "Fully booked"),
      h("span", null, h("i", { class: "legend closed" }), "Closed / off")),
    calendarClosures(opts.days));
}

/** A horizontally scrolling strip of day chips (used by the stylist app). */
export function dayStrip(days: Day[], selected: string | undefined, onPick: (date: string) => void, disabled = false) {
  return h("div", { class: "day-strip", role: "list" }, days.map((day) => {
    const open = day.status === "OPEN";
    return h("button", {
      type: "button",
      role: "listitem",
      class: `day-chip status-${day.status.toLowerCase()}${selected === day.date ? " selected" : ""}`,
      disabled: !open || disabled,
      title: open ? `${day.openSlotCount ?? ""} open times` : day.reason ?? "",
      onClick: () => onPick(day.date),
    },
    h("span", { class: "day-chip-weekday" }, weekdayShort(day.date)),
    h("span", { class: "day-chip-num" }, String(dayOfMonth(day.date))),
    h("span", { class: "day-chip-hint" }, open ? (day.firstOpenTime ? `from ${timeLabel(day.firstOpenTime)}` : "Open") : STATUS_HINT[day.status] ?? ""));
  }));
}

/** When several stylists are free at the picked time, let the visitor choose (or take any). */
export function stylistChoice(slot: Slot, staff: Staff[], selectedId: number | undefined, onPick: (id: number | undefined) => void) {
  const free = (slot.staffIds ?? []).map((id) => staff.find((m) => m.id === id)).filter(Boolean) as Staff[];
  if (free.length <= 1) return null;
  return h("section", { class: "panel" },
    h("h3", { class: "section-title" }, `${free.length} stylists are free at ${timeLabel(slot.startTime)}`),
    h("div", { class: "chip-row" },
      button("Any of them", () => onPick(undefined), `chip${selectedId === undefined ? " active" : ""}`),
      free.map((m) => button([avatar(m.name, m.avatarUrl, "avatar xs"), m.name], () => onPick(m.id), `chip${selectedId === m.id ? " active" : ""}`))));
}

export function selectionSummary(sel: Selection) {
  return `${sel.service.name} · ${dateLabel(sel.date, "long")} at ${timeLabel(sel.startTime)}${sel.staff ? ` with ${sel.staff.name}` : ""}`;
}

type Draft = { customerName: string; customerEmail: string; customerPhone: string; notes: string };

/** Where each "Change" in the booking overview takes the visitor — each app wires its own steps. */
export type SelectionEdits = { service?: () => void; staff?: () => void; when?: () => void };

/**
 * The booking overview: service, stylist and date & time as rows, each tappable to go back and
 * change it. Shown on the details and review steps so the visitor always sees what they're booking.
 */
export function selectionCard(sel: Selection, edit: SelectionEdits = {}, disabled = false) {
  const when = `${dateLabel(sel.date, "long")} · ${timeLabel(sel.startTime)}${sel.endTime ? ` – ${timeLabel(sel.endTime)}` : ""}`;
  const rows: [string, string, string, string | undefined, (() => void) | undefined][] = [
    ["✂️", "Service", sel.service.name, serviceSummary(sel.service) || undefined, edit.service],
    ["👤", "Stylist", sel.staff?.name ?? "First available stylist", sel.staff ? undefined : "We'll match you with whoever is free", edit.staff],
    ["📅", "Date & time", when, undefined, edit.when],
  ];
  return h("section", { class: "panel selection-card", "aria-label": "Your booking" },
    h("h3", { class: "section-title" }, "Your booking"),
    h("div", { class: "selection-rows" }, rows.map(([icon, label, value, meta, onEdit]) => {
      const body = [
        h("span", { class: "info-icon", "aria-hidden": "true" }, icon),
        h("span", { class: "row-body" },
          h("span", { class: "row-meta" }, label),
          h("span", { class: "row-title" }, value),
          meta ? h("span", { class: "row-meta" }, meta) : null),
        onEdit ? h("span", { class: "selection-change" }, "Change") : null,
      ];
      return onEdit
        ? button(body, onEdit, "selection-row", { disabled, "aria-label": `Change ${label.toLowerCase()}: ${value}` })
        : h("div", { class: "selection-row static" }, body);
    })));
}

/**
 * Details → review → confirm → confirmation, shared by every booking-capable app. Only a tap on
 * "Confirm booking" calls the app-only create_customer_booking tool.
 */
export class CheckoutFlow {
  stage: "details" | "review" | "done" = "details";
  draft: Draft = { customerName: "", customerEmail: "", customerPhone: "", notes: "" };
  confirmation: Record<string, unknown> | undefined;
  error: string | undefined;
  /** Outcome of "Add to calendar", shown under the actions. */
  calendarNote: string | undefined;

  reset() {
    this.stage = "details";
    this.confirmation = undefined;
    this.error = undefined;
  }

  render(rt: SalonApp<any>, sel: Selection, actions: { onBack: () => void; onDone: () => void; edit?: SelectionEdits }) {
    if (this.stage === "done" && this.confirmation) return this.renderConfirmation(rt, sel, actions.onDone);
    // Any change goes back to picking, so drop a half-finished review.
    const edit = Object.fromEntries(Object.entries(actions.edit ?? {}).map(([key, go]) =>
      [key, () => { this.stage = "details"; this.error = undefined; go(); }])) as SelectionEdits;
    return h("div", { class: "stack" },
      selectionCard(sel, edit, rt.busy),
      this.stage === "review" ? this.renderReview(rt, sel) : this.renderDetails(rt, sel, actions.onBack));
  }

  private renderDetails(rt: SalonApp<any>, sel: Selection, onBack: () => void) {
    const field = (key: keyof Draft, props: Record<string, unknown>) => {
      const tag = key === "notes" ? "textarea" : "input";
      return h(tag as "input", {
        class: "field", name: key, value: this.draft[key], ...props,
        onInput: (event: Event) => { this.draft[key] = (event.target as HTMLInputElement).value; },
      });
    };
    const error = h("p", { class: "error hidden" }, "Enter your name and either an email address or phone number.");
    const form = h("form", {
      class: "booking-form",
      onSubmit: (event: Event) => {
        event.preventDefault();
        const d = this.draft;
        for (const k of Object.keys(d) as (keyof Draft)[]) d[k] = d[k].trim();
        if (!d.customerName || (!d.customerEmail && !d.customerPhone) || !form.reportValidity()) {
          error.classList.remove("hidden");
          return;
        }
        this.stage = "review";
        rt.context(`The visitor is reviewing a booking for ${selectionSummary(sel)} — not confirmed yet.`);
        rt.render();
      },
    },
    field("customerName", { placeholder: "Full name", autocomplete: "name", required: true }),
    h("div", { class: "field-pair" },
      field("customerEmail", { type: "email", placeholder: "Email (or phone)", autocomplete: "email" }),
      field("customerPhone", { type: "tel", placeholder: "Phone (or email)", autocomplete: "tel" })),
    field("notes", { placeholder: "Anything the salon should know? (optional)", rows: 2 }),
    error,
    h("div", { class: "review-actions" },
      button("Back", onBack, "btn"),
      h("button", { type: "submit", class: "btn primary" }, "Review booking")));
    return h("section", { class: "panel" },
      h("h2", { class: "section-title" }, "Your details"),
      form);
  }

  private renderReview(rt: SalonApp<any>, sel: Selection) {
    // Service, stylist and time are in the overview card above; this lists the visitor's details.
    const rows: [string, string][] = [
      ["Name", this.draft.customerName],
      ["Email", this.draft.customerEmail],
      ["Phone", this.draft.customerPhone],
      ["Notes", this.draft.notes],
    ];
    return h("section", { class: "panel" },
      h("div", { class: "pane-head" },
        h("h2", { class: "section-title" }, "Your details"),
        button("Edit", () => { this.stage = "details"; rt.render(); }, "link-button")),
      h("dl", { class: "review-summary" }, rows.filter(([, v]) => v).map(([label, value]) =>
        h("div", { class: "review-row" }, h("dt", null, label), h("dd", null, value)))),
      this.error ? h("p", { class: "error", role: "alert" }, this.error) : null,
      h("p", { class: "muted" }, "Check everything above, then tap Confirm booking to send it to the salon."),
      h("div", { class: "review-actions" },
        button("Edit details", () => { this.stage = "details"; rt.render(); }, "btn"),
        button(rt.busy ? "Booking…" : "Confirm booking", () => void this.confirm(rt, sel), "btn primary", { disabled: rt.busy })));
  }

  private async confirm(rt: SalonApp<any>, sel: Selection) {
    if (rt.busy) return;
    this.error = undefined;
    const outcome = await rt.act<{ booking?: Record<string, unknown> }>("create_customer_booking", {
      serviceId: sel.service.id,
      date: sel.date,
      startTime: sel.startTime,
      staffId: sel.staff?.id,
      customerName: this.draft.customerName,
      customerEmail: this.draft.customerEmail,
      customerPhone: this.draft.customerPhone,
      notes: this.draft.notes,
      customerConfirmed: true,
    });
    if (outcome.ok) {
      this.confirmation = outcome.data.booking ?? { message: "Booking request sent." };
      this.stage = "done";
      const ref = this.confirmation.bookingId != null ? ` (reference #${this.confirmation.bookingId})` : "";
      rt.context(`The visitor just booked ${selectionSummary(sel)}${ref}; status ${String(this.confirmation.status ?? "PENDING")}.`);
    } else {
      this.error = outcome.error;
    }
    rt.render();
  }

  /**
   * The booking confirmation: what was booked (the overview card, now read-only), its status in
   * plain words, and what to do next — add it to a calendar, get directions, call the salon.
   */
  private renderConfirmation(rt: SalonApp<any>, sel: Selection, onDone: () => void) {
    const c = this.confirmation! as Record<string, any>;
    const checkout = typeof c.checkoutUrl === "string" ? c.checkoutUrl : undefined;
    const confirmed = c.status === "CONFIRMED" && !checkout;
    const booked: Selection = {
      ...sel,
      date: typeof c.date === "string" ? c.date : sel.date,
      startTime: typeof c.startTime === "string" ? c.startTime : sel.startTime,
      endTime: typeof c.endTime === "string" ? c.endTime : sel.endTime,
      // The salon assigns the stylist for "any stylist" bookings, so its answer wins.
      staff: c.staffName
        ? (sel.staff && sel.staff.id === Number(c.staffId) ? sel.staff : { id: Number(c.staffId ?? 0), name: String(c.staffName) })
        : sel.staff,
    };
    const location = (c.location ?? {}) as Record<string, string>;
    const address = [location.address, location.city, location.state, location.zipCode, location.country].filter(Boolean).join(", ");
    const salonName = typeof c.salonName === "string" ? c.salonName : "the salon";
    const directions = location.mapsUrl || (address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${salonName}, ${address}`)}` : undefined);
    const phone = typeof c.salonPhone === "string" ? c.salonPhone : undefined;

    const addToCalendar = async () => {
      const ics = buildIcs({
        uid: `booking-${c.bookingId ?? `${booked.date}-${booked.startTime}`}@${rt.salonId || "salon"}`,
        title: `${booked.service.name} at ${salonName}`,
        date: booked.date,
        startTime: booked.startTime,
        endTime: booked.endTime,
        location: address || undefined,
        description: [booked.staff ? `With ${booked.staff.name}.` : "", c.bookingId != null ? `Booking reference #${c.bookingId}.` : "", phone ? `Salon: ${phone}` : ""].filter(Boolean).join(" "),
      });
      this.calendarNote = (await rt.download(`${booked.service.name.replace(/[^\w-]+/g, "-").toLowerCase()}-${booked.date}.ics`, "text/calendar", ics))
        ? "Calendar file ready — open it to add the appointment."
        : "Couldn't save the calendar file here. Add it manually from the details above.";
      rt.render();
    };

    return h("div", { class: "stack" },
      h("section", { class: "panel confirmation" },
        h("div", { class: `confirmation-badge${confirmed ? "" : " pending"}`, "aria-hidden": "true" }, confirmed ? "✓" : checkout ? "💳" : "⏳"),
        h("h2", { class: "section-title" }, confirmed ? "You're booked!" : checkout ? "Almost done — payment needed" : "Request sent"),
        h("p", { class: "muted" }, confirmed
          ? `See you ${dateLabel(booked.date, "long")} at ${timeLabel(booked.startTime)}.`
          : checkout
            ? "Your time is held — complete the payment to confirm it."
            : `${salonName} will confirm your booking shortly — we'll let you know.`),
        h("span", { class: `status-pill ${confirmed ? "ok" : "warn"}` }, confirmed ? "Confirmed" : checkout ? "Payment pending" : "Waiting for the salon to confirm"),
        c.bookingId != null ? h("p", { class: "muted" }, `Booking reference #${String(c.bookingId)}`) : null,
        checkout ? button("Continue to payment", () => rt.openLink(checkout), "btn primary wide") : null),
      selectionCard(booked),
      address || phone ? h("section", { class: "panel" },
        h("h3", { class: "section-title" }, salonName),
        address ? h("p", { class: "detail" }, address) : null,
        phone ? h("p", { class: "muted" }, `Need to change something? Call ${phone}.`) : null) : null,
      h("div", { class: "action-row" },
        button("📅 Add to calendar", () => void addToCalendar(), "btn"),
        directions ? button("📍 Directions", () => rt.openLink(directions), "btn") : null,
        phone ? button("📞 Call", () => rt.openLink(`tel:${phone.replace(/\s+/g, "")}`), "btn") : null),
      this.calendarNote ? h("p", { class: "muted center", role: "status" }, this.calendarNote) : null,
      button("Book something else", () => { this.calendarNote = undefined; onDone(); }, "btn wide"));
  }
}

/** The app-to-app hand-off row: buttons that ask the chat to open a sibling app. */
export function handoffRow(rt: SalonApp<any>, links: [string, string][]) {
  return h("nav", { class: "handoff", "aria-label": "Other ways to book" },
    links.map(([label, message]) => button(label, () => rt.ask(message), "link-button")));
}
