import { useState } from "react";
import { useLoaderData, useOutletContext } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { RefreshCcw, Check, X } from "lucide-react";
import { ADMIN_API, apiFetch, resolveSalonUUID } from "~/lib/api";
import { formatPrice } from "~/lib/constants";
import { relativeTime } from "~/lib/shopOrders";
import { Toast, useToast } from "@salon/ui-shared";
import type { ShopRefund } from "~/lib/types";
import type { ShopOutletContext } from "./shop";

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const sid = await resolveSalonUUID(params.salonId!);
  const refunds = await apiFetch<ShopRefund[]>(`${ADMIN_API}/${sid}/shop/refunds`);
  return { sid, refunds };
}

const REFUND_STYLE: Record<string, string> = {
  PENDING:  "bg-amber-50 text-amber-700 border-amber-200",
  ACCEPTED: "bg-green-50 text-green-700 border-green-200",
  REJECTED: "bg-red-50 text-red-600 border-red-200",
};

export default function ShopRefunds() {
  useOutletContext<ShopOutletContext>();
  const { sid, refunds: init } = useLoaderData<typeof clientLoader>();
  const [refunds, setRefunds] = useState<ShopRefund[]>(init);
  const [busy, setBusy] = useState<number | null>(null);
  const { toast, notify } = useToast();

  async function action(refund: ShopRefund, verb: "accept" | "reject") {
    setBusy(refund.id);
    try {
      const updated = await apiFetch<ShopRefund>(
        `${ADMIN_API}/${sid}/shop/refunds/${refund.id}/${verb}`,
        { method: "POST" },
      );
      setRefunds((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      notify(verb === "accept" ? "Refund accepted — credit note created" : "Refund rejected");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Error", "error");
    } finally {
      setBusy(null);
    }
  }

  if (refunds.length === 0) {
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
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {refunds.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-mono text-slate-700 text-xs">#{r.orderId}</td>
                <td className="px-4 py-3 font-semibold text-slate-800">{formatPrice(r.amount, "USD")}</td>
                <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{r.reason ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center text-[0.65rem] font-semibold px-2 py-0.5 rounded-full border ${REFUND_STYLE[r.status] ?? ""}`}>
                    {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">{relativeTime(r.createdAt)}</td>
                <td className="px-4 py-3">
                  {r.status === "PENDING" && (
                    <div className="flex items-center gap-1.5 justify-end">
                      <button
                        disabled={busy === r.id}
                        onClick={() => action(r, "accept")}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-green-200 text-xs font-medium text-green-700 bg-white hover:bg-green-50 cursor-pointer disabled:opacity-40"
                      >
                        <Check className="w-3 h-3" /> Accept
                      </button>
                      <button
                        disabled={busy === r.id}
                        onClick={() => action(r, "reject")}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-red-200 text-xs font-medium text-red-600 bg-white hover:bg-red-50 cursor-pointer disabled:opacity-40"
                      >
                        <X className="w-3 h-3" /> Reject
                      </button>
                    </div>
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
