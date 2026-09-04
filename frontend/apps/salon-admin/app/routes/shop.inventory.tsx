import { useState } from "react";
import { useLoaderData, useOutletContext } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { AlertTriangle, Boxes, Check } from "lucide-react";
import { ADMIN_API, apiFetch, resolveSalonUUID } from "~/lib/api";
import { formatPrice } from "~/lib/constants";
import { Toast, useToast } from "@salon/ui-shared";
import type { ShopInventoryRow } from "~/lib/types";
import type { ShopOutletContext } from "./shop";

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const sid = await resolveSalonUUID(params.salonId!);
  const rows = await apiFetch<ShopInventoryRow[]>(`${ADMIN_API}/${sid}/shop/inventory`);
  return { sid, rows };
}

const numCls =
  "w-20 px-2 py-1.5 border border-slate-200 rounded-md text-sm outline-none focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 bg-white text-slate-900";

export default function ShopInventory() {
  useOutletContext<ShopOutletContext>();
  const { sid, rows: init } = useLoaderData<typeof clientLoader>();
  const [rows, setRows] = useState<ShopInventoryRow[]>(init);
  const [draft, setDraft] = useState<Record<number, { quantityOnHand: string; reorderLevel: string }>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const { toast, notify } = useToast();

  const rowDraft = (r: ShopInventoryRow) =>
    draft[r.variantId] ?? { quantityOnHand: String(r.quantityOnHand), reorderLevel: String(r.reorderLevel) };

  const dirty = (r: ShopInventoryRow) => {
    const d = draft[r.variantId];
    if (!d) return false;
    return Number(d.quantityOnHand) !== r.quantityOnHand || Number(d.reorderLevel) !== r.reorderLevel;
  };

  function edit(variantId: number, patch: Partial<{ quantityOnHand: string; reorderLevel: string }>) {
    setDraft((p) => {
      const r = rows.find((x) => x.variantId === variantId)!;
      const base = p[variantId] ?? { quantityOnHand: String(r.quantityOnHand), reorderLevel: String(r.reorderLevel) };
      return { ...p, [variantId]: { ...base, ...patch } };
    });
  }

  async function save(r: ShopInventoryRow) {
    const d = rowDraft(r);
    setSavingId(r.variantId);
    try {
      const updated = await apiFetch<ShopInventoryRow>(`${ADMIN_API}/${sid}/shop/inventory/${r.variantId}`, {
        method: "PUT",
        body: JSON.stringify({
          quantityOnHand: Math.max(0, parseInt(d.quantityOnHand, 10) || 0),
          reorderLevel: Math.max(0, parseInt(d.reorderLevel, 10) || 0),
        }),
      });
      setRows((p) => p.map((x) => (x.variantId === updated.variantId ? updated : x)));
      setDraft((p) => {
        const { [r.variantId]: _, ...rest } = p;
        return rest;
      });
      notify("Stock updated");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Error", "error");
    } finally {
      setSavingId(null);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
        <div className="w-10 h-10 rounded-xl bg-matcha-50 border border-matcha-100 flex items-center justify-center mx-auto mb-3">
          <Boxes className="w-5 h-5 text-matcha-600" />
        </div>
        <h2 className="text-sm font-bold text-slate-800">Nothing to track yet</h2>
        <p className="text-xs text-slate-500 mt-1">Add a product with variants and its stock shows up here.</p>
      </div>
    );
  }

  const lowCount = rows.filter((r) => r.active && r.quantityOnHand <= r.reorderLevel).length;

  return (
    <>
      {lowCount > 0 && (
        <div className="mb-4 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {lowCount} variant{lowCount !== 1 ? "s are" : " is"} at or below the reorder level.
        </div>
      )}

      {/* ── Cards (below sm — a 7-column table has no room here and overflow-x-auto
             on a table isn't a discoverable mobile gesture) ─────────────────── */}
      <div className="sm:hidden flex flex-col gap-2">
        {rows.map((r) => {
          const d = rowDraft(r);
          const low = r.active && r.quantityOnHand <= r.reorderLevel;
          return (
            <div key={r.variantId} className={`rounded-xl border border-slate-200 px-4 py-3 ${low ? "bg-amber-50/40" : "bg-white"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-800 truncate">{r.productName}</span>
                <span className="text-slate-600 text-xs shrink-0">{formatPrice(r.price, r.currency)}</span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {r.label || "Standard"}{r.sku ? ` · ${r.sku}` : ""}
                {!r.productActive && <span> · (product inactive)</span>}
              </div>
              <div className="flex items-end gap-2 mt-2.5">
                <label className="flex flex-col gap-1 flex-1 min-w-0">
                  <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">In stock</span>
                  <input
                    type="number"
                    min="0"
                    className={`${numCls} w-full`}
                    value={d.quantityOnHand}
                    onChange={(e) => edit(r.variantId, { quantityOnHand: e.target.value })}
                  />
                </label>
                <label className="flex flex-col gap-1 flex-1 min-w-0">
                  <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Reorder at</span>
                  <input
                    type="number"
                    min="0"
                    className={`${numCls} w-full`}
                    value={d.reorderLevel}
                    onChange={(e) => edit(r.variantId, { reorderLevel: e.target.value })}
                  />
                </label>
                <button
                  disabled={!dirty(r) || savingId === r.variantId}
                  onClick={() => save(r)}
                  className="shrink-0 inline-flex items-center gap-1 px-2.5 py-2 rounded-md bg-matcha-600 text-white text-xs font-medium hover:bg-matcha-700 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Check className="w-3 h-3" /> Save
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Table (sm and up) ────────────────────────────────────────────── */}
      <div className="hidden sm:block bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100">
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Variant</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">In stock</th>
              <th className="px-4 py-3">Reorder at</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const d = rowDraft(r);
              const low = r.active && r.quantityOnHand <= r.reorderLevel;
              return (
                <tr key={r.variantId} className={low ? "bg-amber-50/40" : ""}>
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-slate-800">{r.productName}</span>
                    {!r.productActive && <span className="ml-2 text-[10px] text-slate-400">(product inactive)</span>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{r.label || "Standard"}</td>
                  <td className="px-4 py-2.5 text-slate-400">{r.sku || "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{formatPrice(r.price, r.currency)}</td>
                  <td className="px-4 py-2.5">
                    <input
                      type="number"
                      min="0"
                      className={numCls}
                      value={d.quantityOnHand}
                      onChange={(e) => edit(r.variantId, { quantityOnHand: e.target.value })}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      type="number"
                      min="0"
                      className={numCls}
                      value={d.reorderLevel}
                      onChange={(e) => edit(r.variantId, { reorderLevel: e.target.value })}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      disabled={!dirty(r) || savingId === r.variantId}
                      onClick={() => save(r)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-matcha-600 text-white text-xs font-medium hover:bg-matcha-700 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Check className="w-3 h-3" /> {savingId === r.variantId ? "Saving…" : "Save"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Toast toast={toast} />
    </>
  );
}
