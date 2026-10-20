import { avatar, button, emptyState, firstName, h } from "../shared/dom";
import { addDays, dateLabel, enumLabel, timeLabel, todayIso } from "../shared/format";
import { appHeader, SalonApp, statusLine, type Data } from "../shared/runtime";
import {
  CheckoutFlow, dayStrip, handoffRow, serviceSelect, slotGrid,
  type Day, type Service, type Slot, type Staff,
} from "../shared/booking";
import { calendarClosures } from "../shared/opening";

type StylistData = Data & {
  services?: Service[];
  staff?: Staff[];
  staffId?: number;
  stylistServiceIds?: number[];
  serviceId?: number;
  from?: string;
  days?: Day[];
  firstAvailable?: { date: string; startTime: string };
  date?: string;
  slots?: Slot[];
  bookingWindow?: { from: string; to: string };
};

const PAGE_DAYS = 14;
const state = {
  slot: undefined as Slot | undefined,
  phase: "pick" as "pick" | "checkout",
  checkout: new CheckoutFlow(),
};

const rt: SalonApp<StylistData> = new SalonApp<StylistData>("Book by Stylist", "salon_booking_by_stylist", (rt) => {
  const data = rt.data!;
  const staff = data.staff ?? [];
  const stylist = staff.find((m) => m.id === data.staffId);
  const service = (data.services ?? []).find((s) => s.id === data.serviceId);
  const header = appHeader("BOOK BY STYLIST", data.salonName ?? "Salon", stylist ? `With ${stylist.name}` : "Choose who you'd like to see");

  if (stylist && service && data.date && state.slot && state.phase === "checkout") {
    return [header, ...statusLine(rt), state.checkout.render(rt, { service, date: data.date, startTime: state.slot.startTime, endTime: state.slot.endTime, staff: stylist }, {
      // The stylist carousel, service select and day strip all live on the pick view.
      edit: { service: backToPick, staff: backToPick, when: backToPick },
      onBack: backToPick,
      onDone: () => { state.phase = "pick"; state.slot = undefined; state.checkout = new CheckoutFlow(); void rt.reload({ staffId: stylist.id }); },
    })];
  }
  return [
    header,
    ...statusLine(rt),
    staff.length ? stylistCarousel(staff, stylist) : emptyState("No stylists take online bookings yet", "Contact the salon to book."),
    stylist ? stylistPanel(data, stylist, service) : h("p", { class: "muted center" }, "Pick a stylist to see the days they work and their open times."),
  ];
});

function backToPick() {
  state.phase = "pick";
  state.checkout.reset();
  rt.render();
}

function load(args: Record<string, unknown>) {
  state.slot = undefined;
  state.phase = "pick";
  state.checkout = new CheckoutFlow();
  return rt.reload(args);
}

function stylistCarousel(staff: Staff[], selected: Staff | undefined) {
  return h("div", { class: "carousel", role: "list" }, staff.map((member) => button([
    avatar(member.name, member.avatarUrl, "avatar lg"),
    h("span", { class: "row-title" }, member.name),
    h("span", { class: "row-meta" }, enumLabel(member.role) || "Stylist"),
  ], () => {
    rt.context(`The visitor is checking when ${member.name} is free.`);
    // Keep the chosen service only if this stylist performs it too.
    const current = (rt.data?.services ?? []).find((s) => s.id === rt.data?.serviceId);
    const keep = current && (!(current.staffIds ?? []).length || (current.staffIds ?? []).includes(member.id));
    void load({ staffId: member.id, serviceId: keep ? current.id : undefined });
  }, `carousel-card${selected?.id === member.id ? " selected" : ""}`, { role: "listitem", "aria-pressed": String(selected?.id === member.id), disabled: rt.busy })));
}

function stylistPanel(data: StylistData, stylist: Staff, service: Service | undefined) {
  const offered = (data.services ?? []).filter((s) => (data.stylistServiceIds ?? []).includes(s.id));
  const from = data.from ?? todayIso();
  const windowEnd = data.bookingWindow?.to ?? addDays(from, PAGE_DAYS);
  const days = data.days ?? [];
  const workingDays = days.filter((d) => d.status === "OPEN").length;
  const base = { staffId: stylist.id, serviceId: service?.id };
  return h("div", { class: "stack" },
    stylist.specializations?.length
      ? h("div", { class: "chip-row" }, stylist.specializations.map((s) => h("span", { class: "tag" }, s)))
      : null,
    offered.length
      ? serviceSelect(offered, service?.id, (serviceId) => void load({ staffId: stylist.id, serviceId, from }),
        `Choose one of ${firstName(stylist.name)}'s services`)
      : h("p", { class: "muted" }, `${firstName(stylist.name)} has no bookable services yet.`),
    data.firstAvailable && service ? button(
      `Next available: ${dateLabel(data.firstAvailable.date)} at ${timeLabel(data.firstAvailable.startTime)}`,
      () => void load({ ...base, from, date: data.firstAvailable!.date }), "next-available", { disabled: rt.busy }) : null,
    h("section", { class: "panel" },
      h("div", { class: "cal-head" },
        button("‹", () => void load({ ...base, from: addDays(from, -PAGE_DAYS) }), "icon-button", { disabled: rt.busy || from <= todayIso(), "aria-label": "Previous two weeks" }),
        h("strong", null, `${dateLabel(from)} – ${dateLabel(days.at(-1)?.date ?? addDays(from, PAGE_DAYS - 1))}`),
        button("›", () => void load({ ...base, from: addDays(from, PAGE_DAYS) }), "icon-button", { disabled: rt.busy || addDays(from, PAGE_DAYS) > windowEnd, "aria-label": "Next two weeks" })),
      days.length
        ? dayStrip(days, data.date, (date) => {
          if (!service) return;
          rt.context(`The visitor is looking at ${stylist.name}'s times on ${dateLabel(date, "long")}${service ? ` for ${service.name}` : ""}.`);
          void load({ ...base, from, date });
        }, rt.busy || !service)
        : emptyState("Outside the booking window", "Go back to an earlier fortnight."),
      calendarClosures(days),
      h("p", { class: "muted" }, workingDays
        ? `${firstName(stylist.name)} has open times on ${workingDays} of these days.${service ? "" : " Choose a service to see exact times."}`
        : `${firstName(stylist.name)} has no open times in this fortnight — try the next one.`)),
    service && data.date ? h("section", { class: "panel" },
      h("h3", { class: "section-title" }, `${firstName(stylist.name)}'s open times · ${dateLabel(data.date, "long")}`),
      slotGrid(data.slots ?? [], state.slot?.startTime, (slot) => { state.slot = slot; rt.render(); }, rt.busy)) : null,
    state.slot && data.date ? h("div", { class: "sticky-cta" },
      h("span", null, `${timeLabel(state.slot.startTime)} · ${dateLabel(data.date)} · ${firstName(stylist.name)}`),
      button("Continue", () => { state.phase = "checkout"; rt.render(); }, "btn primary")) : null,
    handoffRow(rt, [
      [`About ${firstName(stylist.name)}`, `Tell me about ${stylist.name}`],
      ["Any stylist, week view", service ? `Show me the week view for ${service.name}` : "Show me this week's availability"],
    ]));
}

rt.start();
