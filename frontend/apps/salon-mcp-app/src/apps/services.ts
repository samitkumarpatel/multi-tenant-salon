import { avatar, button, emptyState, h } from "../shared/dom";
import { duration, enumLabel, money, plural } from "../shared/format";
import { InlineBooking } from "../shared/inlineBooking";
import { appHeader, SalonApp, statusLine, type Data } from "../shared/runtime";
import type { Service, Staff } from "../shared/booking";

type ServicesData = Data & {
  bookingEnabled?: boolean;
  items?: Service[];
  categories?: { id: string; count: number }[];
  staff?: Staff[];
  category?: string;
  serviceId?: number;
};

const state = {
  category: undefined as string | undefined,
  query: "",
  expanded: new Set<number>(),
  sort: "menu" as "menu" | "price" | "duration",
  seeded: false,
};
const booking = new InlineBooking();

const rt: SalonApp<ServicesData> = new SalonApp<ServicesData>("Explore Services", "salon_services", (rt) => {
  const data = rt.data!;
  if (!state.seeded) {
    // The model may open the app focused on a category or a single service.
    state.seeded = true;
    state.category = data.category;
    if (data.serviceId) state.expanded.add(data.serviceId);
  }
  const services = data.items ?? [];
  const header = appHeader("SERVICES", data.salonName ?? "Salon", plural(services.length, "service"));
  if (booking.active) {
    return [header, ...statusLine(rt), booking.render(rt, { onClose: () => { booking.close(); rt.context("The visitor is browsing the service menu."); rt.render(); } })!];
  }
  const list = h("div", { class: "list-host" }, serviceList(data));
  const search = h("input", {
    class: "field search", type: "search", placeholder: "Search services…", value: state.query, "aria-label": "Search services",
    onInput: (event: Event) => {
      state.query = (event.target as HTMLInputElement).value;
      list.replaceChildren(serviceList(data));
    },
  });
  return [
    header,
    ...statusLine(rt),
    h("div", { class: "toolbar" }, search,
      h("select", {
        class: "field compact", "aria-label": "Sort services",
        onChange: (event: Event) => { state.sort = (event.target as HTMLSelectElement).value as typeof state.sort; rt.render(); },
      },
      h("option", { value: "menu", selected: state.sort === "menu" }, "Menu order"),
      h("option", { value: "price", selected: state.sort === "price" }, "Price: low to high"),
      h("option", { value: "duration", selected: state.sort === "duration" }, "Shortest first"))),
    categoryChips(data),
    list,
  ];
});

function categoryChips(data: ServicesData) {
  const categories = data.categories ?? [];
  if (categories.length < 2) return null;
  const chip = (id: string | undefined, label: string) => button(label, () => {
    state.category = id;
    rt.context(id ? `The visitor is browsing ${enumLabel(id)} services.` : "The visitor is browsing the full service menu.");
    rt.render();
  }, `chip${state.category === id ? " active" : ""}`, { "aria-pressed": String(state.category === id) });
  return h("div", { class: "chip-row scroll" },
    chip(undefined, `All · ${(data.items ?? []).length}`),
    categories.map((c) => chip(c.id, `${enumLabel(c.id)} · ${c.count}`)));
}

function visibleServices(data: ServicesData) {
  const query = state.query.trim().toLowerCase();
  const list = (data.items ?? []).filter((s) => (!state.category || s.category === state.category)
    && (!query || `${s.name} ${s.description ?? ""} ${s.category ?? ""}`.toLowerCase().includes(query)));
  if (state.sort === "price") list.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
  if (state.sort === "duration") list.sort((a, b) => (a.durationMinutes ?? 0) - (b.durationMinutes ?? 0));
  return list;
}

function serviceList(data: ServicesData) {
  const list = visibleServices(data);
  if (!list.length) {
    return emptyState("No services match", state.query ? `Nothing found for “${state.query}”.` : "This category has no services yet.",
      button("Show all services", () => { state.query = ""; state.category = undefined; rt.render(); }, "btn"));
  }
  // Group by category only in menu order with no category filter — otherwise a flat list reads better.
  if (state.sort !== "menu" || state.category) return h("div", { class: "list" }, list.map((s) => serviceRow(s, data)));
  const groups = new Map<string, Service[]>();
  for (const s of list) groups.set(s.category ?? "OTHER", [...(groups.get(s.category ?? "OTHER") ?? []), s]);
  return h("div", { class: "stack" }, [...groups].map(([category, items]) => h("section", { class: "group" },
    h("h3", { class: "section-title" }, `${enumLabel(category)} · ${items.length}`),
    h("div", { class: "list" }, items.map((s) => serviceRow(s, data))))));
}

function serviceRow(service: Service, data: ServicesData) {
  const expanded = state.expanded.has(service.id);
  const performers = (service.staffIds ?? []).map((id) => (data.staff ?? []).find((m) => m.id === id)).filter(Boolean) as Staff[];
  const price = money(service.price, service.currency);
  const row = h("article", { class: `row service-row${data.serviceId === service.id ? " highlight" : ""}` },
    h("button", {
      type: "button", class: "row-main", "aria-expanded": String(expanded),
      onClick: () => {
        if (expanded) state.expanded.delete(service.id); else state.expanded.add(service.id);
        if (!expanded) rt.context(`The visitor is looking at ${service.name}${price ? ` (${price})` : ""}.`);
        rt.render();
      },
    },
    h("div", { class: "row-body" },
      h("span", { class: "row-title" }, service.name),
      h("span", { class: "row-meta" }, [duration(service.durationMinutes), performers.length ? `${performers.length} stylist${performers.length === 1 ? "" : "s"}` : "Any stylist"].filter(Boolean).join(" · ")),
      service.description ? h("span", { class: `row-description${expanded ? "" : " clamp"}` }, service.description) : null),
    h("span", { class: "price" }, price || "Ask")),
    expanded && performers.length ? h("div", { class: "performers" },
      h("span", { class: "row-meta" }, "Performed by"),
      h("div", { class: "chip-row" }, performers.map((m) => h("span", { class: "chip static" }, avatar(m.name, m.avatarUrl, "avatar xs"), m.name)))) : null,
    data.bookingEnabled ? h("div", { class: "row-actions" },
      expanded && performers.length > 1 ? button("Compare stylists", () => rt.ask(`Who are the stylists for ${service.name}?`), "link-button") : null,
      button("Book", () => void booking.start(rt, service), "btn primary small")) : null);
  return row;
}

rt.start();
