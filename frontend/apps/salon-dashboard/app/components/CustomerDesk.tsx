import { useI18n } from "@salon/i18n";
import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, Search, UserRound } from "lucide-react";
import { ADMIN_API, apiFetch } from "~/lib/api";

type Notify = (message: string, kind?: "success" | "error") => void;
export type DeskCustomer = { id: number; name: string; email: string; phone: string | null; notes: string | null; lastSeenAt: string };
type CustomerPage = { content: DeskCustomer[]; totalElements: number };
type History = {
  bookings: { id: number; serviceName: string | null; staffName: string | null; appointmentDate: string; startTime: string; status: string }[];
  orders: { id: number; orderNumber: string; createdAt: string; status: string; currency: string; total: number }[];
  memberships: { id: number; planName: string; status: string; currentPeriodEnd: string | null }[];
};
type Detail = { customer: DeskCustomer; history: History };

const inputCls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10";

/** Searches the salon's customer list as the user types; empty until they have typed two characters. */
function useCustomerSearch(sid: string, query: string) {
  const [results, setResults] = useState<DeskCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      apiFetch<CustomerPage>(`${ADMIN_API}/${sid}/customers?q=${encodeURIComponent(q)}&size=8`, { signal: controller.signal })
        .then((page) => setResults(page.content)).catch(() => { if (!controller.signal.aborted) setResults([]); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [sid, query]);
  return { results, loading };
}

/** A search box that offers matching customers; picking one hands it to the caller (the till, the booking form). */
export function CustomerSuggest({ sid, onPick, placeholder, className = "" }: {
  sid: string; onPick: (customer: DeskCustomer) => void; placeholder?: string; className?: string;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const { results, loading } = useCustomerSearch(sid, query);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!box.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return <div ref={box} className={`relative ${className}`}>
    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
    <input className={`${inputCls} pl-9`} aria-label={t("Find an existing customer")} placeholder={placeholder ?? t("Find an existing customer")}
      value={query} onChange={(e) => { setQuery(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} />
    {open && query.trim().length >= 2 && <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
      {loading && <li className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500"><Loader2 className="size-3.5 animate-spin" />{t("Searching…")}</li>}
      {!loading && !results.length && <li className="px-3 py-2 text-xs text-slate-500">{t("No customer found.")}</li>}
      {results.map((customer) => <li key={customer.id}>
        <button type="button" className="block w-full px-3 py-2 text-left hover:bg-slate-50"
          onClick={() => { onPick(customer); setQuery(""); setOpen(false); }}>
          <span className="block text-sm font-semibold text-slate-800">{customer.name}</span>
          <span className="block truncate text-xs text-slate-500">{[customer.email, customer.phone].filter(Boolean).join(" · ")}</span>
        </button></li>)}
    </ul>}
  </div>;
}

/** Find a customer, read their visit and order history, and add a walk-in. Editing and erasing stay with the owner. */
export function CustomerDesk({ sid, notify }: { sid: string; notify: Notify }) {
  const { t, locale } = useI18n();
  const base = `${ADMIN_API}/${sid}/customers`;
  const [query, setQuery] = useState("");
  const [list, setList] = useState<DeskCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [opening, setOpening] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      apiFetch<CustomerPage>(`${base}?size=50${query.trim() ? `&q=${encodeURIComponent(query.trim())}` : ""}`, { signal: controller.signal })
        .then((page) => setList(page.content)).catch(() => { if (!controller.signal.aborted) notify(t("Could not load customers."), "error"); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, query ? 250 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [base, query]);

  async function open(customer: DeskCustomer) {
    setAdding(false); setOpening(true);
    try { setDetail(await apiFetch<Detail>(`${base}/${customer.id}`)); }
    catch { notify(t("Could not open that customer."), "error"); }
    finally { setOpening(false); }
  }

  const day = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(locale);
  return <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input className={`${inputCls} pl-9`} aria-label={t("Search customers")} placeholder={t("Name, email or phone")} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <button type="button" onClick={() => { setAdding(true); setDetail(null); }} aria-label={t("Add customer")} title={t("Add customer")}
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-matcha-600 px-3 text-white hover:bg-matcha-700"><Plus className="size-4" /></button>
      </div>
      {loading ? <p className="py-6 text-center text-sm text-slate-500" role="status">{t("Loading…")}</p>
        : !list.length ? <p className="py-6 text-center text-sm text-slate-500">{query ? t("No customer found.") : t("No customers yet.")}</p>
        : <ul className="max-h-[60dvh] divide-y divide-slate-100 overflow-auto">{list.map((customer) => <li key={customer.id}>
          <button type="button" onClick={() => open(customer)}
            className={`flex w-full items-center gap-3 px-2 py-2.5 text-left hover:bg-slate-50 ${detail?.customer.id === customer.id ? "bg-matcha-50" : ""}`}>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500"><UserRound className="size-4" /></span>
            <span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-800">{customer.name}</span>
              <span className="block truncate text-xs text-slate-500">{[customer.email, customer.phone].filter(Boolean).join(" · ")}</span></span>
          </button></li>)}</ul>}
    </section>

    <section className="rounded-xl border border-slate-200 bg-white p-5">
      {adding ? <AddCustomer sid={sid} onCancel={() => setAdding(false)} notify={notify}
          onSaved={(customer) => { setAdding(false); setList((items) => [customer, ...items]); open(customer); }} />
        : opening ? <p className="py-10 text-center text-sm text-slate-500" role="status">{t("Loading…")}</p>
        : !detail ? <p className="py-10 text-center text-sm text-slate-500">{t("Select a customer to see their details and history.")}</p>
        : <div className="space-y-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{detail.customer.name}</h2>
            <p className="mt-0.5 text-sm text-slate-600">{[detail.customer.email, detail.customer.phone].filter(Boolean).join(" · ")}</p>
            {detail.customer.notes && <p className="mt-2 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{detail.customer.notes}</p>}
          </div>
          <HistoryBlock title={t("Appointments")} empty={t("No appointments.")} rows={detail.history.bookings.map((b) => ({
            key: b.id, main: `${b.serviceName ?? t("Service")}${b.staffName ? ` · ${b.staffName}` : ""}`, sub: `${day(b.appointmentDate)} ${b.startTime.slice(0, 5)}`, status: b.status }))} />
          <HistoryBlock title={t("Shop orders")} empty={t("No orders.")} rows={detail.history.orders.map((o) => ({
            key: o.id, main: `${o.orderNumber} · ${o.total.toFixed(2)} ${o.currency}`, sub: day(o.createdAt), status: o.status }))} />
          <HistoryBlock title={t("Memberships")} empty={t("No memberships.")} rows={detail.history.memberships.map((m) => ({
            key: m.id, main: m.planName, sub: m.currentPeriodEnd ? `${t("Until")} ${day(m.currentPeriodEnd)}` : "", status: m.status }))} />
        </div>}
    </section>
  </div>;
}

function HistoryBlock({ title, empty, rows }: { title: string; empty: string; rows: { key: number; main: string; sub: string; status: string }[] }) {
  return <div>
    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
    {!rows.length ? <p className="mt-1 text-sm text-slate-400">{empty}</p>
      : <ul className="mt-1 max-h-48 divide-y divide-slate-100 overflow-auto">{rows.map((row) => <li key={row.key} className="flex items-center justify-between gap-3 py-1.5 text-sm">
        <span className="min-w-0"><span className="block truncate text-slate-800">{row.main}</span><span className="block text-xs text-slate-500">{row.sub}</span></span>
        <span className="shrink-0 rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{row.status.replace("_", " ")}</span></li>)}</ul>}
  </div>;
}

function AddCustomer({ sid, onSaved, onCancel, notify }: { sid: string; onSaved: (customer: DeskCustomer) => void; onCancel: () => void; notify: Notify }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const valid = form.name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    try {
      const saved = await apiFetch<DeskCustomer>(`${ADMIN_API}/${sid}/customers`, {
        method: "POST", body: JSON.stringify({ name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || null, notes: form.notes.trim() || null }) });
      notify(t("Customer added."), "success");
      onSaved(saved);
    } catch (err) { notify(err instanceof Error ? err.message : t("Could not add the customer."), "error"); }
    finally { setBusy(false); }
  }
  return <form onSubmit={save} className="space-y-3">
    <h2 className="text-lg font-bold text-slate-900">{t("Add customer")}</h2>
    <input className={inputCls} aria-label={t("Name")} placeholder={t("Name")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
    <input className={inputCls} type="email" aria-label={t("Email")} placeholder={t("Email")} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
    <input className={inputCls} type="tel" aria-label={t("Phone (optional)")} placeholder={t("Phone (optional)")} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
    <textarea className={inputCls} rows={3} aria-label={t("Notes (optional)")} placeholder={t("Notes (optional)")} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
    <div className="flex gap-2">
      <button type="submit" disabled={busy || !valid} className="rounded-lg bg-matcha-600 px-4 py-2 text-sm font-semibold text-white hover:bg-matcha-700 disabled:opacity-50">{busy ? t("Saving…") : t("Save customer")}</button>
      <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">{t("Cancel")}</button>
    </div>
  </form>;
}
