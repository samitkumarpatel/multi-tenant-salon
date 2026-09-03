import { useLoaderData, useOutletContext } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { FileText, Printer } from "lucide-react";
import { ADMIN_API, apiFetch, resolveSalonUUID } from "~/lib/api";
import { formatPrice } from "~/lib/constants";
import { ORDER_STATUS_LABEL, ORDER_STATUS_STYLE } from "~/lib/shopOrders";
import type { ShopOrder } from "~/lib/types";
import type { ShopOutletContext } from "./shop";

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const sid = await resolveSalonUUID(params.salonId!);
  const orders = await apiFetch<ShopOrder[]>(`${ADMIN_API}/${sid}/shop/orders`);
  return { orders: orders.filter((o) => o.paymentStatus === "PAID") };
}

function fmtDate(ts: string) {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function invoiceNumber(order: ShopOrder) {
  return `INV-${order.orderNumber}`;
}

export default function ShopInvoices() {
  useOutletContext<ShopOutletContext>();
  const { orders } = useLoaderData<typeof clientLoader>();

  if (orders.length === 0) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-3">
          <FileText className="w-5 h-5 text-slate-400" />
        </div>
        <h2 className="text-sm font-bold text-slate-800">No invoices yet</h2>
        <p className="text-xs text-slate-500 mt-1">Invoices appear here once an order is paid.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {orders.map((o) => (
        <div key={o.id} className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2.5 mb-0.5">
                <span className="text-sm font-bold text-slate-900 font-mono">{invoiceNumber(o)}</span>
                <span className={`inline-flex items-center text-[0.65rem] font-semibold px-2 py-0.5 rounded-full border ${ORDER_STATUS_STYLE[o.status]}`}>
                  {ORDER_STATUS_LABEL[o.status]}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {o.customerName} · {o.customerEmail} · {fmtDate(o.createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-base font-extrabold text-slate-900">{formatPrice(o.subtotal, o.currency)}</span>
              <button
                onClick={() => {
                  const w = window.open("", "_blank");
                  if (!w) return;
                  w.document.write(`
                    <html><head><title>${invoiceNumber(o)}</title>
                    <style>
                      body { font-family: system-ui, sans-serif; padding: 40px; color: #1e293b; }
                      h1 { font-size: 22px; margin-bottom: 4px; }
                      .meta { color: #64748b; font-size: 13px; margin-bottom: 24px; }
                      table { width: 100%; border-collapse: collapse; font-size: 13px; }
                      th { text-align: left; border-bottom: 2px solid #e2e8f0; padding: 6px 8px; color: #64748b; font-weight: 600; }
                      td { padding: 8px; border-bottom: 1px solid #f1f5f9; }
                      .total { font-weight: 700; font-size: 15px; }
                    </style></head><body>
                    <h1>${invoiceNumber(o)}</h1>
                    <div class="meta">Order ${o.orderNumber} · ${o.customerName} &lt;${o.customerEmail}&gt; · ${fmtDate(o.createdAt)}</div>
                    <table>
                      <thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead>
                      <tbody>
                        ${o.lines.map((l) => `<tr>
                          <td>${l.productName}${l.variantLabel ? ` · ${l.variantLabel}` : ""}</td>
                          <td>${l.quantity}</td>
                          <td>${formatPrice(l.unitPrice, o.currency)}</td>
                          <td>${formatPrice(l.lineTotal, o.currency)}</td>
                        </tr>`).join("")}
                        <tr><td colspan="3" style="text-align:right" class="total">Total</td>
                          <td class="total">${formatPrice(o.subtotal, o.currency)}</td></tr>
                      </tbody>
                    </table>
                  </body></html>`);
                  w.document.close();
                  w.print();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex flex-col gap-1">
              {o.lines.map((l) => (
                <div key={l.id} className="flex items-center justify-between text-xs text-slate-600">
                  <span>{l.quantity} × {l.productName}{l.variantLabel ? ` · ${l.variantLabel}` : ""}</span>
                  <span className="font-medium">{formatPrice(l.lineTotal, o.currency)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
