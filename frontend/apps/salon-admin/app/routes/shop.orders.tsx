import { useEffect, useMemo, useState } from "react";
import { Link, useLoaderData, useOutletContext, useSearchParams } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { ClipboardList, ChevronRight, ChevronDown, ChevronLeft, Check, Search, X } from "lucide-react";
import { ADMIN_API, apiFetch, resolveSalonUUID } from "~/lib/api";
import { formatPrice } from "~/lib/constants";
import { ORDER_STATUS_LABEL, ORDER_STATUS_STYLE } from "~/lib/shopOrders";
import type { ShopOrdersPage } from "~/lib/shopOrders";
import type { ShopOrderStatus } from "~/lib/types";
import type { ShopOutletContext } from "./shop";

const FORWARDED = ["q", "status", "from", "to", "sort", "page"] as const;

export async function clientLoader({ request, params }: ClientLoaderFunctionArgs) {
  const sid = await resolveSalonUUID(params.salonId!);
  const incoming = new URL(request.url).searchParams;
  const qs = new URLSearchParams();
  for (const key of FORWARDED) {
    const v = incoming.get(key);
    if (v) qs.set(key, v);
  }
  const query = qs.toString();
  const page = await apiFetch<ShopOrdersPage>(
    `${ADMIN_API}/${sid}/shop/orders${query ? `?${query}` : ""}`,
  );
  return { page };
}

const ALL_STATUSES: ShopOrderStatus[] = ["NEW", "CONFIRMED", "PROCESSING", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "FULFILLED", "CANCELLED", "FAILED", "ON_HOLD"];
const STATUS_FILTERS: (ShopOrderStatus | "ALL")[] = ["ALL", ...ALL_STATUSES];

/** Per-status row tint + text shades tuned for contrast on that tint. */
const ORDER_ROW_STYLE: Record<
  ShopOrderStatus,
  { row: string; strong: string; muted: string; faint: string; link: string }
> = {
  NEW:          { row: "bg-slate-50 hover:bg-slate-100/80",     strong: "text-slate-800",  muted: "text-slate-500",  faint: "text-slate-400",    link: "text-slate-700" },
  CONFIRMED:    { row: "bg-sky-50/70 hover:bg-sky-100/70",      strong: "text-sky-900",    muted: "text-sky-700",    faint: "text-sky-500/80",   link: "text-sky-800" },
  PROCESSING:   { row: "bg-amber-50/70 hover:bg-amber-100/70",  strong: "text-amber-900",  muted: "text-amber-700",  faint: "text-amber-600/70", link: "text-amber-800" },
  READY_TO_SHIP:{ row: "bg-violet-50/70 hover:bg-violet-100/70",strong: "text-violet-900", muted: "text-violet-700", faint: "text-violet-500/80",link: "text-violet-800" },
  SHIPPED:      { row: "bg-blue-50/70 hover:bg-blue-100/70",    strong: "text-blue-900",   muted: "text-blue-700",   faint: "text-blue-500/80",  link: "text-blue-800" },
  DELIVERED:    { row: "bg-teal-50/70 hover:bg-teal-100/70",    strong: "text-teal-900",   muted: "text-teal-700",   faint: "text-teal-500/80",  link: "text-teal-800" },
  FULFILLED:    { row: "bg-green-50/70 hover:bg-green-100/70",  strong: "text-green-900",  muted: "text-green-700",  faint: "text-green-600/70", link: "text-green-800" },
  CANCELLED:    { row: "bg-red-50/60 hover:bg-red-100/60",      strong: "text-red-800",    muted: "text-red-600",    faint: "text-red-500/70",   link: "text-red-700" },
  FAILED:       { row: "bg-rose-50/60 hover:bg-rose-100/60",    strong: "text-rose-800",   muted: "text-rose-600",   faint: "text-rose-500/70",  link: "text-rose-700" },
  ON_HOLD:      { row: "bg-orange-50/60 hover:bg-orange-100/60",strong: "text-orange-800", muted: "text-orange-600", faint: "text-orange-500/70",link: "text-orange-700" },
};

const controlCls =
  "px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-700 outline-none focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10";

function StatusBadge({ status }: { status: ShopOrderStatus }) {
  return (
    <span className={`inline-flex items-center text-[0.65rem] font-semibold px-2 py-0.5 rounded-full border ${ORDER_STATUS_STYLE[status]}`}>
      {ORDER_STATUS_LABEL[status]}
    </span>
  );
}

function fmtDate(ts: string) {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ShopOrders() {
  useOutletContext<ShopOutletContext>();
  const { page } = useLoaderData<typeof clientLoader>();
  const [params, setParams] = useSearchParams();

  const q = params.get("q") ?? "";
  const status = (params.get("status") as ShopOrderStatus | null) ?? "ALL";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const sort = params.get("sort") === "oldest" ? "oldest" : "newest";

  const filtersActive = !!(q || params.get("status") || from || to);

  /** Merge a patch into the query string. Any change but an explicit page bump resets to page 0. */
  function update(patch: Record<string, string | null>) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v === null || v === "") next.delete(k);
          else next.set(k, v);
        }
        if (!("page" in patch)) next.delete("page");
        return next;
      },
      { replace: true },
    );
  }

  // Debounced search box — local draft, pushed to the URL after a pause.
  const [draft, setDraft] = useState(q);
  useEffect(() => setDraft(q), [q]);
  useEffect(() => {
    if (draft === q) return;
    const t = setTimeout(() => update({ q: draft || null }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const counts = page.statusCounts ?? {};
  const filterCount = (f: ShopOrderStatus | "ALL") =>
    f === "ALL"
      ? ALL_STATUSES.reduce((n, s) => n + (counts[s] ?? 0), 0)
      : counts[f] ?? 0;

  const orders = page.content;
  const { totalElements, totalPages, page: pageIdx } = page;
  const rangeStart = totalElements === 0 ? 0 : pageIdx * page.size + 1;
  const rangeEnd = pageIdx * page.size + orders.length;

  const firstEverEmpty = totalElements === 0 && !filtersActive;

  if (firstEverEmpty) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
        <div className="w-10 h-10 rounded-xl bg-matcha-50 border border-matcha-100 flex items-center justify-center mx-auto mb-3">
          <ClipboardList className="w-5 h-5 text-matcha-600" />
        </div>
        <h2 className="text-sm font-bold text-slate-800">No orders yet</h2>
        <p className="text-xs text-slate-500 mt-1">Orders placed from your public shop appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && update({ q: draft || null })}
            placeholder="Search orders…"
            className={`${controlCls} pl-8 pr-7 w-60`}
          />
          {draft && (
            <button
              onClick={() => setDraft("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <StatusMenu value={status} count={filterCount} onPick={(f) => update({ status: f === "ALL" ? null : f })} />

        <select
          value={sort}
          onChange={(e) => update({ sort: e.target.value === "oldest" ? "oldest" : null })}
          className={`${controlCls} cursor-pointer`}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>

        <div className="inline-flex items-center gap-1.5 text-xs text-slate-400">
          From
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => update({ from: e.target.value || null })}
            className={`${controlCls} cursor-pointer`}
          />
          To
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => update({ to: e.target.value || null })}
            className={`${controlCls} cursor-pointer`}
          />
        </div>

        {filtersActive && (
          <button
            onClick={() => setParams(new URLSearchParams(), { replace: true })}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
        {orders.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No orders match your filters.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white">
              {orders.map((o) => {
                const items = o.lines.reduce((n, l) => n + l.quantity, 0);
                const st = ORDER_ROW_STYLE[o.status];
                return (
                  <tr
                    key={o.id}
                    className={`${st.row} transition-colors cursor-pointer group`}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("a,button")) return;
                      (e.currentTarget.querySelector("a[data-row-link]") as HTMLAnchorElement | null)?.click();
                    }}
                  >
                    <td className={`px-4 py-3 font-mono text-xs font-semibold ${st.strong}`}>{o.orderNumber}</td>
                    <td className={`px-4 py-3 ${st.muted}`}>{fmtDate(o.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className={st.strong}>{o.customerName}</div>
                      <div className={`text-[11px] ${st.faint}`}>{o.customerEmail}</div>
                    </td>
                    <td className={`px-4 py-3 ${st.muted}`}>{items}</td>
                    <td className={`px-4 py-3 font-semibold ${st.strong}`}>{formatPrice(o.subtotal, o.currency)}</td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        data-row-link
                        to={`${o.id}`}
                        className={`inline-flex items-center gap-1 text-xs font-medium ${st.link} group-hover:underline`}
                      >
                        View <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>
          {totalElements === 0
            ? "No orders"
            : `${rangeStart}–${rangeEnd} of ${totalElements} order${totalElements === 1 ? "" : "s"}`}
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              disabled={pageIdx <= 0}
              onClick={() => update({ page: String(pageIdx - 1) })}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </button>
            <span className="px-2 tabular-nums">
              Page {pageIdx + 1} / {totalPages}
            </span>
            <button
              disabled={pageIdx >= totalPages - 1}
              onClick={() => update({ page: String(pageIdx + 1) })}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Status dropdown ──────────────────────────────────────────────────────────

function StatusMenu({
  value,
  count,
  onPick,
}: {
  value: ShopOrderStatus | "ALL";
  count: (f: ShopOrderStatus | "ALL") => number;
  onPick: (f: ShopOrderStatus | "ALL") => void;
}) {
  const [open, setOpen] = useState(false);
  const label = useMemo(() => (value === "ALL" ? "All orders" : ORDER_STATUS_LABEL[value]), [value]);

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`${controlCls} inline-flex items-center gap-2 font-semibold cursor-pointer`}
      >
        <span className="font-medium text-slate-400">Status</span>
        {label}
        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
          {count(value)}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-1.5 w-56 z-50 bg-white border border-slate-200 rounded-xl shadow-lg py-1">
            {STATUS_FILTERS.map((f) => {
              const active = value === f;
              return (
                <button
                  key={f}
                  onClick={() => {
                    onPick(f);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs text-left transition-colors ${
                    active ? "bg-slate-50" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <span className="w-3.5 flex justify-center shrink-0">
                      {active && <Check className="w-3.5 h-3.5 text-matcha-600" />}
                    </span>
                    {f === "ALL" ? (
                      <span className="font-medium text-slate-700">All orders</span>
                    ) : (
                      <StatusBadge status={f} />
                    )}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">{count(f)}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
