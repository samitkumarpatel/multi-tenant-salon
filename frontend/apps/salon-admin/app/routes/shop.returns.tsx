import { useState } from "react";
import { Link, useLoaderData, useOutletContext } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { RotateCcw, ChevronRight, Check, X } from "lucide-react";
import { ADMIN_API, apiFetch, resolveSalonUUID } from "~/lib/api";
import { RETURN_STATUS_LABEL, RETURN_STATUS_STYLE, relativeTime } from "~/lib/shopOrders";
import { Toast, useToast } from "@salon/ui-shared";
import type { ShopOrder } from "~/lib/types";
import type { ShopOutletContext } from "./shop";

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const sid = await resolveSalonUUID(params.salonId!);
  const orders = await apiFetch<ShopOrder[]>(`${ADMIN_API}/${sid}/shop/returns`);
  return { sid, orders };
}

export default function ShopReturns() {
  useOutletContext<ShopOutletContext>();
  const { sid, orders: init } = useLoaderData<typeof clientLoader>();
  const [orders, setOrders] = useState<ShopOrder[]>(init);
  const [busy, setBusy] = useState<number | null>(null);
  const { toast, notify } = useToast();

  async function updateStatus(order: ShopOrder, status: string) {
    setBusy(order.id);
    try {
      const updated = await apiFetch<ShopOrder>(
        `${ADMIN_API}/${sid}/shop/orders/${order.id}/returns/status`,
        { method: "POST", body: JSON.stringify({ status, notes: null }) },
      );
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      notify(`Return ${status === "APPROVED" ? "approved" : status === "REJECTED" ? "rejected" : "updated"}`);
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
          <RotateCcw className="w-5 h-5 text-slate-400" />
        </div>
        <h2 className="text-sm font-bold text-slate-800">No returns yet</h2>
        <p className="text-xs text-slate-500 mt-1">Return requests from customers appear here.</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <Link
                    to={`../orders/${o.id}`}
                    className="text-xs text-blue-600 hover:underline font-medium inline-flex items-center gap-1"
                  >
                    {o.orderNumber} <ChevronRight className="w-3 h-3" />
                  </Link>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">{o.customerName}</td>
                <td className="px-4 py-3">
                  {o.returnStatus && (
                    <span className={`inline-flex items-center text-[0.65rem] font-semibold px-2 py-0.5 rounded-full border ${RETURN_STATUS_STYLE[o.returnStatus] ?? "bg-slate-100 text-slate-500 border-slate-200"}`}>
                      {RETURN_STATUS_LABEL[o.returnStatus] ?? o.returnStatus}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs max-w-xs truncate">{o.returnReason ?? "—"}</td>
                <td className="px-4 py-3 text-slate-400 text-xs">
                  {o.returnUpdatedAt ? relativeTime(o.returnUpdatedAt) : relativeTime(o.createdAt)}
                </td>
                <td className="px-4 py-3">
                  {o.returnStatus === "REQUESTED" && (
                    <div className="flex items-center gap-1.5 justify-end">
                      <button
                        disabled={busy === o.id}
                        onClick={() => updateStatus(o, "APPROVED")}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-green-200 text-xs font-medium text-green-700 bg-white hover:bg-green-50 cursor-pointer disabled:opacity-40"
                      >
                        <Check className="w-3 h-3" /> Approve
                      </button>
                      <button
                        disabled={busy === o.id}
                        onClick={() => updateStatus(o, "REJECTED")}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-red-200 text-xs font-medium text-red-600 bg-white hover:bg-red-50 cursor-pointer disabled:opacity-40"
                      >
                        <X className="w-3 h-3" /> Reject
                      </button>
                    </div>
                  )}
                  {o.returnStatus === "APPROVED" && (
                    <button
                      disabled={busy === o.id}
                      onClick={() => updateStatus(o, "RECEIVED")}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 cursor-pointer disabled:opacity-40"
                    >
                      Mark Received
                    </button>
                  )}
                  {o.returnStatus === "RECEIVED" && (
                    <button
                      disabled={busy === o.id}
                      onClick={() => updateStatus(o, "ACCEPTED")}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-green-200 text-xs font-medium text-green-700 bg-white hover:bg-green-50 cursor-pointer disabled:opacity-40"
                    >
                      <Check className="w-3 h-3" /> Accept Return
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Toast toast={toast} />
    </>
  );
}
