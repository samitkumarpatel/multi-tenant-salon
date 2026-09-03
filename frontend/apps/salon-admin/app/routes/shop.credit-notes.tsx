import { useState } from "react";
import { useLoaderData, useOutletContext } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { Receipt, Banknote } from "lucide-react";
import { ADMIN_API, apiFetch, resolveSalonUUID } from "~/lib/api";
import { formatPrice } from "~/lib/constants";
import { relativeTime } from "~/lib/shopOrders";
import { Toast, useToast } from "@salon/ui-shared";
import type { ShopCreditNote } from "~/lib/types";
import type { ShopOutletContext } from "./shop";

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const sid = await resolveSalonUUID(params.salonId!);
  const creditNotes = await apiFetch<ShopCreditNote[]>(`${ADMIN_API}/${sid}/shop/credit-notes`);
  return { sid, creditNotes };
}

const CN_STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  PAID:    "bg-green-50 text-green-700 border-green-200",
};

export default function ShopCreditNotes() {
  useOutletContext<ShopOutletContext>();
  const { sid, creditNotes: init } = useLoaderData<typeof clientLoader>();
  const [creditNotes, setCreditNotes] = useState<ShopCreditNote[]>(init);
  const [busy, setBusy] = useState<number | null>(null);
  const { toast, notify } = useToast();

  async function payCreditNote(cn: ShopCreditNote) {
    setBusy(cn.id);
    try {
      const updated = await apiFetch<ShopCreditNote>(
        `${ADMIN_API}/${sid}/shop/credit-notes/${cn.id}/pay`,
        { method: "POST" },
      );
      setCreditNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      notify("Credit note marked as paid");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Error", "error");
    } finally {
      setBusy(null);
    }
  }

  if (creditNotes.length === 0) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-3">
          <Receipt className="w-5 h-5 text-slate-400" />
        </div>
        <h2 className="text-sm font-bold text-slate-800">No credit notes yet</h2>
        <p className="text-xs text-slate-500 mt-1">Credit notes appear here once a refund is accepted.</p>
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
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {creditNotes.map((cn) => (
              <tr key={cn.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-mono text-slate-700 text-xs">#{cn.orderId}</td>
                <td className="px-4 py-3 text-slate-600 text-xs">{cn.reference ?? "—"}</td>
                <td className="px-4 py-3 font-semibold text-slate-800">{formatPrice(cn.amount, "USD")}</td>
                <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{cn.reason ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center text-[0.65rem] font-semibold px-2 py-0.5 rounded-full border ${CN_STATUS_STYLE[cn.status ?? "PENDING"] ?? ""}`}>
                    {cn.status ?? "Pending"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">{relativeTime(cn.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  {(cn.status === "PENDING" || !cn.status) && (
                    <button
                      disabled={busy === cn.id}
                      onClick={() => payCreditNote(cn)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-green-200 text-xs font-medium text-green-700 bg-white hover:bg-green-50 cursor-pointer disabled:opacity-40"
                    >
                      <Banknote className="w-3 h-3" /> Pay back
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
