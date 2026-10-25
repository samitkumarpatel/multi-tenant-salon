import { useEffect, useRef, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import type { StripeCheckoutLoadActionsSuccess } from "@stripe/stripe-js";
import { useI18n } from "@salon/i18n";
import { fontStack, loadGoogleFont, contrastText } from "./theme";

/** How the salon takes the payment (`PaymentGateway.Checkout` on the API). */
export type CheckoutUi = "REDIRECT" | "EMBEDDED" | "ELEMENTS";

export interface CheckoutBranding {
  displayName: string | null;
  primaryColor: string | null;
  backgroundColor: string | null;
  fontFamily: string | null;
}

export interface CheckoutInstructions {
  ui: CheckoutUi;
  url: string | null;
  clientSecret: string | null;
  publishableKey: string | null;
  stripeAccountId: string | null;
  returnUrl: string | null;
  cancelUrl: string | null;
  branding: CheckoutBranding | null;
}

/** Any API response that may start a payment: `{ checkoutUrl, checkout }`. */
export interface CheckoutResult {
  checkoutUrl?: string | null;
  checkout?: CheckoutInstructions | null;
}

/**
 * Starts the payment the API set up. A redirect checkout navigates to Stripe and returns `null` (keep the page
 * busy); an embedded or branded form returns its instructions — render `<StripeCheckoutPanel>` with them.
 * Either way the customer ends on the same `?payment=success|cancel` return page.
 */
export function beginCheckout(result: CheckoutResult): CheckoutInstructions | null {
  const checkout = result.checkout;
  if (checkout && checkout.ui !== "REDIRECT" && checkout.clientSecret && checkout.publishableKey) return checkout;
  const url = checkout?.url ?? result.checkoutUrl;
  if (url) window.location.assign(url);
  return null;
}

/** Stripe.js for the salon's own Stripe account (direct charges). */
function stripeFor(checkout: CheckoutInstructions) {
  return loadStripe(checkout.publishableKey!, checkout.stripeAccountId ? { stripeAccount: checkout.stripeAccountId } : undefined);
}

export interface StripeCheckoutPanelProps {
  checkout: CheckoutInstructions;
  /** What is being paid for, shown above the form. */
  title?: string;
  /** Asked for in the branded form when the checkout doesn't already know it. */
  customerEmail?: string | null;
}

/**
 * The in-page payment form: Stripe's embedded Checkout, or the salon's branded Payment Element form. Closing it
 * goes to the checkout's cancel page — exactly what Stripe's own "back" link does on the redirect checkout.
 */
export function StripeCheckoutPanel({ checkout, title, customerEmail }: StripeCheckoutPanelProps) {
  const { t } = useI18n();
  const accent = checkout.branding?.primaryColor ?? "#111827";
  const close = () => { if (checkout.cancelUrl) window.location.assign(checkout.cancelUrl); };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkout.cancelUrl]);

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" role="dialog" aria-modal="true"
         aria-label={title ?? t("Payment")}>
      <div className="w-full sm:max-w-lg max-h-[95dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-xl"
           style={{ fontFamily: fontStack(checkout.branding?.fontFamily) }}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            {checkout.branding?.displayName && <p className="text-xs text-slate-500 truncate">{checkout.branding.displayName}</p>}
            <h2 className="text-base font-semibold text-slate-900 truncate">{title ?? t("Payment")}</h2>
          </div>
          <button type="button" onClick={close} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
            {t("Cancel")}
          </button>
        </div>
        <div className="p-5">
          {checkout.ui === "EMBEDDED"
            ? <EmbeddedForm checkout={checkout} />
            : <BrandedForm checkout={checkout} accent={accent} customerEmail={customerEmail ?? null} />}
        </div>
      </div>
    </div>
  );
}

function EmbeddedForm({ checkout }: { checkout: CheckoutInstructions }) {
  const { t } = useI18n();
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let destroyed = false;
    let instance: { mount(el: HTMLElement): void; destroy(): void } | null = null;
    stripeFor(checkout)
      .then((stripe) => {
        if (!stripe) throw new Error("Stripe.js failed to load");
        return stripe.createEmbeddedCheckoutPage({ fetchClientSecret: () => Promise.resolve(checkout.clientSecret!) });
      })
      .then((embedded) => {
        if (destroyed) { embedded.destroy(); return; }
        instance = embedded;
        if (host.current) embedded.mount(host.current);
      })
      .catch(() => setError(t("The payment form couldn't be loaded. Check your connection and try again.")));
    return () => { destroyed = true; instance?.destroy(); };
  }, [checkout, t]);

  return error ? <p className="text-sm text-red-600">{error}</p> : <div ref={host} />;
}

function BrandedForm({ checkout, accent, customerEmail }: { checkout: CheckoutInstructions; accent: string; customerEmail: string | null }) {
  const { t } = useI18n();
  const host = useRef<HTMLDivElement>(null);
  const [actions, setActions] = useState<StripeCheckoutLoadActionsSuccess | null>(null);
  const [needsEmail, setNeedsEmail] = useState(false);
  const [email, setEmail] = useState(customerEmail ?? "");
  const [amount, setAmount] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let element: { unmount(): void; destroy?: () => void } | null = null;
    const font = checkout.branding?.fontFamily;
    loadGoogleFont(font);
    stripeFor(checkout)
      .then(async (stripe) => {
        if (!stripe) throw new Error("Stripe.js failed to load");
        const sdk = stripe.initCheckoutElementsSdk({
          clientSecret: checkout.clientSecret!,
          elementsOptions: {
            appearance: {
              theme: "stripe",
              variables: {
                colorPrimary: accent,
                fontFamily: fontStack(font),
                borderRadius: "10px",
              },
            },
            fonts: font ? [{ cssSrc: `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@400;500;600&display=swap` }] : [],
          },
        });
        const payment = sdk.createPaymentElement();
        if (cancelled) return;
        if (host.current) payment.mount(host.current);
        element = payment;
        const loaded = await sdk.loadActions();
        if (cancelled) return;
        if (loaded.type === "error") throw new Error(loaded.error.message);
        const session = loaded.actions.getSession();
        setNeedsEmail(!session.email);
        setAmount(session.total?.total?.amount ?? null);
        setActions(loaded.actions);
      })
      .catch(() => { if (!cancelled) setError(t("The payment form couldn't be loaded. Check your connection and try again.")); });
    return () => { cancelled = true; element?.unmount(); };
  }, [checkout, accent, t]);

  async function pay(event: React.FormEvent) {
    event.preventDefault();
    if (!actions) return;
    setBusy(true);
    setError(null);
    const result = await actions.confirm({
      redirect: "if_required",
      ...(needsEmail ? { email: email.trim() } : {}),
    });
    if (result.type === "error") {
      setError(result.error.message);
      setBusy(false);
      return;
    }
    // Paid without leaving the page (cards): go to the same success page Stripe would redirect to.
    if (checkout.returnUrl) window.location.assign(checkout.returnUrl);
  }

  return (
    <form onSubmit={pay} className="flex flex-col gap-4">
      {needsEmail && (
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          {t("Email")}
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email"
                 className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900" />
        </label>
      )}
      <div ref={host} className="min-h-[180px]" />
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <button type="submit" disabled={!actions || busy}
              className="w-full rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-60"
              style={{ background: accent, color: contrastText(accent) }}>
        {busy ? t("Processing…") : amount ? t("Pay {amount}", { amount }) : t("Pay")}
      </button>
    </form>
  );
}
