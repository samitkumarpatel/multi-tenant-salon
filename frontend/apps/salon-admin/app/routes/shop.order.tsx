import { useState } from "react";
import { Link, useLoaderData, useOutletContext } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import {
  ArrowLeft, Banknote, Bell, Check, CheckCheck, FileText, Mail,
  MapPin, Package, Phone, Receipt, RefreshCcw, Send, Truck, X,
  RotateCcw,
} from "lucide-react";
import { ADMIN_API, apiFetch, resolveSalonUUID } from "~/lib/api";
import { formatPrice } from "~/lib/constants";
import {
  ORDER_STATUS_LABEL, ORDER_STATUS_STYLE, relativeTime,
  RETURN_STATUS_LABEL, RETURN_STATUS_STYLE,
} from "~/lib/shopOrders";
import { Toast, useToast } from "@salon/ui-shared";
import type { ShopOrder, ShopOrderActivity, ShopOrderActivityType, ShopOrderStatus } from "~/lib/types";
import type { ShopOutletContext } from "./shop";

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const sid = await resolveSalonUUID(params.salonId!);
  const order = await apiFetch<ShopOrder>(`${ADMIN_API}/${sid}/shop/orders/${params.orderId}`);
  return { sid, order };
}

const ACTIVITY_META: Partial<Record<ShopOrderActivityType | string, { label: string; dot: string; color?: string }>> = {
  ORDER_PLACED:        { label: "Order placed",         dot: "bg-blue-500" },
  INVOICE_SENT:        { label: "Invoice sent",          dot: "bg-indigo-500" },
  STATUS_CHANGED:      { label: "Status updated",        dot: "bg-amber-500" },
  REFUND_INITIATED:    { label: "Refund initiated",      dot: "bg-orange-500", color: "text-orange-600" },
  REFUND_APPROVED:     { label: "Refund approved",       dot: "bg-sky-500",    color: "text-sky-600" },
  REFUND_ACCEPTED:     { label: "Refund accepted",       dot: "bg-green-500",  color: "text-green-600" },
  REFUND_REJECTED:     { label: "Refund rejected",       dot: "bg-red-500",    color: "text-red-600" },
  CREDIT_PAID:         { label: "Credit paid back",      dot: "bg-green-600",  color: "text-green-700" },
  SHIPMENT_CREATED:    { label: "Shipment dispatched",   dot: "bg-teal-500",   color: "text-teal-600" },
  RETURN_REQUESTED:    { label: "Return requested",      dot: "bg-orange-400", color: "text-orange-600" },
  RETURN_UPDATED:      { label: "Return updated",        dot: "bg-orange-500", color: "text-orange-700" },
  CUSTOMER_NOTIFIED:   { label: "Customer notified",     dot: "bg-blue-400" },
  WORK_NOTE:           { label: "Internal note",         dot: "bg-slate-300" },
};

const CARRIERS = ["DHL", "UPS", "FedEx", "TNT", "PostNL", "Royal Mail", "USPS", "DPD", "GLS", "Hermes", "Other"];

const inputCls =
  "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 bg-white text-slate-900";

const REFUND_STATUS_STYLE: Record<string, string> = {
  PENDING:  "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED: "bg-sky-50 text-sky-700 border-sky-200",
  ACCEPTED: "bg-green-50 text-green-700 border-green-200",
  REJECTED: "bg-red-50 text-red-600 border-red-200",
};
const CN_STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  PAID:    "bg-green-50 text-green-700 border-green-200",
};

type ModalKind =
  | { kind: "notify" }
  | { kind: "notify-line"; lineId: number; productName: string }
  | { kind: "shipping" }
  | { kind: "refunds" }
  | { kind: "credit-notes" }
  | { kind: "create-return" };

export default function ShopOrderDetail() {
  useOutletContext<ShopOutletContext>();
  const { sid, order: init } = useLoaderData<typeof clientLoader>();
  const [order, setOrder] = useState<ShopOrder>(init);
  const [busy, setBusy] = useState(false);
  const { toast, notify } = useToast();

  const [modal, setModal] = useState<ModalKind | null>(null);
  const [notifyMsg, setNotifyMsg] = useState("");
  const [trackingCarrier, setTrackingCarrier] = useState(order.trackingCarrier ?? "");
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber ?? "");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [noteText, setNoteText] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [openEmail, setOpenEmail] = useState<number | null>(null);

  function closeModal() { setModal(null); }

  async function apiAction<T>(call: () => Promise<T>, onSuccess: (r: T) => void, msg: string) {
    setBusy(true);
    try {
      onSuccess(await call());
      notify(msg);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Error", "error");
    } finally {
      setBusy(false);
    }
  }

  const updateOrder = (o: ShopOrder) => {
    setOrder(o);
    setTrackingCarrier(o.trackingCarrier ?? "");
    setTrackingNumber(o.trackingNumber ?? "");
  };

  async function setStatus(status: ShopOrderStatus) {
    await apiAction(
      () => apiFetch<ShopOrder>(`${ADMIN_API}/${sid}/shop/orders/${order.id}/status`, {
        method: "POST", body: JSON.stringify({ status }),
      }),
      updateOrder, `Order marked ${ORDER_STATUS_LABEL[status].toLowerCase()}`,
    );
  }

  async function sendInvoice() {
    await apiAction(
      () => apiFetch<ShopOrder>(`${ADMIN_API}/${sid}/shop/orders/${order.id}/invoice`, { method: "POST" }),
      updateOrder, "Invoice sent — customer notified",
    );
  }

  async function submitNotify() {
    if (!notifyMsg.trim()) return;
    if (modal?.kind === "notify") {
      await apiAction(
        () => apiFetch<ShopOrder>(`${ADMIN_API}/${sid}/shop/orders/${order.id}/notify`, {
          method: "POST", body: JSON.stringify({ message: notifyMsg }),
        }),
        updateOrder, "Customer notified",
      );
    } else if (modal?.kind === "notify-line") {
      await apiAction(
        () => apiFetch<ShopOrder>(
          `${ADMIN_API}/${sid}/shop/orders/${order.id}/lines/${modal.lineId}/notify`,
          { method: "POST", body: JSON.stringify({ message: notifyMsg }) },
        ),
        updateOrder, "Customer notified",
      );
    }
    closeModal(); setNotifyMsg("");
  }

  async function submitShipping() {
    if (!trackingCarrier.trim() && !trackingNumber.trim()) return;
    await apiAction(
      () => apiFetch<ShopOrder>(`${ADMIN_API}/${sid}/shop/orders/${order.id}/shipping`, {
        method: "POST", body: JSON.stringify({ carrier: trackingCarrier, trackingNumber }),
      }),
      updateOrder, "Shipping saved — customer notified",
    );
    closeModal();
  }

  async function submitRefund() {
    const amount = parseFloat(refundAmount);
    if (!amount || amount <= 0) return;
    await apiAction(
      () => apiFetch<ShopOrder>(`${ADMIN_API}/${sid}/shop/orders/${order.id}/refunds`, {
        method: "POST", body: JSON.stringify({ amount, reason: refundReason }),
      }),
      updateOrder, "Refund initiated — customer notified",
    );
    setRefundAmount(""); setRefundReason("");
  }

  async function approveRefund() {
    await apiAction(
      () => apiFetch<ShopOrder>(`${ADMIN_API}/${sid}/shop/orders/${order.id}/refunds/approve`, { method: "POST" }),
      updateOrder, "Refund approved — awaiting item return",
    );
  }

  async function acceptRefund() {
    await apiAction(
      () => apiFetch<ShopOrder>(`${ADMIN_API}/${sid}/shop/orders/${order.id}/refunds/accept`, { method: "POST" }),
      updateOrder, "Refund accepted — credit note created",
    );
  }

  async function rejectRefund() {
    await apiAction(
      () => apiFetch<ShopOrder>(`${ADMIN_API}/${sid}/shop/orders/${order.id}/refunds/reject`, { method: "POST" }),
      updateOrder, "Refund rejected — customer notified",
    );
  }

  async function payCreditNote() {
    await apiAction(
      () => apiFetch<ShopOrder>(`${ADMIN_API}/${sid}/shop/orders/${order.id}/credit-note/pay`, { method: "POST" }),
      updateOrder, "Credit note paid back to customer",
    );
  }

  async function submitNote() {
    const text = noteText.trim();
    if (!text) return;
    await apiAction(
      () => apiFetch<ShopOrder>(`${ADMIN_API}/${sid}/shop/orders/${order.id}/work-note`, {
        method: "POST", body: JSON.stringify({ note: text }),
      }),
      updateOrder, "Note added",
    );
    setNoteText("");
  }

  async function submitReturn() {
    await apiAction(
      () => apiFetch<ShopOrder>(`${ADMIN_API}/${sid}/shop/orders/${order.id}/returns`, {
        method: "POST", body: JSON.stringify({ reason: returnReason }),
      }),
      (o) => { updateOrder(o); closeModal(); },
      "Return requested",
    );
    setReturnReason("");
  }

  const addr = order.shippingAddress;
  const hasAddr = addr && (addr.line1 || addr.city || addr.country || addr.zipCode);
  const activities: ShopOrderActivity[] = order.activities ?? [];
  const isClosed = order.status === "FULFILLED" || order.status === "CANCELLED" || order.status === "FAILED";
  const isDelivered = order.status === "DELIVERED" || order.status === "FULFILLED";
  const isShippedOrLater = ["SHIPPED", "DELIVERED", "FULFILLED"].includes(order.status);
  const hasTracking = !!(order.trackingCarrier || order.trackingNumber);
  const hasRefund = !!order.refundStatus;
  const pendingRefundCount = order.refundStatus === "PENDING" ? 1 : 0;
  const pendingCnCount = order.creditNoteStatus === "PENDING" ? 1 : 0;

  return (
    <>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div>
          <Link to=".." className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-600 mb-2">
            <ArrowLeft className="w-3.5 h-3.5" /> All orders
          </Link>
          <h1 className="text-xl font-black text-slate-900 font-mono tracking-tight">{order.orderNumber}</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {new Date(order.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
            {order.paymentReference
              ? <span> · ref <span className="font-mono">{order.paymentReference}</span></span>
              : null}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center text-[0.65rem] font-semibold px-2.5 py-1 rounded-full border ${ORDER_STATUS_STYLE[order.status]}`}>
            {ORDER_STATUS_LABEL[order.status]}
          </span>
          <span className="text-[0.65rem] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
            {order.paymentStatus === "PAID" ? "Paid" : "Payment pending"}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4 max-w-3xl">

        {/* ── Items ─────────────────────────────────────────────────────────── */}
        <Card>
          <SectionHeader>Order items</SectionHeader>
          <div className="divide-y divide-slate-50">
            {order.lines.map((line) => (
              <div key={line.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                  <Package className="w-4 h-4 text-slate-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {line.productName}
                    {line.variantLabel
                      ? <span className="text-slate-400 font-normal"> · {line.variantLabel}</span>
                      : null}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {formatPrice(line.unitPrice, order.currency)} × {line.quantity}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold text-slate-800">{formatPrice(line.lineTotal, order.currency)}</span>
                  <button
                    disabled={busy}
                    title="Notify customer about this item"
                    onClick={() => {
                      setNotifyMsg(`Hi ${order.customerName.split(" ")[0]}, your item "${line.productName}" has an update.`);
                      setModal({ kind: "notify-line", lineId: line.id, productName: line.productName });
                    }}
                    className="p-1.5 rounded-md border border-slate-200 text-slate-300 hover:text-matcha-600 hover:border-matcha-200 hover:bg-matcha-50 cursor-pointer disabled:opacity-40 transition-colors"
                  >
                    <Bell className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-100 pt-3 mt-2 flex flex-col gap-1">
            <Row label="Subtotal" value={formatPrice(order.subtotal, order.currency)} />
            <Row
              label={<span className="font-bold text-slate-800">Total</span>}
              value={<span className="font-bold text-slate-900 text-base">{formatPrice(order.subtotal, order.currency)}</span>}
            />
          </div>
        </Card>

        {/* ── Customer + Ship-to ───────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <SectionHeader className="flex items-center gap-1"><Mail className="w-3 h-3" /> Customer</SectionHeader>
            <p className="text-sm font-semibold text-slate-900 mb-2">{order.customerName}</p>
            <div className="flex flex-col gap-1.5">
              <a href={`mailto:${order.customerEmail}`}
                className="inline-flex items-center gap-2 text-xs text-blue-600 hover:underline truncate">
                <Mail className="w-3.5 h-3.5 shrink-0" /> {order.customerEmail}
              </a>
              {order.customerPhone
                ? <a href={`tel:${order.customerPhone}`}
                    className="inline-flex items-center gap-2 text-xs text-blue-600 hover:underline">
                    <Phone className="w-3.5 h-3.5 shrink-0" /> {order.customerPhone}
                  </a>
                : <span className="inline-flex items-center gap-2 text-xs text-slate-400">
                    <Phone className="w-3.5 h-3.5 shrink-0" /> No phone
                  </span>
              }
            </div>
          </Card>

          <Card>
            <SectionHeader className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Ship to</SectionHeader>
            {hasAddr ? (
              <address className="not-italic text-xs text-slate-600 leading-relaxed">
                {addr!.line1 && <div>{addr!.line1}</div>}
                {addr!.line2 && <div>{addr!.line2}</div>}
                <div>{[addr!.zipCode, addr!.city].filter(Boolean).join(" ")}{addr!.state ? `, ${addr!.state}` : ""}</div>
                {addr!.country && <div>{addr!.country}</div>}
              </address>
            ) : (
              <p className="text-xs text-slate-400">No address provided.</p>
            )}
          </Card>
        </div>

        {/* ── Actions ───────────────────────────────────────────────────────── */}
        <Card>
          <SectionHeader>Actions</SectionHeader>
          <div className="flex flex-col gap-4">

            {/* Order lifecycle */}
            {!isClosed && (
              <ActionGroup label="Order Status">
                {order.status === "NEW" && (
                  <ActionBtn icon={<Check className="w-3.5 h-3.5" />} label="Confirm" disabled={busy} onClick={() => setStatus("CONFIRMED")} variant="success" />
                )}
                {(order.status === "NEW" || order.status === "CONFIRMED") && (
                  <ActionBtn icon={<RefreshCcw className="w-3.5 h-3.5" />} label="Mark Processing" disabled={busy} onClick={() => setStatus("PROCESSING")} />
                )}
                {order.status === "PROCESSING" && (
                  <ActionBtn icon={<Package className="w-3.5 h-3.5" />} label="Ready to Ship" disabled={busy} onClick={() => setStatus("READY_TO_SHIP")} />
                )}
                {(order.status === "PROCESSING" || order.status === "READY_TO_SHIP") && (
                  <ActionBtn icon={<Truck className="w-3.5 h-3.5" />} label="Mark Shipped" disabled={busy} onClick={() => setStatus("SHIPPED")} />
                )}
                {order.status === "SHIPPED" && (
                  <ActionBtn icon={<Check className="w-3.5 h-3.5" />} label="Mark Delivered" disabled={busy} onClick={() => setStatus("DELIVERED")} variant="success" />
                )}
                {order.status === "DELIVERED" && (
                  <ActionBtn icon={<CheckCheck className="w-3.5 h-3.5" />} label="Mark Fulfilled" disabled={busy} onClick={() => setStatus("FULFILLED")} variant="success" />
                )}
                {order.status === "NEW" && (
                  <ActionBtn icon={<X className="w-3.5 h-3.5" />} label="Put on Hold" disabled={busy} onClick={() => setStatus("ON_HOLD")} variant="warning" />
                )}
                {!isShippedOrLater && order.status !== "FULFILLED" && (
                  <ActionBtn icon={<X className="w-3.5 h-3.5" />} label="Cancel" disabled={busy} onClick={() => setStatus("CANCELLED")} variant="danger" />
                )}
              </ActionGroup>
            )}

            {/* Fulfillment operations */}
            <ActionGroup label="Fulfillment">
              <ActionBtn
                icon={<Truck className="w-3.5 h-3.5" />}
                label={hasTracking
                  ? `Shipping: ${order.trackingCarrier ?? ""}${order.trackingCarrier && order.trackingNumber ? " · " : ""}${order.trackingNumber ?? ""}`
                  : "Update Shipping"}
                disabled={busy}
                onClick={() => setModal({ kind: "shipping" })}
              />
              {isDelivered && !order.returnStatus && (
                <ActionBtn icon={<RotateCcw className="w-3.5 h-3.5" />} label="Request Return" disabled={busy}
                  onClick={() => setModal({ kind: "create-return" })} variant="warning" />
              )}
            </ActionGroup>

            {/* Communication */}
            <ActionGroup label="Communication">
              <ActionBtn
                icon={<Bell className="w-3.5 h-3.5" />}
                label="Notify Customer"
                disabled={busy}
                onClick={() => { setNotifyMsg(""); setModal({ kind: "notify" }); }}
              />
              <ActionBtn
                icon={<FileText className="w-3.5 h-3.5" />}
                label="Issue Invoice"
                disabled={busy}
                onClick={sendInvoice}
              />
            </ActionGroup>

            {/* Financial */}
            <ActionGroup label="Financial">
              <ActionBtn
                icon={<RefreshCcw className="w-3.5 h-3.5" />}
                label="Refunds"
                badge={pendingRefundCount}
                disabled={busy}
                onClick={() => setModal({ kind: "refunds" })}
                variant="warning"
              />
              {order.creditNoteRef && (
                <ActionBtn
                  icon={<Receipt className="w-3.5 h-3.5" />}
                  label={`Credit Note ${order.creditNoteRef}`}
                  badge={pendingCnCount}
                  disabled={busy}
                  onClick={() => setModal({ kind: "credit-notes" })}
                />
              )}
            </ActionGroup>

          </div>
        </Card>

        {/* ── Return card ─────────────────────────────────────────────────────── */}
        {order.returnStatus && (
          <Card>
            <SectionHeader className="flex items-center gap-1"><RotateCcw className="w-3 h-3" /> Return</SectionHeader>
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <div>
                <span className={`inline-flex items-center text-[0.65rem] font-semibold px-2 py-0.5 rounded-full border ${RETURN_STATUS_STYLE[order.returnStatus] ?? "bg-slate-100 text-slate-500 border-slate-200"}`}>
                  {RETURN_STATUS_LABEL[order.returnStatus] ?? order.returnStatus}
                </span>
                {order.returnReason && <span className="text-xs text-slate-500 ml-2">{order.returnReason}</span>}
                {order.returnNotes && <p className="text-xs text-slate-400 mt-1">{order.returnNotes}</p>}
              </div>
              {order.returnUpdatedAt && (
                <span className="text-[11px] text-slate-400 shrink-0">{relativeTime(order.returnUpdatedAt)}</span>
              )}
            </div>
          </Card>
        )}

        {/* ── Activity timeline ─────────────────────────────────────────────── */}
        <Card>
          <SectionHeader>Activity</SectionHeader>
          {activities.length === 0 ? (
            <p className="text-xs text-slate-400 pb-1">No activity yet.</p>
          ) : (
            <ol className="relative border-l-2 border-slate-100 ml-1 mb-4">
              {activities.map((a) => {
                const meta = ACTIVITY_META[a.type] ?? { label: a.type, dot: "bg-slate-300" };
                const isNote = a.type === "WORK_NOTE";
                const email = a.type === "CUSTOMER_NOTIFIED" && a.body ? a : null;
                const isOpen = openEmail === a.id;
                return (
                  <li key={a.id} className="ml-5 pb-4 last:pb-0">
                    <span className={`absolute -left-[9px] w-4 h-4 rounded-full border-2 border-white ${meta.dot}`} />
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold ${isNote ? "text-slate-400" : (meta.color ?? "text-slate-700")}`}>
                        {meta.label}
                      </span>
                      {a.notified && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-1.5 py-0.5">
                          <Send className="w-2.5 h-2.5" /> Notified
                        </span>
                      )}
                      {email && a.status && a.status !== "SENT" && (
                        <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-1.5 py-0.5">
                          {a.status === "LOGGED" ? "not sent (dev)" : a.status.toLowerCase()}
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400">{relativeTime(a.createdAt)}</span>
                    </div>
                    {a.message && (
                      <p className={`text-xs mt-0.5 leading-relaxed ${isNote ? "text-slate-400 italic" : "text-slate-500"}`}>
                        {a.message}
                      </p>
                    )}
                    {email && (
                      <div className="mt-1">
                        <button
                          type="button"
                          onClick={() => setOpenEmail(isOpen ? null : a.id)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-matcha-700 hover:text-matcha-900 cursor-pointer"
                        >
                          <Mail className="w-3 h-3" /> {isOpen ? "Hide email" : "View email"}
                        </button>
                        {isOpen && (
                          <div className="mt-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                            <p className="text-[11px] text-slate-400">
                              To <span className="font-medium text-slate-600">{order.customerEmail}</span>
                              {email.channel ? ` · ${email.channel.toLowerCase()}` : ""}
                            </p>
                            {email.subject && <p className="font-semibold text-slate-800 mt-1">{email.subject}</p>}
                            <pre className="mt-1.5 whitespace-pre-wrap font-sans leading-relaxed text-slate-600">{email.body}</pre>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          <div className="flex gap-2 border-t border-slate-100 pt-3">
            <textarea
              rows={2}
              placeholder="Add an internal note…"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && e.metaKey && submitNote()}
              className={`${inputCls} resize-none flex-1`}
            />
            <button
              disabled={busy || !noteText.trim()}
              onClick={submitNote}
              className="self-end px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              Add note
            </button>
          </div>
        </Card>
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────────── */}

      {/* Notify */}
      {(modal?.kind === "notify" || modal?.kind === "notify-line") && (
        <Modal
          title={modal.kind === "notify-line" ? `Notify — ${modal.productName}` : "Notify customer"}
          icon={<Bell className="w-4 h-4 text-matcha-600" />}
          onClose={closeModal}
        >
          <p className="text-xs text-slate-500 mb-3">
            Sending to <span className="font-medium text-slate-700">{order.customerEmail}</span>
            {order.customerPhone ? ` · ${order.customerPhone}` : ""}.
          </p>
          <textarea autoFocus rows={4} className={`${inputCls} resize-none mb-4`}
            placeholder="Your message…" value={notifyMsg} onChange={(e) => setNotifyMsg(e.target.value)} />
          <ModalFooter>
            <ModalCancel onClick={closeModal} />
            <ModalSave label="Send" icon={<Send className="w-3.5 h-3.5" />} disabled={busy || !notifyMsg.trim()} onClick={submitNotify} />
          </ModalFooter>
        </Modal>
      )}

      {/* Shipping */}
      {modal?.kind === "shipping" && (
        <Modal title="Shipping & tracking" icon={<Truck className="w-4 h-4 text-teal-600" />} onClose={closeModal}>
          {hasTracking && (
            <div className="flex items-center gap-2 mb-4 p-2.5 rounded-lg bg-teal-50 border border-teal-100">
              <Truck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span className="text-xs text-teal-700 font-medium">
                {order.trackingCarrier && <span>{order.trackingCarrier} </span>}
                {order.trackingNumber && <span className="font-mono">{order.trackingNumber}</span>}
              </span>
            </div>
          )}
          <div className="grid grid-cols-[140px_1fr] gap-3 mb-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Carrier</label>
              <select className={inputCls} value={trackingCarrier} onChange={(e) => setTrackingCarrier(e.target.value)}>
                <option value="">— Select —</option>
                {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Tracking number</label>
              <input autoFocus className={inputCls} placeholder="e.g. 1Z999AA10123456784"
                value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitShipping()} />
            </div>
          </div>
          <ModalFooter>
            <ModalCancel onClick={closeModal} />
            <ModalSave label="Save & notify" icon={<Send className="w-3.5 h-3.5" />}
              disabled={busy || (!trackingCarrier.trim() && !trackingNumber.trim())}
              onClick={submitShipping} />
          </ModalFooter>
        </Modal>
      )}

      {/* Refunds */}
      {modal?.kind === "refunds" && (
        <Modal title="Refund" icon={<RefreshCcw className="w-4 h-4 text-orange-600" />} onClose={closeModal} wide>
          {/* Existing refund */}
          {hasRefund && (
            <div className="mb-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Current refund</p>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-800">
                      {order.refundAmount != null ? formatPrice(order.refundAmount, order.currency) : ""}
                    </span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${REFUND_STATUS_STYLE[order.refundStatus!] ?? ""}`}>
                      {order.refundStatus}
                    </span>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {order.refundStatus === "PENDING" && (
                      <>
                        <button disabled={busy} onClick={approveRefund}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-green-200 text-[11px] font-medium text-green-700 bg-white hover:bg-green-50 cursor-pointer disabled:opacity-40">
                          <Check className="w-3 h-3" /> Approve
                        </button>
                        <button disabled={busy} onClick={rejectRefund}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-red-200 text-[11px] font-medium text-red-600 bg-white hover:bg-red-50 cursor-pointer disabled:opacity-40">
                          <X className="w-3 h-3" /> Reject
                        </button>
                      </>
                    )}
                    {order.refundStatus === "APPROVED" && (
                      <button disabled={busy} onClick={acceptRefund}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-blue-200 text-[11px] font-medium text-blue-700 bg-white hover:bg-blue-50 cursor-pointer disabled:opacity-40">
                        <Check className="w-3 h-3" /> Accept
                      </button>
                    )}
                  </div>
                </div>
                {order.refundReason && <p className="text-[11px] text-slate-500 mt-1">{order.refundReason}</p>}
              </div>
            </div>
          )}

          {/* Issue new refund */}
          {!hasRefund && (
            <div className={hasRefund ? "border-t border-slate-100 pt-4" : ""}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Issue refund</p>
              <p className="text-xs text-slate-500 mb-3">
                Customer will be notified at <span className="font-medium text-slate-700">{order.customerEmail}</span>.
              </p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Amount *</label>
                  <input type="number" min="0.01" step="0.01" max={order.subtotal}
                    className={inputCls} placeholder={`Max ${formatPrice(order.subtotal, order.currency)}`}
                    value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Reason</label>
                  <input className={inputCls} placeholder="e.g. Item damaged"
                    value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end">
                <ModalSave label="Issue refund" icon={<RefreshCcw className="w-3.5 h-3.5" />}
                  disabled={busy || !refundAmount || parseFloat(refundAmount) <= 0}
                  onClick={submitRefund} />
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Credit Notes */}
      {modal?.kind === "credit-notes" && order.creditNoteRef && (
        <Modal title="Credit Note" icon={<Receipt className="w-4 h-4 text-purple-600" />} onClose={closeModal}>
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {order.refundAmount != null && (
                  <span className="text-xs font-semibold text-slate-800">{formatPrice(order.refundAmount, order.currency)}</span>
                )}
                <span className="font-mono text-[10px] text-slate-400">{order.creditNoteRef}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${CN_STATUS_STYLE[order.creditNoteStatus ?? "PENDING"] ?? ""}`}>
                  {order.creditNoteStatus ?? "Pending"}
                </span>
              </div>
              {order.creditNoteStatus === "PENDING" && (
                <button disabled={busy} onClick={() => { payCreditNote(); closeModal(); }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-purple-200 text-[11px] font-medium text-purple-700 bg-white hover:bg-purple-50 cursor-pointer disabled:opacity-40 shrink-0">
                  <Banknote className="w-3 h-3" /> Pay back
                </button>
              )}
            </div>
            {order.refundReason && <p className="text-[11px] text-slate-500 mt-1">{order.refundReason}</p>}
          </div>
        </Modal>
      )}

      {/* Create Return */}
      {modal?.kind === "create-return" && (
        <Modal title="Request Return" icon={<RotateCcw className="w-4 h-4 text-orange-600" />} onClose={closeModal}>
          <p className="text-xs text-slate-500 mb-3">Describe why the customer is returning items.</p>
          <div className="mb-4">
            <label className="block text-xs text-slate-500 mb-1">Reason</label>
            <input autoFocus className={inputCls} placeholder="e.g. Item damaged in transit"
              value={returnReason} onChange={(e) => setReturnReason(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitReturn()} />
          </div>
          <ModalFooter>
            <ModalCancel onClick={closeModal} />
            <ModalSave label="Create return" icon={<RotateCcw className="w-3.5 h-3.5" />}
              disabled={busy} onClick={submitReturn} />
          </ModalFooter>
        </Modal>
      )}

      <Toast toast={toast} />
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">{children}</div>;
}

function SectionHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3 ${className}`}>
      {children}
    </p>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-800 text-right">{value}</span>
    </div>
  );
}

function ActionGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-300 mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

type BtnVariant = "default" | "success" | "danger" | "warning";
const BTN_CLS: Record<BtnVariant, string> = {
  default: "border-slate-200 text-slate-700 bg-white hover:bg-slate-50",
  success: "border-green-200 text-green-700 bg-white hover:bg-green-50",
  danger:  "border-red-200  text-red-600  bg-white hover:bg-red-50",
  warning: "border-orange-200 text-orange-700 bg-white hover:bg-orange-50",
};

function ActionBtn({ icon, label, badge = 0, disabled, onClick, variant = "default" }: {
  icon: React.ReactNode; label: string; badge?: number; disabled: boolean;
  onClick: () => void; variant?: BtnVariant;
}) {
  return (
    <button disabled={disabled} onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${BTN_CLS[variant]}`}>
      {icon}
      <span className="truncate max-w-[180px]">{label}</span>
      {badge > 0 && (
        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-red-500 text-white">
          {badge}
        </span>
      )}
    </button>
  );
}

function Modal({ title, icon, children, onClose, wide = false }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; onClose: () => void; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`bg-white rounded-2xl shadow-2xl border border-slate-200 w-full p-6 max-h-[90vh] overflow-y-auto ${wide ? "max-w-lg" : "max-w-md"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">{icon}</div>
            <h2 className="text-sm font-bold text-slate-900">{title}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return <div className="flex justify-end gap-2">{children}</div>;
}

function ModalCancel({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer">
      Cancel
    </button>
  );
}

function ModalSave({ label, icon, disabled, onClick }: {
  label: string; icon: React.ReactNode; disabled: boolean; onClick: () => void;
}) {
  return (
    <button disabled={disabled} onClick={onClick}
      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-matcha-600 text-white text-xs font-semibold hover:bg-matcha-700 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
      {icon} {label}
    </button>
  );
}
