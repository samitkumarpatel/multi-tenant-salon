import { button, h } from "./dom";
import { dateLabel, timeLabel, todayIso } from "./format";
import type { Data, SalonApp } from "./runtime";
import {
  CheckoutFlow, monthCalendar, serviceSummary, slotGrid, stylistChoice,
  type Day, type Selection, type Service, type Slot, type Staff,
} from "./booking";

/** The slice of a `salon_booking` result this pane needs. */
export type BookingData = Data & {
  services?: Service[];
  staff?: Staff[];
  month?: string;
  days?: Day[];
  date?: string;
  slots?: Slot[];
  bookingWindow?: { from: string; to: string };
};

/**
 * Month calendar → open times → (stylist) → details → confirm, for one service. Backed by the
 * `salon_booking` tool so any app — services, team, the booking wizard — gets the same real
 * availability and the same confirmation step.
 */
export class InlineBooking {
  service: Service | undefined;
  staff: Staff | undefined;
  roster: Staff[] = [];
  month = todayIso().slice(0, 7);
  days: Day[] = [];
  window = { from: todayIso(), to: todayIso() };
  date: string | undefined;
  slots: Slot[] = [];
  slot: Slot | undefined;
  /** Stylist picked for the slot when the visitor booked "any stylist" and several are free. */
  slotStaffId: number | undefined;
  checkout = new CheckoutFlow();
  /** "pick" = calendar + times on screen; "checkout" = details/review/confirmation. */
  phase: "pick" | "checkout" = "pick";
  loading = false;
  error: string | undefined;

  get active() {
    return this.service !== undefined;
  }

  /**
   * Opens the pane for a service (and optional stylist), loading this month's calendar. With a
   * date and start time (a "next available" shortcut) that time comes pre-selected, if still open.
   */
  async start(rt: SalonApp<any>, service: Service, staff?: Staff, date?: string, startTime?: string, slotStaffId?: number) {
    this.service = service;
    this.staff = staff;
    this.date = undefined;
    this.slot = undefined;
    this.phase = "pick";
    this.checkout = new CheckoutFlow();
    rt.context(`The visitor is booking ${service.name}${staff ? ` with ${staff.name}` : ""} and choosing a date.`);
    await this.load(rt, { month: date?.slice(0, 7) ?? this.month, date });
    const slot = startTime ? this.slots.find((s) => s.startTime === startTime) : undefined;
    if (slot) {
      this.slot = slot;
      this.slotStaffId = !staff && slotStaffId && slot.staffIds?.includes(slotStaffId) ? slotStaffId : undefined;
      rt.render();
    }
  }

  /** Adopts a `salon_booking` result the app already has (e.g. the model opened it on a date). */
  hydrate(data: BookingData, services: Service[], staff: Staff[]) {
    this.roster = staff;
    if (data.bookingWindow) this.window = data.bookingWindow;
    if (data.month) this.month = data.month;
    const service = services.find((s) => s.id === data.serviceId);
    if (!service) return;
    this.service = service;
    this.staff = staff.find((m) => m.id === data.staffId);
    this.days = data.days ?? [];
    this.date = data.date || undefined;
    this.slots = data.slots ?? [];
  }

  close() {
    this.phase = "pick";
    this.service = undefined;
    this.staff = undefined;
    this.date = undefined;
    this.slot = undefined;
  }

  private async load(rt: SalonApp<any>, args: { month?: string; date?: string }) {
    if (!this.service) return;
    this.loading = true;
    this.error = undefined;
    rt.render();
    const outcome = await rt.call<BookingData>("salon_booking", {
      serviceId: this.service.id, staffId: this.staff?.id, month: args.month, date: args.date,
    });
    this.loading = false;
    if (outcome.ok) {
      const d = outcome.data;
      this.roster = d.staff ?? this.roster;
      this.window = d.bookingWindow ?? this.window;
      this.month = d.month ?? this.month;
      this.days = d.days ?? [];
      this.date = d.date || undefined;
      this.slots = d.slots ?? [];
      this.slot = undefined;
    } else {
      this.error = outcome.error;
    }
    rt.render();
  }

  selection(): Selection | undefined {
    if (!this.service || !this.date || !this.slot) return undefined;
    const staffId = this.staff?.id ?? this.slotStaffId
      ?? (this.slot.staffIds?.length === 1 ? this.slot.staffIds[0] : undefined);
    return {
      service: this.service,
      date: this.date,
      startTime: this.slot.startTime,
      endTime: this.slot.endTime,
      staff: this.staff ?? this.roster.find((m) => m.id === staffId),
    };
  }

  /**
   * @param opts.onChangeService / onChangeStaff — where the overview's "Change" goes for the
   *   service and a fixed stylist (the app's own steps); date & time, and a stylist picked per
   *   time, are changed back on this pane's calendar.
   */
  render(rt: SalonApp<any>, opts: { onClose?: () => void; title?: string; onChangeService?: () => void; onChangeStaff?: () => void } = {}) {
    const service = this.service;
    if (!service) return null;
    const busy = this.loading || rt.busy;
    const sel = this.selection();
    if (sel && this.phase === "checkout") {
      const backToPick = () => { this.phase = "pick"; this.checkout.reset(); rt.render(); };
      // The overview card names the service, stylist and time; once booked, the confirmation is the page.
      return h("div", { class: "stack" },
        this.checkout.stage === "done" ? null : this.header({ ...opts, title: "Confirm your booking", meta: false }),
        this.checkout.render(rt, sel, {
          edit: {
            service: opts.onChangeService,
            staff: this.staff ? opts.onChangeStaff : backToPick,
            when: backToPick,
          },
          onBack: backToPick,
          onDone: () => {
            this.checkout = new CheckoutFlow();
            this.phase = "pick";
            this.slot = undefined;
            this.date = undefined;
            opts.onClose?.();
            rt.render();
          },
        }));
    }
    return h("div", { class: "stack" },
      this.header(opts),
      this.error ? h("p", { class: "error", role: "alert" }, this.error) : null,
      busy ? h("div", { class: "loading compact" }, h("span", { class: "spinner" }), h("span", null, "Checking availability…")) : null,
      monthCalendar({
        month: this.month,
        days: this.days,
        selected: this.date,
        window: this.window,
        disabled: busy,
        onPick: (date) => {
          rt.context(`The visitor is booking ${service.name}${this.staff ? ` with ${this.staff.name}` : ""} and looking at times on ${dateLabel(date, "long")}.`);
          void this.load(rt, { month: this.month, date });
        },
        onMonth: (month) => void this.load(rt, { month }),
      }),
      this.date ? h("section", { class: "panel" },
        h("h3", { class: "section-title" }, `Open times · ${dateLabel(this.date, "long")}`),
        slotGrid(this.slots, this.slot?.startTime, (slot) => {
          this.slot = slot;
          this.slotStaffId = undefined;
          this.checkout.reset();
          rt.render();
        }, busy)) : h("p", { class: "muted center" }, "Pick a day with a dot to see its open times."),
      this.slot && !this.staff ? stylistChoice(this.slot, this.roster, this.slotStaffId, (id) => { this.slotStaffId = id; rt.render(); }) : null,
      this.slot ? h("div", { class: "sticky-cta" },
        h("span", null, `${timeLabel(this.slot.startTime)} · ${dateLabel(this.date!, "short")}`),
        button("Continue", () => { this.phase = "checkout"; rt.render(); }, "btn primary")) : null);
  }

  private header(opts: { onClose?: () => void; title?: string; meta?: boolean }) {
    const service = this.service!;
    return h("div", { class: "pane-head" },
      h("div", { class: "row-body" },
        h("span", { class: "row-title" }, opts.title ?? `Book ${service.name}`),
        opts.meta === false ? null
          : h("span", { class: "row-meta" }, [serviceSummary(service), this.staff ? `with ${this.staff.name}` : "any stylist"].filter(Boolean).join(" · "))),
      opts.onClose ? button("✕", opts.onClose, "icon-button", { "aria-label": "Close booking" }) : null);
  }
}
