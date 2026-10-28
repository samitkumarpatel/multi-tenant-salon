import { useI18n } from "@salon/i18n";
import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { ADMIN_API, apiFetch } from "~/lib/api";
import { formatPrice } from "~/lib/format";

type Notify = (message: string, kind?: "success" | "error") => void;
type Status = "NEW" | "CONFIRMED" | "PROCESSING" | "READY_TO_SHIP" | "SHIPPED" | "DELIVERED" | "FULFILLED" | "CANCELLED" | "FAILED" | "ON_HOLD";
type Order = {
  id: number; orderNumber: string; customerName: string; customerEmail: string; customerPhone: string | null;
  status: Status; paymentStatus: string; subtotal: number; total: number | null; currency: string; createdAt: string;
  shippingMethodName: string | null; trackingCarrier: string | null; trackingNumber: string | null;
  lines: { id: number; productName: string; variantLabel: string | null; quantity: number; lineTotal: number }[];
};
type Page = { content: Order[]; statusCounts: Partial<Record<Status, number>> };

/** The steps the desk may take; cancelling and refunding stay with the owner. */
const NEXT: { status: Status; label: string }[] = [
  { status: "PROCESSING", label: "Start processing" },
  { status: "READY_TO_SHIP", label: "Ready" },
  { status: "SHIPPED", label: "Shipped" },
  { status: "FULFILLED", label: "Handed over / done" },
];
const FILTERS: { key: string; label: string }[] = [
  { key: "", label: "All" }, { key: "NEW", label: "New" }, { key: "PROCESSING", label: "Processing" },
  { key: "READY_TO_SHIP", label: "Ready" }, { key: "SHIPPED", label: "Shipped" }, { key: "FULFILLED", label: "Done" },
];

const inputCls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10";

/** Web-shop orders at the counter: find one, see what is in it, and move it along (e.g. hand over a click-and-collect order). */
export function OrdersDesk({ sid, notify }: { sid: string; notify: Notify }) {
  const { t, locale } = useI18n();
  const base = `${ADMIN_API}/${sid}/shop/orders`;
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ size: "30" });
      if (status) params.set("status", status);
      if (query.trim()) params.set("q", query.trim());
      apiFetch<Page>(`${base}?${params}`, { signal: controller.signal })
        .then(setPage).catch(() => { if (!controller.signal.aborted) notify(t("Could not load orders."), "error"); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, query ? 250 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [base, status, query]);

  async function move(order: Order, next: Status) {
    setBusy(true);
    try {
      const updated = await apiFetch<Order>(`${base}/${order.id}/desk-status`, { method: "POST", body: JSON.stringify({ status: next }) });
      setSelected(updated);
      setPage((current) => current && { ...current, content: current.content.map((item) => item.id === updated.id ? updated : item) });
      notify(t("Order updated."), "success");
    } catch (err) { notify(err instanceof Error ? err.message : t("Could not update the order."), "error"); }
    finally { setBusy(false); }
  }

  const when = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  return <div className="grid gap-5 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input className={`${inputCls} pl-9`} aria-label={t("Search orders")} placeholder={t("Order number, name or email")} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-1" role="group" aria-label={t("Filter orders by status")}>
        {FILTERS.map((filter) => <button key={filter.key} type="button" aria-pressed={status === filter.key} onClick={() => setStatus(filter.key)}
          className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${status === filter.key ? "bg-matcha-100 text-matcha-900" : "text-slate-500 hover:bg-slate-50"}`}>
          {t(filter.label)}{filter.key && page?.statusCounts?.[filter.key as Status] ? ` (${page.statusCounts[filter.key as Status]})` : ""}</button>)}
      </div>
      {loading ? <p className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500" role="status"><Loader2 className="size-4 animate-spin" />{t("Loading…")}</p>
        : !page?.content.length ? <p className="py-6 text-center text-sm text-slate-500">{t("No orders found.")}</p>
        : <ul className="max-h-[60dvh] divide-y divide-slate-100 overflow-auto">{page.content.map((order) => <li key={order.id}>
          <button type="button" onClick={() => setSelected(order)} className={`flex w-full items-center gap-3 px-2 py-2.5 text-left hover:bg-slate-50 ${selected?.id === order.id ? "bg-matcha-50" : ""}`}>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{order.orderNumber} · {order.customerName}</span>
              <span className="block text-xs text-slate-500">{when(order.createdAt)}</span></span>
            <span className="shrink-0 text-right"><span className="block text-sm font-semibold text-slate-700">{formatPrice(order.total ?? order.subtotal, order.currency, locale)}</span>
              <span className="block text-[10px] font-semibold uppercase text-slate-500">{order.status.replace("_", " ")}</span></span>
          </button></li>)}</ul>}
    </section>

    <section className="rounded-xl border border-slate-200 bg-white p-5">
      {!selected ? <p className="py-10 text-center text-sm text-slate-500">{t("Select an order to see what is in it.")}</p> : <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{selected.orderNumber}</h2>
          <p className="text-sm text-slate-600">{selected.customerName} · {selected.customerEmail}{selected.customerPhone ? ` · ${selected.customerPhone}` : ""}</p>
          <p className="mt-1 text-xs text-slate-500">{when(selected.createdAt)} · {selected.paymentStatus} · {selected.status.replace("_", " ")}{selected.shippingMethodName ? ` · ${selected.shippingMethodName}` : ""}</p>
          {selected.trackingNumber && <p className="text-xs text-slate-500">{selected.trackingCarrier} {selected.trackingNumber}</p>}
        </div>
        <ul className="divide-y divide-slate-100 border-y border-slate-100 text-sm">
          {selected.lines.map((line) => <li key={line.id} className="flex justify-between gap-3 py-2">
            <span>{line.quantity} × {line.productName}{line.variantLabel ? ` · ${line.variantLabel}` : ""}</span>
            <span className="tabular-nums text-slate-700">{formatPrice(line.lineTotal, selected.currency, locale)}</span></li>)}
        </ul>
        <p className="flex justify-between text-sm font-bold text-slate-800"><span>{t("Total")}</span><span>{formatPrice(selected.total ?? selected.subtotal, selected.currency, locale)}</span></p>
        {selected.status === "CANCELLED" || selected.status === "FAILED" || selected.status === "FULFILLED"
          ? <p className="text-sm text-slate-500">{t("This order is closed.")}</p>
          : <div className="flex flex-wrap gap-2">{NEXT.filter((step) => step.status !== selected.status).map((step) =>
            <button key={step.status} type="button" disabled={busy} onClick={() => move(selected, step.status)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50 ${step.status === "FULFILLED" ? "bg-matcha-600 text-white hover:bg-matcha-700" : "border border-slate-200 text-slate-700 hover:bg-slate-50"}`}>{t(step.label)}</button>)}</div>}
      </div>}
    </section>
  </div>;
}
