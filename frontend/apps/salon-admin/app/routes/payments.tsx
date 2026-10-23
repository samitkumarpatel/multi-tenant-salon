import { useI18n } from "@salon/i18n";
import { GuideLink } from "~/components/GuideLink";
import { useCallback, useEffect, useState } from "react";
import { useLoaderData, useOutletContext, useRevalidator, useSearchParams } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { BadgeCheck, Check, Circle, Clock, CreditCard, ExternalLink, FlaskConical, LoaderCircle, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Toast, useToast } from "@salon/ui-shared";
import { ADMIN_API, apiFetch, resolveSalonUUID } from "~/lib/api";
import type { LayoutContext } from "~/lib/types";
import { StripeConnectEmbed, type ConnectComponent } from "~/components/StripeConnectEmbed";

type Account = { stripeAccountId: string; detailsSubmitted: boolean; chargesEnabled: boolean; payoutsEnabled: boolean };
type Area = "SHOP" | "BOOKING" | "POS" | "MEMBERSHIP";
type CheckoutUi = "REDIRECT" | "EMBEDDED" | "ELEMENTS";
type AreaSetting = { area: Area; enabled: boolean; checkoutUi: CheckoutUi };
type Settings = { salonId: string; areas: AreaSetting[]; bookingPaymentType: "FULL" | "DEPOSIT"; bookingDepositPercent: number };
// Checkout Sessions don't pin payment methods, so Stripe offers whatever the salon enables here
// (salons have the full Stripe Dashboard on their own connected account).
const STRIPE_PAYMENT_METHODS_URL = "https://dashboard.stripe.com/settings/payment_methods";
type Requirement = { description: string; awaitingActionFrom: "user" | "stripe"; deadline: "currently_due" | "past_due" };
type Onboarding = { stage: "NOT_STARTED" | "ACTION_REQUIRED" | "IN_REVIEW" | "READY"; requirements: Requirement[] };
type Payload = {
  stripe: {
    account: Account | null; settings: Settings; configured: boolean; onboarding?: Onboarding; testMode?: boolean;
    inlineCheckoutAvailable?: boolean; publishableKey?: string | null;
  };
};
type Terminal = { id: number; stripeReaderId: string; label: string; deviceType: string | null; serialNumber: string | null; status: string | null };
type PaymentRow = {
  id: number; area: Area; reference: string; channel: "CHECKOUT" | "TERMINAL"; checkoutUi: CheckoutUi | null;
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELED" | "PARTIALLY_REFUNDED" | "REFUNDED";
  amount: number; currency: string; amountRefunded: number; description: string | null; customerEmail: string | null;
  failureMessage: string | null; createdAt: string;
};
type Tab = "setup" | "terminals" | "transactions" | "payouts" | "payments" | "account";

const AREAS: { area: Area; feature: string; title: string; desc: string }[] = [
  { area: "SHOP", feature: "WEBSHOP", title: "Online Shop", desc: "Take card payments for customer orders." },
  { area: "BOOKING", feature: "BOOKING", title: "Online bookings", desc: "Collect a deposit or full payment when a customer books." },
  { area: "POS", feature: "DASHBOARD", title: "Till / POS", desc: "Take card payments at the salon desk — on a card reader or a card form. Cash can still be recorded manually." },
  { area: "MEMBERSHIP", feature: "MEMBERSHIP", title: "Memberships", desc: "Let customers pay for a membership period online or at the desk. Members get a renewal link before each period ends." },
];
const AREA_LABEL: Record<Area, string> = { SHOP: "Shop", BOOKING: "Booking", POS: "Till", MEMBERSHIP: "Membership" };
const CHECKOUT_UI: { value: CheckoutUi; title: string; hint: string }[] = [
  { value: "REDIRECT", title: "Stripe checkout page", hint: "Customers go to a Stripe page in your colours, then come back." },
  { value: "EMBEDDED", title: "Stripe form on your page", hint: "Stripe’s checkout form opens on your own website." },
  { value: "ELEMENTS", title: "Your branded payment form", hint: "A payment form styled with your website’s colours and font." },
];

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const sid = await resolveSalonUUID(params.salonId!);
  const payload = await apiFetch<Payload>(`${ADMIN_API}/${sid}/payments/stripe`);
  return { sid, payload };
}

export default function PaymentsPage() {
  const { t: translateUi } = useI18n();
  const { sid, payload } = useLoaderData<typeof clientLoader>();
  const { salon } = useOutletContext<LayoutContext>();
  const { toast, notify } = useToast();
  const [params, setParams] = useSearchParams();
  const account = payload.stripe.account;
  const publishableKey = payload.stripe.publishableKey ?? null;
  const features = new Set((salon.features ?? []).map((item: any) => typeof item === "string" ? item : item.feature));

  const tabs: { key: Tab; label: string }[] = [
    { key: "setup", label: "Setup" },
    ...(features.has("DASHBOARD") && account ? [{ key: "terminals" as const, label: "Card readers" }] : []),
    ...(account ? [{ key: "transactions" as const, label: "Transactions" }] : []),
    ...(account && publishableKey ? [
      { key: "payouts" as const, label: "Payouts" },
      { key: "payments" as const, label: "Payments & disputes" },
      { key: "account" as const, label: "Account" },
    ] : []),
  ];
  const requested = params.get("tab") as Tab | null;
  const tab: Tab = tabs.some((t) => t.key === requested) ? requested! : "setup";
  const go = (next: Tab) => { const p = new URLSearchParams(params); p.set("tab", next); setParams(p, { replace: true }); };

  return <div className="mx-auto max-w-4xl space-y-5">
    <div><div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><h1 className="text-xl font-bold text-slate-900">{translateUi("Payments")}</h1><GuideLink path="payments/connecting-your-stripe-account" /></div><p className="mt-1 text-sm text-slate-500">{translateUi("Connect one Stripe account for this salon, choose where and how customers pay, and manage your money — all here.")}</p></div>
    {account && publishableKey && <StripeConnectEmbed sid={sid} publishableKey={publishableKey} component="notification-banner" />}
    {tabs.length > 1 && <nav className="flex flex-wrap gap-1 border-b border-slate-200" aria-label={translateUi("Payments")}>
      {tabs.map((item) => <button key={item.key} type="button" onClick={() => go(item.key)} aria-current={tab === item.key ? "page" : undefined}
        className={`-mb-px border-b-2 px-3 py-2 text-xs font-semibold ${tab === item.key ? "border-matcha-700 text-matcha-800" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{translateUi(item.label)}</button>)}
    </nav>}
    {tab === "setup" && <SetupTab sid={sid} payload={payload} features={features} notify={notify} />}
    {tab === "terminals" && <TerminalsTab sid={sid} testMode={Boolean(payload.stripe.testMode)} notify={notify} />}
    {tab === "transactions" && <TransactionsTab sid={sid} notify={notify} />}
    {(tab === "payouts" || tab === "payments" || tab === "account") && publishableKey && (
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <StripeConnectEmbed sid={sid} publishableKey={publishableKey}
          component={({ payouts: "payouts", payments: "payments", account: "account-management" } as Record<string, ConnectComponent>)[tab]} />
      </section>
    )}
    <Toast toast={toast} />
  </div>;
}

type Notify = (message: string, kind?: "success" | "error") => void;

function SetupTab({ sid, payload, features, notify }: { sid: string; payload: Payload; features: Set<string>; notify: Notify }) {
  const { t: translateUi } = useI18n();
  const revalidator = useRevalidator();
  const [settings, setSettings] = useState<Settings>(payload.stripe.settings);
  const [busy, setBusy] = useState(false);
  const [onboardingHere, setOnboardingHere] = useState(false);
  const account = payload.stripe.account;
  const publishableKey = payload.stripe.publishableKey ?? null;
  const inlineAvailable = Boolean(payload.stripe.inlineCheckoutAvailable);
  const connected = Boolean(account?.detailsSubmitted && account?.chargesEnabled);
  // Derived from the account flags if an older API doesn't send `onboarding` yet.
  const onboarding: Onboarding = payload.stripe.onboarding ?? {
    stage: !account ? "NOT_STARTED" : connected ? "READY" : account.detailsSubmitted ? "IN_REVIEW" : "ACTION_REQUIRED",
    requirements: [],
  };
  const fromSalon = onboarding.requirements.filter((item) => item.awaitingActionFrom !== "stripe");
  const fromStripe = onboarding.requirements.filter((item) => item.awaitingActionFrom === "stripe");
  const steps = account ? [
    { label: "Stripe account created", done: true },
    { label: "Business details submitted", done: account.detailsSubmitted },
    { label: "Card payments activated by Stripe", done: account.chargesEnabled },
    { label: "Payouts to your bank enabled", done: account.payoutsEnabled },
  ] : [];
  const statusText = {
    NOT_STARTED: "Connect your salon’s Stripe account to receive card payments.",
    ACTION_REQUIRED: "Your Stripe account is created, but Stripe still needs some details from you before it can accept payments.",
    IN_REVIEW: "You’ve submitted everything Stripe asked for. Stripe is reviewing your account — card payments switch on automatically once it’s approved.",
    READY: account?.payoutsEnabled
      ? "Your Stripe account can accept payments."
      : "Your Stripe account can accept payments. Payouts to your bank aren’t enabled yet — finish the setup to receive your money.",
  }[onboarding.stage];
  const needsSetup = !connected || !account?.payoutsEnabled;

  async function connectStripe() {
    setBusy(true);
    try {
      const result = await apiFetch<{ url: string }>(`${ADMIN_API}/${sid}/payments/stripe/onboarding-link`, { method: "POST" });
      window.location.assign(result.url);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not open Stripe onboarding", "error");
      setBusy(false);
    }
  }

  const finishOnboarding = useCallback(() => { setOnboardingHere(false); revalidator.revalidate(); }, [revalidator]);

  async function save() {
    setBusy(true);
    try {
      const saved = await apiFetch<Settings>(`${ADMIN_API}/${sid}/payments/settings`, { method: "PUT", body: JSON.stringify(settings) });
      setSettings(saved);
      notify("Payment settings saved.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not save payment settings", "error");
    } finally { setBusy(false); }
  }

  const areaSetting = (area: Area) => settings.areas.find((a) => a.area === area) ?? { area, enabled: false, checkoutUi: "REDIRECT" as CheckoutUi };
  const updateArea = (area: Area, change: Partial<AreaSetting>) => setSettings((current) => ({
    ...current,
    areas: [...current.areas.filter((a) => a.area !== area), { ...areaSetting(area), ...change }],
  }));
  const availableAreas = AREAS.filter((area) => features.has(area.feature));

  return <>
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><CreditCard className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-900">{translateUi("Stripe account")}</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{statusText}</p>
          {account && <p className="mt-2 text-[11px] text-slate-400">{translateUi("Account ")}{account.stripeAccountId}</p>}
          {steps.length > 0 && <ul className="mt-3 space-y-1.5">
            {steps.map((step) => <li key={step.label} className={`flex items-center gap-2 text-xs ${step.done ? "text-slate-700" : "text-slate-400"}`}>
              {step.done ? <Check className="h-3.5 w-3.5 shrink-0 text-green-600" /> : <Circle className="h-3.5 w-3.5 shrink-0 text-slate-300" />}{translateUi(step.label)}
            </li>)}
          </ul>}
          {fromSalon.length > 0 && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
            <p className="text-xs font-semibold text-amber-900">{translateUi("Stripe still needs from you")}</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-amber-900">
              {fromSalon.map((item) => <li key={item.description}>{item.description}{item.deadline === "past_due" && <span className="ml-1.5 font-semibold">{translateUi("· overdue")}</span>}</li>)}
            </ul>
          </div>}
          {fromStripe.length > 0 && <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700"><Clock className="h-3.5 w-3.5" /> {translateUi("Stripe is checking")}</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-slate-600">
              {fromStripe.map((item) => <li key={item.description}>{item.description}</li>)}
            </ul>
          </div>}
          {payload.stripe.testMode && !connected && <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500"><FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {translateUi("Stripe is in sandbox mode: finish the setup with Stripe’s test details to activate test card payments. No real money moves.")}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {connected && <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700"><BadgeCheck className="h-4 w-4" /> {translateUi("Connected")}</span>}
            {needsSetup && publishableKey && !onboardingHere && <button type="button" disabled={!payload.stripe.configured} onClick={() => setOnboardingHere(true)} className="inline-flex items-center gap-2 rounded-lg bg-matcha-700 px-4 py-2 text-xs font-semibold text-white hover:bg-matcha-800 disabled:cursor-not-allowed disabled:opacity-50">{account ? translateUi("Continue setup") : translateUi("Set up payments")}</button>}
            {needsSetup && <button type="button" disabled={busy || !payload.stripe.configured} onClick={connectStripe} className={publishableKey
              ? "inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-50"
              : "inline-flex items-center gap-2 rounded-lg bg-matcha-700 px-4 py-2 text-xs font-semibold text-white hover:bg-matcha-800 disabled:cursor-not-allowed disabled:opacity-50"}>
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}{publishableKey ? translateUi("or continue on Stripe’s site") : account ? translateUi("Continue Stripe setup") : translateUi("Connect with Stripe")}</button>}
            {connected && <a href={STRIPE_PAYMENT_METHODS_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 no-underline hover:bg-slate-50">{translateUi("Manage payment methods ")}<ExternalLink className="h-3.5 w-3.5" /></a>}
            {!payload.stripe.configured && <span className="text-xs text-amber-700">{translateUi("Stripe is not configured for this environment.")}</span>}
          </div>
          {connected && <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            {translateUi("Customers see the payment methods you turn on in your Stripe account — for example cards, Apple Pay, Google Pay, MobilePay or Klarna, where available for your country and currency. The same methods apply to the shop, bookings, memberships and the till. ")}</p>}
        </div>
      </div>
      {onboardingHere && publishableKey && <div className="mt-5 border-t border-slate-100 pt-5">
        <StripeConnectEmbed sid={sid} publishableKey={publishableKey} component="account-onboarding" onExit={finishOnboarding} />
      </div>}
    </section>

    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-4"><h2 className="text-sm font-semibold text-slate-900">{translateUi("Payment areas")}</h2><p className="mt-1 text-xs text-slate-500">{translateUi("Choose where customers pay by card, and how the payment looks to them.")}</p>
        {account && !connected && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">{translateUi("You can choose your payment areas now. They stay off for customers until Stripe activates card payments on your account, then switch on automatically.")}</p>}
        {!account && <p className="mt-2 text-xs text-slate-400">{translateUi("Connect a Stripe account first to choose payment areas.")}</p>}
        {account && !inlineAvailable && <p className="mt-2 text-xs text-slate-400">{translateUi("Only the Stripe checkout page is available in this environment.")}</p>}</div>
      <div className="divide-y divide-slate-100">
        {availableAreas.length === 0 && <p className="px-5 py-4 text-sm text-slate-500">{translateUi("Enable Shop, Booking, Membership or Dashboard for this salon to configure payment areas.")}</p>}
        {availableAreas.map((area) => {
          const current = areaSetting(area.area);
          return <div key={area.area} className="px-5 py-4">
            <label className="flex cursor-pointer items-center gap-4">
              <input type="checkbox" checked={current.enabled} disabled={!account} onChange={() => updateArea(area.area, { enabled: !current.enabled })} className="h-4 w-4 accent-emerald-700" />
              <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-slate-800">{translateUi(area.title)}</span><span className="mt-0.5 block text-xs text-slate-500">{translateUi(area.desc)}</span></span>
              {current.enabled && account && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${connected ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-800"}`}>{connected ? translateUi("Live") : translateUi("Waiting for Stripe")}</span>}
            </label>
            {current.enabled && <div className="mt-3 grid gap-2 pl-8 sm:grid-cols-3" role="radiogroup" aria-label={translateUi("How customers pay")}>
              {CHECKOUT_UI.map((option) => {
                const disabled = option.value !== "REDIRECT" && !inlineAvailable;
                const selected = current.checkoutUi === option.value;
                return <button key={option.value} type="button" role="radio" aria-checked={selected} disabled={disabled}
                  onClick={() => updateArea(area.area, { checkoutUi: option.value })}
                  className={`rounded-lg border p-2.5 text-left disabled:cursor-not-allowed disabled:opacity-40 ${selected ? "border-matcha-500 bg-matcha-50 ring-2 ring-matcha-500/20" : "border-slate-200 hover:border-matcha-300"}`}>
                  <span className="block text-xs font-semibold text-slate-800">{translateUi(option.title)}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">{translateUi(option.hint)}</span>
                </button>;
              })}
            </div>}
          </div>;
        })}
      </div>
      {features.has("BOOKING") && areaSetting("BOOKING").enabled && <div className="border-t border-slate-100 px-5 py-4">
        <label className="mb-2 block text-xs font-semibold text-slate-700">{translateUi("Booking payment")}</label>
        <div className="flex flex-wrap items-center gap-3">
          <select value={settings.bookingPaymentType} onChange={(event) => setSettings((s) => ({ ...s, bookingPaymentType: event.target.value as Settings["bookingPaymentType"] }))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
            <option value="FULL">{translateUi("Full service price")}</option><option value="DEPOSIT">{translateUi("Deposit")}</option>
          </select>
          {settings.bookingPaymentType === "DEPOSIT" && <label className="flex items-center gap-2 text-xs text-slate-600"><input type="number" min="1" max="100" value={settings.bookingDepositPercent} onChange={(event) => setSettings((s) => ({ ...s, bookingDepositPercent: Number(event.target.value) }))} className="w-20 rounded-lg border border-slate-200 px-3 py-2" />{translateUi("% deposit")}</label>}
        </div>
      </div>}
      <div className="flex justify-end border-t border-slate-100 px-5 py-4"><button type="button" disabled={busy || !account} onClick={save} className="rounded-lg bg-matcha-700 px-4 py-2 text-xs font-semibold text-white hover:bg-matcha-800 disabled:opacity-50">{translateUi("Save payment settings")}</button></div>
    </section>
  </>;
}

function TerminalsTab({ sid, testMode, notify }: { sid: string; testMode: boolean; notify: Notify }) {
  const { t: translateUi } = useI18n();
  const [terminals, setTerminals] = useState<Terminal[] | null>(null);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ id: number; label: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<number | null>(null);
  const base = `${ADMIN_API}/${sid}/payments/terminals`;

  const load = useCallback((refresh: boolean) => {
    apiFetch<Terminal[]>(`${base}${refresh ? "?refresh=true" : ""}`).then(setTerminals)
      .catch((error: unknown) => { setTerminals([]); notify(error instanceof Error ? error.message : "Could not load card readers", "error"); });
  }, [base, notify]);
  useEffect(() => { load(true); }, [load]);

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    try { await action(); notify(translateUi(done)); load(false); }
    catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", "error"); }
    finally { setBusy(false); }
  }

  return <section className="rounded-xl border border-slate-200 bg-white">
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div><h2 className="text-sm font-semibold text-slate-900">{translateUi("Card readers")}</h2>
        <p className="mt-1 text-xs text-slate-500">{translateUi("Stripe Terminal readers used at the salon desk for the till and membership sales. Staff pick a reader when they take a card payment.")}</p></div>
      <button type="button" onClick={() => load(true)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"><RotateCcw className="h-3.5 w-3.5" />{translateUi("Refresh")}</button>
    </div>
    <div className="divide-y divide-slate-100">
      {terminals === null && <p className="px-5 py-4 text-sm text-slate-400">{translateUi("Loading…")}</p>}
      {terminals?.length === 0 && <p className="px-5 py-4 text-sm text-slate-500">{translateUi("No card readers yet.")}</p>}
      {terminals?.map((reader) => <div key={reader.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
        <span className={`h-2 w-2 shrink-0 rounded-full ${reader.status === "online" ? "bg-green-500" : reader.status === "offline" ? "bg-slate-300" : "bg-amber-400"}`} title={reader.status ?? ""} />
        {editing?.id === reader.id
          ? <input autoFocus value={editing.label} onChange={(e) => setEditing({ id: reader.id, label: e.target.value })} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
          : <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-slate-800">{reader.label}</span>
              <span className="block text-[11px] text-slate-400">{[reader.deviceType, reader.serialNumber, reader.status].filter(Boolean).join(" · ")}</span></span>}
        {editing?.id === reader.id
          ? <><button type="button" disabled={busy} onClick={() => run(() => apiFetch(`${base}/${reader.id}`, { method: "PUT", body: JSON.stringify({ label: editing.label }) }).then(() => setEditing(null)), "Card reader renamed.")} className="rounded-lg bg-matcha-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{translateUi("Save")}</button>
              <button type="button" onClick={() => setEditing(null)} className="text-xs text-slate-500">{translateUi("Cancel")}</button></>
          : <><button type="button" onClick={() => setEditing({ id: reader.id, label: reader.label })} className="rounded p-1.5 text-slate-400 hover:bg-slate-100" aria-label={translateUi("Rename")}><Pencil className="h-3.5 w-3.5" /></button>
              {confirmRemove === reader.id
                ? <button type="button" disabled={busy} onClick={() => run(() => apiFetch(`${base}/${reader.id}`, { method: "DELETE" }), "Card reader removed.")} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{translateUi("Remove reader")}</button>
                : <button type="button" onClick={() => setConfirmRemove(reader.id)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={translateUi("Remove")}><Trash2 className="h-3.5 w-3.5" /></button>}</>}
      </div>)}
    </div>
    <form className="flex flex-wrap items-end gap-2 border-t border-slate-100 px-5 py-4" onSubmit={(e) => {
      e.preventDefault();
      void run(() => apiFetch(base, { method: "POST", body: JSON.stringify({ registrationCode: code.trim(), label: label.trim() || null }) })
        .then(() => { setCode(""); setLabel(""); }), "Card reader added.");
    }}>
      <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs font-semibold text-slate-700">{translateUi("Registration code")}
        <input value={code} onChange={(e) => setCode(e.target.value)} required placeholder={testMode ? "simulated-wpe" : "sepia-cerulean-aqua"} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal" /></label>
      <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs font-semibold text-slate-700">{translateUi("Name")}
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={translateUi("Front desk")} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal" /></label>
      <button type="submit" disabled={busy || !code.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-matcha-700 px-4 py-2 text-xs font-semibold text-white hover:bg-matcha-800 disabled:opacity-50"><Plus className="h-3.5 w-3.5" />{translateUi("Add reader")}</button>
      <p className="w-full text-[11px] leading-relaxed text-slate-500">{testMode
        ? translateUi("Test mode: use the code simulated-wpe to add a simulated reader, then tap a test card from the desk.")
        : translateUi("On the reader, open its settings and choose “Generate pairing code”, then enter that code here. The salon address is used as the reader location.")}</p>
    </form>
  </section>;
}

function TransactionsTab({ sid, notify }: { sid: string; notify: Notify }) {
  const { t: translateUi, locale } = useI18n();
  const [area, setArea] = useState<Area | "">("");
  const [rows, setRows] = useState<PaymentRow[] | null>(null);
  const [refunding, setRefunding] = useState<{ id: number; amount: string; reason: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiFetch<PaymentRow[]>(`${ADMIN_API}/${sid}/payments/transactions${area ? `?area=${area}` : ""}`).then(setRows)
      .catch((error: unknown) => { setRows([]); notify(error instanceof Error ? error.message : "Could not load transactions", "error"); });
  }, [sid, area, notify]);
  useEffect(() => { load(); }, [load]);

  const money = (value: number, currency: string) => new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
  const statusStyle: Record<PaymentRow["status"], string> = {
    PENDING: "bg-slate-100 text-slate-600", SUCCEEDED: "bg-green-50 text-green-700", FAILED: "bg-red-50 text-red-600",
    CANCELED: "bg-slate-100 text-slate-500", PARTIALLY_REFUNDED: "bg-amber-50 text-amber-800", REFUNDED: "bg-indigo-50 text-indigo-700",
  };
  const statusLabel: Record<PaymentRow["status"], string> = {
    PENDING: "Pending", SUCCEEDED: "Paid", FAILED: "Failed", CANCELED: "Canceled", PARTIALLY_REFUNDED: "Partly refunded", REFUNDED: "Refunded",
  };

  async function refund(row: PaymentRow) {
    if (!refunding) return;
    setBusy(true);
    try {
      await apiFetch(`${ADMIN_API}/${sid}/payments/transactions/${row.id}/refunds`, {
        method: "POST", body: JSON.stringify({ amount: Number(refunding.amount), reason: refunding.reason.trim() || null }),
      });
      notify(translateUi("Refund sent to the customer’s card."));
      setRefunding(null);
      load();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not refund", "error");
    } finally { setBusy(false); }
  }

  return <section className="rounded-xl border border-slate-200 bg-white">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div><h2 className="text-sm font-semibold text-slate-900">{translateUi("Transactions")}</h2>
        <p className="mt-1 text-xs text-slate-500">{translateUi("Every card payment across the shop, bookings, memberships and the till. Refunds go back to the customer’s card.")}</p></div>
      <select value={area} onChange={(e) => setArea(e.target.value as Area | "")} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700" aria-label={translateUi("Area")}>
        <option value="">{translateUi("All areas")}</option>
        {(Object.keys(AREA_LABEL) as Area[]).map((key) => <option key={key} value={key}>{translateUi(AREA_LABEL[key])}</option>)}
      </select>
    </div>
    <div className="divide-y divide-slate-100">
      {rows === null && <p className="px-5 py-4 text-sm text-slate-400">{translateUi("Loading…")}</p>}
      {rows?.length === 0 && <p className="px-5 py-4 text-sm text-slate-500">{translateUi("No card payments yet.")}</p>}
      {rows?.map((row) => {
        const remaining = row.amount - row.amountRefunded;
        const refundable = (row.status === "SUCCEEDED" || row.status === "PARTIALLY_REFUNDED") && remaining > 0;
        return <div key={row.id} className="px-5 py-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="w-32 shrink-0 text-slate-400">{new Date(row.createdAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}</span>
            <span className="min-w-0 flex-1 truncate text-slate-700"><span className="font-semibold">{translateUi(AREA_LABEL[row.area])}</span> · {row.description ?? `#${row.reference}`}
              <span className="ml-1 text-slate-400">· {row.channel === "TERMINAL" ? translateUi("Card reader") : translateUi("Online")}{row.customerEmail ? ` · ${row.customerEmail}` : ""}</span></span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusStyle[row.status]}`}>{translateUi(statusLabel[row.status])}</span>
            <span className="w-24 text-right font-semibold text-slate-800">{money(row.amount, row.currency)}</span>
            {refundable && refunding?.id !== row.id && <button type="button" onClick={() => setRefunding({ id: row.id, amount: remaining.toFixed(2), reason: "" })} className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">{translateUi("Refund")}</button>}
          </div>
          {row.amountRefunded > 0 && <p className="mt-1 pl-0 text-[11px] text-slate-500 sm:pl-[8.75rem]">{translateUi("Refunded {amount}", { amount: money(row.amountRefunded, row.currency) })}</p>}
          {row.failureMessage && row.status !== "SUCCEEDED" && <p className="mt-1 text-[11px] text-slate-400 sm:pl-[8.75rem]">{row.failureMessage}</p>}
          {refunding?.id === row.id && <form className="mt-2 flex flex-wrap items-end gap-2 sm:pl-[8.75rem]" onSubmit={(e) => { e.preventDefault(); void refund(row); }}>
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600">{translateUi("Amount ({currency})", { currency: row.currency })}
              <input type="number" step="0.01" min="0.01" max={remaining} required value={refunding.amount} onChange={(e) => setRefunding({ ...refunding, amount: e.target.value })} className="w-28 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-normal" /></label>
            <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-[11px] font-semibold text-slate-600">{translateUi("Reason (optional)")}
              <input value={refunding.reason} onChange={(e) => setRefunding({ ...refunding, reason: e.target.value })} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-normal" /></label>
            <button type="submit" disabled={busy} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{busy ? translateUi("Refunding…") : translateUi("Refund to card")}</button>
            <button type="button" onClick={() => setRefunding(null)} className="text-xs text-slate-500">{translateUi("Cancel")}</button>
          </form>}
        </div>;
      })}
    </div>
  </section>;
}
