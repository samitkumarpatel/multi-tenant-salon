import { useI18n } from "@salon/i18n";
import React, { useEffect, useState } from "react";
import { ArrowLeft, BadgeCheck, Check, Loader2, Mail, Phone, QrCode, Star, X } from "lucide-react";
import { apiFetch, API_BASE } from "./api";
import { friendlyMessage } from "./apiError";
import { formatPrice } from "./constants";
import { SiteHeader, SiteFooter } from "./SiteChrome";
import { SalonPolicyLinks } from "./SalonPolicyLinks";
import type { SalonPolicy } from "./SalonPolicyLinks";
import { contrastText, fontStack, isLightColor, loadGoogleFont } from "./theme";
import PhoneInput from "./PhoneInput";
import { findCountry } from "./countryMatch";
import type { Country, MembershipBillingInterval, MembershipCatalog, MembershipPlan, MembershipRenewal, Salon, WebsiteTheme } from "./types";

export interface MembershipViewProps {
  salon: Salon;
  theme: WebsiteTheme;
  policies?: SalonPolicy[];
  /** Build the href for a page key (for the header's other nav links). */
  getPagePath?: (page: string) => string;
  /** Navigate to another page key, or null to return to the home page. */
  onNavigate?: (page: string | null) => void;
}

const PER: Record<MembershipBillingInterval, string> = { MONTHLY: "/ month", QUARTERLY: "/ 3 months", YEARLY: "/ year" };
const COVERS: Record<MembershipBillingInterval, string> = { MONTHLY: "one month", QUARTERLY: "3 months", YEARLY: "one year" };
const PERIOD: Record<MembershipBillingInterval, string> = { MONTHLY: "a month", QUARTERLY: "every 3 months", YEARLY: "a year" };
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Translate = (s: string, v?: Record<string, string | number>) => string;

/** What a member gets, as display lines: included services, discounts, then the salon's own perks. */
export function membershipBenefits(plan: MembershipPlan, translateUi: Translate) {
  return [
    ...plan.includedServices.map((s) => translateUi("{count}× {service} included {period}", {
      count: s.quantityPerCycle, service: s.name, period: translateUi(PERIOD[plan.billingInterval]),
    })),
    ...(plan.serviceDiscountPercent ? [translateUi("{percent}% off all services", { percent: plan.serviceDiscountPercent })] : []),
    ...(plan.productDiscountPercent ? [translateUi("{percent}% off products", { percent: plan.productDiscountPercent })] : []),
    ...plan.perks,
  ];
}

/**
 * The salon's membership plans, with online sign-up through Stripe Checkout when the salon has it
 * enabled. Each payment covers one period; `?renew=<token>` (the link in the reminder email) opens
 * the renewal screen for that membership instead.
 */
export function MembershipView({ salon, theme, policies = [], getPagePath, onNavigate }: MembershipViewProps) {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const fontStackCss = fontStack(theme.fontFamily);
  const heroLight = isLightColor(theme.heroBg);
  const accentText = contrastText(theme.accentColor);
  const text = theme.heroTextColor ?? (heroLight ? "#0F172A" : "#FFFFFF");
  const sub = heroLight ? "#475569" : "#94A3B8";
  const cardBg = heroLight ? "#FFFFFF" : "rgba(255,255,255,0.06)";
  const cardBorder = heroLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.12)";

  const [catalog, setCatalog] = useState<MembershipCatalog | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [joining, setJoining] = useState<MembershipPlan | null>(null);
  const [returned, setReturned] = useState<"success" | "cancel" | null>(null);
  const [renewToken, setRenewToken] = useState<string | null>(null);
  // null while loading. Fetched up front (like the shop) so the join form's phone field can open
  // on the salon's dialling code — PhoneInput picks its default once, when it mounts.
  const [countries, setCountries] = useState<Country[] | null>(null);

  useEffect(() => { loadGoogleFont(theme.fontFamily); }, [theme.fontFamily]);

  useEffect(() => {
    let alive = true;
    apiFetch<Country[]>(`${API_BASE}/api/salon-utility/countries`)
      .then((c) => alive && setCountries(c))
      .catch(() => alive && setCountries([]));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    apiFetch<MembershipCatalog>(`${API_BASE}/api/salon/${salon.id}/membership/plans`)
      .then((c) => alive && setCatalog(c))
      .catch((e) => alive && setLoadError(friendlyMessage(e)));
    return () => { alive = false; };
  }, [salon.id]);

  // Stripe sends the visitor back with ?payment=success|cancel; the membership itself is activated
  // by Stripe's webhook, so the success screen only promises the email, never a status it can't see.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get("payment");
    if (outcome === "success" || outcome === "cancel") setReturned(outcome);
    setRenewToken(params.get("renew"));
  }, []);

  function clearReturn() {
    setReturned(null);
    const url = new URL(window.location.href);
    ["payment", "reference", "session_id", "renew"].forEach((k) => url.searchParams.delete(k));
    setRenewToken(null);
    window.history.replaceState(window.history.state, "", url.toString());
  }

  const goHome = () => onNavigate?.(null);
  const contact = salon.contact;

  const shell = (body: React.ReactNode) => (
    <div className="min-h-[100dvh] flex flex-col" style={{ fontFamily: fontStackCss, backgroundColor: theme.heroBg }}>
      <SiteHeader salon={salon} theme={theme} current="membership" onBack={goHome} getPagePath={getPagePath}
        onNavigate={(page) => onNavigate?.(page)} />
      <main className="flex-1">{body}</main>
      <SiteFooter salon={salon} theme={theme} current="membership" onBack={goHome} getPagePath={getPagePath} policies={policies} />
    </div>
  );

  if (returned === "success") {
    return shell(
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <div className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center"
          style={{ backgroundColor: `${theme.accentColor}22`, border: `1px solid ${theme.accentColor}44` }}>
          <BadgeCheck className="w-8 h-8" style={{ color: theme.accentColor }} />
        </div>
        <h1 className="text-3xl font-black tracking-tight mb-3" style={{ color: text }}>
          {renewToken ? translateUi("Thanks for renewing!") : translateUi("Welcome aboard!")}
        </h1>
        <p className="text-sm mb-2" style={{ color: sub }}>
          {renewToken
            ? translateUi("Your payment is being confirmed — your membership continues without a gap.")
            : translateUi("Thank you for joining {salon}. Your payment is being confirmed.", { salon: salon.name })}
        </p>
        <p className="text-sm mb-8 flex items-center justify-center gap-2" style={{ color: sub }}>
          <QrCode className="w-4 h-4 shrink-0" />
          {translateUi("Your membership QR code is on its way to your email — show it at your next visit.")}
        </p>
        <button onClick={() => { clearReturn(); goHome(); }}
          className="inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity cursor-pointer"
          style={{ backgroundColor: theme.accentColor, color: accentText }}>
          <ArrowLeft className="w-4 h-4" /> {translateUi("Back to {salon}", { salon: salon.name })}
        </button>
      </div>,
    );
  }

  if (renewToken) {
    return shell(
      <RenewPanel salon={salon} token={renewToken} theme={theme} text={text} sub={sub} cardBg={cardBg} cardBorder={cardBorder}
        accentText={accentText} cancelled={returned === "cancel"} onDone={clearReturn} />,
    );
  }

  const plans = catalog?.plans ?? [];

  return shell(
    <>
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 pb-6 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: theme.accentColor }}>{translateUi("Membership")}</p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight" style={{ color: text }}>
          {translateUi("Your look, on subscription")}
        </h1>
        <p className="mt-3 text-sm sm:text-base max-w-xl mx-auto" style={{ color: sub }}>
          {translateUi("Join {salon} as a member for regular treatments, member prices and perks. Pay by card for each period — no automatic charges.", { salon: salon.name })}
        </p>
      </section>

      {returned === "cancel" && (
        <div className="max-w-xl mx-auto px-4 mb-4">
          <div className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, color: text }}>
            <span>{translateUi("Checkout cancelled — you haven't been charged.")}</span>
            <button onClick={clearReturn} aria-label={translateUi("Close")} className="cursor-pointer opacity-60 hover:opacity-100"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-12">
        {!catalog && !loadError && (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" style={{ color: sub }} /></div>
        )}
        {loadError && <p className="text-center text-sm py-16" style={{ color: sub }}>{loadError}</p>}
        {catalog && plans.length === 0 && (
          <p className="text-center text-sm py-16" style={{ color: sub }}>{translateUi("There are no membership plans available right now — check back soon.")}</p>
        )}
        {plans.length > 0 && (
          <div className={`grid gap-5 ${plans.length === 1 ? "max-w-sm mx-auto" : plans.length === 2 ? "sm:grid-cols-2 max-w-3xl mx-auto" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
            {plans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} theme={theme} text={text} sub={sub} cardBg={cardBg} cardBorder={cardBorder}
                accentText={accentText} onlineSignup={catalog!.onlineSignup} onJoin={() => setJoining(plan)} />
            ))}
          </div>
        )}
        {catalog && plans.length > 0 && !catalog.onlineSignup && (contact?.phone || contact?.email) && (
          <p className="mt-6 text-center text-sm" style={{ color: sub }}>
            {translateUi("To join, contact us:")}{" "}
            {contact?.phone && <a href={`tel:${contact.phone}`} className="font-semibold" style={{ color: text }}>{contact.phone}</a>}
            {contact?.phone && contact?.email && " · "}
            {contact?.email && <a href={`mailto:${contact.email}`} className="font-semibold" style={{ color: text }}>{contact.email}</a>}
          </p>
        )}
      </section>

      {plans.length > 0 && (
        <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
          <h2 className="text-lg font-bold mb-4 text-center" style={{ color: text }}>{translateUi("How membership works")}</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { q: "Join online", a: "Pick a plan and pay securely by card for your first period." },
              { q: "Show your QR code", a: "We email you a membership QR code. Show it at the desk to use your benefits." },
              { q: "Renew when you're ready", a: "Before your membership ends we email you a renewal link. Don't renew and it simply ends — nothing is charged automatically." },
            ].map((item) => (
              <div key={item.q} className="rounded-xl p-4" style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}` }}>
                <p className="text-sm font-semibold mb-1" style={{ color: text }}>{translateUi(item.q)}</p>
                <p className="text-xs leading-relaxed" style={{ color: sub }}>{translateUi(item.a)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {joining && (
        <JoinDialog salon={salon} plan={joining} theme={theme} accentText={accentText} policies={policies}
          countries={countries} onClose={() => setJoining(null)} />
      )}
    </>,
  );
}

function PlanCard({ plan, theme, text, sub, cardBg, cardBorder, accentText, onlineSignup, onJoin }: {
  plan: MembershipPlan; theme: WebsiteTheme; text: string; sub: string; cardBg: string; cardBorder: string;
  accentText: string; onlineSignup: boolean; onJoin: () => void;
}) {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const benefits = membershipBenefits(plan, translateUi);
  const worth = plan.includedValue && plan.includedValue > plan.price ? plan.includedValue : null;
  return (
    <article className="relative rounded-2xl p-6 flex flex-col"
      style={{ backgroundColor: cardBg, border: plan.highlighted ? `2px solid ${theme.accentColor}` : `1px solid ${cardBorder}`,
        boxShadow: plan.highlighted ? `0 12px 32px -12px ${theme.accentColor}55` : undefined }}>
      {plan.highlighted && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1 rounded-full whitespace-nowrap"
          style={{ backgroundColor: theme.accentColor, color: accentText }}>
          <Star className="w-3 h-3" /> {translateUi("Most popular")}
        </span>
      )}
      <h3 className="text-lg font-bold" style={{ color: text }}>{plan.name}</h3>
      <p className="mt-2 flex items-baseline gap-1.5" style={{ color: text }}>
        <span className="text-3xl font-black tabular-nums">{formatPrice(plan.price, plan.currency, uiLocale)}</span>
        <span className="text-sm" style={{ color: sub }}>{translateUi(PER[plan.billingInterval])}</span>
      </p>
      {plan.signupFee ? (
        <p className="text-xs mt-1" style={{ color: sub }}>
          {translateUi("+ {fee} one-time sign-up fee", { fee: formatPrice(plan.signupFee, plan.currency, uiLocale) })}
        </p>
      ) : null}
      {worth && (
        <p className="text-xs font-semibold mt-1" style={{ color: theme.accentColor }}>
          {translateUi("Includes {value} of treatments", { value: formatPrice(worth, plan.currency, uiLocale) })}
        </p>
      )}
      {plan.description && <p className="text-sm mt-3 leading-relaxed" style={{ color: sub }}>{plan.description}</p>}
      {benefits.length > 0 && (
        <ul className="mt-4 space-y-2 flex-1">
          {benefits.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-sm" style={{ color: text }}>
              <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: theme.accentColor }} /> <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
      {plan.spotsLeft != null && !plan.soldOut && plan.spotsLeft <= 5 && (
        <p className="mt-4 text-xs font-semibold" style={{ color: theme.accentColor }}>
          {translateUi("Only {count} spots left", { count: plan.spotsLeft })}
        </p>
      )}
      {onlineSignup && (
        <button onClick={onJoin} disabled={plan.soldOut}
          className="mt-5 w-full text-sm font-semibold px-5 py-3 rounded-xl transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          style={plan.highlighted || plan.soldOut
            ? { backgroundColor: theme.accentColor, color: accentText }
            : { backgroundColor: "transparent", color: text, border: `1.5px solid ${theme.accentColor}` }}>
          {plan.soldOut ? translateUi("Fully booked") : translateUi("Join {plan}", { plan: plan.name })}
        </button>
      )}
    </article>
  );
}

function JoinDialog({ salon, plan, theme, accentText, policies, countries, onClose }: {
  salon: Salon; plan: MembershipPlan; theme: WebsiteTheme; accentText: string; policies: SalonPolicy[];
  /** null while the country list is still loading. */
  countries: Country[] | null; onClose: () => void;
}) {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ringStyle = { ["--tw-ring-color" as string]: `${theme.accentColor}33` };
  const inputCls = "w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm outline-none transition bg-white text-slate-900 focus:ring-2 placeholder:text-slate-300";
  const firstCharge = plan.price + (plan.signupFee ?? 0);
  const valid = name.trim().length > 0 && EMAIL.test(email.trim());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<{ subscriptionId: number; checkoutUrl: string }>(`${API_BASE}/api/salon/${salon.id}/membership/checkout`, {
        method: "POST",
        body: JSON.stringify({
          planId: plan.id, customerName: name.trim(), customerEmail: email.trim(),
          customerPhone: phone.trim() || null, returnUrl: window.location.href,
        }),
      });
      window.location.assign(result.checkoutUrl);
    } catch (err) {
      setError(friendlyMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm sm:p-4"
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="join-title"
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl p-6 max-h-[92dvh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: theme.accentColor }}>{translateUi("Join")}</p>
            <h2 id="join-title" className="text-lg font-bold text-slate-900">{plan.name}</h2>
            <p className="text-sm text-slate-500">{formatPrice(plan.price, plan.currency, uiLocale)} {translateUi(PER[plan.billingInterval])}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label={translateUi("Close")} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="join-name" className="mb-1.5 block text-sm font-medium text-slate-700">{translateUi("Full name ")}<span className="text-red-500">*</span></label>
            <input id="join-name" autoFocus autoComplete="name" className={inputCls} style={ringStyle} placeholder={translateUi("Jane Smith")}
              value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="join-email" className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <Mail className="w-3.5 h-3.5" /> {translateUi("Email address")} <span className="text-red-500">*</span>
            </label>
            <input id="join-email" type="email" autoComplete="email" className={inputCls} style={ringStyle} placeholder="jane@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)} />
            <p className="mt-1 text-[11px] text-slate-400">{translateUi("We'll send your membership QR code here.")}</p>
          </div>
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <Phone className="w-3.5 h-3.5" /> {translateUi("Phone number")} <span className="font-normal text-slate-400">{translateUi("(optional)")}</span>
            </label>
            {countries === null ? (
              <div className="h-[46px] rounded-xl border border-stone-200 bg-stone-50 animate-pulse" aria-busy="true" />
            ) : (
              <PhoneInput value={phone} onChange={setPhone} countries={countries}
                defaultCountry={findCountry(countries, salon.location?.country)?.name} />
            )}
          </div>
        </div>

        <div className="mt-5 rounded-xl bg-slate-50 border border-slate-100 p-4 text-sm text-slate-600 space-y-1">
          <div className="flex justify-between"><span>{translateUi("Due today")}</span>
            <span className="font-semibold text-slate-900 tabular-nums">{formatPrice(firstCharge, plan.currency, uiLocale)}</span></div>
          {plan.signupFee ? (
            <p className="text-xs text-slate-400">{translateUi("Includes the {fee} sign-up fee.", { fee: formatPrice(plan.signupFee, plan.currency, uiLocale) })}</p>
          ) : null}
          <p className="text-xs text-slate-500">
            {translateUi("Covers {period}. Before it ends we'll email you a link to renew — nothing is charged automatically.", {
              period: translateUi(COVERS[plan.billingInterval]),
            })}
          </p>
        </div>

        {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}

        <button type="submit" disabled={!valid || busy}
          className="mt-5 w-full inline-flex items-center justify-center gap-2 text-sm font-semibold px-5 py-3 rounded-xl hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: theme.accentColor, color: accentText }}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          {busy ? translateUi("Opening secure checkout…") : translateUi("Continue to payment")}
        </button>
        <p className="mt-2 text-center text-[11px] text-slate-400">{translateUi("Payments are processed securely by Stripe.")}</p>
        {policies.length > 0 && (
          <div className="mt-3 flex justify-center text-[11px]"><SalonPolicyLinks policies={policies} salonName={salon.name} /></div>
        )}
      </form>
    </div>
  );
}

/** The page behind the renewal link: whose membership, until when, and a one-time checkout for the next period. */
function RenewPanel({ salon, token, theme, text, sub, cardBg, cardBorder, accentText, cancelled, onDone }: {
  salon: Salon; token: string; theme: WebsiteTheme; text: string; sub: string; cardBg: string; cardBorder: string;
  accentText: string; cancelled: boolean; onDone: () => void;
}) {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const [renewal, setRenewal] = useState<MembershipRenewal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    apiFetch<MembershipRenewal>(`${API_BASE}/api/salon/${salon.id}/membership/renewals/${encodeURIComponent(token)}`)
      .then((r) => alive && setRenewal(r))
      .catch((e) => alive && setError(friendlyMessage(e)));
    return () => { alive = false; };
  }, [salon.id, token]);

  async function renew() {
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<{ checkoutUrl: string }>(
        `${API_BASE}/api/salon/${salon.id}/membership/renewals/${encodeURIComponent(token)}/checkout`,
        { method: "POST", body: JSON.stringify({ returnUrl: window.location.href }) });
      window.location.assign(result.checkoutUrl);
    } catch (err) {
      setError(friendlyMessage(err));
      setBusy(false);
    }
  }

  const date = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString(uiLocale, { day: "numeric", month: "long", year: "numeric" }) : "";
  const ended = renewal && (renewal.status === "CANCELLED" || renewal.status === "INCOMPLETE" || renewal.status === "PENDING_PAYMENT");
  const standing = !renewal ? "" : renewal.status === "EXPIRED"
    ? translateUi("Your membership ended on {date}.", { date: date(renewal.currentPeriodEnd) })
    : renewal.status === "ACTIVE"
      ? translateUi("Your membership runs until {date}.", { date: date(renewal.currentPeriodEnd) })
      : translateUi("This membership has been cancelled. Contact the salon if you'd like to join again.");

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <div className="rounded-2xl p-6" style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}` }}>
        <p className="text-xs font-bold uppercase tracking-[0.2em] mb-2" style={{ color: theme.accentColor }}>{translateUi("Renew membership")}</p>
        {!renewal && !error && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" style={{ color: sub }} /></div>}
        {renewal && (
          <>
            <h1 className="text-2xl font-black tracking-tight" style={{ color: text }}>
              {translateUi("Hi {name},", { name: renewal.firstName })}
            </h1>
            <p className="mt-2 text-sm" style={{ color: sub }}>{standing}</p>
            {!ended && (
              <div className="mt-5 rounded-xl p-4" style={{ border: `1px solid ${cardBorder}` }}>
                <p className="text-sm font-semibold" style={{ color: text }}>{renewal.planName}</p>
                <p className="mt-1 flex items-baseline gap-1.5" style={{ color: text }}>
                  <span className="text-2xl font-black tabular-nums">{formatPrice(renewal.price, renewal.currency, uiLocale)}</span>
                  <span className="text-sm" style={{ color: sub }}>{translateUi(PER[renewal.billingInterval])}</span>
                </p>
                <p className="mt-1 text-xs" style={{ color: sub }}>
                  {renewal.status === "ACTIVE"
                    ? translateUi("The new period starts when the current one ends.")
                    : translateUi("The new period starts today.")}
                </p>
              </div>
            )}
            {cancelled && <p className="mt-4 text-sm" style={{ color: sub }}>{translateUi("Checkout cancelled — you haven't been charged.")}</p>}
            {!ended && renewal.cancelAtPeriodEnd && (
              <p className="mt-4 text-xs" style={{ color: sub }}>{translateUi("Your membership is set to end. Renewing keeps it going.")}</p>
            )}
            {!ended && !renewal.canRenewNow && (
              <p className="mt-4 text-sm" style={{ color: sub }}>{translateUi("You're paid up for now — renewal opens a month before your membership ends.")}</p>
            )}
            {!ended && renewal.canRenewNow && !renewal.onlinePayment && (
              <p className="mt-4 text-sm" style={{ color: sub }}>{translateUi("Online renewal isn't available right now — please contact the salon.")}</p>
            )}
            {!ended && renewal.canRenewNow && renewal.onlinePayment && (
              <button onClick={renew} disabled={busy}
                className="mt-5 w-full inline-flex items-center justify-center gap-2 text-sm font-semibold px-5 py-3 rounded-xl hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40"
                style={{ backgroundColor: theme.accentColor, color: accentText }}>
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {busy ? translateUi("Opening secure checkout…") : translateUi("Renew for {price}", { price: formatPrice(renewal.price, renewal.currency, uiLocale) })}
              </button>
            )}
          </>
        )}
        {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}
        <button onClick={onDone} className="mt-5 text-xs font-semibold underline cursor-pointer" style={{ color: sub }}>
          {translateUi("See all membership plans")}
        </button>
      </div>
    </div>
  );
}
