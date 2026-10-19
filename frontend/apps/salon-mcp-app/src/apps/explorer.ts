import { button, h } from "../shared/dom";
import { enumLabel, timeLabel } from "../shared/format";
import { appHeader, SalonApp, statusLine, type Data } from "../shared/runtime";

type Hours = { day: string; openTime?: string; closeTime?: string; closed?: boolean };
type ExplorerData = Data & {
  bookingEnabled?: boolean;
  shopEnabled?: boolean;
  salon?: { name: string; location?: Record<string, string>; contact?: Record<string, string>; bookingAdvanceDays?: number };
  location?: Record<string, string>;
  items?: Hours[];
};

const VIEWS = [["overview", "Overview"], ["hours", "Opening hours"], ["location", "Location"]] as const;
const TODAY = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"][new Date().getDay()];

const rt: SalonApp<ExplorerData> = new SalonApp<ExplorerData>("Salon Info", "salon_explorer", (rt) => {
  const data = rt.data!;
  return [
    appHeader("SALON INFO", data.salon?.name ?? data.salonName ?? "Salon"),
    h("nav", { class: "tabs", role: "tablist" }, VIEWS.map(([view, label]) => button(label, () => void rt.reload({ view }),
      `tab${data.view === view ? " active" : ""}`, { role: "tab", "aria-selected": String(data.view === view), disabled: rt.busy }))),
    ...statusLine(rt),
    data.view === "hours" ? hours(data.items ?? []) : null,
    data.view === "location" ? location(data.location ?? {}) : null,
    data.view === "overview" || !VIEWS.some(([v]) => v === data.view) ? overview(data) : null,
    launcher(data),
  ];
});

function address(location: Record<string, string>) {
  return [location.address, location.city, location.state, location.zipCode, location.country].filter(Boolean).join(", ");
}

function overview(data: ExplorerData) {
  const salon = data.salon;
  if (!salon) return h("p", { class: "muted" }, "Open the Overview tab for the salon's details.");
  const contact = salon.contact ?? {};
  const loc = salon.location ?? {};
  const today = (data.items ?? []).find((d) => d.day === TODAY);
  return h("div", { class: "stack" },
    h("section", { class: "card info-grid" },
      address(loc) ? infoRow("📍", "Address", address(loc), loc.mapsUrl ? button("Open map", () => rt.openLink(loc.mapsUrl!), "link-button") : null) : null,
      today ? infoRow("🕒", "Today", today.closed ? "Closed today" : `${timeLabel(today.openTime)} – ${timeLabel(today.closeTime)}`) : null,
      contact.phone ? infoRow("📞", "Phone", contact.phone) : null,
      contact.email ? infoRow("✉️", "Email", contact.email) : null,
      contact.website ? infoRow("🌐", "Website", contact.website, button("Visit", () => rt.openLink(contact.website!), "link-button")) : null,
      data.bookingEnabled ? infoRow("📅", "Online booking", `Available up to ${salon.bookingAdvanceDays ?? 60} days ahead`) : null),
    data.items?.length ? hours(data.items) : null);
}

function infoRow(icon: string, label: string, value: string, action?: Node | null) {
  return h("div", { class: "info-row" },
    h("span", { class: "info-icon", "aria-hidden": "true" }, icon),
    h("div", { class: "row-body" }, h("span", { class: "row-meta" }, label), h("span", { class: "detail" }, value)),
    action ?? null);
}

function hours(items: Hours[]) {
  return h("section", { class: "card" },
    h("h3", { class: "section-title" }, "Opening hours"),
    h("div", { class: "hours-list" }, items.map((day) => h("div", { class: `hours-row${day.day === TODAY ? " today" : ""}` },
      h("span", { class: "hours-day" }, enumLabel(day.day), day.day === TODAY ? h("span", { class: "tag" }, "Today") : null),
      h("span", { class: "hours-time" }, day.closed ? "Closed" : `${timeLabel(day.openTime)} – ${timeLabel(day.closeTime)}`)))));
}

function location(loc: Record<string, string>) {
  const text = address(loc);
  return h("section", { class: "card stack" },
    h("h3", { class: "section-title" }, "Find us"),
    h("p", { class: "detail" }, text || "The salon hasn't published its address yet."),
    loc.mapsUrl ? button("Open in maps", () => rt.openLink(loc.mapsUrl!), "btn primary") : null);
}

/** Tiles that ask the chat to open the dedicated apps. */
function launcher(data: ExplorerData) {
  const tiles: [string, string, string][] = [
    ["✂️", "Services", "Show me your services"],
    ["👥", "Our team", "Show me the team"],
  ];
  if (data.bookingEnabled) {
    tiles.push(["📅", "Book now", "I'd like to book an appointment"], ["🗓️", "This week", "What's free this week?"]);
  }
  if (data.shopEnabled) tiles.push(["🛍️", "Shop", "Show me the shop"]);
  return h("section", { class: "launcher" },
    h("h3", { class: "section-title" }, "Explore more"),
    h("div", { class: "launcher-grid" }, tiles.map(([icon, label, message]) =>
      button([h("span", { class: "launcher-icon", "aria-hidden": "true" }, icon), h("span", null, label)], () => rt.ask(message), "launcher-tile"))));
}

rt.start();
