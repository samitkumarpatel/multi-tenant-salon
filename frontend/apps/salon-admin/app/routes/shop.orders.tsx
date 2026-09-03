import { useState } from "react";
import { Link, useLoaderData, useOutletContext } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { ClipboardList, ChevronRight } from "lucide-react";
import { ADMIN_API, apiFetch, resolveSalonUUID } from "~/lib/api";
import { formatPrice } from "~/lib/constants";
import { ORDER_STATUS_LABEL, ORDER_STATUS_STYLE } from "~/lib/shopOrders";
import type { ShopOrder, ShopOrderStatus } from "~/lib/types";
import type { ShopOutletContext } from "./shop";

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const sid = await resolveSalonUUID(params.salonId!);
  const orders = await apiFetch<ShopOrder[]>(`${ADMIN_API}/${sid}/shop/orders`);
  return { orders };
}

const ALL_STATUSES: ShopOrderStatus[] = ["NEW", "PROCESSING", "SHIPPED", "FULFILLED", "CANCELLED"];

function StatusBadge({ status }: { status: ShopOrderStatus }) {
  return (
    <span
      className={`inline-flex items-center text-[0.65rem] font-semibold px-2 py-0.5 rounded-full border ${ORDER_STATUS_STYLE[status]}`}
    >
      {ORDER_STATUS_LABEL[status]}
    </span>
  );
}

function fmtDate(ts: string) {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ShopOrders() {
  useOutletContext<ShopOutletContext>();
  const { orders } = useLoaderData<typeof clientLoader>();
  const [filter, setFilter] = useState<ShopOrderStatus | "ALL">("ALL");

  const counts = ALL_STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = orders.filter((o) => o.status === s).length;
    return acc;
  }, {});

  const visible = filter === "ALL" ? orders : orders.filter((o) => o.status === filter);

  if (orders.length === 0) {
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
      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("ALL")}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
            filter === "ALL"
              ? "bg-slate-700 text-white border-slate-700"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          }`}
        >
          All
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
            {orders.length}
          </span>
        </button>
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              filter === s
                ? "bg-slate-700 text-white border-slate-700"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {ORDER_STATUS_LABEL[s]}
            {counts[s] > 0 && (
              <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                filter === s ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              }`}>
                {counts[s]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
        {visible.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No {ORDER_STATUS_LABEL[filter as ShopOrderStatus]} orders.
          </div>
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
            <tbody className="divide-y divide-slate-100">
              {visible.map((o) => {
                const items = o.lines.reduce((n, l) => n + l.quantity, 0);
                return (
                  <tr
                    key={o.id}
                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("a,button")) return;
                      (e.currentTarget.querySelector("a[data-row-link]") as HTMLAnchorElement | null)?.click();
                    }}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800">{o.orderNumber}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(o.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="text-slate-800">{o.customerName}</div>
                      <div className="text-[11px] text-slate-400">{o.customerEmail}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{items}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{formatPrice(o.subtotal, o.currency)}</td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        data-row-link
                        to={`${o.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-matcha-700 group-hover:text-matcha-800"
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
    </div>
  );
}
