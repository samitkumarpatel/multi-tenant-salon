import { useI18n } from "@salon/i18n";
import { useState } from "react";
import { Mail, Printer, X } from "lucide-react";
import { ADMIN_API, apiFetch } from "~/lib/api";
import { formatPrice } from "~/lib/format";

export type ReceiptSale = {
  id: number; saleNumber: string; customerName?: string | null; customerEmail?: string | null; paymentMethod: "CASH" | "CARD" | "OTHER";
  total: number; currency: string; createdAt: string; discountAmount?: number; tipAmount?: number;
  lines?: { itemName: string; unitPrice: number; quantity: number; lineTotal: number }[];
};

/** A settled sale as a receipt: print it for the customer, or email it to them. */
export function ReceiptDialog({ sid, salonName, sale, onClose, notify }: {
  sid: string; salonName: string; sale: ReceiptSale; onClose: () => void; notify: (message: string, kind?: "success" | "error") => void;
}) {
  const { t, locale } = useI18n();
  const [email, setEmail] = useState(sale.customerEmail ?? "");
  const [busy, setBusy] = useState(false);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  function print() {
    const root = document.documentElement;
    root.classList.add("printing-receipt");
    window.addEventListener("afterprint", () => root.classList.remove("printing-receipt"), { once: true });
    window.print();
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    try {
      await apiFetch<void>(`${ADMIN_API}/${sid}/dashboard/sales/${sale.id}/receipt`, { method: "POST", body: JSON.stringify({ email: email.trim() }) });
      notify(t("Receipt sent."), "success");
      onClose();
    } catch (err) { notify(err instanceof Error ? err.message : t("Could not send the receipt."), "error"); }
    finally { setBusy(false); }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={t("Receipt")}>
    <div className="max-h-[90dvh] w-full max-w-sm overflow-auto rounded-2xl bg-white p-5 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-800">{t("Receipt")}</h2>
        <button type="button" onClick={onClose} aria-label={t("Close")} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="size-4" /></button>
      </div>
      <div id="receipt-print" className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-800">
        <p className="text-center text-base font-bold">{salonName}</p>
        <p className="mt-1 text-center font-mono text-xs text-slate-500">{sale.saleNumber}</p>
        <p className="text-center text-xs text-slate-500">{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(sale.createdAt))}</p>
        {sale.customerName && <p className="mt-1 text-center text-xs text-slate-500">{sale.customerName}</p>}
        <ul className="mt-3 space-y-1 border-y border-slate-200 py-2 text-xs">
          {(sale.lines ?? []).map((line, i) => <li key={i} className="flex justify-between gap-3">
            <span>{line.quantity} × {line.itemName}</span><span className="tabular-nums">{formatPrice(line.lineTotal, sale.currency, locale)}</span></li>)}
        </ul>
        {(sale.discountAmount ?? 0) > 0 && <p className="mt-2 flex justify-between text-xs text-slate-600"><span>{t("Discount")}</span><span className="tabular-nums">-{formatPrice(sale.discountAmount!, sale.currency, locale)}</span></p>}
        {(sale.tipAmount ?? 0) > 0 && <p className="mt-1 flex justify-between text-xs text-slate-600"><span>{t("Tip")}</span><span className="tabular-nums">{formatPrice(sale.tipAmount!, sale.currency, locale)}</span></p>}
        <p className="mt-2 flex justify-between font-bold"><span>{t("Total")}</span><span className="tabular-nums">{formatPrice(sale.total, sale.currency, locale)}</span></p>
        <p className="text-right text-xs capitalize text-slate-500">{sale.paymentMethod.toLowerCase()}</p>
        <p className="mt-3 text-center text-xs text-slate-500">{t("Thank you for your visit!")}</p>
      </div>
      <button type="button" onClick={print} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
        <Printer className="size-4" />{t("Print")}</button>
      <form onSubmit={send} className="mt-3 flex gap-2">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label={t("Customer email")} placeholder={t("Customer email")}
          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-matcha-500" />
        <button type="submit" disabled={busy || !valid} className="inline-flex items-center gap-1.5 rounded-lg bg-matcha-600 px-3 py-2 text-sm font-semibold text-white hover:bg-matcha-700 disabled:opacity-50">
          <Mail className="size-4" />{busy ? t("Sending…") : t("Email")}</button>
      </form>
    </div>
  </div>;
}
