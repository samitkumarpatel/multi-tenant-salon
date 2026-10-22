import { useI18n } from "@salon/i18n";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { BadgeCheck, Camera, CheckCircle2, CreditCard, Loader2, ScanLine, Send, XCircle } from "lucide-react";
import { isNotFoundError } from "@salon/ui-shared";
import type { CheckoutInstructions, CheckoutResult, MembershipDetail, MembershipPlan, MembershipStatus, MembershipSubscription } from "@salon/ui-website";
import { StripeCheckoutPanel, beginCheckout } from "@salon/ui-website";
import { TerminalPaymentDialog, type Terminal, type TerminalPayment } from "~/components/TerminalPaymentDialog";
import { ADMIN_API, apiFetch } from "~/lib/api";
import { AUTH_MODE, getAccessToken } from "~/lib/auth";
import { formatPrice } from "~/lib/format";

export type MembershipDeskView = "check-in" | "sell";
type PaymentMethod = "CASH" | "CARD" | "OTHER";
type Translate = (s: string, v?: Record<string, string | number>) => string;
type Notify = (message: string, kind?: "success" | "error") => void;

const inputCls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10";

const STATUS_LABEL: Record<MembershipStatus, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  ACTIVE: "Active",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
  INCOMPLETE: "Checkout abandoned",
};
const STATUS_STYLE: Record<MembershipStatus, string> = {
  PENDING_PAYMENT: "bg-slate-100 text-slate-600 border-slate-200",
  ACTIVE: "bg-green-50 text-green-700 border-green-200",
  EXPIRED: "bg-amber-50 text-amber-700 border-amber-200",
  CANCELLED: "bg-red-50 text-red-600 border-red-200",
  INCOMPLETE: "bg-slate-50 text-slate-400 border-slate-200",
};
const INTERVAL_SUFFIX: Record<MembershipPlan["billingInterval"], string> = {
  MONTHLY: "/ month",
  QUARTERLY: "/ 3 months",
  YEARLY: "/ year",
};

/** The card checkout leaves the desk for Stripe; this remembers which membership it was for. */
const PENDING_CARD_KEY = "desk-membership-card-sale";

function fmtDate(ts: string | null | undefined, locale: string) {
  return ts ? new Date(ts).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" }) : "—";
}

function renewalLine(m: MembershipSubscription, translateUi: Translate, locale: string) {
  if (m.status === "CANCELLED") return m.endedAt ? translateUi("Ended {date}", { date: fmtDate(m.endedAt, locale) }) : translateUi("Ended");
  if (m.status === "EXPIRED") return translateUi("Expired {date}", { date: fmtDate(m.endedAt ?? m.currentPeriodEnd, locale) });
  if (m.status === "PENDING_PAYMENT" || m.status === "INCOMPLETE") return "—";
  if (m.cancelAtPeriodEnd) return translateUi("Ends {date}", { date: fmtDate(m.currentPeriodEnd, locale) });
  return translateUi("Paid through {date}", { date: fmtDate(m.currentPeriodEnd, locale) });
}

function StatusBadge({ status }: { status: MembershipStatus }) {
  const { t: translateUi } = useI18n();
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold ${STATUS_STYLE[status]}`}>{translateUi(STATUS_LABEL[status])}</span>;
}

/** The member's QR as an object URL — the endpoint needs the desk's bearer token, so an <img src> can't load it. */
async function memberQrUrl(sid: string, subscriptionId: number): Promise<string> {
  const token = AUTH_MODE === "oauth2" ? getAccessToken() : null;
  const res = await fetch(`${ADMIN_API}/${sid}/membership/subscriptions/${subscriptionId}/qr.png`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Could not load the QR code");
  return URL.createObjectURL(await res.blob());
}

/** Check-in (scan or type a member code) and selling a membership at the till. */
export function MembershipDesk({ sid, view, cardEnabled, notify, terminals = [], testMode = false }: {
  sid: string; view: MembershipDeskView; cardEnabled: boolean; notify: Notify;
  /** The salon's card readers; card sales go to one of them by default. */
  terminals?: Terminal[]; testMode?: boolean;
}) {
  const { t: translateUi } = useI18n();
  const [plans, setPlans] = useState<MembershipPlan[] | null>(null);
  const [plansError, setPlansError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<MembershipPlan[]>(`${ADMIN_API}/${sid}/membership/plans`)
      .then((all) => setPlans(all.filter((plan) => plan.status === "ACTIVE")))
      .catch((error: unknown) => { setPlans([]); setPlansError(error instanceof Error ? error.message : String(error)); });
  }, [sid]);

  return view === "sell"
    ? <SellMembership sid={sid} plans={plans} plansError={plansError} cardEnabled={cardEnabled} notify={notify}
        terminals={terminals} testMode={testMode} />
    : <CheckIn sid={sid} plans={plans ?? []} notify={notify} translateUi={translateUi} />;
}

/** Chromium's built-in QR decoder; absent on browsers without it, where staff type or use a USB scanner. */
type BarcodeDetectorLike = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
const BarcodeDetectorCtor = typeof window !== "undefined"
  ? (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => BarcodeDetectorLike }).BarcodeDetector
  : undefined;

type LookupResult = { kind: "found"; detail: MembershipDetail } | { kind: "missing"; code: string } | { kind: "error"; message: string };

function CheckIn({ sid, plans, notify, translateUi }: { sid: string; plans: MembershipPlan[]; notify: Notify; translateUi: Translate }) {
  const { locale: uiLocale } = useI18n();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  async function lookUp(raw: string) {
    const value = raw.trim();
    if (!value) return;
    setBusy(true);
    try {
      const detail = await apiFetch<MembershipDetail>(`${ADMIN_API}/${sid}/membership/verify?code=${encodeURIComponent(value)}`);
      setResult({ kind: "found", detail });
    } catch (e) {
      setResult(isNotFoundError(e) ? { kind: "missing", code: value } : { kind: "error", message: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
      setCode("");
      inputRef.current?.focus();
    }
  }

  async function sendRenewalLink(subscriptionId: number) {
    setSendingLink(true);
    try {
      const detail = await apiFetch<MembershipDetail>(`${ADMIN_API}/${sid}/membership/subscriptions/${subscriptionId}/send-renewal-link`, { method: "POST" });
      setResult({ kind: "found", detail });
      notify(translateUi("Renewal link sent to {email}.", { email: detail.subscription.customerEmail }));
    } catch (e) {
      notify(e instanceof Error ? e.message : translateUi("Could not send the renewal link"), "error");
    } finally {
      setSendingLink(false);
    }
  }

  useEffect(() => {
    if (!scanning || !BarcodeDetectorCtor) return;
    const detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });
    let stream: MediaStream | null = null;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        const tick = async () => {
          if (stopped) return;
          const codes = await detector.detect(video).catch(() => []);
          if (codes[0]?.rawValue) {
            setScanning(false);
            void lookUp(codes[0].rawValue);
            return;
          }
          timer = setTimeout(tick, 250);
        };
        void tick();
      } catch {
        setScanning(false);
        setResult({ kind: "error", message: translateUi("Couldn't open the camera. Allow camera access, or type the member code.") });
      }
    })();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // lookUp is stable enough for a scan session; restarting the camera on each render would flicker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  const m = result?.kind === "found" ? result.detail.subscription : null;
  const valid = m?.status === "ACTIVE";
  const lapsed = m?.status === "EXPIRED";
  const plan = m ? plans.find((p) => p.id === m.planId) : undefined;
  const benefits = plan ? [
    plan.serviceDiscountPercent ? translateUi("{percent}% off services", { percent: plan.serviceDiscountPercent }) : null,
    plan.productDiscountPercent ? translateUi("{percent}% off products", { percent: plan.productDiscountPercent }) : null,
    ...plan.includedServices.map((s) => translateUi("{count}× {service} included", { count: s.quantityPerCycle, service: s.name })),
    ...plan.perks,
  ].filter((b): b is string => Boolean(b)) : [];

  return (
    <div className="max-w-xl space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <label htmlFor="desk-member-code" className="mb-1 block text-sm font-semibold text-slate-800">{translateUi("Check in a member")}</label>
        <p className="mb-3 text-xs text-slate-500">{translateUi("Scan the QR code from the member's email, or type their member code.")}</p>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void lookUp(code); }}>
          <div className="relative flex-1">
            <ScanLine className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input id="desk-member-code" ref={inputRef} autoFocus autoComplete="off" spellCheck={false}
              className={`${inputCls} pl-9 font-mono uppercase tracking-wider`}
              placeholder="M7K2Q9XZT" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <button type="submit" disabled={busy || !code.trim()}
            className="cursor-pointer rounded-lg bg-matcha-600 px-4 py-2 text-sm font-semibold text-white hover:bg-matcha-700 disabled:opacity-45">
            {translateUi("Check")}
          </button>
          {BarcodeDetectorCtor && (
            <button type="button" onClick={() => setScanning((s) => !s)} aria-pressed={scanning}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <Camera className="h-4 w-4" /> {scanning ? translateUi("Stop") : translateUi("Scan")}
            </button>
          )}
        </form>
        {scanning && <video ref={videoRef} muted playsInline className="mt-3 aspect-video w-full rounded-lg bg-slate-900 object-cover" />}
      </div>

      {result?.kind === "found" && m && (
        <div className={`rounded-xl border-2 p-5 ${valid ? "border-green-300 bg-green-50" : lapsed ? "border-amber-300 bg-amber-50" : "border-red-300 bg-red-50"}`}>
          <div className="flex items-start gap-3">
            {valid ? <CheckCircle2 className="h-7 w-7 shrink-0 text-green-600" />
              : <XCircle className={`h-7 w-7 shrink-0 ${lapsed ? "text-amber-600" : "text-red-600"}`} />}
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-slate-900">
                {valid ? translateUi("Valid member") : lapsed ? translateUi("Membership expired — not renewed yet") : translateUi("Not an active member")}
              </p>
              <p className="mt-1 text-sm text-slate-800">{m.customerName} · {m.planName}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <StatusBadge status={m.status} />
                <span>{renewalLine(m, translateUi, uiLocale)}</span>
                {m.startedAt && <span>· {translateUi("Member since {date}", { date: fmtDate(m.startedAt, uiLocale) })}</span>}
              </div>
              {valid && benefits.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-green-200 pt-3 text-xs text-slate-700">
                  {benefits.map((benefit) => <li key={benefit} className="flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 shrink-0 text-green-600" />{benefit}</li>)}
                </ul>
              )}
              {lapsed && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-amber-200 pt-3">
                  <p className="flex-1 text-xs text-slate-600">{translateUi("They can renew from the link in their email, or you can sell them a new membership.")}</p>
                  <button type="button" disabled={sendingLink} onClick={() => void sendRenewalLink(m.id)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50">
                    <Send className="h-3.5 w-3.5" /> {sendingLink ? translateUi("Sending…") : translateUi("Email renewal link")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {result?.kind === "missing" && (
        <div className="flex items-start gap-3 rounded-xl border-2 border-red-300 bg-red-50 p-5">
          <XCircle className="h-7 w-7 shrink-0 text-red-600" />
          <div>
            <p className="text-base font-bold text-slate-900">{translateUi("No member found")}</p>
            <p className="mt-1 text-sm text-slate-600">{translateUi("No membership at this salon has the code {code}.", { code: result.code.toUpperCase() })}</p>
          </div>
        </div>
      )}
      {result?.kind === "error" && <p className="text-sm text-red-600">{result.message}</p>}
    </div>
  );
}

type SaleOutcome =
  | { kind: "active"; subscription: MembershipSubscription; qrUrl: string | null }
  | { kind: "waiting"; subscription: MembershipSubscription | null }
  | { kind: "cancelled" };

function SellMembership({ sid, plans, plansError, cardEnabled, notify, terminals, testMode }: {
  sid: string; plans: MembershipPlan[] | null; plansError: string | null; cardEnabled: boolean; notify: Notify;
  terminals: Terminal[]; testMode: boolean;
}) {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const [params, setParams] = useSearchParams();
  const [planId, setPlanId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [saving, setSaving] = useState(false);
  const [outcome, setOutcome] = useState<SaleOutcome | null>(null);
  const [cardVia, setCardVia] = useState<number | "online">(terminals[0]?.id ?? "online");
  const [readerPayment, setReaderPayment] = useState<{ subscriptionId: number; payment: TerminalPayment } | null>(null);
  const [inlineCheckout, setInlineCheckout] = useState<CheckoutInstructions | null>(null);

  const plan = plans?.find((p) => p.id === planId) ?? null;
  const total = plan ? plan.price + (plan.signupFee ?? 0) : 0;

  /** The membership activates when the server handles the reader's outcome — a moment after it settles. */
  async function waitForActive(subscriptionId: number) {
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        const detail = await apiFetch<MembershipDetail>(`${ADMIN_API}/${sid}/membership/subscriptions/${subscriptionId}`);
        if (detail.subscription.status === "ACTIVE") {
          await showActive(subscriptionId);
          notify(translateUi("Membership sold — the welcome email with the QR code is on its way."));
          return;
        }
        setOutcome({ kind: "waiting", subscription: detail.subscription });
      } catch { /* keep trying */ }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  async function showActive(subscriptionId: number) {
    const detail = await apiFetch<MembershipDetail>(`${ADMIN_API}/${sid}/membership/subscriptions/${subscriptionId}`);
    const qrUrl = await memberQrUrl(sid, subscriptionId).catch(() => null);
    setOutcome({ kind: "active", subscription: detail.subscription, qrUrl });
  }

  // Back from Stripe: the webhook activates the membership a moment later, so poll briefly. Read once
  // on mount — the payment params are dropped right away so a later visit doesn't replay the result.
  const [cardReturn] = useState(() => {
    const payment = params.get("payment");
    if (!payment) return null;
    let subscriptionId: number | null = null;
    try { subscriptionId = Number(JSON.parse(sessionStorage.getItem(PENDING_CARD_KEY) ?? "null")?.subscriptionId) || null; } catch { /* storage unavailable */ }
    return { succeeded: payment === "success", subscriptionId };
  });
  useEffect(() => {
    if (!cardReturn) return;
    try { sessionStorage.removeItem(PENDING_CARD_KEY); } catch { /* storage unavailable */ }
    const next = new URLSearchParams(params);
    ["payment", "reference", "session_id"].forEach((key) => next.delete(key));
    setParams(next, { replace: true });
    if (!cardReturn.succeeded) { setOutcome({ kind: "cancelled" }); return; }
    const pendingId = cardReturn.subscriptionId;
    if (!pendingId) { setOutcome({ kind: "waiting", subscription: null }); return; }
    let stopped = false;
    let attempts = 0;
    const poll = async () => {
      try {
        const detail = await apiFetch<MembershipDetail>(`${ADMIN_API}/${sid}/membership/subscriptions/${pendingId}`);
        if (stopped) return;
        if (detail.subscription.status === "ACTIVE") { stopped = true; await showActive(pendingId); return; }
        setOutcome({ kind: "waiting", subscription: detail.subscription });
      } catch { /* keep polling */ }
      if (++attempts < 10 && !stopped) setTimeout(() => void poll(), 1500);
    };
    void poll();
    return () => { stopped = true; };
    // Runs once, for the return captured on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardReturn]);

  async function sell() {
    if (!plan) return;
    setSaving(true);
    try {
      const returnUrl = `${window.location.origin}${window.location.pathname}?view=membership&membershipView=sell`;
      const onReader = method === "CARD" && cardVia !== "online";
      const response = await apiFetch<{ subscriptionId: number; terminalPayment?: TerminalPayment | null } & CheckoutResult>(`${ADMIN_API}/${sid}/membership/desk-sales`, {
        method: "POST",
        body: JSON.stringify({ planId: plan.id, customerName: name.trim(), customerEmail: email.trim(), customerPhone: phone.trim() || null,
          paymentMethod: method, returnUrl, inlineCheckout: true, terminalId: onReader ? cardVia : null }),
      });
      if (response.terminalPayment) {
        setReaderPayment({ subscriptionId: response.subscriptionId, payment: response.terminalPayment });
        return;
      }
      if (response.checkoutUrl || response.checkout) {
        try { sessionStorage.setItem(PENDING_CARD_KEY, JSON.stringify({ subscriptionId: response.subscriptionId })); } catch { /* optional */ }
        const inline = beginCheckout(response);
        if (inline) setInlineCheckout(inline);
        return;
      }
      await showActive(response.subscriptionId);
      notify(translateUi("Membership sold — the welcome email with the QR code is on its way."));
    } catch (error) {
      notify(error instanceof Error ? error.message : translateUi("Could not sell the membership"), "error");
    } finally {
      setSaving(false);
    }
  }

  function startOver() {
    if (outcome?.kind === "active" && outcome.qrUrl) URL.revokeObjectURL(outcome.qrUrl);
    setOutcome(null);
    setPlanId(null);
    setName(""); setEmail(""); setPhone("");
    setMethod("CASH");
  }

  if (outcome) {
    return (
      <div className="max-w-xl">
        {outcome.kind === "active" && (
          <div className="rounded-xl border-2 border-green-300 bg-green-50 p-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-7 w-7 shrink-0 text-green-600" />
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-slate-900">{translateUi("Membership active")}</p>
                <p className="mt-1 text-sm text-slate-800">{outcome.subscription.customerName} · {outcome.subscription.planName}</p>
                <p className="mt-1 text-xs text-slate-600">{renewalLine(outcome.subscription, translateUi, uiLocale)}</p>
                <p className="mt-3 text-xs text-slate-600">{translateUi("Member code")}</p>
                <p className="font-mono text-lg font-bold tracking-widest text-slate-900">{outcome.subscription.memberCode}</p>
                <p className="mt-2 text-xs text-slate-500">{translateUi("The QR code is also emailed to {email}.", { email: outcome.subscription.customerEmail })}</p>
              </div>
              {outcome.qrUrl && <img src={outcome.qrUrl} alt={translateUi("Member QR code")} className="h-32 w-32 shrink-0 rounded-lg border border-green-200 bg-white p-1" />}
            </div>
          </div>
        )}
        {outcome.kind === "waiting" && (
          <div className="flex items-start gap-3 rounded-xl border-2 border-slate-200 bg-white p-5">
            <Loader2 className="h-7 w-7 shrink-0 animate-spin text-slate-400" />
            <div>
              <p className="text-base font-bold text-slate-900">{translateUi("Card payment received — waiting for Stripe")}</p>
              <p className="mt-1 text-sm text-slate-600">
                {outcome.subscription
                  ? translateUi("{name}'s membership activates as soon as Stripe confirms the payment, and the QR code is emailed then.", { name: outcome.subscription.customerName })
                  : translateUi("The membership activates as soon as Stripe confirms the payment, and the QR code is emailed then.")}
              </p>
            </div>
          </div>
        )}
        {outcome.kind === "cancelled" && (
          <div className="flex items-start gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-5">
            <XCircle className="h-7 w-7 shrink-0 text-amber-600" />
            <div>
              <p className="text-base font-bold text-slate-900">{translateUi("Card payment cancelled")}</p>
              <p className="mt-1 text-sm text-slate-600">{translateUi("No membership was started. You can try again or take another payment method.")}</p>
            </div>
          </div>
        )}
        <button type="button" onClick={startOver} className="mt-4 cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          {translateUi("Sell another membership")}
        </button>
      </div>
    );
  }

  const canSell = Boolean(plan && name.trim() && email.trim() && !plan.soldOut && (method !== "CARD" || cardEnabled));
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[1fr_320px]">
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">{translateUi("Membership plans")}</h2>
          <p className="mt-0.5 text-xs text-slate-400">{translateUi("Plans on sale. Manage plans in Admin.")}</p>
        </div>
        <div className="grid gap-2 p-3 sm:grid-cols-2">
          {plans === null && <p className="p-4 text-sm text-slate-400">{translateUi("Loading plans…")}</p>}
          {plansError && <p className="p-4 text-sm text-red-600">{plansError}</p>}
          {plans?.length === 0 && !plansError && <p className="p-4 text-sm text-slate-400">{translateUi("No membership plans are on sale yet.")}</p>}
          {plans?.map((p) => (
            <button key={p.id} type="button" disabled={p.soldOut} onClick={() => setPlanId(p.id)} aria-pressed={planId === p.id}
              className={`cursor-pointer rounded-lg border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${planId === p.id ? "border-matcha-500 bg-matcha-50 ring-2 ring-matcha-500/20" : "border-slate-200 bg-white hover:border-matcha-300 hover:bg-matcha-50"}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                {p.soldOut ? <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">{translateUi("Full")}</span>
                  : p.spotsLeft != null && <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">{translateUi("{count} left", { count: p.spotsLeft })}</span>}
              </div>
              <p className="mt-1 text-xs font-semibold text-slate-700">{formatPrice(p.price, p.currency, uiLocale)} {translateUi(INTERVAL_SUFFIX[p.billingInterval])}</p>
              {p.signupFee ? <p className="text-[11px] text-slate-400">{translateUi("+ {fee} sign-up fee", { fee: formatPrice(p.signupFee, p.currency, uiLocale) })}</p> : null}
              {p.description && <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{p.description}</p>}
            </button>
          ))}
        </div>
      </section>

      <section className="h-fit rounded-xl border border-slate-200 bg-white lg:sticky lg:top-20">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <BadgeCheck className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-800">{translateUi("New member")}</h2>
        </div>
        <form className="space-y-2 p-4" onSubmit={(e) => { e.preventDefault(); if (canSell) void sell(); }}>
          <p className="text-xs text-slate-500">{plan ? plan.name : translateUi("Choose a plan to begin.")}</p>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={translateUi("Customer name")} aria-label={translateUi("Customer name")} autoComplete="off" />
          <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={translateUi("Email (the QR code is sent here)")} aria-label={translateUi("Customer email")} autoComplete="off" />
          <input className={inputCls} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={translateUi("Phone (optional)")} aria-label={translateUi("Customer phone")} autoComplete="off" />
          <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} aria-label={translateUi("Payment method")}>
            <option value="CASH">{translateUi("Cash")}</option>
            <option value="CARD" disabled={!cardEnabled}>{translateUi("Card")}{cardEnabled ? translateUi(" · Stripe") : translateUi(" · enable membership payments in Admin")}</option>
            <option value="OTHER">{translateUi("Other")}</option>
          </select>
          {method === "CARD" && terminals.length > 0 && (
            <select className={inputCls} value={String(cardVia)} aria-label={translateUi("Take the card payment on")}
              onChange={(e) => setCardVia(e.target.value === "online" ? "online" : Number(e.target.value))}>
              {terminals.map((reader) => <option key={reader.id} value={reader.id}>{translateUi("Card reader")}: {reader.label}{reader.status === "offline" ? ` · ${translateUi("offline")}` : ""}</option>)}
              <option value="online">{translateUi("Card form on this screen")}</option>
            </select>
          )}
          <div className="flex justify-between border-t border-slate-100 pt-3 text-sm font-bold text-slate-800">
            <span>{translateUi("Total today")}</span><span>{plan ? formatPrice(total, plan.currency, uiLocale) : "—"}</span>
          </div>
          <button type="submit" disabled={!canSell || saving}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-matcha-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-matcha-700 disabled:opacity-40">
            <CreditCard className="h-4 w-4" /> {saving ? translateUi("Processing…") : method === "CARD" ? translateUi("Continue to card payment") : translateUi("Record payment and activate")}
          </button>
        </form>
      </section>
      {inlineCheckout && <StripeCheckoutPanel checkout={inlineCheckout} title={plan?.name} customerEmail={email.trim()} />}
      {readerPayment && (
        <TerminalPaymentDialog sid={sid} payment={readerPayment.payment} terminals={terminals} testMode={testMode}
          onFinished={(done) => {
            if (done.status !== "SUCCEEDED") { setOutcome({ kind: "cancelled" }); return; }
            void waitForActive(readerPayment.subscriptionId);
          }}
          onClose={() => setReaderPayment(null)} />
      )}
    </div>
  );
}
