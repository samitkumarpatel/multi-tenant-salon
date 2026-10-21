import { button, emptyState, h } from "../shared/dom";
import { money, plural } from "../shared/format";
import { appHeader, SalonApp, statusLine, type Data } from "../shared/runtime";

type Interval = "MONTHLY" | "QUARTERLY" | "YEARLY";
type Included = { serviceId: number; name: string; durationMinutes?: number; price?: number; quantityPerCycle: number };
type Plan = {
  id: number; name: string; description?: string; price: number; currency?: string; billingInterval: Interval;
  signupFee?: number; serviceDiscountPercent?: number; productDiscountPercent?: number; spotsLeft?: number;
  soldOut: boolean; highlighted: boolean; includedValue?: number; perks: string[]; includedServices: Included[];
};
type MembershipData = Data & { plans?: Plan[]; onlineSignup?: boolean; planId?: number; contact?: { phone?: string; email?: string } };
type Screen = "plans" | "compare" | "plan" | "join" | "review" | "done";

const PER: Record<Interval, string> = { MONTHLY: "/ month", QUARTERLY: "/ 3 months", YEARLY: "/ year" };
const COVERS: Record<Interval, string> = { MONTHLY: "one month", QUARTERLY: "3 months", YEARLY: "one year" };
const PERIOD: Record<Interval, string> = { MONTHLY: "a month", QUARTERLY: "every 3 months", YEARLY: "a year" };

const draftKeys = ["customerName", "customerEmail", "customerPhone"] as const;
type Draft = Record<(typeof draftKeys)[number], string>;

const state = {
  screen: "plans" as Screen,
  plan: undefined as Plan | undefined,
  draft: Object.fromEntries(draftKeys.map((k) => [k, ""])) as Draft,
  checkoutUrl: undefined as string | undefined,
  error: undefined as string | undefined,
  seeded: false,
};

const rt: SalonApp<MembershipData> = new SalonApp<MembershipData>("Salon Membership", "salon_membership", (rt) => {
  const data = rt.data!;
  const plans = data.plans ?? [];
  if (!state.seeded) seed(data, plans);
  const screens: Record<Screen, () => Node | null> = {
    plans: () => planList(data, plans),
    compare: () => compare(plans),
    plan: () => state.plan ? planDetail(data, state.plan) : planList(data, plans),
    join: joinForm,
    review: review,
    done: done,
  };
  return [appHeader("MEMBERSHIP", data.salonName ?? "Salon", plural(plans.length, "plan")), ...statusLine(rt), screens[state.screen]()];
});

function seed(data: MembershipData, plans: Plan[]) {
  state.seeded = true;
  const focus = plans.find((p) => p.id === data.planId);
  if (focus) openPlan(focus, false);
  else rt.context(plans.length
    ? `The visitor is comparing membership plans: ${plans.map((p) => `${p.name} (${price(p)})`).join(", ")}.`
    : "The salon has no membership plans on sale right now.");
}

function go(screen: Screen) {
  state.screen = screen;
  state.error = undefined;
  rt.render();
  window.scrollTo({ top: 0 });
}

function openPlan(plan: Plan, render = true) {
  state.plan = plan;
  state.screen = "plan";
  rt.context(`The visitor is looking at the ${plan.name} membership (${price(plan)}). Nothing is bought until they pay in the checkout.`);
  if (render) go("plan");
}

function price(plan: Plan) {
  return `${money(plan.price, plan.currency)} ${PER[plan.billingInterval]}`;
}

function benefits(plan: Plan) {
  return [
    ...plan.includedServices.map((s) => `${s.quantityPerCycle}× ${s.name} included ${PERIOD[plan.billingInterval]}`),
    ...(plan.serviceDiscountPercent ? [`${plan.serviceDiscountPercent}% off all services`] : []),
    ...(plan.productDiscountPercent ? [`${plan.productDiscountPercent}% off products`] : []),
    ...plan.perks,
  ];
}

function benefitList(plan: Plan) {
  const lines = benefits(plan);
  return lines.length ? h("ul", { class: "benefits" }, lines.map((line) => h("li", null, line))) : null;
}

function worth(plan: Plan) {
  return plan.includedValue && plan.includedValue > plan.price
    ? h("span", { class: "worth" }, `Includes ${money(plan.includedValue, plan.currency)} of treatments`) : null;
}

function joinButton(data: MembershipData, plan: Plan, wide = false) {
  if (!data.onlineSignup) return null;
  return button(plan.soldOut ? "Fully booked" : `Join ${plan.name}`, () => { state.plan = plan; go("join"); },
    `btn${plan.highlighted || wide ? " primary" : ""}${wide ? " wide" : ""}`, { disabled: plan.soldOut });
}

function contactNote(data: MembershipData) {
  if (data.onlineSignup) return null;
  const phone = data.contact?.phone;
  const email = data.contact?.email;
  return h("section", { class: "notice" },
    "Online sign-up isn't available yet — contact the salon to join.",
    phone || email ? h("div", { class: "action-row" },
      phone ? button("📞 Call", () => rt.openLink(`tel:${phone.replace(/\s+/g, "")}`), "btn") : null,
      email ? button("✉️ Email", () => rt.openLink(`mailto:${email}`), "btn") : null) : null);
}

function planList(data: MembershipData, plans: Plan[]) {
  if (!plans.length) return emptyState("No membership plans right now", "The salon hasn't put any plans on sale yet — check back soon.");
  return h("div", { class: "stack" },
    h("div", { class: "plan-grid" }, plans.map((plan) => h("article", { class: `plan-card${plan.highlighted ? " highlighted" : ""}` },
      plan.highlighted ? h("span", { class: "plan-ribbon" }, "★ Most popular") : null,
      h("button", { type: "button", class: "plan-open", onClick: () => openPlan(plan) },
        h("span", { class: "row-title" }, plan.name),
        h("span", { class: "plan-price" }, h("strong", null, money(plan.price, plan.currency)), " ", h("span", { class: "row-meta" }, PER[plan.billingInterval]))),
      plan.signupFee ? h("span", { class: "row-meta" }, `+ ${money(plan.signupFee, plan.currency)} one-time sign-up fee`) : null,
      worth(plan),
      benefitList(plan),
      plan.spotsLeft != null && !plan.soldOut && plan.spotsLeft <= 5 ? h("span", { class: "tag" }, `Only ${plural(plan.spotsLeft, "spot")} left`) : null,
      h("div", { class: "plan-actions" },
        button("Details", () => openPlan(plan), "link-button"),
        joinButton(data, plan))))),
    plans.length > 1 ? button("Compare plans side by side", () => go("compare"), "btn wide") : null,
    contactNote(data),
    h("p", { class: "muted" }, "Each payment covers one period, by card. Before it ends you're emailed a link to renew — nothing is charged automatically. Your membership QR code arrives by email."));
}

function compare(plans: Plan[]) {
  const rows: [string, (p: Plan) => string][] = [
    ["Price", (p) => price(p)],
    ["Sign-up fee", (p) => (p.signupFee ? money(p.signupFee, p.currency) : "—")],
    ["Included services", (p) => p.includedServices.map((s) => `${s.quantityPerCycle}× ${s.name}`).join(", ") || "—"],
    ["Service discount", (p) => (p.serviceDiscountPercent ? `${p.serviceDiscountPercent}%` : "—")],
    ["Product discount", (p) => (p.productDiscountPercent ? `${p.productDiscountPercent}%` : "—")],
    ["Perks", (p) => p.perks.join(", ") || "—"],
  ];
  rt.context(`The visitor is comparing membership plans side by side: ${plans.map((p) => p.name).join(", ")}.`);
  return h("div", { class: "stack" },
    h("div", { class: "pane-head" }, button("← All plans", () => go("plans"), "link-button")),
    h("div", { class: "compare-wrap" }, h("table", { class: "compare" },
      h("thead", null, h("tr", null, h("th", null, ""), plans.map((p) => h("th", { scope: "col" },
        button(p.name, () => openPlan(p), "link-button"))))),
      h("tbody", null, rows.map(([label, cell]) => h("tr", null,
        h("th", { scope: "row" }, label), plans.map((p) => h("td", null, cell(p)))))))));
}

function planDetail(data: MembershipData, plan: Plan) {
  return h("div", { class: "stack" },
    h("div", { class: "pane-head" }, button("← All plans", () => go("plans"), "link-button")),
    h("section", { class: `panel detail-card${plan.highlighted ? " highlighted" : ""}` },
      plan.highlighted ? h("span", { class: "tag" }, "★ Most popular") : null,
      h("h2", { class: "detail-title" }, plan.name),
      h("p", { class: "plan-price lg" }, h("strong", null, money(plan.price, plan.currency)), " ", h("span", { class: "row-meta" }, PER[plan.billingInterval])),
      plan.signupFee ? h("span", { class: "row-meta" }, `+ ${money(plan.signupFee, plan.currency)} one-time sign-up fee`) : null,
      worth(plan),
      plan.description ? h("p", { class: "detail" }, plan.description) : null,
      benefitList(plan),
      plan.includedServices.length ? h("div", { class: "chip-row" }, plan.includedServices.map((s) =>
        button(`✂️ ${s.name}`, () => rt.ask(`Tell me about the ${s.name} service`), "chip"))) : null,
      joinButton(data, plan, true)),
    contactNote(data));
}

function joinForm() {
  const plan = state.plan!;
  const field = (key: (typeof draftKeys)[number], props: Record<string, unknown>) => h("input", {
    class: "field", name: key, value: state.draft[key], ...props,
    onInput: (event: Event) => { state.draft[key] = (event.target as HTMLInputElement).value; },
  });
  const error = h("p", { class: "error hidden" }, "Enter your name and email address.");
  const form = h("form", {
    class: "booking-form",
    onSubmit: (event: Event) => {
      event.preventDefault();
      for (const key of draftKeys) state.draft[key] = state.draft[key].trim();
      if (!state.draft.customerName || !state.draft.customerEmail || !form.reportValidity()) {
        error.classList.remove("hidden");
        return;
      }
      go("review");
    },
  },
  field("customerName", { placeholder: "Full name", autocomplete: "name", required: true }),
  field("customerEmail", { type: "email", placeholder: "Email — your QR code is sent here", autocomplete: "email", required: true }),
  field("customerPhone", { type: "tel", placeholder: "Phone (optional)", autocomplete: "tel" }),
  error,
  h("div", { class: "review-actions" },
    button("Back", () => go("plan"), "btn"),
    h("button", { type: "submit", class: "btn primary" }, "Review")));
  rt.context(`The visitor is entering their details to join the ${plan.name} membership (not paid yet).`);
  return h("section", { class: "panel" }, h("h2", { class: "section-title" }, `Join ${plan.name}`), form);
}

function review() {
  const plan = state.plan!;
  const d = state.draft;
  const today = plan.price + (plan.signupFee ?? 0);
  return h("div", { class: "stack" },
    h("h2", { class: "section-title" }, "Review and pay"),
    h("section", { class: "panel" },
      h("div", { class: "pane-head" }, h("h3", { class: "section-title" }, plan.name),
        button("Change", () => go("plans"), "link-button", { disabled: rt.busy })),
      benefitList(plan)),
    h("section", { class: "panel" },
      h("div", { class: "pane-head" }, h("h3", { class: "section-title" }, "Your details"),
        button("Change", () => go("join"), "link-button", { disabled: rt.busy })),
      h("dl", { class: "review-summary" },
        ([["Name", d.customerName], ["Email", d.customerEmail], ["Phone", d.customerPhone]] as [string, string][])
          .filter(([, v]) => v).map(([label, value]) => h("div", { class: "review-row" }, h("dt", null, label), h("dd", null, value))))),
    h("section", { class: "panel" },
      h("div", { class: "total-row" }, h("span", null, "Due today"), h("strong", null, money(today, plan.currency))),
      plan.signupFee ? h("p", { class: "muted" }, `Includes the ${money(plan.signupFee, plan.currency)} sign-up fee.`) : null,
      h("p", { class: "muted" }, `Covers ${COVERS[plan.billingInterval]}. Before it ends you'll get an email with a link to renew for ${money(plan.price, plan.currency)} — nothing is charged automatically.`)),
    state.error ? h("p", { class: "error", role: "alert" }, state.error) : null,
    button(rt.busy ? "Opening checkout…" : "Continue to payment", () => void startCheckout(), "btn primary wide", { disabled: rt.busy }),
    h("p", { class: "muted" }, "You'll pay securely by card on Stripe. Nothing is charged until you complete the payment there."));
}

async function startCheckout() {
  if (rt.busy || !state.plan) return;
  state.error = undefined;
  const d = state.draft;
  const outcome = await rt.act<{ checkout?: { checkoutUrl?: string } }>("create_membership_checkout", {
    planId: state.plan.id, customerName: d.customerName, customerEmail: d.customerEmail, customerPhone: d.customerPhone,
    customerConfirmed: true,
  });
  const url = outcome.ok ? outcome.data.checkout?.checkoutUrl : undefined;
  if (url) {
    state.checkoutUrl = url;
    rt.context(`The visitor started checkout for the ${state.plan.name} membership. It isn't active until they finish paying in Stripe; then the QR code is emailed to ${d.customerEmail}.`);
    rt.openLink(url);
    go("done");
  } else {
    state.error = outcome.ok ? "We couldn't start the checkout. Please try again." : outcome.error;
    rt.render();
  }
}

function done() {
  const plan = state.plan;
  return h("div", { class: "stack" },
    h("section", { class: "panel confirmation" },
      h("div", { class: "confirmation-badge pending", "aria-hidden": "true" }, "💳"),
      h("h2", { class: "section-title" }, "Finish paying to join"),
      h("p", { class: "muted" }, `The secure checkout for ${plan?.name ?? "your membership"} opened in a new tab. Once the payment goes through, your membership QR code is emailed to ${state.draft.customerEmail}.`),
      state.checkoutUrl ? button("Open checkout again", () => rt.openLink(state.checkoutUrl!), "btn primary wide") : null),
    button("Back to the plans", () => { state.checkoutUrl = undefined; go("plans"); }, "btn wide"));
}

rt.start();
