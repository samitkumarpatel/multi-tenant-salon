import { useI18n } from "@salon/i18n";
import { useEffect, useState } from "react";
import { Link, useLoaderData, useNavigate, useSearchParams } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { ChevronLeft, ChevronRight, Contact, Download, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Toast, useToast } from "@salon/ui-shared";
import { ADMIN_API, apiFetch, resolveSalonUUID } from "~/lib/api";
import { fmtDate } from "~/lib/membership";
import { formatPrice } from "~/lib/constants";
import { Modal, ModalActions } from "~/components/ShopModal";
import type { SalonCustomer, SalonCustomerDetail, SalonCustomerPage } from "~/lib/types";

const PAGE_SIZE = 50;

const inputCls =
  "w-full px-3 py-2 border border-slate-200 rounded-md text-sm outline-none transition-[border-color,box-shadow] focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 bg-white text-slate-900";
const fieldLabel = "block text-sm font-medium text-slate-700 mb-1";
const controlCls =
  "px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-700 outline-none focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10";

export async function clientLoader({ params, request }: ClientLoaderFunctionArgs) {
  const sid = await resolveSalonUUID(params.salonId!);
  // Search, sort and paging all run in the database, like the member list.
  const url = new URL(request.url);
  const query = new URLSearchParams({ page: url.searchParams.get("page") ?? "0", size: String(PAGE_SIZE) });
  for (const key of ["q", "sort"]) {
    const value = url.searchParams.get(key);
    if (value) query.set(key, value);
  }
  const customers = await apiFetch<SalonCustomerPage>(`${ADMIN_API}/${sid}/customers?${query}`);
  return { sid, customers };
}

function csvCell(value: unknown) {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

interface FormFields {
  name: string;
  email: string;
  phone: string;
  notes: string;
}

const blank = (): FormFields => ({ name: "", email: "", phone: "", notes: "" });

type ModalState = { kind: "add" } | { kind: "edit" | "del"; customer: SalonCustomer } | { kind: "view"; id: number };

export default function Customers() {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const { sid, customers } = useLoaderData<typeof clientLoader>();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { toast, notify } = useToast();
  const [draft, setDraft] = useState(params.get("q") ?? "");
  const [modal, setModal] = useState<ModalState | null>(null);
  const [f, setF] = useState<FormFields>(blank());
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<SalonCustomerDetail | null>(null);
  const q = params.get("q") ?? "";
  const sort = params.get("sort") === "name" ? "name" : "recent";
  const shown = customers.content;
  const close = () => { setModal(null); setDetail(null); };

  function update(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) v ? next.set(k, v) : next.delete(k);
    if (!("page" in patch)) next.delete("page");
    setParams(next, { replace: true });
  }

  useEffect(() => setDraft(q), [q]);
  useEffect(() => {
    if (draft === q) return;
    const timer = setTimeout(() => update({ q: draft || null }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  // The detail modal loads the customer's history when it opens.
  useEffect(() => {
    if (modal?.kind !== "view") return;
    let live = true;
    apiFetch<SalonCustomerDetail>(`${ADMIN_API}/${sid}/customers/${modal.id}`)
      .then((d) => live && setDetail(d))
      .catch((e) => { if (live) { notify(e instanceof Error ? e.message : "Error", "error"); setModal(null); } });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal]);

  /** Reload the list through the loader, keeping the filters. */
  const refresh = () => navigate(`${window.location.pathname}${window.location.search}`, { replace: true });

  function openAdd() { setF(blank()); setModal({ kind: "add" }); }
  function openEdit(c: SalonCustomer) {
    setF({ name: c.name, email: c.email, phone: c.phone ?? "", notes: c.notes ?? "" });
    setModal({ kind: "edit", customer: c });
  }

  async function save() {
    if (!f.name.trim() || (modal?.kind === "add" && !f.email.trim())) return;
    setBusy(true);
    try {
      const body = JSON.stringify({ name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim() || null, notes: f.notes.trim() || null });
      if (modal?.kind === "edit") {
        await apiFetch(`${ADMIN_API}/${sid}/customers/${modal.customer.id}`, { method: "PUT", body });
        notify(`"${f.name.trim()}" updated`);
      } else {
        await apiFetch(`${ADMIN_API}/${sid}/customers`, { method: "POST", body });
        notify(`"${f.name.trim()}" added`);
      }
      close();
      refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Error", "error");
    } finally {
      setBusy(false);
    }
  }

  async function erase() {
    if (modal?.kind !== "del") return;
    setBusy(true);
    try {
      await apiFetch(`${ADMIN_API}/${sid}/customers/${modal.customer.id}`, { method: "DELETE" });
      notify(translateUi("Customer erased"));
      close();
      refresh();
    } catch (e) {
      // 409: an active membership or upcoming appointment — the server says which.
      notify(e instanceof Error ? e.message : "Error", "error");
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv() {
    const query = new URLSearchParams({ page: "0", size: "200", sort });
    if (q) query.set("q", q);
    const all = await apiFetch<SalonCustomerPage>(`${ADMIN_API}/${sid}/customers?${query}`).then((p) => p.content).catch(() => shown);
    const rows = all.map((c) => [c.name, c.email, c.phone, c.notes, c.createdAt, c.lastSeenAt]);
    const csv = [["Name", "Email", "Phone", "Notes", "Customer since", "Last activity"], ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const empty = customers.totalElements === 0 && !q;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:flex-1 sm:min-w-[200px] sm:max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className={`${controlCls} w-full pl-8`} placeholder={translateUi("Search name, email or phone")}
            value={draft} onChange={(e) => setDraft(e.target.value)} />
        </div>
        <select className={`${controlCls} min-h-10`} value={sort} onChange={(e) => update({ sort: e.target.value === "name" ? "name" : null })}>
          <option value="recent">{translateUi("Latest activity")}</option>
          <option value="name">{translateUi("Name A–Z")}</option>
        </select>
        {q && (
          <button className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 cursor-pointer" onClick={() => update({ q: null })}>
            <X className="w-3.5 h-3.5" /> {translateUi("Clear")}
          </button>
        )}
        <div className="flex w-full sm:w-auto items-center gap-2 sm:ml-auto">
          <button className={`${controlCls} min-h-10 inline-flex items-center justify-center gap-1.5 cursor-pointer hover:bg-slate-50`} onClick={exportCsv}>
            <Download className="w-3.5 h-3.5" /> {translateUi("Export CSV")}
          </button>
          <button className="inline-flex min-h-10 items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-matcha-600 hover:bg-matcha-700 cursor-pointer" onClick={openAdd}>
            <Plus className="w-3.5 h-3.5" /> {translateUi("Add customer")}
          </button>
        </div>
      </div>

      {empty ? (
        <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
          <div className="w-10 h-10 rounded-xl bg-matcha-50 border border-matcha-100 flex items-center justify-center mx-auto mb-3">
            <Contact className="w-5 h-5 text-matcha-600" />
          </div>
          <h2 className="text-sm font-bold text-slate-800">{translateUi("No customers yet")}</h2>
          <p className="text-xs text-slate-500 mt-1">
            {translateUi("Customers appear here when they book, order from your shop or join a membership. You can also add one yourself.")}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          {shown.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-slate-400">{translateUi("No customers match your search.")}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {shown.map((c) => (
                <li key={c.id} className="group flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                  <button className="flex-1 min-w-0 text-left cursor-pointer" onClick={() => setModal({ kind: "view", id: c.id })}>
                    <span className="block text-sm font-semibold text-slate-900 truncate">{c.name}</span>
                    <span className="block text-xs text-slate-400 truncate">{[c.email, c.phone].filter(Boolean).join(" · ")}</span>
                    {c.notes && <span className="block text-xs text-slate-500 truncate mt-0.5">{c.notes}</span>}
                    <span className="block md:hidden text-[11px] text-slate-400 mt-0.5">
                      {translateUi("Last activity")} {fmtDate(c.lastSeenAt, uiLocale)}
                    </span>
                  </button>
                  <span className="hidden md:block text-xs text-slate-400 shrink-0">
                    {translateUi("Last activity")} {fmtDate(c.lastSeenAt, uiLocale)}
                  </span>
                  <div className="shrink-0 flex items-center gap-1.5 row-actions">
                    <button aria-label={translateUi("Edit")} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 cursor-pointer" onClick={() => openEdit(c)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button aria-label={translateUi("Delete")} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-red-200 text-red-600 bg-white hover:bg-red-50 cursor-pointer" onClick={() => setModal({ kind: "del", customer: c })}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <ChevronRight className="hidden md:block w-4 h-4 text-slate-300" />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {customers.totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            {translateUi("Showing {from}–{to} of {total}", {
              from: customers.page * customers.size + 1,
              to: customers.page * customers.size + shown.length,
              total: customers.totalElements,
            })}
          </p>
          <div className="flex gap-1.5">
            <button className={`${controlCls} min-h-10 min-w-10 inline-flex items-center justify-center cursor-pointer disabled:opacity-40`} disabled={customers.page === 0}
              onClick={() => update({ page: String(customers.page - 1) })}><ChevronLeft className="w-3.5 h-3.5" /></button>
            <button className={`${controlCls} min-h-10 min-w-10 inline-flex items-center justify-center cursor-pointer disabled:opacity-40`} disabled={customers.page + 1 >= customers.totalPages}
              onClick={() => update({ page: String(customers.page + 1) })}><ChevronRight className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      )}

      {(modal?.kind === "add" || modal?.kind === "edit") && (
        <Modal title={modal.kind === "add" ? translateUi("Add customer") : translateUi("Edit customer")} onClose={close}>
          <div className="space-y-3">
            <div>
              <label className={fieldLabel}>{translateUi("Name")}</label>
              <input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
            </div>
            <div>
              <label className={fieldLabel}>{translateUi("Email")}</label>
              <input className={inputCls} type="email" value={f.email} disabled={modal.kind === "edit"}
                onChange={(e) => setF({ ...f, email: e.target.value })} />
              {modal.kind === "edit" && (
                <p className="text-[11px] text-slate-400 mt-1">{translateUi("The email identifies the customer and can't be changed.")}</p>
              )}
            </div>
            <div>
              <label className={fieldLabel}>{translateUi("Phone")}</label>
              <input className={inputCls} type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            </div>
            <div>
              <label className={fieldLabel}>{translateUi("Notes")}</label>
              <textarea className={inputCls} rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })}
                placeholder={translateUi("Only visible to you and your team")} />
            </div>
            {modal.kind === "edit" && (
              <p className="text-[11px] text-slate-400">
                {translateUi("Past bookings, orders and memberships keep the details they were made with.")}
              </p>
            )}
          </div>
          <ModalActions busy={busy} onCancel={close} onSave={save}
            saveLabel={modal.kind === "add" ? translateUi("Add customer") : translateUi("Save")}
            disabled={!f.name.trim() || (modal.kind === "add" && !f.email.trim())}
            validationHint={translateUi("Name and email are required")} />
        </Modal>
      )}

      {modal?.kind === "del" && (
        <Modal title={translateUi("Erase customer")} onClose={close} narrow>
          <p className="text-sm text-slate-600">
            {translateUi("Erase {name}? Their name, email and phone are removed from every booking, order and membership. Those records stay for your books, shown as “Deleted customer”. This can't be undone.", { name: modal.customer.name })}
          </p>
          <ModalActions busy={busy} onCancel={close} onSave={erase} saveLabel={translateUi("Erase")} danger />
        </Modal>
      )}

      {modal?.kind === "view" && (
        <Modal title={detail?.customer.name ?? translateUi("Customer")} onClose={close}>
          {!detail ? (
            <p className="text-xs text-slate-400 py-6 text-center">{translateUi("Loading…")}</p>
          ) : (
            <div className="space-y-5 text-sm">
              <div>
                <p className="text-slate-700">{detail.customer.email}</p>
                {detail.customer.phone && <p className="text-slate-500">{detail.customer.phone}</p>}
                <p className="text-xs text-slate-400 mt-1">{translateUi("Customer since")} {fmtDate(detail.customer.createdAt, uiLocale)}</p>
                {detail.customer.notes && (
                  <p className="mt-2 text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-md px-3 py-2 whitespace-pre-wrap">{detail.customer.notes}</p>
                )}
              </div>

              <HistorySection title={translateUi("Bookings")} empty={translateUi("No bookings")} count={detail.history.bookings.length}>
                {detail.history.bookings.map((b) => (
                  <li key={b.id} className="flex justify-between gap-3 py-1.5 text-xs">
                    <span className="text-slate-700 truncate">
                      {fmtDate(b.appointmentDate, uiLocale)} {b.startTime?.slice(0, 5)} · {b.serviceName ?? "—"}{b.staffName ? ` · ${b.staffName}` : ""}
                    </span>
                    <span className="text-slate-400 shrink-0">{b.status}</span>
                  </li>
                ))}
              </HistorySection>

              <HistorySection title={translateUi("Orders")} empty={translateUi("No orders")} count={detail.history.orders.length}>
                {detail.history.orders.map((o) => (
                  <li key={o.id} className="flex justify-between gap-3 py-1.5 text-xs">
                    <Link to={`../shop/orders/${o.id}`} className="text-matcha-700 hover:underline truncate">
                      {o.orderNumber} · {fmtDate(o.createdAt, uiLocale)}
                    </Link>
                    <span className="text-slate-400 shrink-0">{formatPrice(o.total, o.currency, uiLocale)} · {o.status}</span>
                  </li>
                ))}
              </HistorySection>

              <HistorySection title={translateUi("Memberships")} empty={translateUi("No memberships")} count={detail.history.memberships.length}>
                {detail.history.memberships.map((m) => (
                  <li key={m.id} className="flex justify-between gap-3 py-1.5 text-xs">
                    <Link to={`../membership/members/${m.id}`} className="text-matcha-700 hover:underline truncate">{m.planName}</Link>
                    <span className="text-slate-400 shrink-0">{m.status}{m.currentPeriodEnd ? ` · ${fmtDate(m.currentPeriodEnd, uiLocale)}` : ""}</span>
                  </li>
                ))}
              </HistorySection>

              {detail.deleteBlockedReason && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">{detail.deleteBlockedReason}</p>
              )}
              <div className="flex justify-between pt-3 border-t border-slate-100">
                <button className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  disabled={!detail.canDelete} onClick={() => setModal({ kind: "del", customer: detail.customer })}>
                  <Trash2 className="w-3.5 h-3.5" /> {translateUi("Erase")}
                </button>
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 cursor-pointer"
                  onClick={() => openEdit(detail.customer)}>
                  <Pencil className="w-3 h-3" /> {translateUi("Edit")}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
      <Toast toast={toast} />
    </div>
  );
}

function HistorySection({ title, empty, count, children }: { title: string; empty: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{title} ({count})</h3>
      {count === 0 ? <p className="text-xs text-slate-400">{empty}</p> : <ul className="divide-y divide-slate-100 max-h-48 overflow-y-auto">{children}</ul>}
    </div>
  );
}
