import { App, applyDocumentTheme, applyHostFonts, applyHostStyleVariables } from "@modelcontextprotocol/ext-apps";
import "./style.css";

type SalonData = {
  view: string;
  salonId: string;
  bookingEnabled?: boolean;
  salonName?: string;
  salon?: {
    name: string;
    handler: string;
    location: Record<string, string>;
    contact: Record<string, string>;
    bookingEnabled: boolean;
    bookingAdvanceDays: number;
  };
  location?: Record<string, string>;
  items?: Record<string, unknown>[];
  services?: { id: number; name: string; durationMinutes: number }[];
  serviceId?: number;
  serviceName?: string;
  date?: string;
  error?: string;
};

type Slot = { staffId?: number; startTime: string; endTime?: string };
type BookingDetails = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes: string;
};

const app = new App({ name: "Salon Explorer", version: "1.0.0" });
const root = document.querySelector<HTMLElement>("#app")!;
function applyHostTheme() {
  const context = app.getHostContext();
  if (context?.theme) applyDocumentTheme(context.theme);
  if (context?.styles?.variables) applyHostStyleVariables(context.styles.variables);
  if (context?.styles?.css?.fonts) applyHostFonts(context.styles.css.fonts);
}
app.onhostcontextchanged = applyHostTheme;
let latest: SalonData | undefined;
let busy = false;
let selectedSlot: Slot | undefined;
let bookingDraft: BookingDetails = { customerName: "", customerEmail: "", customerPhone: "", notes: "" };
let reviewingBooking = false;
let confirmedBooking: Record<string, unknown> | undefined;
let profileStaff: Record<string, unknown> | undefined;
let profileMediaIndex: number | undefined;
let preferredStaffId: number | undefined;

app.ontoolresult = (result) => {
  const structured = result.structuredContent as SalonData | undefined;
  if (structured) {
    latest = structured;
    render();
    return;
  }
  const text = result.content?.find((item) => item.type === "text")?.text;
  if (text) {
    try {
      latest = JSON.parse(text) as SalonData;
    } catch {
      latest = { view: "error", salonId: latest?.salonId ?? "", error: text };
    }
    render();
  }
};

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function addText(parent: HTMLElement, className: string, value: unknown, fallback = "") {
  const text = element("span", className, textValue(value, fallback));
  parent.append(text);
  return text;
}

async function callView(view: string, extra: Record<string, unknown> = {}) {
  if (!latest?.salonId || busy) return;
  selectedSlot = undefined;
  bookingDraft = { customerName: "", customerEmail: "", customerPhone: "", notes: "" };
  reviewingBooking = false;
  confirmedBooking = undefined;
  busy = true;
  render();
  try {
    const result = await app.callServerTool({
      name: "salon_explorer",
      arguments: { salonIdOrHandler: latest.salonId, view, ...extra },
    });
    if (result.isError) {
      latest = { ...latest, error: result.content?.find((item) => item.type === "text")?.text ?? "Could not load this information." };
    } else if (result.structuredContent) {
      latest = result.structuredContent as SalonData;
    } else {
      const content = result.content?.find((item) => item.type === "text")?.text;
      if (content) latest = JSON.parse(content) as SalonData;
    }
  } catch {
    latest = { ...latest, error: "Could not connect to the salon service. Please try again." };
  } finally {
    busy = false;
    render();
  }
}

function makeNav() {
  const nav = element("nav", "nav");
  const views = ["overview", "services", "team", "hours", "location", "availability"];
  for (const view of views) {
    if (view === "availability" && !latest?.bookingEnabled) continue;
    const button = element("button", `nav-button${latest?.view === view ? " active" : ""}`, view === "team" ? "Team" : view[0].toUpperCase() + view.slice(1));
    button.type = "button";
    button.disabled = busy;
    button.addEventListener("click", () => void callView(view));
    nav.append(button);
  }
  return nav;
}

function renderOverview(data: SalonData) {
  const salon = data.salon;
  if (!salon) return;
  const card = element("section", "overview-card");
  const location = salon.location ?? {};
  const address = [location.address, location.city, location.state, location.zipCode, location.country].filter(Boolean).join(", ");
  const contact = salon.contact ?? {};
  if (address) addText(card, "detail", address);
  if (contact.phone) addText(card, "detail", `Phone: ${contact.phone}`);
  if (contact.email) addText(card, "detail", `Email: ${contact.email}`);
  if (contact.website) addText(card, "detail", `Website: ${contact.website}`);
  if (address && location.mapsUrl) {
    const map = element("a", "link", "Open map");
    map.href = location.mapsUrl;
    map.target = "_blank";
    map.rel = "noopener noreferrer";
    card.append(map);
  }
  if (salon.bookingEnabled) addText(card, "muted", `Online booking available · up to ${salon.bookingAdvanceDays} days ahead`);
  root.append(card);
  if (data.items?.length) renderHours(data.items);
}

function renderServices(items: Record<string, unknown>[]) {
  const list = element("div", "list");
  for (const service of items) {
    const row = element("article", "row");
    const body = element("div", "row-body");
    addText(body, "row-title", service.name);
    if (service.description) addText(body, "row-description", service.description);
    addText(body, "row-meta", `${service.durationMinutes || ""}${service.durationMinutes ? " min" : ""}${service.price != null ? ` · ${service.currency ?? ""} ${service.price}` : ""}`);
    row.append(body);
    if (latest?.bookingEnabled) {
      const book = element("button", "small-button", "Check times") as HTMLButtonElement;
      book.type = "button";
      book.disabled = busy;
      book.addEventListener("click", () => void callView("availability", { serviceId: service.id }));
      row.append(book);
    }
    list.append(row);
  }
  root.append(list);
}

function renderTeam(items: Record<string, unknown>[]) {
  const list = element("div", "list");
  for (const member of items) {
    const row = element("button", "row team-row team-card") as HTMLButtonElement;
    row.type = "button";
    row.setAttribute("aria-haspopup", "dialog");
    row.addEventListener("click", () => { profileStaff = member; profileMediaIndex = undefined; render(); });
    if (typeof member.avatarUrl === "string" && member.avatarUrl) {
      const image = element("img", "avatar") as HTMLImageElement;
      image.src = member.avatarUrl;
      image.alt = "";
      image.loading = "lazy";
      row.append(image);
    }
    const body = element("div", "row-body");
    addText(body, "row-title", member.name);
    if (member.role) addText(body, "row-meta", member.role);
    if (member.specializations && Array.isArray(member.specializations)) addText(body, "row-meta", member.specializations.join(" · "));
    const media = Array.isArray(member.workMedia) ? member.workMedia.length : 0;
    const hints = [member.bio ? "About" : "", media ? `${media} portfolio item${media === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ");
    addText(body, "row-meta", hints || "View stylist profile");
    row.append(body);
    addText(row, "team-chevron", "›");
    list.append(row);
  }
  root.append(list);
}

function isVideo(url: string) { return /\.(mp4|webm|mov|m4v)(?:[?#].*)?$/i.test(url); }

function renderStaffProfile() {
  const member = profileStaff;
  if (!member) return;
  const overlay = element("div", "profile-overlay");
  overlay.addEventListener("click", (event) => { if (event.target === overlay) { profileStaff = undefined; profileMediaIndex = undefined; render(); } });
  const dialog = element("section", "profile-dialog");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", `${textValue(member.name)} profile`);
  const header = element("div", "profile-header");
  if (typeof member.avatarUrl === "string" && member.avatarUrl) {
    const avatar = element("img", "profile-avatar") as HTMLImageElement;
    avatar.src = member.avatarUrl; avatar.alt = ""; header.append(avatar);
  }
  const identity = element("div", "row-body");
  addText(identity, "profile-name", member.name);
  if (Array.isArray(member.specializations) && member.specializations.length) addText(identity, "row-meta", member.specializations.join(" · "));
  header.append(identity);
  const close = element("button", "small-button profile-close", "Close") as HTMLButtonElement;
  close.type = "button"; close.addEventListener("click", () => { profileStaff = undefined; profileMediaIndex = undefined; render(); }); header.append(close);
  dialog.append(header);
  const content = element("div", "profile-content");
  if (member.role) addText(identity, "row-meta", member.role);
  if (member.bio) { content.append(element("h3", "section-title", `About ${textValue(member.name).split(/\s+/)[0]}`)); content.append(element("p", "row-description profile-bio", textValue(member.bio))); }
  const media = Array.isArray(member.workMedia) ? member.workMedia.filter((x): x is string => typeof x === "string" && !!x) : [];
  if (media.length) {
    content.append(element("h3", "section-title", `${textValue(member.name).split(/\s+/)[0]}'s work · ${media.length}`));
    const gallery = element("div", "profile-gallery");
    media.forEach((url, index) => {
      const thumb = element("button", "media-thumb") as HTMLButtonElement; thumb.type = "button"; thumb.setAttribute("aria-label", `Open portfolio item ${index + 1}`);
      if (isVideo(url)) { const video = element("video") as HTMLVideoElement; video.src = url; video.muted = true; video.preload = "metadata"; thumb.append(video, element("span", "video-badge", "▶")); }
      else { const image = element("img") as HTMLImageElement; image.src = url; image.alt = `${textValue(member.name)} portfolio`; image.loading = "lazy"; thumb.append(image); }
      thumb.addEventListener("click", () => { profileMediaIndex = index; render(); }); gallery.append(thumb);
    });
    content.append(gallery);
  }
  if (!member.bio && !media.length) content.append(element("p", "muted", "This stylist has not added a bio or portfolio yet."));
  dialog.append(content);
  if (latest?.bookingEnabled && member.availableForBooking !== false) {
    const footer = element("footer", "profile-footer");
    const book = element("button", "primary-button", `Check availability with ${textValue(member.name).split(/\s+/)[0]}`) as HTMLButtonElement;
    book.type = "button"; book.addEventListener("click", () => { preferredStaffId = Number(member.id); profileStaff = undefined; profileMediaIndex = undefined; void callView("availability", { staffId: preferredStaffId }); });
    footer.append(book); dialog.append(footer);
  }
  overlay.append(dialog);
  if (profileMediaIndex !== undefined && media[profileMediaIndex]) {
    const lightbox = element("div", "lightbox");
    lightbox.addEventListener("click", (event) => { if (event.target === lightbox) { profileMediaIndex = undefined; render(); } });
    const closeMedia = element("button", "lightbox-close", "×") as HTMLButtonElement; closeMedia.type = "button"; closeMedia.setAttribute("aria-label", "Close image viewer"); closeMedia.addEventListener("click", () => { profileMediaIndex = undefined; render(); }); lightbox.append(closeMedia);
    const url = media[profileMediaIndex];
    if (isVideo(url)) { const video = element("video", "lightbox-media") as HTMLVideoElement; video.src = url; video.controls = true; video.autoplay = true; lightbox.append(video); }
    else { const image = element("img", "lightbox-media") as HTMLImageElement; image.src = url; image.alt = `${textValue(member.name)} portfolio`; lightbox.append(image); }
    if (media.length > 1) {
      const prev = element("button", "lightbox-nav lightbox-prev", "‹") as HTMLButtonElement; prev.type = "button"; prev.setAttribute("aria-label", "Previous media"); prev.addEventListener("click", () => { profileMediaIndex = (profileMediaIndex! - 1 + media.length) % media.length; render(); });
      const next = element("button", "lightbox-nav lightbox-next", "›") as HTMLButtonElement; next.type = "button"; next.setAttribute("aria-label", "Next media"); next.addEventListener("click", () => { profileMediaIndex = (profileMediaIndex! + 1) % media.length; render(); }); lightbox.append(prev, next);
    }
    overlay.append(lightbox);
  }
  root.append(overlay);
}

function renderHours(items: Record<string, unknown>[]) {
  const list = element("div", "hours-list");
  for (const day of items) {
    const row = element("div", "hours-row");
    addText(row, "hours-day", day.day);
    addText(row, "hours-time", day.closed ? "Closed" : `${textValue(day.openTime)} – ${textValue(day.closeTime)}`);
    list.append(row);
  }
  root.append(list);
}

function renderAvailability(data: SalonData) {
  const form = element("form", "availability-form");
  const serviceSelect = element("select", "field") as HTMLSelectElement;
  serviceSelect.name = "serviceId";
  serviceSelect.required = true;
  const placeholder = element("option", "", "Choose a service") as HTMLOptionElement;
  placeholder.value = "";
  serviceSelect.append(placeholder);
  for (const service of data.services ?? []) {
    const option = element("option", "", service.name) as HTMLOptionElement;
    option.value = String(service.id);
    option.selected = service.id === data.serviceId;
    serviceSelect.append(option);
  }
  const dateInput = element("input", "field") as HTMLInputElement;
  dateInput.type = "date";
  dateInput.name = "date";
  dateInput.required = true;
  const today = new Date();
  dateInput.min = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  dateInput.value = data.date ?? "";
  const submit = element("button", "primary-button", "Check times") as HTMLButtonElement;
  submit.type = "submit";
  submit.disabled = busy;
  form.append(serviceSelect, dateInput, submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void callView("availability", { serviceId: Number(serviceSelect.value), date: dateInput.value, ...(preferredStaffId ? { staffId: preferredStaffId } : {}) });
  });
  root.append(form);

  if (data.serviceName && data.date) addText(root, "muted result-heading", `${data.serviceName} · ${data.date}`);
  if (data.date && data.items) {
    if (data.items.length === 0) {
      root.append(element("p", "empty", "No available times were found for this date."));
      return;
    }
    const slots = element("div", "slot-grid");
    for (const slot of data.items) {
      const slotCard = element(`button`, `slot-card${selectedSlot?.startTime === slot.startTime && selectedSlot?.staffId === slot.staffId ? " selected" : ""}`) as HTMLButtonElement;
      slotCard.type = "button";
      slotCard.disabled = busy;
      slotCard.addEventListener("click", () => {
        selectedSlot = slot as Slot;
        reviewingBooking = false;
        bookingDraft = { customerName: "", customerEmail: "", customerPhone: "", notes: "" };
        render();
      });
      addText(slotCard, "slot-time", slot.startTime);
      if (slot.staffId != null) addText(slotCard, "slot-label", `Staff #${slot.staffId}`);
      slots.append(slotCard);
    }
    root.append(slots);
  }

  if (selectedSlot && !reviewingBooking) renderBookingDetails(data, selectedSlot);
  if (selectedSlot && reviewingBooking) renderBookingReview(data, selectedSlot);
}

function renderBookingDetails(data: SalonData, slot: Slot) {
  const section = element("section", "booking-panel");
  section.append(element("h2", "section-title", "Your details"));
  section.append(element("p", "muted", `${data.serviceName} · ${data.date} at ${slot.startTime}`));
  const form = element("form", "booking-form");
  const name = element("input", "field") as HTMLInputElement;
  name.name = "customerName";
  name.placeholder = "Full name";
  name.autocomplete = "name";
  name.required = true;
  name.value = bookingDraft.customerName;
  const email = element("input", "field") as HTMLInputElement;
  email.name = "customerEmail";
  email.type = "email";
  email.placeholder = "Email address (or phone)";
  email.autocomplete = "email";
  email.value = bookingDraft.customerEmail;
  const phone = element("input", "field") as HTMLInputElement;
  phone.name = "customerPhone";
  phone.type = "tel";
  phone.placeholder = "Phone number (or email)";
  phone.autocomplete = "tel";
  phone.value = bookingDraft.customerPhone;
  const notes = element("textarea", "field") as HTMLTextAreaElement;
  notes.name = "notes";
  notes.placeholder = "Notes (optional)";
  notes.rows = 2;
  notes.value = bookingDraft.notes;
  for (const input of [name, email, phone, notes]) {
    input.addEventListener("input", () => {
      bookingDraft = {
        customerName: name.value,
        customerEmail: email.value,
        customerPhone: phone.value,
        notes: notes.value,
      };
    });
  }
  const error = element("p", "error hidden", "Enter a name and either an email address or phone number.");
  const review = element("button", "primary-button", "Review booking") as HTMLButtonElement;
  review.type = "submit";
  form.append(name, email, phone, notes, error, review);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    bookingDraft = { customerName: name.value.trim(), customerEmail: email.value.trim(), customerPhone: phone.value.trim(), notes: notes.value.trim() };
    if (!bookingDraft.customerName || (!bookingDraft.customerEmail && !bookingDraft.customerPhone) || !form.reportValidity()) {
      error.classList.remove("hidden");
      return;
    }
    reviewingBooking = true;
    render();
  });
  section.append(form);
  root.append(section);
}

function renderBookingReview(data: SalonData, slot: Slot) {
  const section = element("section", "booking-panel");
  section.append(element("h2", "section-title", "Review your booking"));
  const summary = element("div", "review-summary");
  for (const [label, value] of [
    ["Service", data.serviceName ?? ""],
    ["Date", data.date ?? ""],
    ["Time", slot.startTime],
    ["Name", bookingDraft.customerName],
    ["Email", bookingDraft.customerEmail],
    ["Phone", bookingDraft.customerPhone],
    ["Notes", bookingDraft.notes],
  ]) {
    if (value) {
      const row = element("div", "review-row");
      addText(row, "review-label", label);
      addText(row, "review-value", value);
      summary.append(row);
    }
  }
  section.append(summary);
  section.append(element("p", "muted", "Tap Confirm booking to send this request to the salon."));
  const actions = element("div", "review-actions");
  const edit = element("button", "small-button", "Edit details") as HTMLButtonElement;
  edit.type = "button";
  edit.addEventListener("click", () => { reviewingBooking = false; render(); });
  const confirm = element("button", "primary-button", "Confirm booking") as HTMLButtonElement;
  confirm.type = "button";
  confirm.disabled = busy;
  confirm.addEventListener("click", () => void confirmBooking(data, slot));
  actions.append(edit, confirm);
  section.append(actions);
  root.append(section);
}

async function confirmBooking(data: SalonData, slot: Slot) {
  if (!data.salonId || !data.serviceId || !data.date || busy) return;
  busy = true;
  render();
  try {
    const result = await app.callServerTool({
      name: "create_customer_booking",
      arguments: {
        salonIdOrHandler: data.salonId,
        serviceId: data.serviceId,
        date: data.date,
        startTime: slot.startTime,
        staffId: slot.staffId,
        customerName: bookingDraft.customerName,
        customerEmail: bookingDraft.customerEmail || undefined,
        customerPhone: bookingDraft.customerPhone || undefined,
        notes: bookingDraft.notes || undefined,
        customerConfirmed: true,
      },
    });
    if (result.isError) {
      const message = result.content?.find((item) => item.type === "text")?.text ?? "Booking could not be created.";
      latest = { ...data, error: message };
    } else {
      let payload = result.structuredContent as { booking?: Record<string, unknown> } | undefined;
      if (!payload) {
        const text = result.content?.find((item) => item.type === "text")?.text;
        if (text) payload = JSON.parse(text) as { booking?: Record<string, unknown> };
      }
      confirmedBooking = payload?.booking ?? { message: "Booking request sent." };
      latest = data;
    }
  } catch {
    latest = { ...data, error: "Booking could not be created. Check availability and try again." };
  } finally {
    busy = false;
    render();
  }
}

function render() {
  root.replaceChildren();
  if (!latest) {
    root.append(element("div", "loading", busy ? "Loading salon…" : "Waiting for salon details…"));
    return;
  }
  const title = element("header", "header");
  addText(title, "eyebrow", "SALON EXPLORER");
  addText(title, "title", latest.salon?.name ?? latest.salonName ?? "Salon");
  root.append(title, makeNav());
  if (busy) root.append(element("div", "loading compact", "Updating…"));
  if (latest.error) root.append(element("p", "error", latest.error));
  if (confirmedBooking) {
    const card = element("section", "booking-panel confirmation");
    const status = textValue(confirmedBooking.status, "PENDING");
    card.append(element("h2", "section-title", status === "CONFIRMED" ? "Booking confirmed" : "Booking request sent"));
    addText(card, "detail", `${textValue(confirmedBooking.serviceName)} · ${textValue(confirmedBooking.date)} at ${textValue(confirmedBooking.startTime)}`);
    if (confirmedBooking.bookingId != null) addText(card, "muted", `Booking reference #${confirmedBooking.bookingId}`);
    if (typeof confirmedBooking.checkoutUrl === "string") {
      const checkout = element("a", "primary-link", "Continue to payment");
      checkout.href = confirmedBooking.checkoutUrl;
      checkout.target = "_blank";
      checkout.rel = "noopener noreferrer";
      card.append(checkout);
    }
    root.append(card);
    return;
  }
  if (latest.view === "overview") renderOverview(latest);
  if (latest.view === "services") renderServices(latest.items ?? []);
  if (latest.view === "team") renderTeam(latest.items ?? []);
  if (latest.view === "hours") renderHours(latest.items ?? []);
  if (latest.view === "location" && latest.location) renderLocation(latest.location);
  if (latest.view === "availability") renderAvailability(latest);
  if (profileStaff) renderStaffProfile();
}

function renderLocation(location: Record<string, string>) {
  const card = element("section", "overview-card");
  const address = [location.address, location.city, location.state, location.zipCode, location.country].filter(Boolean).join(", ");
  if (address) addText(card, "detail", address);
  if (location.mapsUrl) {
    const map = element("a", "link", "Open map");
    map.href = location.mapsUrl;
    map.target = "_blank";
    map.rel = "noopener noreferrer";
    card.append(map);
  }
  root.append(card);
}

app.connect().then(applyHostTheme).catch(() => {
  root.replaceChildren(element("p", "error", "Could not connect to the chat client."));
});
