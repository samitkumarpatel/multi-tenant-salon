import { useEffect, useMemo, useState } from "react";
import { Link, useLoaderData, useOutletContext } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { RefreshCcw, Check, X, Search, ChevronDown } from "lucide-react";
import { ADMIN_API, apiFetch, resolveSalonUUID } from "~/lib/api";
import { formatPrice } from "~/lib/constants";
import { relativeTime } from "~/lib/shopOrders";
import { Toast, useToast } from "@salon/ui-shared";
import type { ShopOrder, ShopRefundStatus } from "~/lib/types";
import type { ShopOutletContext } from "./shop";

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const sid = await resolveSalonUUID(params.salonId!);
  const orders = await apiFetch<ShopOrder[]>(`${ADMIN_API}/${sid}/shop/refunds`);
  return { sid, orders };
}

const ALL_STATUSES: ShopRefundStatus[] = ["PENDING", "APPROVED", "ACCEPTED", "REJECTED"];

const STATUS_STYLE: Record<string, string> = {
  PENDING:  "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED: "bg-sky-50 text-sky-700 border-sky-200",
  ACCEPTED: "bg-green-50 text-green-700 border-green-200",
  REJECTED: "bg-red-50 text-red-600 border-red-200",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending", APPROVED: "Approved", ACCEPTED: "Accepted", REJECTED: "Rejected",
};

const controlCls =
  "px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-700 outline-none focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10";

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center text-[0.65rem] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLE[status] ?? "bg-slate-100 text-slate-500 border-slate-200"}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function fmtDate(ts: string) {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StatusMenu({
  value, counts, onPick,
}: { value: ShopRefundStatus | "ALL"; counts: Partial<Record<string, number>>; onPick: (v: ShopRefundStatus | "ALL") => void }) {
  const [open, setOpen] = useState(false);
  const label = value === "ALL" ? "All refunds" : STATUS_LABEL[value] ?? value;
  const total = value === "ALL"
    ? ALL_STATUSES.reduce((n, s) => n + (counts[s] ?? 0), 0)
    : counts[value] ?? 0;

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`${controlCls} inline-flex items-center gap-2 font-semibold cursor-pointer`}
      >
        <span className="font-medium text-slate-400">Status</span>
        {label}
        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
          {total}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-1.5 w-48 z-50 bg-white border border-slate-200 rounded-xl shadow-lg py-1">
            {(["ALL", ...ALL_STATUSES] as (ShopRefundStatus | "ALL")[]).map((s) => {
              const active = value === s;
              const cnt = s === "ALL" ? ALL_STATUSES.reduce((n, x) => n + (counts[x] ?? 0), 0) : (counts[s] ?? 0);
              return (
                <button
                  key={s}
                  onClick={() => { onPick(s); setOpen(false); }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs text-left transition-colors ${active ? "bg-slate-50" : "hover:bg-slate-50"}`}
                >
                  <span className="inline-flex items-center gap-2">
                    <span className="w-3.5 flex justify-center shrink-0">
                      {active && <Check className="w-3.5 h-3.5 text-matcha-600" />}
                    </span>
                    {s === "ALL" ? <span className="font-medium text-slate-700">All refunds</span> : <StatusBadge status={s} />}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">{cnt}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function ShopRefunds() {
  useOutletContext<ShopOutletContext>();
  const { sid, orders: init } = useLoaderData<typeof clientLoader>();
  const [orders, setOrders] = useState<ShopOrder[]>(init);
  const [busy, setBusy] = useState<number | null>(null);
  const { toast, notify } = useToast();

  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<ShopRefundStatus | "ALL">("ALL");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");

  useEffect(() => {
    if (draft === q) return;
    const t = setTimeout(() => setQ(draft), 350);
    return () => clearTimeout(t);
  }, [draft, q]);

  const filtersActive = !!(q || statusFilter !== "ALL");

  const counts = useMemo(() => {
    const c: Partial<Record<string, number>> = {};
    for (const o of orders) if (o.refundStatus) c[o.refundStatus] = (c[o.refundStatus] ?? 0) + 1;
    return c;
  }, [orders]);

  const filtered = useMemo(() => {
    let list = [...orders];
    if (q.trim()) {
      const term = q.trim().toLowerCase();
      list = list.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(term) ||
          o.customerName.toLowerCase().includes(term) ||
          (o.refundReason ?? "").toLowerCase().includes(term),
      );
    }
    if (statusFilter !== "ALL") list = list.filter((o) => o.refundStatus === statusFilter);
    list.sort((a, b) => {
      const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return sort === "newest" ? diff : -diff;
    });
    return list;
  }, [orders, q, statusFilter, sort]);

  function clearFilters() { setDraft(""); setQ(""); setStatusFilter("ALL"); }

  async function action(order: ShopOrder, verb: "approve" | "accept" | "reject") {
    setBusy(order.id);
    try {
      const updated = await apiFetch<ShopOrder>(
        `${ADMIN_API}/${sid}/shop/orders/${order.id}/refunds/${verb}`,
        { method: "POST" },
      );
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      const msg =
        verb === "approve" ? "Refund approved — awaiting item return"
        : verb === "accept" ? "Refund accepted — credit note created"
        : "Refund rejected";
      notify(msg);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Error", "error");
    } finally {
      setBusy(null);
    }
  }

  if (orders.length === 0) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-3">
          <RefreshCcw className="w-5 h-5 text-slate-400" />
        </div>
        <h2 className="text-sm font-bold text-slate-800">No refunds yet</h2>
        <p className="text-xs text-slate-500 mt-1">Refunds initiated from order details appear here.</p>
      </div>
    );
  }

  return (
    <>
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search refunds…"
            className={`${controlCls} pl-8 pr-7 w-56`}
          />
          {draft && (
            <button
              onClick={() => { setDraft(""); setQ(""); }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <StatusMenu value={statusFilter} counts={counts} onPick={setStatusFilter} />

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value === "oldest" ? "oldest" : "newest")}
          className={`${controlCls} cursor-pointer`}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>

        {filtersActive && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      {/* ── Cards (below sm — a 7-column table has no room here and overflow-x-auto
             on a table isn't a discoverable mobile gesture) ─────────────────── */}
      <div className="sm:hidden flex flex-col gap-2">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 bg-white border border-slate-200 rounded-xl">No refunds match your filters.</div>
        ) : (
          filtered.map((o) => (
            <div key={o.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <Link to={`../orders/${o.id}`} className="font-mono text-xs text-blue-600 hover:underline">
                  {o.orderNumber}
                </Link>
                {o.refundStatus ? <StatusBadge status={o.refundStatus} /> : "—"}
              </div>
              <div className="mt-1.5 text-xs text-slate-600">{o.customerName}</div>
              {o.refundReason && <div className="text-xs text-slate-500 mt-0.5">{o.refundReason}</div>}
              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-400">
                <span>{fmtDate(o.createdAt)}</span>
                <span className="font-semibold text-slate-800">
                  {o.refundAmount != null ? formatPrice(o.refundAmount, o.currency) : "—"}
                </span>
              </div>
              {o.refundStatus === "PENDING" && (
                <div className="flex items-center gap-1.5 mt-2.5">
                  <button
                    disabled={busy === o.id}
                    onClick={() => action(o, "approve")}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md border border-green-200 text-xs font-medium text-green-700 bg-white hover:bg-green-50 cursor-pointer disabled:opacity-40"
                  >
                    <Check className="w-3 h-3" /> Approve
                  </button>
                  <button
                    disabled={busy === o.id}
                    onClick={() => action(o, "reject")}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md border border-red-200 text-xs font-medium text-red-600 bg-white hover:bg-red-50 cursor-pointer disabled:opacity-40"
                  >
                    <X className="w-3 h-3" /> Reject
                  </button>
                </div>
              )}
              {o.refundStatus === "APPROVED" && (
                <button
                  disabled={busy === o.id}
                  onClick={() => action(o, "accept")}
                  className="w-full mt-2.5 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md border border-blue-200 text-xs font-medium text-blue-700 bg-white hover:bg-blue-50 cursor-pointer disabled:opacity-40"
                >
                  <Check className="w-3 h-3" /> Accept
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* ── Table (sm and up) ────────────────────────────────────────────── */}
      <div className="hidden sm:block bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No refunds match your filters.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      to={`../orders/${o.id}`}
                      className="font-mono text-xs text-blue-600 hover:underline"
                    >
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{o.customerName}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    {o.refundAmount != null ? formatPrice(o.refundAmount, o.currency) : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{o.refundReason ?? "—"}</td>
                  <td className="px-4 py-3">
                    {o.refundStatus ? <StatusBadge status={o.refundStatus} /> : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{fmtDate(o.createdAt)}</td>
                  <td className="px-4 py-3">
                    {o.refundStatus === "PENDING" && (
                      <div className="flex items-center gap-1.5 justify-end">
                        <button
                          disabled={busy === o.id}
                          onClick={() => action(o, "approve")}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-green-200 text-xs font-medium text-green-700 bg-white hover:bg-green-50 cursor-pointer disabled:opacity-40"
                        >
                          <Check className="w-3 h-3" /> Approve
                        </button>
                        <button
                          disabled={busy === o.id}
                          onClick={() => action(o, "reject")}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-red-200 text-xs font-medium text-red-600 bg-white hover:bg-red-50 cursor-pointer disabled:opacity-40"
                        >
                          <X className="w-3 h-3" /> Reject
                        </button>
                      </div>
                    )}
                    {o.refundStatus === "APPROVED" && (
                      <button
                        disabled={busy === o.id}
                        onClick={() => action(o, "accept")}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-blue-200 text-xs font-medium text-blue-700 bg-white hover:bg-blue-50 cursor-pointer disabled:opacity-40"
                      >
                        <Check className="w-3 h-3" /> Accept
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="text-xs text-slate-400 mt-2">
        {filtered.length} of {orders.length} refund{orders.length === 1 ? "" : "s"}
      </div>

      <Toast toast={toast} />
    </>
  );
}
