import { avatar, button, emptyState, firstName, h } from "./dom";
import { dateLabel, dayOfMonth, duration, enumLabel, money, plural, timeLabel, weekdayShort } from "./format";
import { InlineBooking } from "./inlineBooking";
import { closuresCard, todayBadge, weekCard, weeklyCard, weekStrip, type ClosureRange, type OpeningDay, type Today, type WeeklyHours } from "./opening";
import { PortfolioGallery } from "./profile";
import { NextAvailable, slotLabel } from "./nextAvailable";
import { serviceSummary, type Service, type Staff } from "./booking";
import type { Data, SalonApp } from "./runtime";

/**
 * The connected salon guide behind the Salon info, Explore services and Meet the team apps. Each
 * section is its own card or page — salon home, opening hours, location, the service menu, one
 * service, the team, one stylist, and booking — joined by a back stack, so the visitor moves
 * between them inside one app instead of asking the chat to open another. The three apps differ
 * only in which tool result seeds it and which page it opens on; the other sections are fetched
 * on demand through the same tools.
 */

type Base = Data & { bookingEnabled?: boolean; shopEnabled?: boolean; today?: Today; contact?: { phone?: string; email?: string } };
type Location = { address?: string; city?: string; state?: string; zipCode?: string; country?: string; mapsUrl?: string };
type ExplorerData = Base & {
  salon?: { name: string; contact?: { phone?: string; email?: string; website?: string }; bookingAdvanceDays?: number };
  location?: Location;
  items?: WeeklyHours[];
  week?: OpeningDay[];
  upcomingClosures?: ClosureRange[];
};
type ServicesData = Base & { items?: Service[]; categories?: { id: string; count: number }[]; staff?: Staff[]; category?: string; serviceId?: number };
type TeamData = Base & { items?: Staff[]; services?: Service[]; specializations?: string[]; staffId?: number; specialization?: string };

type Section = "explorer" | "services" | "team";
export type Route =
  | { name: "home" }
  | { name: "hours" }
  | { name: "location" }
  | { name: "services" }
  | { name: "service"; id: number }
  | { name: "team" }
  | { name: "stylist"; id: number }
  | { name: "bookWith"; staffId: number; date?: string }
  | { name: "book" };

const TOOLS: Record<Section, [string, Record<string, unknown>]> = {
  explorer: ["salon_explorer", { view: "overview" }],
  services: ["salon_services", {}],
  team: ["salon_team", {}],
};
const SECTION_OF: Record<Route["name"], Section | undefined> = {
  home: "explorer", hours: "explorer", location: "explorer",
  services: "services", service: "services",
  team: "team", stylist: "team", bookWith: "team",
  book: undefined,
};
const TABS: [Route["name"], string][] = [["home", "Salon"], ["services", "Services"], ["team", "Team"], ["hours", "Hours"]];

export class SalonNavigator {
  private stack: Route[] = [{ name: "home" }];
  private explorer: ExplorerData | undefined;
  private services: ServicesData | undefined;
  private team: TeamData | undefined;
  private loading = new Set<Section>();
  private errors = new Map<Section, string>();
  private seededFrom: unknown;
  private category: string | undefined;
  private specialization: string | undefined;
  private query = "";
  private sort: "menu" | "price" | "duration" = "menu";
  private readonly booking = new InlineBooking();
  private readonly gallery = new PortfolioGallery();
  private readonly next = new NextAvailable();
  private rt!: SalonApp<Base>;

  get route() {
    return this.stack[this.stack.length - 1]!;
  }

  /** The `view` the SalonApp runtime calls on every render. */
  view = (rt: SalonApp<Data>): Node[] => {
    this.rt = rt as SalonApp<Base>;
    if (this.seededFrom !== rt.data) this.seed(rt.data as Base);
    const route = this.route;
    const section = SECTION_OF[route.name];
    if (section) this.ensure(section);
    return [this.header(), ...[this.navBar()].flat(), this.body(route, section)].filter((n): n is HTMLElement => !!n);
  };

  /** Adopts a tool result the host pushed (the model opened or re-opened the app). */
  private seed(data: Base) {
    this.seededFrom = data;
    this.booking.close();
    this.gallery.close();
    if (data.app === "salon_services") {
      const d = data as ServicesData;
      this.services = d;
      this.category = d.category;
      this.stack = d.serviceId ? [{ name: "services" }, { name: "service", id: d.serviceId }] : [{ name: "services" }];
    } else if (data.app === "salon_team") {
      const d = data as TeamData;
      this.team = d;
      this.specialization = d.specialization;
      this.stack = d.staffId ? [{ name: "team" }, { name: "stylist", id: d.staffId }] : [{ name: "team" }];
    } else {
      const d = data as ExplorerData;
      // The overview and hours payloads carry the dated week; a location-only payload loads the overview on demand.
      if (d.week) this.explorer = d;
      this.stack = [{ name: d.view === "hours" ? "hours" : d.view === "location" ? "location" : "home" }];
    }
  }

  /** Loads a section's data through its tool the first time a page needs it. */
  private ensure(section: Section) {
    if (this.data(section) || this.loading.has(section) || this.errors.has(section)) return;
    this.loading.add(section);
    const [tool, args] = TOOLS[section];
    void this.rt.call<Base>(tool, args).then((outcome) => {
      this.loading.delete(section);
      if (outcome.ok) {
        if (section === "explorer") this.explorer = outcome.data as ExplorerData;
        if (section === "services") this.services = outcome.data as ServicesData;
        if (section === "team") this.team = outcome.data as TeamData;
      } else {
        this.errors.set(section, outcome.error);
      }
      this.rt.render();
    });
  }

  private data(section: Section) {
    return section === "explorer" ? (this.explorer?.week ? this.explorer : undefined)
      : section === "services" ? this.services : this.team;
  }

  private get base(): Base {
    return this.rt.data!;
  }

  // ── Navigation ─────────────────────────────────────────────────────────

  go(route: Route) {
    this.gallery.close();
    this.stack.push(route);
    this.announce(route);
    this.rt.render();
    scrollToTop();
  }

  /** Jumps to a top-level section, dropping the trail. */
  jump(route: Route) {
    this.booking.close();
    this.gallery.close();
    this.stack = [route];
    this.announce(route);
    this.rt.render();
  }

  back() {
    if (this.stack.length < 2) return;
    if (this.route.name === "book") this.booking.close();
    this.gallery.close();
    this.stack.pop();
    this.announce(this.route);
    this.rt.render();
  }

  private announce(route: Route) {
    const service = route.name === "service" ? this.findService(route.id) : undefined;
    const member = route.name === "stylist" ? this.findStaff(route.id) : undefined;
    const text: Record<Route["name"], string> = {
      home: "The visitor is on the salon's home card.",
      hours: "The visitor is looking at the opening hours, holidays and closures.",
      location: "The visitor is looking at the salon's location.",
      services: "The visitor is browsing the service menu.",
      service: `The visitor is looking at the ${service?.name ?? "service"} detail card.`,
      team: "The visitor is browsing the team.",
      stylist: `The visitor is looking at ${member?.name ?? "a stylist"}'s profile.`,
      bookWith: "The visitor is choosing a service to book with a stylist.",
      book: "The visitor is booking an appointment.",
    };
    this.rt.context(text[route.name]);
  }

  private crumb(route: Route) {
    switch (route.name) {
      case "home": return "Salon";
      case "hours": return "Hours";
      case "location": return "Location";
      case "services": return "Services";
      case "service": return this.findService(route.id)?.name ?? "Service";
      case "team": return "Team";
      case "stylist": return this.findStaff(route.id)?.name ?? "Stylist";
      case "bookWith": return "Choose a service";
      case "book": return "Book";
    }
  }

  // ── Chrome ─────────────────────────────────────────────────────────────

  private header() {
    const base = this.base;
    return h("header", { class: "header" },
      h("span", { class: "eyebrow" }, this.eyebrow()),
      h("span", { class: "title" }, base.salonName ?? "Salon"),
      todayBadge(base.today, this.route.name === "hours" ? undefined : () => this.jump({ name: "hours" })));
  }

  private eyebrow() {
    const section = SECTION_OF[this.route.name];
    return section === "services" ? "SERVICES" : section === "team" ? "OUR TEAM" : this.route.name === "book" ? "BOOKING" : "SALON INFO";
  }

  private navBar() {
    const top = this.stack[0]!.name;
    const tabs = h("nav", { class: "tabs", role: "tablist", "aria-label": "Salon sections" },
      TABS.map(([name, label]) => button(label, () => this.jump({ name } as Route),
        `tab${top === name && this.stack.length === 1 ? " active" : ""}`, { role: "tab", "aria-selected": String(top === name) })));
    if (this.stack.length < 2) return tabs;
    return [tabs, h("div", { class: "trail" },
      button("‹ Back", () => this.back(), "btn small"),
      h("nav", { class: "breadcrumb", "aria-label": "You are here" }, this.stack.map((route, index) => {
        const last = index === this.stack.length - 1;
        return [
          index ? h("span", { class: "crumb-sep", "aria-hidden": "true" }, "›") : null,
          last ? h("span", { class: "crumb current", "aria-current": "page" }, this.crumb(route))
            : button(this.crumb(route), () => this.popTo(index), "crumb"),
        ];
      })))];
  }

  private popTo(index: number) {
    if (this.stack.slice(index + 1).some((r) => r.name === "book")) this.booking.close();
    this.gallery.close();
    this.stack = this.stack.slice(0, index + 1);
    this.announce(this.route);
    this.rt.render();
  }

  private body(route: Route, section: Section | undefined) {
    if (section && !this.data(section)) {
      const error = this.errors.get(section);
      return error
        ? h("div", { class: "stack" }, h("p", { class: "error", role: "alert" }, error),
          button("Try again", () => { this.errors.delete(section); this.rt.render(); }, "btn"))
        : h("div", { class: "loading" }, h("span", { class: "spinner" }), h("span", null, "Loading…"));
    }
    switch (route.name) {
      case "home": return this.home();
      case "hours": return this.hours();
      case "location": return this.location();
      case "services": return this.serviceMenu();
      case "service": return this.serviceCard(route.id);
      case "team": return this.teamGrid();
      case "stylist": return this.stylistPage(route.id);
      case "bookWith": return this.bookWith(route.staffId, route.date);
      case "book": return this.bookingPane();
    }
  }

  // ── Salon home, hours, location ────────────────────────────────────────

  private home() {
    const data = this.explorer!;
    const contact = data.salon?.contact ?? {};
    const loc = data.location ?? {};
    const tiles: [string, string, () => void][] = [
      ["✂️", "Services", () => this.go({ name: "services" })],
      ["👥", "Our team", () => this.go({ name: "team" })],
      ["🕒", "Opening hours", () => this.go({ name: "hours" })],
      ["📍", "Find us", () => this.go({ name: "location" })],
    ];
    if (data.bookingEnabled) tiles.push(["📅", "Book now", () => this.go({ name: "services" })]);
    if (data.shopEnabled) tiles.push(["🛍️", "Shop", () => this.rt.ask("Show me the shop")]);
    return h("div", { class: "stack" },
      h("section", { class: "card info-grid" },
        address(loc) ? infoRow("📍", "Address", address(loc), loc.mapsUrl ? button("Map", () => this.rt.openLink(loc.mapsUrl!), "link-button") : null) : null,
        contact.phone ? infoRow("📞", "Phone", contact.phone, button("Call", () => this.rt.openLink(`tel:${contact.phone}`), "link-button")) : null,
        contact.email ? infoRow("✉️", "Email", contact.email, button("Email", () => this.rt.openLink(`mailto:${contact.email}`), "link-button")) : null,
        contact.website ? infoRow("🌐", "Website", contact.website, button("Visit", () => this.rt.openLink(contact.website!), "link-button")) : null,
        data.bookingEnabled
          ? infoRow("📅", "Online booking", `Up to ${data.salon?.bookingAdvanceDays ?? 60} days ahead`)
          : infoRow("📅", "Booking", "This salon takes bookings by phone or email")),
      weekStrip(data.week ?? [], () => this.go({ name: "hours" })),
      // Closures inside the next seven days are already on the strip; list only the later ones.
      closuresCard((data.upcomingClosures ?? []).filter((r) => r.from > ((data.week ?? []).at(-1)?.date ?? "")).slice(0, 3)),
      h("section", { class: "launcher" },
        h("h3", { class: "section-title" }, "Explore"),
        h("div", { class: "launcher-grid" }, tiles.map(([icon, label, onClick]) =>
          button([h("span", { class: "launcher-icon", "aria-hidden": "true" }, icon), h("span", null, label)], onClick, "launcher-tile")))));
  }

  private hours() {
    const data = this.explorer!;
    return h("div", { class: "stack" },
      weekCard(data.week ?? []),
      closuresCard(data.upcomingClosures ?? []),
      weeklyCard(data.items ?? []),
      data.bookingEnabled ? button("Book an appointment", () => this.go({ name: "services" }), "btn primary") : this.contactActions());
  }

  private location() {
    const loc = this.explorer!.location ?? {};
    const text = address(loc);
    return h("section", { class: "card stack" },
      h("h3", { class: "section-title" }, "Find us"),
      h("p", { class: "detail" }, text || "The salon hasn't published its address yet."),
      loc.mapsUrl ? button("Open in maps", () => this.rt.openLink(loc.mapsUrl!), "btn primary") : null);
  }

  // ── Services ───────────────────────────────────────────────────────────

  private serviceMenu() {
    const data = this.services!;
    const list = h("div", { class: "list-host" }, this.serviceList());
    const search = h("input", {
      class: "field search", type: "search", placeholder: "Search services…", value: this.query, "aria-label": "Search services",
      onInput: (event: Event) => {
        this.query = (event.target as HTMLInputElement).value;
        list.replaceChildren(this.serviceList());
      },
    });
    const categories = data.categories ?? [];
    const chip = (id: string | undefined, label: string) => button(label, () => {
      this.category = id;
      this.rt.context(id ? `The visitor is browsing ${enumLabel(id)} services.` : "The visitor is browsing the full service menu.");
      this.rt.render();
    }, `chip${this.category === id ? " active" : ""}`, { "aria-pressed": String(this.category === id) });
    return h("div", { class: "stack" },
      h("p", { class: "subtitle" }, plural((data.items ?? []).length, "service")),
      h("div", { class: "toolbar" }, search,
        h("select", {
          class: "field compact", "aria-label": "Sort services",
          onChange: (event: Event) => { this.sort = (event.target as HTMLSelectElement).value as typeof this.sort; this.rt.render(); },
        },
        h("option", { value: "menu", selected: this.sort === "menu" }, "Menu order"),
        h("option", { value: "price", selected: this.sort === "price" }, "Price: low to high"),
        h("option", { value: "duration", selected: this.sort === "duration" }, "Shortest first"))),
      categories.length > 1 ? h("div", { class: "chip-row scroll" },
        chip(undefined, `All · ${(data.items ?? []).length}`),
        categories.map((c) => chip(c.id, `${enumLabel(c.id)} · ${c.count}`))) : null,
      list);
  }

  private serviceList() {
    const query = this.query.trim().toLowerCase();
    const list = (this.services!.items ?? []).filter((s) => (!this.category || s.category === this.category)
      && (!query || `${s.name} ${s.description ?? ""} ${s.category ?? ""}`.toLowerCase().includes(query)));
    if (this.sort === "price") list.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    if (this.sort === "duration") list.sort((a, b) => (a.durationMinutes ?? 0) - (b.durationMinutes ?? 0));
    if (!list.length) {
      return (this.services!.items ?? []).length
        ? emptyState("No services match", this.query ? `Nothing found for “${this.query}”.` : "This category has no services yet.",
          button("Show all services", () => { this.query = ""; this.category = undefined; this.rt.render(); }, "btn"))
        : emptyState("No services listed yet", "The salon hasn't published its menu online.", this.contactActions() ?? undefined);
    }
    // Group by category only in menu order with no category filter — otherwise a flat list reads better.
    if (this.sort !== "menu" || this.category) return h("div", { class: "list" }, list.map((s) => this.serviceRow(s)));
    const groups = new Map<string, Service[]>();
    for (const s of list) groups.set(s.category ?? "OTHER", [...(groups.get(s.category ?? "OTHER") ?? []), s]);
    return h("div", { class: "stack" }, [...groups].map(([category, items]) => h("section", { class: "group" },
      h("h3", { class: "section-title" }, `${enumLabel(category)} · ${items.length}`),
      h("div", { class: "list" }, items.map((s) => this.serviceRow(s))))));
  }

  private serviceRow(service: Service) {
    const performers = this.performers(service);
    return h("article", { class: "row service-row" },
      h("button", { type: "button", class: "row-main", onClick: () => this.go({ name: "service", id: service.id }), "aria-label": `${service.name} details` },
        h("div", { class: "row-body" },
          h("span", { class: "row-title" }, service.name),
          h("span", { class: "row-meta" }, [duration(service.durationMinutes), (service.staffIds ?? []).length ? plural(performers.length, "stylist") : "Any stylist"].filter(Boolean).join(" · ")),
          service.description ? h("span", { class: "row-description clamp" }, service.description) : null),
        h("span", { class: "price" }, money(service.price, service.currency) || "Ask"),
        h("span", { class: "team-chevron", "aria-hidden": "true" }, "›")),
      h("div", { class: "row-actions" },
        button("Details", () => this.go({ name: "service", id: service.id }), "link-button"),
        this.base.bookingEnabled ? button("Book", () => this.bookService(service), "btn primary small") : null));
  }

  private serviceCard(id: number) {
    const service = this.findService(id);
    if (!service) return this.notFound("This service isn't on the menu", "It may have been removed or renamed.", { name: "services" }, "See all services");
    const assigned = (service.staffIds ?? []).length > 0;
    const performers = this.performers(service);
    const related = (this.services?.items ?? []).filter((s) => s.id !== service.id && s.category === service.category).slice(0, 4);
    const price = money(service.price, service.currency);
    return h("div", { class: "stack" },
      h("article", { class: "card detail-card" },
        h("div", { class: "detail-head" },
          h("div", { class: "row-body" },
            service.category ? h("span", { class: "tag" }, enumLabel(service.category)) : null,
            h("h2", { class: "detail-title" }, service.name)),
          h("span", { class: "price lg" }, price || "Price on request")),
        h("div", { class: "fact-row" },
          duration(service.durationMinutes) ? h("span", { class: "fact" }, "⏱ ", duration(service.durationMinutes)) : null,
          h("span", { class: "fact" }, "✂️ ", assigned ? plural(performers.length, "stylist") : "Any of our stylists")),
        service.description ? h("p", { class: "row-description" }, service.description) : h("p", { class: "muted" }, "Ask the salon for more about this service."),
        this.base.bookingEnabled ? this.earliestFor(service) : null,
        this.base.bookingEnabled
          ? button(performers.length === 1 ? `Book with ${firstName(performers[0]!.name)}` : "Book this service", () => this.bookService(service), "btn primary wide")
          : this.contactActions()),
      h("section", { class: "card" },
        h("h3", { class: "section-title" }, assigned ? "Who performs it" : "Our team"),
        performers.length
          ? h("div", { class: "list" }, performers.map((m) => this.stylistRow(m, service)))
          : h("p", { class: "muted" }, assigned ? "The stylists for this service aren't taking online bookings right now." : "Any available stylist can do this — pick a time and we'll match you.")),
      related.length ? h("section", { class: "group" },
        h("h3", { class: "section-title" }, `More ${enumLabel(service.category)} services`),
        h("div", { class: "list" }, related.map((s) => button(
          [h("div", { class: "row-body" }, h("span", { class: "row-title" }, s.name), h("span", { class: "row-meta" }, serviceSummary(s))), h("span", { class: "team-chevron" }, "›")],
          () => this.go({ name: "service", id: s.id }), "row row-button")))) : null);
  }

  /** "Earliest: Tomorrow 10:00 AM with Anna" plus a button that opens booking on exactly that time. */
  private earliestFor(service: Service) {
    const result = this.next.get(this.rt, { serviceId: service.id });
    if (result === undefined) return h("p", { class: "next-free" }, "Checking the next open time…");
    const first = result?.firstAvailable;
    if (!first) return result === null ? null : h("p", { class: "notice" }, "No open times in the booking window right now — contact the salon.");
    const member = first.staffId ? this.findStaff(first.staffId) : undefined;
    return h("div", { class: "earliest" },
      h("div", { class: "row-body" },
        h("span", { class: "row-meta" }, "Earliest available"),
        h("span", { class: "row-title" }, `${slotLabel(first.date, first.startTime)}${member ? ` with ${member.name}` : ""}`)),
      button("Book this time", () => this.startBooking(service, (service.staffIds ?? []).length === 1 ? member : undefined, false, first.date, first.startTime, first.staffId),
        "btn primary small"));
  }

  private stylistRow(member: Staff, service: Service) {
    const bookable = this.base.bookingEnabled && member.availableForBooking !== false;
    return h("div", { class: "row" },
      h("button", { type: "button", class: "row-link", onClick: () => this.go({ name: "stylist", id: member.id }), "aria-label": `${member.name} profile` },
        avatar(member.name, member.avatarUrl, "avatar"),
        h("div", { class: "row-body" },
          h("span", { class: "row-title" }, member.name),
          h("span", { class: "row-meta" }, member.role ? enumLabel(member.role) : "Stylist"))),
      button("Profile", () => this.go({ name: "stylist", id: member.id }), "btn small"),
      bookable && (service.staffIds ?? []).length > 1 ? button("Book", () => this.startBooking(service, member), "btn primary small") : null);
  }

  /** Stylists who perform a service — its assigned stylists, or the whole bookable team when it's open to anyone. */
  private performers(service: Service): Staff[] {
    const roster = this.roster();
    const ids = service.staffIds ?? [];
    return ids.length ? ids.map((id) => roster.find((m) => m.id === id)).filter(Boolean) as Staff[] : [];
  }

  // ── Team ───────────────────────────────────────────────────────────────

  private teamGrid() {
    const data = this.team!;
    const specs = data.specializations ?? [];
    const wanted = this.specialization?.toLowerCase();
    const members = (data.items ?? []).filter((m) => !wanted || (m.specializations ?? []).some((s) => s.toLowerCase() === wanted));
    const chip = (value: string | undefined, label: string) => button(label, () => {
      this.specialization = value;
      this.rt.context(value ? `The visitor is looking for stylists who specialise in ${value}.` : "The visitor is browsing the whole team.");
      this.rt.render();
    }, `chip${this.specialization === value ? " active" : ""}`, { "aria-pressed": String(this.specialization === value) });
    return h("div", { class: "stack" },
      h("p", { class: "subtitle" }, plural((data.items ?? []).length, "stylist")),
      specs.length ? h("div", { class: "chip-row scroll" }, chip(undefined, "Everyone"), specs.map((s) => chip(s, s))) : null,
      !(data.items ?? []).length ? emptyState("No team members listed yet", "The salon hasn't introduced its team online.")
        : !members.length ? emptyState("No stylists match", "Try another specialisation.", button("Show everyone", () => { this.specialization = undefined; this.rt.render(); }, "btn"))
          : h("div", { class: "card-grid" }, members.map((member) => {
            const open = () => this.go({ name: "stylist", id: member.id });
            return h("article", { class: "staff-card" },
              h("button", { type: "button", class: "staff-card-main", onClick: open },
                avatar(member.name, member.avatarUrl, "avatar lg"),
                h("span", { class: "row-title" }, member.name),
                member.role ? h("span", { class: "row-meta" }, enumLabel(member.role)) : null,
                member.specializations?.length ? h("div", { class: "chip-row center" }, member.specializations.slice(0, 3).map((s) => h("span", { class: "tag" }, s))) : null),
              h("div", { class: "staff-card-actions" },
                button("Profile", open, "btn small"),
                this.base.bookingEnabled && member.availableForBooking !== false ? button("Book", () => this.bookStylist(member), "btn primary small") : null));
          })));
  }

  private stylistPage(id: number) {
    const member = this.findStaff(id);
    if (!member) return this.notFound("We couldn't find that stylist", "They may no longer be on the team.", { name: "team" }, "Meet the team");
    const first = firstName(member.name);
    const services = this.stylistServices(member);
    const bookable = this.base.bookingEnabled && member.availableForBooking !== false;
    return h("div", { class: "stack" },
      h("article", { class: "card detail-card" },
        h("div", { class: "profile-header flat" },
          avatar(member.name, member.avatarUrl, "profile-avatar"),
          h("div", { class: "row-body" },
            h("h2", { class: "detail-title" }, member.name),
            h("span", { class: "row-meta" }, member.role ? enumLabel(member.role) : "Stylist"))),
        member.specializations?.length ? h("div", { class: "chip-row" }, member.specializations.map((s) =>
          button(s, () => { this.specialization = s; this.jump({ name: "team" }); }, "tag tag-button", { "aria-label": `Stylists who specialise in ${s}` }))) : null,
        member.bio ? h("p", { class: "row-description" }, member.bio) : h("p", { class: "muted" }, `${first} hasn't added a bio yet.`),
        bookable ? this.stylistAvailability(member) : null,
        bookable ? button(`Book with ${first}`, () => this.bookStylist(member), "btn primary wide")
          : this.base.bookingEnabled ? h("p", { class: "notice" }, `${first} isn't taking online bookings right now — choose another stylist or contact the salon.`)
            : this.contactActions()),
      h("section", { class: "card" },
        h("h3", { class: "section-title" }, `${first}'s services`),
        services.length
          ? h("div", { class: "list" }, services.map((s) => h("div", { class: "row" },
            h("button", { type: "button", class: "row-link", onClick: () => this.go({ name: "service", id: s.id }) },
              h("div", { class: "row-body" }, h("span", { class: "row-title" }, s.name), h("span", { class: "row-meta" }, serviceSummary(s)))),
            bookable ? button("Book", () => this.startBooking(s, member), "btn primary small")
              : button("Details", () => this.go({ name: "service", id: s.id }), "btn small"))))
          : h("p", { class: "muted" }, `${first} has no services listed online yet.`)),
      (member.workMedia ?? []).length ? h("section", { class: "card" },
        h("h3", { class: "section-title" }, `${first}'s work · ${(member.workMedia ?? []).length}`),
        this.gallery.render(member, () => this.rt.render())) : null);
  }

  /** "Next free" for a stylist plus their next three open days — tap a day to book it. */
  private stylistAvailability(member: Staff) {
    const result = this.next.get(this.rt, { staffId: member.id, days: 3 });
    if (result === undefined) return h("p", { class: "next-free" }, "Checking when they're free…");
    if (result === null) return null;
    const first = result.firstAvailable;
    if (!first) return h("p", { class: "notice" }, `${firstName(member.name)} has no open times in the booking window right now.`);
    const days = result.openDays ?? [];
    return h("div", { class: "stack tight" },
      h("p", { class: "next-free ok" }, `Next free: ${slotLabel(first.date, first.startTime)}`),
      days.length ? h("div", { class: "day-strip", role: "list", "aria-label": `${member.name}'s next open days` }, days.map((day) => button([
        h("span", { class: "day-chip-weekday" }, weekdayShort(day.date)),
        h("span", { class: "day-chip-num" }, String(dayOfMonth(day.date))),
        h("span", { class: "day-chip-hint" }, day.firstOpenTime ? `from ${timeLabel(day.firstOpenTime)}` : "Open"),
      ], () => this.bookStylist(member, day.date), "day-chip status-open", { role: "listitem", "aria-label": `Book with ${member.name} on ${dateLabel(day.date, "long")}` }))) : null);
  }

  /** Services a stylist offers: those assigned to them, plus services assigned to nobody (anyone can do them). */
  private stylistServices(member: Staff) {
    const services = this.team?.services ?? this.services?.items ?? [];
    const assigned = services.filter((s) => (member.serviceIds ?? []).includes(s.id) || (s.staffIds ?? []).includes(member.id));
    const open = services.filter((s) => !(s.staffIds ?? []).length);
    return [...assigned, ...open.filter((s) => !assigned.includes(s))];
  }

  private bookWith(staffId: number, date?: string) {
    const member = this.findStaff(staffId);
    if (!member) return this.notFound("We couldn't find that stylist", undefined, { name: "team" }, "Meet the team");
    const services = this.stylistServices(member);
    return h("div", { class: "stack" },
      h("div", { class: "pane-head" },
        avatar(member.name, member.avatarUrl, "avatar"),
        h("div", { class: "row-body" },
          h("span", { class: "row-title" }, `Book with ${member.name}`),
          h("span", { class: "row-meta" }, `Choose one of ${firstName(member.name)}'s services`))),
      services.length
        ? h("div", { class: "list" }, services.map((s) => button(
          [h("div", { class: "row-body" }, h("span", { class: "row-title" }, s.name), h("span", { class: "row-meta" }, serviceSummary(s))), h("span", { class: "team-chevron" }, "›")],
          () => this.startBooking(s, member, true, date), "row row-button")))
        : emptyState(`${firstName(member.name)} has no bookable services yet`, "Ask the salon, or pick another stylist."));
  }

  // ── Booking ────────────────────────────────────────────────────────────

  /** From a service: straight to its only stylist's calendar, otherwise "any stylist" with a per-time choice. */
  private bookService(service: Service) {
    const performers = this.performers(service).filter((m) => m.availableForBooking !== false);
    this.startBooking(service, performers.length === 1 && (service.staffIds ?? []).length === 1 ? performers[0] : undefined);
  }

  /** From a stylist: straight to the calendar when they do one service, otherwise pick the service first. */
  private bookStylist(member: Staff, date?: string) {
    const services = this.stylistServices(member);
    if (services.length === 1) this.startBooking(services[0]!, member, false, date);
    else this.go({ name: "bookWith", staffId: member.id, date });
  }

  private startBooking(service: Service, member?: Staff, replace = false, date?: string, startTime?: string, slotStaffId?: number) {
    if (replace) this.stack.pop();
    this.stack.push({ name: "book" });
    this.gallery.close();
    void this.booking.start(this.rt, service, member, date, startTime, slotStaffId);
    scrollToTop();
  }

  private bookingPane() {
    if (!this.booking.active) return this.notFound("Nothing to book yet", "Pick a service or a stylist first.", { name: "services" }, "See services");
    const serviceId = this.booking.service?.id;
    return this.booking.render(this.rt, {
      onClose: () => {
        // Also reached after "Book something else" — times have changed, so refresh the hints.
        this.next.clear();
        if (this.route.name === "book") this.back();
        else this.booking.close();
      },
      // Leaving booking to change the service or stylist: the menu, or the service's card (its stylists).
      onChangeService: () => this.leaveBookingFor({ name: "services" }),
      onChangeStaff: () => this.leaveBookingFor(serviceId ? { name: "service", id: serviceId } : { name: "team" }),
    });
  }

  private leaveBookingFor(route: Route) {
    this.booking.close();
    if (this.route.name === "book") this.stack.pop();
    this.go(route);
  }

  // ── Shared bits ────────────────────────────────────────────────────────

  private roster(): Staff[] {
    return this.team?.items ?? this.services?.staff ?? [];
  }

  private findService(id: number) {
    return (this.services?.items ?? this.team?.services ?? []).find((s) => s.id === id);
  }

  private findStaff(id: number) {
    return this.roster().find((m) => m.id === id);
  }

  /** Call/email buttons — the way to book when online booking is off. */
  private contactActions() {
    const contact = this.base.contact ?? this.explorer?.salon?.contact;
    if (!contact?.phone && !contact?.email) return null;
    return h("div", { class: "contact-actions" },
      h("span", { class: "muted" }, this.base.bookingEnabled ? "Prefer to talk to the salon?" : "Book by contacting the salon:"),
      contact.phone ? button(`📞 ${contact.phone}`, () => this.rt.openLink(`tel:${contact.phone}`), "btn small") : null,
      contact.email ? button("✉️ Email", () => this.rt.openLink(`mailto:${contact.email}`), "btn small") : null);
  }

  private notFound(title: string, detail: string | undefined, route: Route, label: string) {
    return emptyState(title, detail, button(label, () => this.jump(route), "btn"));
  }
}

function address(location: Location) {
  return [location.address, location.city, location.state, location.zipCode, location.country].filter(Boolean).join(", ");
}

function infoRow(icon: string, label: string, value: string, action?: Node | null) {
  return h("div", { class: "info-row" },
    h("span", { class: "info-icon", "aria-hidden": "true" }, icon),
    h("div", { class: "row-body" }, h("span", { class: "row-meta" }, label), h("span", { class: "detail" }, value)),
    action ?? null);
}

/** The app iframe grows to its content; a new page should start at its top, not mid-list. */
function scrollToTop() {
  window.scrollTo({ top: 0 });
}
