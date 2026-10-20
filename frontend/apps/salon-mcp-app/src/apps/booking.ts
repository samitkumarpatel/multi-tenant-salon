import { avatar, button, emptyState, h } from "../shared/dom";
import { enumLabel } from "../shared/format";
import { InlineBooking, type BookingData } from "../shared/inlineBooking";
import { appHeader, SalonApp, statusLine } from "../shared/runtime";
import { handoffRow, serviceSummary, type Service, type Staff } from "../shared/booking";
import { NextAvailable, slotLabel } from "../shared/nextAvailable";

type Step = "service" | "stylist" | "schedule";

const state = {
  step: "service" as Step,
  service: undefined as Service | undefined,
  /** null = "any available stylist" chosen explicitly; undefined = not chosen yet. */
  staff: undefined as Staff | null | undefined,
  query: "",
  seeded: false,
};
const schedule = new InlineBooking();
const next = new NextAvailable();

const rt: SalonApp<BookingData> = new SalonApp<BookingData>("Book an Appointment", "salon_booking", (rt) => {
  const data = rt.data!;
  const services = data.services ?? [];
  const staff = data.staff ?? [];
  if (!state.seeded) seed(data, services, staff);
  return [
    appHeader("BOOK AN APPOINTMENT", data.salonName ?? "Salon"),
    stepper(),
    ...statusLine(rt),
    state.step === "service" ? serviceStep(services) : null,
    state.step === "stylist" && state.service ? stylistStep(state.service, staff) : null,
    state.step === "schedule" ? schedule.render(rt, {
      title: "Pick a date and time",
      // Also reached after "Book something else" — times have changed, so refresh the hints.
      onClose: () => { schedule.close(); next.clear(); state.step = "stylist"; rt.render(); },
      onChangeService: () => { schedule.close(); state.step = "service"; rt.render(); },
      onChangeStaff: () => { schedule.close(); state.step = "stylist"; rt.render(); },
    }) : null,
    state.service && schedule.phase === "pick" ? handoffRow(rt, [
      ["See the whole week instead", `Show me the week view for ${state.service.name}`],
      ["Choose by stylist", "I'd like to book with a specific stylist"],
    ]) : null,
  ];
});

/** Picks up wherever the model opened the app: a service, a stylist, even a date. */
function seed(data: BookingData, services: Service[], staff: Staff[]) {
  state.seeded = true;
  const preferred = staff.find((m) => m.id === data.staffId);
  if (preferred) state.staff = preferred;
  state.service = services.find((s) => s.id === data.serviceId);
  if (state.service) {
    schedule.hydrate(data, services, staff);
    if (preferred || data.date) state.step = "schedule";
    else state.step = "stylist";
  }
}

function stepper() {
  const steps: [Step, string][] = [["service", "Service"], ["stylist", "Stylist"], ["schedule", "Date & time"]];
  const current = steps.findIndex(([s]) => s === state.step);
  const done = schedule.phase === "checkout";
  return h("ol", { class: "stepper" },
    steps.map(([step, label], index) => h("li", { class: `${index < current || done ? "done" : ""}${index === current && !done ? " current" : ""}` },
      index < current
        ? button(label, () => { state.step = step; if (step !== "schedule") schedule.close(); rt.render(); }, "step-link")
        : h("span", null, label))),
    h("li", { class: done ? "current" : "" }, h("span", null, "Confirm")));
}

function serviceRows(services: Service[]) {
  const query = state.query.trim().toLowerCase();
  const filtered = services.filter((s) => !query || `${s.name} ${s.category ?? ""}`.toLowerCase().includes(query));
  return filtered.length
    ? filtered.map((s) => button([
      h("div", { class: "row-body" },
        h("span", { class: "row-title" }, s.name),
        h("span", { class: "row-meta" }, [enumLabel(s.category), serviceSummary(s)].filter(Boolean).join(" · "))),
      h("span", { class: "team-chevron" }, "›")], () => pickService(s), `row row-button${state.service?.id === s.id ? " selected" : ""}`))
    : [emptyState("No services match", "Try a different search.")];
}

function serviceStep(services: Service[]) {
  const list = h("div", { class: "list" }, serviceRows(services));
  return h("section", { class: "stack" },
    h("h2", { class: "section-title" }, "What would you like to book?"),
    services.length > 6 ? h("input", {
      class: "field search", type: "search", placeholder: "Search services…", value: state.query, "aria-label": "Search services",
      onInput: (event: Event) => { state.query = (event.target as HTMLInputElement).value; list.replaceChildren(...serviceRows(services)); },
    }) : null,
    list);
}

function pickService(service: Service) {
  state.service = service;
  // A stylist picked earlier only carries over if they perform this service.
  if (state.staff && !offers(state.staff, service)) state.staff = undefined;
  state.step = "stylist";
  rt.context(`The visitor chose ${service.name} and is picking a stylist.`);
  rt.render();
}

function offers(member: Staff, service: Service) {
  return !(service.staffIds ?? []).length || (service.staffIds ?? []).includes(member.id);
}

function stylistStep(service: Service, staff: Staff[]): HTMLElement {
  const eligible = staff.filter((m) => offers(m, service));
  // Each stylist's soonest open time for this service, so the visitor can pick by "who's free first".
  const availability = next.get(rt, { serviceId: service.id });
  const soonest = (member: Staff | null) => {
    if (availability === undefined) return { text: "Checking availability…", tone: "" };
    if (availability === null) return null;
    const slot = member ? availability.byStaff?.find((b) => b.staffId === member.id) : availability.firstAvailable;
    return slot?.date
      ? { text: `Next free: ${slotLabel(slot.date, slot.startTime)}`, tone: "ok" }
      : { text: "No open times in the booking window", tone: "off" };
  };
  // "Soonest" only when one stylist is strictly first — a tie would single someone out for nothing.
  const ranked = (availability?.byStaff ?? []).filter((b) => b.date).map((b) => ({ id: b.staffId, at: `${b.date} ${b.startTime}` }))
    .sort((a, b) => a.at.localeCompare(b.at));
  const earliest = ranked.length > 1 && ranked[0]!.at < ranked[1]!.at ? ranked[0]!.id : undefined;
  const card = (member: Staff | null): HTMLElement => {
    const selected = state.staff === member || (member !== null && state.staff?.id === member.id);
    const hint = soonest(member);
    return button([
      member ? avatar(member.name, member.avatarUrl, "avatar") : h("span", { class: "avatar avatar-initials", "aria-hidden": "true" }, "✦"),
      h("div", { class: "row-body" },
        h("span", { class: "row-title" }, member ? member.name : "Any available stylist",
          member && member.id === earliest && eligible.length > 1 ? h("span", { class: "tag soonest" }, "Soonest") : null),
        h("span", { class: "row-meta" }, member
          ? [enumLabel(member.role), (member.specializations ?? []).slice(0, 2).join(", ")].filter(Boolean).join(" · ")
          : "Most open times — we'll match you with whoever is free"),
        hint ? h("span", { class: `next-free ${hint.tone}` }, hint.text) : null),
      h("span", { class: "team-chevron" }, "›")],
    () => void pickStylist(service, member), `row row-button${selected ? " selected" : ""}`, { disabled: rt.busy });
  };
  return h("section", { class: "stack" },
    h("h2", { class: "section-title" }, `Who would you like for ${service.name}?`),
    h("div", { class: "list" }, card(null), eligible.map(card)));
}

async function pickStylist(service: Service, member: Staff | null) {
  state.staff = member;
  state.step = "schedule";
  await schedule.start(rt, service, member ?? undefined);
}

rt.start();
