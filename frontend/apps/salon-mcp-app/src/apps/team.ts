import { avatar, button, emptyState, firstName, h } from "../shared/dom";
import { enumLabel, plural } from "../shared/format";
import { InlineBooking } from "../shared/inlineBooking";
import { StaffProfile } from "../shared/profile";
import { appHeader, SalonApp, statusLine, type Data } from "../shared/runtime";
import { serviceSummary, type Service, type Staff } from "../shared/booking";

type TeamData = Data & {
  bookingEnabled?: boolean;
  items?: Staff[];
  services?: Service[];
  specializations?: string[];
  staffId?: number;
  specialization?: string;
};

const state = {
  specialization: undefined as string | undefined,
  /** Stylist whose service list is open for booking (before a service is picked). */
  choosingFor: undefined as Staff | undefined,
  seeded: false,
};
const profile = new StaffProfile();
const booking = new InlineBooking();

const rt: SalonApp<TeamData> = new SalonApp<TeamData>("Meet the Team", "salon_team", (rt) => {
  const data = rt.data!;
  const team = data.items ?? [];
  if (!state.seeded) {
    state.seeded = true;
    state.specialization = data.specialization;
    const focus = team.find((m) => m.id === data.staffId);
    if (focus) profile.open(focus);
  }
  const header = appHeader("OUR TEAM", data.salonName ?? "Salon", plural(team.length, "stylist"));
  if (booking.active) {
    return [header, ...statusLine(rt), booking.render(rt, { onClose: () => { booking.close(); rt.render(); } })!];
  }
  if (state.choosingFor) return [header, ...statusLine(rt), servicePicker(state.choosingFor, data)];
  return [
    header,
    ...statusLine(rt),
    specializationChips(data),
    teamGrid(data),
    profile.render({
      services: data.services ?? [],
      bookingEnabled: !!data.bookingEnabled,
      rerender: () => rt.render(),
      onBook: (member) => startBooking(member, data),
    }),
  ];
});

function specializationChips(data: TeamData) {
  const specs = data.specializations ?? [];
  if (!specs.length) return null;
  const chip = (value: string | undefined, label: string) => button(label, () => {
    state.specialization = value;
    rt.context(value ? `The visitor is looking for stylists who specialise in ${value}.` : "The visitor is browsing the whole team.");
    rt.render();
  }, `chip${state.specialization === value ? " active" : ""}`, { "aria-pressed": String(state.specialization === value) });
  return h("div", { class: "chip-row scroll" }, chip(undefined, "Everyone"), specs.map((s) => chip(s, s)));
}

function teamGrid(data: TeamData) {
  const wanted = state.specialization?.toLowerCase();
  const team = (data.items ?? []).filter((m) => !wanted || (m.specializations ?? []).some((s) => s.toLowerCase() === wanted));
  if (!team.length) return emptyState("No stylists match", "Try another specialisation.", button("Show everyone", () => { state.specialization = undefined; rt.render(); }, "btn"));
  return h("div", { class: "card-grid" }, team.map((member) => {
    const media = member.workMedia?.length ?? 0;
    const openProfile = (event: Event) => {
      profile.open(member, event);
      rt.context(`The visitor opened ${member.name}'s profile.`);
      rt.render();
    };
    return h("article", { class: "staff-card" },
      h("button", { type: "button", class: "staff-card-main", onClick: openProfile, "aria-haspopup": "dialog" },
        avatar(member.name, member.avatarUrl, "avatar lg"),
        h("span", { class: "row-title" }, member.name),
        member.role ? h("span", { class: "row-meta" }, enumLabel(member.role)) : null,
        member.specializations?.length ? h("div", { class: "chip-row center" }, member.specializations.slice(0, 3).map((s) => h("span", { class: "tag" }, s))) : null,
        media ? h("span", { class: "row-meta" }, `${plural(media, "portfolio item")}`) : null),
      h("div", { class: "staff-card-actions" },
        button("Profile", openProfile, "btn small"),
        data.bookingEnabled && member.availableForBooking !== false ? button("Book", () => startBooking(member, data), "btn primary small") : null));
  }));
}

function stylistServices(member: Staff, data: TeamData) {
  const services = data.services ?? [];
  const assigned = services.filter((s) => (member.serviceIds ?? []).includes(s.id));
  // Services assigned to nobody can be done by anyone, so they're always on offer.
  const open = services.filter((s) => !(s.staffIds ?? []).length);
  return [...assigned, ...open.filter((s) => !assigned.includes(s))];
}

function startBooking(member: Staff, data: TeamData) {
  profile.close();
  const services = stylistServices(member, data);
  if (services.length === 1) {
    void booking.start(rt, services[0]!, member);
    return;
  }
  state.choosingFor = member;
  rt.context(`The visitor wants to book with ${member.name} and is choosing a service.`);
  rt.render();
}

function servicePicker(member: Staff, data: TeamData) {
  const services = stylistServices(member, data);
  return h("div", { class: "stack" },
    h("div", { class: "pane-head" },
      avatar(member.name, member.avatarUrl, "avatar"),
      h("div", { class: "row-body" },
        h("span", { class: "row-title" }, `Book with ${member.name}`),
        h("span", { class: "row-meta" }, `Choose one of ${firstName(member.name)}'s services`)),
      button("✕", () => { state.choosingFor = undefined; rt.render(); }, "icon-button", { "aria-label": "Back to the team" })),
    services.length
      ? h("div", { class: "list" }, services.map((s) => button(
        [h("div", { class: "row-body" }, h("span", { class: "row-title" }, s.name), h("span", { class: "row-meta" }, serviceSummary(s))), h("span", { class: "team-chevron" }, "›")],
        () => { state.choosingFor = undefined; void booking.start(rt, s, member); }, "row row-button")))
      : emptyState(`${firstName(member.name)} has no bookable services yet`, "Ask the salon, or pick another stylist."));
}

rt.start();
