import { useI18n } from "@salon/i18n";
import { useState } from "react";
import type { BookingPaymentLink } from "./BookingPaymentLinks";

export interface BookingPaymentLinkResult {
  paymentUrl: string;
  amount: number;
  currency: string;
  emailed: boolean;
  /** The recorded link (status, expiry, who sent it) — present when the server tracks payment links. */
  link?: BookingPaymentLink | null;
}

export interface BookingPaymentLinkDialogProps {
  customerName: string;
  customerEmail?: string;
  /** What the service costs — the default amount to charge. */
  defaultAmount?: number;
  currency?: string;
  /** Why the default amount is what it is, e.g. "Your no-show fee". */
  amountHint?: string;
  /** Creates the link; the app owns the request (its own `apiFetch`) and rejects with a readable message. */
  onCreate: (body: { amount?: number; sendEmail: boolean }) => Promise<BookingPaymentLinkResult>;
  onClose: () => void;
}

/** Collect from a customer who did not show up: pick the amount, then copy the Stripe link and/or email it. */
export function BookingPaymentLinkDialog({ customerName, customerEmail, defaultAmount, currency, amountHint, onCreate, onClose }: BookingPaymentLinkDialogProps) {
  const { t } = useI18n();
  const hasEmail = Boolean(customerEmail?.trim());
  const [amount, setAmount] = useState(defaultAmount != null ? String(defaultAmount) : "");
  const [sendEmail, setSendEmail] = useState(hasEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BookingPaymentLinkResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function create() {
    const parsed = amount.trim() === "" ? undefined : Number(amount);
    if (parsed !== undefined && (!Number.isFinite(parsed) || parsed <= 0)) {
      setError(t("Enter an amount greater than zero."));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setResult(await onCreate({ amount: parsed, sendEmail: sendEmail && hasEmail }));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Could not create the payment link."));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.paymentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(t("Could not copy — select the link and copy it by hand."));
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <h2 className="text-base font-bold text-slate-900">{t("Request payment")}</h2>
        <p className="mt-1 text-xs text-slate-500">{t("Send {name} a secure link to pay for this appointment.", { name: customerName })}</p>

        {!result ? (
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-semibold text-slate-600">
              {t("Amount")}{currency ? ` (${currency})` : ""}
              <input type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-900" />
              {amountHint && <span className="mt-1 block text-[11px] font-normal text-slate-400">{amountHint}</span>}
            </label>
            <label className={`flex items-start gap-2 text-xs ${hasEmail ? "text-slate-600" : "text-slate-400"}`}>
              <input type="checkbox" className="mt-0.5" checked={sendEmail && hasEmail} disabled={!hasEmail} onChange={(e) => setSendEmail(e.target.checked)} />
              <span>{hasEmail ? t("Email the link to {email}", { email: customerEmail ?? "" }) : t("No email on this booking — copy the link and send it yourself.")}</span>
            </label>
            {error && <p className="text-xs font-medium text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">{t("Cancel")}</button>
              <button type="button" disabled={busy} onClick={() => void create()} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                {busy ? t("Creating…") : t("Create payment link")}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-xs font-medium text-green-700">
              {result.emailed ? t("Payment link emailed to {email}.", { email: customerEmail ?? "" }) : t("Payment link created.")}
            </p>
            <input readOnly value={result.paymentUrl} onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700" />
            <p className="text-[11px] text-slate-400">{t("The link stays open for 24 hours. Create a new one any time.")}</p>
            {error && <p className="text-xs font-medium text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => void copy()} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                {copied ? t("Copied") : t("Copy link")}
              </button>
              <button type="button" onClick={onClose} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">{t("Done")}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
