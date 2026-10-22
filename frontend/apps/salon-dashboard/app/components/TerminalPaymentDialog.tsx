import { useI18n } from "@salon/i18n";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, CreditCard, LoaderCircle, XCircle } from "lucide-react";
import { ADMIN_API, apiFetch } from "~/lib/api";
import { formatPrice } from "~/lib/format";

/** A salon card reader (`GET …/payments/terminals`). */
export interface Terminal {
  id: number;
  label: string;
  deviceType?: string | null;
  status?: "online" | "offline" | null;
}

/** A payment running on a reader (`PaymentGateway.TerminalPayment`). */
export interface TerminalPayment {
  paymentId: number;
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELED";
  terminalId: number | null;
  terminalLabel: string | null;
  amount: number;
  currency: string;
  failureMessage: string | null;
}

/** Loads the salon's readers for the desk; empty when there are none (or the desk can't see them). */
export async function loadTerminals(sid: string): Promise<Terminal[]> {
  return apiFetch<Terminal[]>(`${ADMIN_API}/${sid}/payments/terminals`).catch((): Terminal[] => []);
}

interface Props {
  sid: string;
  payment: TerminalPayment;
  terminals: Terminal[];
  /** Stripe test mode: offer to "tap" a test card on a simulated reader. */
  testMode: boolean;
  /** Called once, when the payment settles (paid, canceled or failed). */
  onFinished: (payment: TerminalPayment) => void;
  onClose: () => void;
}

/**
 * Follows a card payment on a reader until it settles. A declined card keeps the payment open: the customer can
 * try another card (Retry, optionally on another reader) or the desk cancels it. The outcome itself is recorded
 * by the server from Stripe; this dialog only polls it (and asks Stripe directly every few polls in case a
 * webhook is late).
 */
export function TerminalPaymentDialog({ sid, payment: started, terminals, testMode, onFinished, onClose }: Props) {
  const { t, locale } = useI18n();
  const [payment, setPayment] = useState(started);
  const [readerId, setReaderId] = useState<number | null>(started.terminalId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finished = useRef(false);
  const base = `${ADMIN_API}/${sid}/payments/terminal-payments/${started.paymentId}`;

  function apply(next: TerminalPayment) {
    setPayment(next);
    if (next.status !== "PENDING" && !finished.current) {
      finished.current = true;
      onFinished(next);
    }
  }

  useEffect(() => {
    let polls = 0;
    const timer = window.setInterval(async () => {
      if (finished.current) { window.clearInterval(timer); return; }
      polls += 1;
      try {
        apply(await apiFetch<TerminalPayment>(`${base}${polls % 5 === 0 ? "?refresh=true" : ""}`));
      } catch { /* keep polling */ }
    }, 2000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  async function act(path: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      apply(await apiFetch<TerminalPayment>(`${base}${path}`, { method: path.startsWith("?") ? "GET" : "POST",
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Something went wrong"));
    } finally {
      setBusy(false);
    }
  }

  const pending = payment.status === "PENDING";
  const amount = formatPrice(payment.amount, payment.currency, locale);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex flex-col items-center text-center">
          {payment.status === "SUCCEEDED" ? <CheckCircle2 className="h-10 w-10 text-matcha-600" />
            : pending ? (payment.failureMessage ? <CreditCard className="h-10 w-10 text-amber-500" /> : <LoaderCircle className="h-10 w-10 animate-spin text-slate-400" />)
            : <XCircle className="h-10 w-10 text-red-500" />}
          <p className="mt-3 text-2xl font-bold text-slate-900">{amount}</p>
          <p className="mt-1 text-sm text-slate-600">
            {payment.status === "SUCCEEDED" ? t("Payment received")
              : payment.status === "CANCELED" ? t("Payment canceled")
              : payment.status === "FAILED" ? t("Payment failed")
              : payment.failureMessage ? payment.failureMessage
              : t("Ask the customer to tap, insert or swipe their card on {reader}", { reader: payment.terminalLabel ?? t("the reader") })}
          </p>
          {error && <p className="mt-2 text-xs text-red-600" role="alert">{error}</p>}
        </div>

        {pending ? (
          <div className="mt-5 space-y-2">
            {payment.failureMessage && (
              <div className="flex gap-2">
                <select value={readerId ?? ""} onChange={(e) => setReaderId(Number(e.target.value))}
                        className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  {terminals.map((reader) => <option key={reader.id} value={reader.id}>
                    {reader.label}{reader.status === "offline" ? ` · ${t("offline")}` : ""}</option>)}
                </select>
                <button type="button" disabled={busy} onClick={() => act("/retry", { terminalId: readerId })}
                        className="rounded-lg bg-matcha-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{t("Try again")}</button>
              </div>
            )}
            {testMode && (
              <button type="button" disabled={busy} onClick={() => act("/simulate", {})}
                      className="w-full rounded-lg border border-dashed border-slate-300 px-4 py-2 text-xs text-slate-600 disabled:opacity-50">
                {t("Test mode: tap a test card")}
              </button>
            )}
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={() => act("?refresh=true")}
                      className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">{t("Check status")}</button>
              <button type="button" disabled={busy} onClick={() => act("/cancel")}
                      className="flex-1 rounded-lg border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 disabled:opacity-50">{t("Cancel payment")}</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={onClose}
                  className="mt-5 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">{t("Done")}</button>
        )}
      </div>
    </div>
  );
}
