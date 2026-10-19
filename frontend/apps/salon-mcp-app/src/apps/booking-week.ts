import { button, emptyState, h } from "../shared/dom";
import { addDays, dateLabel, dayOfMonth, dayPart, plural, timeLabel, todayIso, weekdayShort } from "../shared/format";
import { appHeader, SalonApp, statusLine, type Data } from "../shared/runtime";
import {
  CheckoutFlow, handoffRow, serviceSelect, staffSelect, stylistChoice,
  type Day, type Service, type Slot, type Staff,
} from "../shared/booking";

type WeekData = Data & {
  services?: Service[];
  staff?: Staff[];
  serviceId?: number;
  staffId?: number;
  weekStart?: string;
  hasPreviousWeek?: boolean;
  hasNextWeek?: boolean;
  days?: Day[];
};

const PARTS = ["Morning", "Afternoon", "Evening"] as const;
const state = {
  part: undefined as (typeof PARTS)[number] | undefined,
  pick: undefined as { date: string; slot: Slot } | undefined,
  pickStaffId: undefined as number | undefined,
  phase: "pick" as "pick" | "checkout",
  checkout: new CheckoutFlow(),
};

const rt: SalonApp<WeekData> = new SalonApp<WeekData>("Week View Booking", "salon_booking_week", (rt) => {
  const data = rt.data!;
  const services = data.services ?? [];
  const staff = data.staff ?? [];
  const service = services.find((s) => s.id === data.serviceId);
  const filterStaff = staff.find((m) => m.id === data.staffId);
  const header = appHeader("WEEK VIEW", data.salonName ?? "Salon", service ? `${service.name}${filterStaff ? ` with ${filterStaff.name}` : ""}` : undefined);

  if (service && state.pick && state.phase === "checkout") {
    const staffId = filterStaff?.id ?? state.pickStaffId ?? (state.pick.slot.staffIds?.length === 1 ? state.pick.slot.staffIds[0] : undefined);
    return [header, ...statusLine(rt), state.checkout.render(rt, {
      service, date: state.pick.date, startTime: state.pick.slot.startTime, endTime: state.pick.slot.endTime,
      staff: staff.find((m) => m.id === staffId),
    }, {
      onBack: () => { state.phase = "pick"; state.checkout.reset(); rt.render(); },
      onDone: () => { void load({ serviceId: service.id, staffId: data.staffId, weekStart: data.weekStart }); },
    })];
  }
  return [
    header,
    ...statusLine(rt),
    h("div", { class: "filters" },
      serviceSelect(services, service?.id, (serviceId) => void load({ serviceId, staffId: data.staffId, weekStart: data.weekStart })),
      staffSelect(staff, filterStaff?.id, (staffId) => void load({ serviceId: service?.id, staffId, weekStart: data.weekStart }))),
    service ? week(data, service, staff) : emptyState("Choose a service", "The week grid shows every open start time for the service you pick."),
  ];
});

function load(args: Record<string, unknown>) {
  state.pick = undefined;
  state.pickStaffId = undefined;
  state.phase = "pick";
  state.checkout = new CheckoutFlow();
  return rt.reload(args);
}

function week(data: WeekData, service: Service, staff: Staff[]) {
  const days = data.days ?? [];
  const weekStart = data.weekStart ?? todayIso();
  const visible = (slots: Slot[] = []) => slots.filter((s) => !state.part || dayPart(s.startTime) === state.part);
  const total = days.reduce((sum, d) => sum + visible(d.slots).length, 0);
  const nav = { serviceId: service.id, staffId: data.staffId };
  return h("div", { class: "stack" },
    h("div", { class: "cal-head" },
      button("‹", () => void load({ ...nav, weekStart: addDays(weekStart, -7) }), "icon-button", { disabled: rt.busy || !data.hasPreviousWeek, "aria-label": "Previous week" }),
      h("div", { class: "center" },
        h("strong", null, `${dateLabel(weekStart)} – ${dateLabel(addDays(weekStart, 6))}`),
        h("span", { class: "row-meta block" }, `${plural(total, "open time")}${state.part ? ` in the ${state.part.toLowerCase()}` : ""}`)),
      button("›", () => void load({ ...nav, weekStart: addDays(weekStart, 7) }), "icon-button", { disabled: rt.busy || !data.hasNextWeek, "aria-label": "Next week" })),
    h("div", { class: "chip-row" },
      button("All day", () => { state.part = undefined; rt.render(); }, `chip${!state.part ? " active" : ""}`),
      PARTS.map((part) => button(part, () => { state.part = part; rt.render(); }, `chip${state.part === part ? " active" : ""}`)),
      data.hasPreviousWeek ? button("This week", () => void load({ ...nav }), "link-button") : null),
    h("div", { class: "week-grid", role: "grid", "aria-label": `Open times for ${service.name}` }, days.map((day) => {
      const slots = visible(day.slots);
      const isToday = day.date === todayIso();
      return h("section", { class: `week-col status-${day.status.toLowerCase()}${isToday ? " today" : ""}`, role: "row" },
        h("header", { class: "week-col-head" },
          h("span", { class: "day-chip-weekday" }, weekdayShort(day.date)),
          h("span", { class: "day-chip-num" }, String(dayOfMonth(day.date))),
          h("span", { class: "day-chip-hint" }, day.status === "OPEN" ? `${slots.length} free` : shortReason(day))),
        h("div", { class: "week-col-body" }, slots.length
          ? slots.map((slot) => {
            const selected = state.pick?.date === day.date && state.pick.slot.startTime === slot.startTime;
            return button(timeLabel(slot.startTime), () => {
              state.pick = { date: day.date, slot };
              state.pickStaffId = undefined;
              rt.context(`The visitor picked ${service.name} on ${dateLabel(day.date, "long")} at ${timeLabel(slot.startTime)} in the week view (not booked yet).`);
              rt.render();
            }, `week-slot${selected ? " selected" : ""}`, { role: "gridcell", "aria-pressed": String(selected), disabled: rt.busy });
          })
          : h("span", { class: "week-empty", title: day.reason ?? "" }, day.status === "OPEN" ? "—" : shortReason(day))));
    })),
    state.pick && !data.staffId ? stylistChoice(state.pick.slot, staff, state.pickStaffId, (id) => { state.pickStaffId = id; rt.render(); }) : null,
    state.pick ? h("div", { class: "sticky-cta" },
      h("span", null, `${dateLabel(state.pick.date)} · ${timeLabel(state.pick.slot.startTime)}`),
      button("Continue", () => { state.phase = "checkout"; rt.render(); }, "btn primary")) : null,
    total === 0 && days.some((d) => d.status === "OPEN" || d.status === "FULLY_BOOKED")
      ? h("p", { class: "muted center" }, state.part ? `Nothing free in the ${state.part.toLowerCase()} — try All day.` : "Fully booked this week — try the next one.")
      : null,
    handoffRow(rt, [
      ["Pick a date on a calendar", `I'd like to book ${service.name}`],
      ["Choose a stylist first", "I'd like to book with a specific stylist"],
    ]));
}

function shortReason(day: Day) {
  switch (day.status) {
    case "SALON_CLOSED": return "Closed";
    case "STAFF_OFF": return "Off";
    case "FULLY_BOOKED": return "Full";
    case "PAST": return "Past";
    case "OUTSIDE_WINDOW": return "—";
    default: return "";
  }
}

rt.start();
