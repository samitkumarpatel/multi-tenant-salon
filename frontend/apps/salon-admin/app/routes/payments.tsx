import { useState } from "react";
import { useLoaderData, useOutletContext } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { BadgeCheck, Check, Circle, Clock, CreditCard, ExternalLink, FlaskConical, LoaderCircle } from "lucide-react";
import { Toast, useToast } from "@salon/ui-shared";
import { ADMIN_API, apiFetch, resolveSalonUUID } from "~/lib/api";
import type { LayoutContext } from "~/lib/types";

type Account = { stripeAccountId: string; detailsSubmitted: boolean; chargesEnabled: boolean; payoutsEnabled: boolean };
type Settings = { salonId: string; shopEnabled: boolean; bookingEnabled: boolean; posEnabled: boolean; bookingPaymentType: "FULL" | "DEPOSIT"; bookingDepositPercent: number };
// Checkout Sessions don't pin payment_method_types, so Stripe offers whatever the salon enables here
// (salons have the full Stripe Dashboard on their own connected account).
const STRIPE_PAYMENT_METHODS_URL = "https://dashboard.stripe.com/settings/payment_methods";
type Requirement = { description: string; awaitingActionFrom: "user" | "stripe"; deadline: "currently_due" | "past_due" };
type Onboarding = { stage: "NOT_STARTED" | "ACTION_REQUIRED" | "IN_REVIEW" | "READY"; requirements: Requirement[] };
type Payload = { stripe: { account: Account | null; settings: Settings; configured: boolean; onboarding?: Onboarding; testMode?: boolean } };

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const sid = await resolveSalonUUID(params.salonId!);
  const payload = await apiFetch<Payload>(`${ADMIN_API}/${sid}/payments/stripe`);
  return { sid, payload };
}

export default function PaymentsPage() {
  const { sid, payload } = useLoaderData<typeof clientLoader>();
  const { salon } = useOutletContext<LayoutContext>();
  const { toast, notify } = useToast();
  const [settings, setSettings] = useState(payload.stripe.settings);
  const [busy, setBusy] = useState(false);
  const account = payload.stripe.account;
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
      : "Your Stripe account can accept payments. Payouts to your bank aren’t enabled yet — finish that in Stripe to receive your money.",
  }[onboarding.stage];
  const features = new Set((salon.features ?? []).map((item: any) => typeof item === "string" ? item : item.feature));

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

  function toggle(key: "shopEnabled" | "bookingEnabled" | "posEnabled") {
    setSettings((current) => ({ ...current, [key]: !current[key] }));
  }

  const areas = [
    { key: "shopEnabled" as const, feature: "WEBSHOP", title: "Online Shop", desc: "Take card payments for customer orders." },
    { key: "bookingEnabled" as const, feature: "BOOKING", title: "Online bookings", desc: "Collect a deposit or full payment when a customer books." },
    { key: "posEnabled" as const, feature: "DASHBOARD", title: "Till / POS", desc: "Offer Stripe Checkout for card payments at the salon. Cash can still be recorded manually." },
  ];
  const availableAreas = areas.filter((area) => features.has(area.feature));

  return <div className="mx-auto max-w-3xl space-y-5">
    <div><h1 className="text-xl font-bold text-slate-900">Payments</h1><p className="mt-1 text-sm text-slate-500">Connect one Stripe account for this salon and choose where to accept payments.</p></div>

    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><CreditCard className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-900">Stripe account</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{statusText}</p>
          {account && <p className="mt-2 text-[11px] text-slate-400">Account {account.stripeAccountId}</p>}
          {steps.length > 0 && <ul className="mt-3 space-y-1.5">
            {steps.map((step) => <li key={step.label} className={`flex items-center gap-2 text-xs ${step.done ? "text-slate-700" : "text-slate-400"}`}>
              {step.done ? <Check className="h-3.5 w-3.5 shrink-0 text-green-600" /> : <Circle className="h-3.5 w-3.5 shrink-0 text-slate-300" />}{step.label}
            </li>)}
          </ul>}
          {fromSalon.length > 0 && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
            <p className="text-xs font-semibold text-amber-900">Stripe still needs from you</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-amber-900">
              {fromSalon.map((item) => <li key={item.description}>{item.description}{item.deadline === "past_due" && <span className="ml-1.5 font-semibold">· overdue</span>}</li>)}
            </ul>
          </div>}
          {fromStripe.length > 0 && <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700"><Clock className="h-3.5 w-3.5" /> Stripe is checking</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-slate-600">
              {fromStripe.map((item) => <li key={item.description}>{item.description}</li>)}
            </ul>
          </div>}
          {payload.stripe.testMode && !connected && account && <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500"><FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Stripe is in sandbox mode: finish the setup with Stripe’s test details to activate test card payments. No real money moves.</p>}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {connected && <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700"><BadgeCheck className="h-4 w-4" /> Connected</span>}
            {(!connected || !account?.payoutsEnabled) && <button type="button" disabled={busy || !payload.stripe.configured} onClick={connectStripe} className="inline-flex items-center gap-2 rounded-lg bg-matcha-700 px-4 py-2 text-xs font-semibold text-white hover:bg-matcha-800 disabled:cursor-not-allowed disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}{account ? "Continue Stripe setup" : "Connect with Stripe"}</button>}
            {connected && <a href={STRIPE_PAYMENT_METHODS_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 no-underline hover:bg-slate-50">Manage payment methods <ExternalLink className="h-3.5 w-3.5" /></a>}
            {!payload.stripe.configured && <span className="text-xs text-amber-700">Stripe is not configured for this environment.</span>}
          </div>
          {connected && <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            Customers see the payment methods you turn on in your Stripe account — for example cards, Apple Pay, Google Pay, MobilePay or Klarna, where available for your country and currency. Sign in to Stripe with your own Stripe login to change them. The same methods apply to the shop, bookings and the till.
          </p>}
        </div>
      </div>
    </section>

    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-4"><h2 className="text-sm font-semibold text-slate-900">Payment areas</h2><p className="mt-1 text-xs text-slate-500">These settings share the salon’s connected Stripe account.</p>
        {account && !connected && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">You can choose your payment areas now. They stay off for customers until Stripe activates card payments on your account, then switch on automatically.</p>}
        {!account && <p className="mt-2 text-xs text-slate-400">Connect a Stripe account first to choose payment areas.</p>}</div>
      <div className="divide-y divide-slate-100">
        {availableAreas.length === 0 && <p className="px-5 py-4 text-sm text-slate-500">Enable Shop, Booking, or Dashboard for this salon to configure payment areas.</p>}
        {availableAreas.map((area) => {
          return <label key={area.key} className="flex cursor-pointer items-center gap-4 px-5 py-4">
            <input type="checkbox" checked={settings[area.key]} disabled={!account} onChange={() => toggle(area.key)} className="h-4 w-4 accent-emerald-700" />
            <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-slate-800">{area.title}</span><span className="mt-0.5 block text-xs text-slate-500">{area.desc}</span></span>
            {settings[area.key] && account && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${connected ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-800"}`}>{connected ? "Live" : "Waiting for Stripe"}</span>}
          </label>;
        })}
      </div>
      {features.has("BOOKING") && settings.bookingEnabled && <div className="border-t border-slate-100 px-5 py-4">
        <label className="mb-2 block text-xs font-semibold text-slate-700">Booking payment</label>
        <div className="flex flex-wrap items-center gap-3">
          <select value={settings.bookingPaymentType} onChange={(event) => setSettings((s) => ({ ...s, bookingPaymentType: event.target.value as Settings["bookingPaymentType"] }))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
            <option value="FULL">Full service price</option><option value="DEPOSIT">Deposit</option>
          </select>
          {settings.bookingPaymentType === "DEPOSIT" && <label className="flex items-center gap-2 text-xs text-slate-600"><input type="number" min="1" max="100" value={settings.bookingDepositPercent} onChange={(event) => setSettings((s) => ({ ...s, bookingDepositPercent: Number(event.target.value) }))} className="w-20 rounded-lg border border-slate-200 px-3 py-2" />% deposit</label>}
        </div>
      </div>}
      <div className="flex justify-end border-t border-slate-100 px-5 py-4"><button type="button" disabled={busy || !account} onClick={save} className="rounded-lg bg-matcha-700 px-4 py-2 text-xs font-semibold text-white hover:bg-matcha-800 disabled:opacity-50">Save payment settings</button></div>
    </section>
    <Toast toast={toast} />
  </div>;
}
