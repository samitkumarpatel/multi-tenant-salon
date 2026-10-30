import { useI18n } from "@salon/i18n";
import { useEffect, useRef, useState } from "react";
import { Link, useLoaderData, useOutletContext, useParams } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import {
  ArrowLeft, Banknote, Bell, Check, CheckCheck, Copy, CreditCard, ExternalLink, FileText, Mail,
  MapPin, MessageSquare, Package, Phone, Receipt, RefreshCcw, Send, StickyNote, Truck, X,
  RotateCcw, Printer,
} from "lucide-react";
import { ADMIN_API, apiFetch, resolveSalonUUID } from "~/lib/api";
import { formatPrice } from "~/lib/constants";
import {
  ORDER_STATUS_LABEL, ORDER_STATUS_STYLE, relativeTime,
  RETURN_STATUS_LABEL, RETURN_STATUS_STYLE,
} from "~/lib/shopOrders";
import { Toast, useToast } from "@salon/ui-shared";
import type { ShopOrder, ShopOrderActivity, ShopOrderActivityType, ShopOrderStatus, ShopPaymentStatus } from "~/lib/types";
import type { ShopOutletContext } from "./shop";
import { formatWeight } from "~/lib/shopWeights";

/** One attempt to take payment for this order, from the payments ledger (`area=SHOP`, reference = order id). */
type PaymentAttempt = {
  id: number; channel: "CHECKOUT" | "TERMINAL"; checkoutUi: string | null;
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELED" | "PARTIALLY_REFUNDED" | "REFUNDED";
  amount: number; currency: string; amountRefunded: number;
  checkoutSessionId: string | null; paymentIntentId: string | null; failureMessage: string | null;
  createdAt: string; updatedAt: string;
};

type Communication = {
  id: number; activityId: number; sourceActivityId: number | null; sourceLineActivityId: number | null; channel: string; recipient: string | null; subject: string | null;
  body: string | null; htmlBody: string | null; status: string; failureReason: string | null;
  attempts: number; generation: number; createdAt: string; updatedAt: string;
  history: { id: number; generation: number; status: string; failureReason: string | null; startedAt: string; finishedAt: string | null }[];
};

const COMMUNICATION_STATUS: Record<string, string> = {
  QUEUED: "Queued", SENDING: "Sending", SENT: "Accepted by email provider", FAILED: "Failed",
  RETRYING: "Automatic retry pending", LOGGED: "Email not configured", SKIPPED: "Skipped",
};

export async function clientLoader({ params, request }: ClientLoaderFunctionArgs) {
  const sid = await resolveSalonUUID(params.salonId!);
  // Only the order is required to open this page. Supporting histories load after
  // rendering so an unavailable or older endpoint cannot break order expansion.
  const order = await apiFetch<ShopOrder>(`${ADMIN_API}/${sid}/shop/orders/${params.orderId}`, { signal: request.signal });
  return { sid, order };
}

const PAYMENT_STATUS: Record<ShopPaymentStatus, { label: string; style: string }> = {
  PENDING:    { label: "Payment pending", style: "bg-amber-50 text-amber-700 border-amber-200" },
  AUTHORIZED: { label: "Authorized",      style: "bg-sky-50 text-sky-700 border-sky-200" },
  CAPTURED:   { label: "Captured",        style: "bg-green-50 text-green-700 border-green-200" },
  PAID:       { label: "Paid",            style: "bg-green-50 text-green-700 border-green-200" },
  SETTLED:    { label: "Settled",         style: "bg-green-50 text-green-700 border-green-200" },
  FAILED:     { label: "Payment failed",  style: "bg-red-50 text-red-600 border-red-200" },
  VOIDED:     { label: "Voided",          style: "bg-slate-100 text-slate-500 border-slate-200" },
};

const ATTEMPT_STATUS: Record<PaymentAttempt["status"], { label: string; style: string }> = {
  PENDING:            { label: "Pending",            style: "bg-amber-50 text-amber-700 border-amber-200" },
  SUCCEEDED:          { label: "Succeeded",          style: "bg-green-50 text-green-700 border-green-200" },
  FAILED:             { label: "Failed",             style: "bg-red-50 text-red-600 border-red-200" },
  CANCELED:           { label: "Cancelled",          style: "bg-slate-100 text-slate-500 border-slate-200" },
  PARTIALLY_REFUNDED: { label: "Partly refunded",    style: "bg-sky-50 text-sky-700 border-sky-200" },
  REFUNDED:           { label: "Refunded",           style: "bg-slate-100 text-slate-600 border-slate-200" },
};

const COMMUNICATION_LABEL: Record<string, string> = {
  IMPORTANT_ONLY: "Important updates only",
  ALL: "Every update",
};

const LINE_ACTIVITY_LABEL: Record<string, string> = {
  LINE_CREATED: "Added to order",
  STATUS_CHANGED: "Status updated",
  USER_NOTIFIED: "Customer notified",
  NOTE_ADDED: "Note",
};

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
  | { kind: "note-line"; lineId: number; productName: string }
  | { kind: "shipping" }
  | { kind: "refunds" }
  | { kind: "credit-notes" }
  | { kind: "create-return" };

export default function ShopOrderDetail() {
  const { sid, order } = useLoaderData<typeof clientLoader>();
  return <ShopOrderDetailContent key={`${sid}:${order.id}`} />;
}

function ShopOrderDetailContent() {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const { salon } = useOutletContext<ShopOutletContext>();
  const { sid, order: init } = useLoaderData<typeof clientLoader>();
  const { salonId } = useParams<{ salonId: string }>();
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
  const [selectedActivity, setSelectedActivity] = useState<ShopOrderActivity | null>(null);
  const [payments, setPayments] = useState<PaymentAttempt[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [paymentsError, setPaymentsError] = useState(false);
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [communicationError, setCommunicationError] = useState("");
  const selectedCommunication = communications.find((c) => c.activityId === selectedActivity?.id || c.sourceActivityId === selectedActivity?.id
    || (selectedActivity && selectedActivity.id < 0 && c.sourceLineActivityId === -selectedActivity.id));

  useEffect(() => {
    const controller = new AbortController();
    apiFetch<PaymentAttempt[]>(`${ADMIN_API}/${sid}/payments/transactions?area=SHOP&reference=${init.id}&limit=20`, { signal: controller.signal })
      .then((attempts) => {
        if (!Array.isArray(attempts)) throw new Error("Invalid payment history response");
        if (!controller.signal.aborted) setPayments(attempts);
      })
      .catch(() => { if (!controller.signal.aborted) setPaymentsError(true); })
      .finally(() => { if (!controller.signal.aborted) setPaymentsLoading(false); });
    return () => controller.abort();
  }, [sid, init.id]);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh(initial = false) {
      if (controller.signal.aborted) return;
      if (document.visibilityState === "visible") {
        // Refresh independently: a failed history request must not prevent the
        // order's status and activity from updating either.
        const messages = apiFetch<Communication[]>(`${ADMIN_API}/${sid}/shop/orders/${init.id}/communications`, { signal: controller.signal })
          .then((messages) => {
            if (!Array.isArray(messages)) throw new Error("Invalid communication history response");
            if (!controller.signal.aborted) { setCommunications(messages); setCommunicationError(""); }
          })
          .catch(() => {
            if (!controller.signal.aborted) setCommunicationError(translateUi("Could not load communication history. Order details are still available."));
          });
        const details = initial ? Promise.resolve() : apiFetch<ShopOrder>(`${ADMIN_API}/${sid}/shop/orders/${init.id}`, { signal: controller.signal })
          .then((nextOrder) => { if (!controller.signal.aborted) setOrder(nextOrder); })
          .catch(() => { /* Keep the last order while a background refresh is unavailable. */ });
        await Promise.all([messages, details]);
      }
      if (!controller.signal.aborted) timer = setTimeout(() => { void refresh(); }, 5000);
    }
    void refresh(true);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [sid, init.id, translateUi]);

  async function retryCommunication(message: Communication) {
    await apiAction(
      () => apiFetch<Communication[]>(`${ADMIN_API}/${sid}/shop/orders/${order.id}/communications/${message.id}/retry`, { method: "POST" }),
      setCommunications, translateUi("Email retry queued"),
    );
  }
  const [lineNote, setLineNote] = useState("");

  function copy(value: string, what: string) {
    navigator.clipboard?.writeText(value).then(() => notify(`${what} copied`), () => notify("Couldn't copy", "error"));
  }

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
      updateOrder, "Invoice notification queued",
    );
  }

  async function submitNotify() {
    if (!notifyMsg.trim()) return;
    if (modal?.kind === "notify") {
      await apiAction(
        () => apiFetch<ShopOrder>(`${ADMIN_API}/${sid}/shop/orders/${order.id}/notify`, {
          method: "POST", body: JSON.stringify({ message: notifyMsg }),
        }),
        updateOrder, "Customer message queued",
      );
    } else if (modal?.kind === "notify-line") {
      await apiAction(
        () => apiFetch<ShopOrder>(
          `${ADMIN_API}/${sid}/shop/orders/${order.id}/lines/${modal.lineId}/notify`,
          { method: "POST", body: JSON.stringify({ message: notifyMsg }) },
        ),
        updateOrder, "Customer message queued",
      );
    }
    closeModal(); setNotifyMsg("");
  }

  async function submitLineNote() {
    if (modal?.kind !== "note-line" || !lineNote.trim()) return;
    await apiAction(
      () => apiFetch<ShopOrder>(`${ADMIN_API}/${sid}/shop/orders/${order.id}/lines/${modal.lineId}/notes`, {
        method: "POST", body: JSON.stringify({ note: lineNote.trim() }),
      }),
      updateOrder, "Note added to item",
    );
    closeModal(); setLineNote("");
  }

  async function submitShipping() {
    if (!trackingCarrier.trim() && !trackingNumber.trim()) return;
    await apiAction(
      () => apiFetch<ShopOrder>(`${ADMIN_API}/${sid}/shop/orders/${order.id}/shipping`, {
        method: "POST", body: JSON.stringify({ carrier: trackingCarrier, trackingNumber }),
      }),
      updateOrder, "Shipping saved — update queued",
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
      updateOrder, "Refund initiated — update queued",
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
      updateOrder, "Refund rejected — update queued",
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

  /** Opens a 100×150 mm shipping label (ship-to, sender, order, tracking) in a print window. */
  function printLabel() {
    if (!hasAddr) return;
    const esc = (v?: string | null) => (v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
    const loc = salon.location;
    const from = [salon.name, loc?.address, [loc?.zipCode, loc?.city].filter(Boolean).join(" "), loc?.country].filter(Boolean).map(esc).join("<br>");
    const to = [order.customerName, addr!.line1, addr!.line2,
      [addr!.zipCode, addr!.city].filter(Boolean).join(" ") + (addr!.state ? `, ${addr!.state}` : ""), addr!.country]
      .filter(Boolean).map(esc).join("<br>");
    const w = window.open("", "_blank", "width=480,height=700");
    if (!w) { notify("Allow pop-ups to print the label", "error"); return; }
    w.document.write(`<!doctype html><html><head><title>Label ${esc(order.orderNumber)}</title><style>
      @page { size: 100mm 150mm; margin: 0 }
      body { font-family: Arial, sans-serif; margin: 0; padding: 6mm; width: 88mm; box-sizing: content-box; color: #000 }
      .from { font-size: 9pt; border-bottom: 1.5px solid #000; padding-bottom: 4mm; line-height: 1.35 }
      .lbl { font-size: 7pt; font-weight: bold; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 1mm }
      .to { font-size: 15pt; font-weight: bold; line-height: 1.3; padding: 6mm 0; border-bottom: 1.5px solid #000 }
      .meta { font-size: 9pt; padding-top: 4mm; line-height: 1.6 } .num { font-family: monospace; font-size: 12pt; font-weight: bold }
    </style></head><body>
      <div class="from"><div class="lbl">From</div>${from}</div>
      <div class="to"><div class="lbl">Ship to</div>${to}${order.customerPhone ? `<div style="font-size:10pt;font-weight:normal;margin-top:2mm">Tel ${esc(order.customerPhone)}</div>` : ""}</div>
      <div class="meta"><div class="num">${esc(order.orderNumber)}</div>
        ${order.shippingMethodName ? `Service: ${esc(order.shippingMethodName)}<br>` : ""}
        ${order.totalWeightGrams ? `Weight: ${esc(formatWeight(order.totalWeightGrams, uiLocale))}<br>` : ""}
        ${order.trackingNumber ? `Tracking: ${esc(order.trackingCarrier)} ${esc(order.trackingNumber)}` : ""}</div>
      <script>window.onload = () => { window.print(); }<\/script></body></html>`);
    w.document.close();
  }

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
            <ArrowLeft className="w-3.5 h-3.5" /> {translateUi("All orders ")}</Link>
          <h1 className="text-lg sm:text-xl font-black break-all text-slate-900 font-mono tracking-tight">{order.orderNumber}</h1>
          <p className="text-xs text-slate-400 mt-0.5 break-all">
            {new Date(order.createdAt).toLocaleString(uiLocale, { dateStyle: "medium", timeStyle: "short" })}
            {order.paymentReference
              ? <span> {translateUi("· ref ")}<span className="font-mono">{order.paymentReference}</span></span>
              : null}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center text-[0.65rem] font-semibold px-2.5 py-1 rounded-full border ${ORDER_STATUS_STYLE[order.status]}`}>
            {ORDER_STATUS_LABEL[order.status]}
          </span>
          <span className={`text-[0.65rem] font-semibold px-2.5 py-1 rounded-full border ${PAYMENT_STATUS[order.paymentStatus]?.style ?? "bg-slate-100 text-slate-500 border-slate-200"}`}>
            {translateUi(PAYMENT_STATUS[order.paymentStatus]?.label ?? order.paymentStatus)}
          </span>
        </div>
      </div>

      {/* One column (with the cards in a phone-friendly order) below xl; main + sidebar columns from xl up. */}
      <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
      <div className="contents xl:flex xl:flex-col xl:gap-4 xl:min-w-0">

        {/* ── Items ─────────────────────────────────────────────────────────── */}
        <Card className="order-1 xl:order-none">
          <SectionHeader>{translateUi("Order items")}</SectionHeader>
          <div className="divide-y divide-slate-50">
            {order.lines.map((line) => (
              <div key={line.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                  <Package className="w-4 h-4 text-slate-300" />
                </div>
                <div className="flex-1 min-w-[9rem]">
                  <p className="text-sm font-medium text-slate-800 break-words">
                    {line.productName}
                    {line.variantLabel
                      ? <span className="text-slate-400 font-normal"> · {line.variantLabel}</span>
                      : null}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {formatPrice(line.unitPrice, order.currency, uiLocale)} × {line.quantity}
                    {line.variantId ? <span> · {translateUi("variant")} #{line.variantId}</span> : <span> · {translateUi("product no longer in the catalogue")}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-auto">
                  <span className="text-sm font-semibold text-slate-800">{formatPrice(line.lineTotal, order.currency, uiLocale)}</span>
                  <button
                    disabled={busy}
                    title={translateUi("Notify customer about this item")}
                    onClick={() => {
                      setNotifyMsg(`Hi ${order.customerName.split(" ")[0]}, your item "${line.productName}" has an update.`);
                      setModal({ kind: "notify-line", lineId: line.id, productName: line.productName });
                    }}
                    className="p-1.5 rounded-md border border-slate-200 text-slate-300 hover:text-matcha-600 hover:border-matcha-200 hover:bg-matcha-50 cursor-pointer disabled:opacity-40 transition-colors"
                  >
                    <Bell className="w-3.5 h-3.5" />
                  </button>
                  <button
                    disabled={busy}
                    title={translateUi("Add a note to this item")}
                    onClick={() => { setLineNote(""); setModal({ kind: "note-line", lineId: line.id, productName: line.productName }); }}
                    className="p-1.5 rounded-md border border-slate-200 text-slate-300 hover:text-matcha-600 hover:border-matcha-200 hover:bg-matcha-50 cursor-pointer disabled:opacity-40 transition-colors"
                  >
                    <StickyNote className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {/* The item's own history: notes and per-item messages ("Added to order" is implied). */}
              {line.activities?.some((a) => a.type !== "LINE_CREATED") && (
                <ul className="mt-2 ml-12 flex flex-col gap-1">
                  {line.activities.filter((a) => a.type !== "LINE_CREATED").map((a) => {
                    const communication = communications.find((c) => c.sourceLineActivityId === a.id);
                    return <li key={a.id} className="flex items-start gap-1.5 text-[11px] text-slate-500">
                      {a.type === "NOTE_ADDED"
                        ? <StickyNote className="w-3 h-3 mt-0.5 shrink-0 text-slate-400" />
                        : communication?.channel === "SMS"
                          ? <MessageSquare className="w-3 h-3 mt-0.5 shrink-0 text-blue-500" />
                          : <Mail className="w-3 h-3 mt-0.5 shrink-0 text-blue-500" />}
                      <span className="min-w-0">
                        {a.type === "USER_NOTIFIED" ? <button type="button" className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-matcha-200 bg-matcha-50 px-2 font-semibold text-matcha-800 shadow-sm transition-colors hover:border-matcha-400 hover:bg-matcha-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-matcha-500 focus-visible:ring-offset-1"
                          title={translateUi("View customer communication")}
                          onClick={() => {
                            const communication = communications.find((c) => c.sourceLineActivityId === a.id);
                            setSelectedActivity(activities.find((entry) => entry.id === communication?.activityId) ?? {
                              id: -a.id, orderId: order.id, type: "CUSTOMER_NOTIFIED", message: a.message,
                              notified: false, createdAt: a.createdAt,
                          });
                          }}>
                          {translateUi("Customer communication")}</button>
                          : <span className="font-medium text-slate-600">{translateUi(LINE_ACTIVITY_LABEL[a.type] ?? a.type)}</span>}
                        {a.message ? <span> — {a.message}</span> : null}
                        <span className="text-slate-400"> · {relativeTime(a.createdAt)}{a.actor ? ` · ${a.actor}` : ""}</span>
                      </span>
                    </li>;
                  })}
                </ul>
              )}
              </div>
            ))}
          </div>
          <div className="border-t border-slate-100 pt-3 mt-2 flex flex-col gap-1">
            <Row label={translateUi("Subtotal")} value={formatPrice(order.subtotal, order.currency, uiLocale)} />
            {order.totalWeightGrams ? (
              <Row label={translateUi("Weight")} value={formatWeight(order.totalWeightGrams, uiLocale)} />
            ) : null}
            {order.shippingMethodName && (
              <Row
                label={`${translateUi("Shipping")} · ${order.shippingMethodName}`}
                value={order.shippingCost ? formatPrice(order.shippingCost, order.currency, uiLocale) : translateUi("Free")}
              />
            )}
            <Row
              label={<span className="font-bold text-slate-800">{translateUi("Total")}</span>}
              value={<span className="font-bold text-slate-900 text-base">{formatPrice(order.total ?? order.subtotal, order.currency, uiLocale)}</span>}
            />
          </div>
        </Card>

        {/* ── Payment ───────────────────────────────────────────────────────── */}
        <Card className="order-5 xl:order-none">
          <div className="flex items-center justify-between gap-2 mb-3">
            <SectionHeader className="flex items-center gap-1 !mb-0"><CreditCard className="w-3 h-3" /> {translateUi("Payment")}</SectionHeader>
            {payments.length > 0 && (
              <Link to={`/${salonId}/payments`} className="inline-flex items-center gap-1 text-[11px] font-medium text-matcha-700 hover:underline">
                {translateUi("Open in Payments")} <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Row label={translateUi("Status")} value={
              <span className={`inline-flex text-[0.65rem] font-semibold px-2 py-0.5 rounded-full border ${PAYMENT_STATUS[order.paymentStatus]?.style ?? ""}`}>
                {translateUi(PAYMENT_STATUS[order.paymentStatus]?.label ?? order.paymentStatus)}
              </span>} />
            <Row label={translateUi("Method")} value={
              paymentsLoading ? translateUi("Loading payment history…")
                : paymentsError ? translateUi("Payment history is currently unavailable.")
                : payments.length === 0 ? translateUi("No card payment recorded")
                : payments[0].channel === "TERMINAL" ? translateUi("Card reader in the salon") : translateUi("Card — online checkout (Stripe)")} />
            <Row label={translateUi("Order total")} value={formatPrice(order.total ?? order.subtotal, order.currency, uiLocale)} />
            {payments.some((p) => p.amountRefunded > 0) && (
              <Row label={translateUi("Refunded to card")} value={formatPrice(payments.reduce((n, p) => n + p.amountRefunded, 0), order.currency, uiLocale)} />
            )}
            <Row label={translateUi("Payment reference")} value={order.paymentReference
              ? <CopyValue value={order.paymentReference} onCopy={() => copy(order.paymentReference!, "Payment reference")} />
              : <span className="text-slate-400">—</span>} />
            {order.refundStatus && (
              <Row label={translateUi("Refund")} value={
                <span className="inline-flex items-center gap-1.5">
                  <span className={`inline-flex text-[0.65rem] font-semibold px-2 py-0.5 rounded-full border ${REFUND_STATUS_STYLE[order.refundStatus] ?? ""}`}>{order.refundStatus.toLowerCase()}</span>
                  {order.refundAmount != null && formatPrice(order.refundAmount, order.currency, uiLocale)}
                </span>} />
            )}
            {order.refundReason && <Row label={translateUi("Refund reason")} value={<span className="text-slate-600">{order.refundReason}</span>} />}
            {order.creditNoteRef && (
              <Row label={translateUi("Credit note")} value={
                <span className="inline-flex items-center gap-1.5">
                  <span className="font-mono">{order.creditNoteRef}</span>
                  {order.creditNoteStatus && <span className={`inline-flex text-[0.65rem] font-semibold px-2 py-0.5 rounded-full border ${CN_STATUS_STYLE[order.creditNoteStatus] ?? ""}`}>{order.creditNoteStatus.toLowerCase()}</span>}
                </span>} />
            )}
          </div>

          {payments.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                {payments.length === 1 ? translateUi("Card payment") : translateUi("Card payment attempts ({count})", { count: payments.length })}
              </p>
              <ul className="flex flex-col gap-2">
                {payments.map((p) => (
                  <li key={p.id} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-[11px] text-slate-600 flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex font-semibold px-2 py-0.5 rounded-full border ${ATTEMPT_STATUS[p.status].style}`}>{translateUi(ATTEMPT_STATUS[p.status].label)}</span>
                      <span className="font-semibold text-slate-800">{formatPrice(p.amount, p.currency, uiLocale)}</span>
                    </div>
                    <span className="text-slate-400">
                      {new Date(p.createdAt).toLocaleString(uiLocale, { dateStyle: "medium", timeStyle: "short" })}
                      {p.updatedAt !== p.createdAt && ` · ${translateUi("updated")} ${relativeTime(p.updatedAt)}`}
                      {` · #${p.id}`}
                    </span>
                    {p.paymentIntentId && (
                      <span className="flex items-center gap-1">{translateUi("Payment intent")}: <CopyValue value={p.paymentIntentId} onCopy={() => copy(p.paymentIntentId!, "Payment intent")} /></span>
                    )}
                    {p.checkoutSessionId && p.checkoutSessionId !== p.paymentIntentId && (
                      <span className="flex items-center gap-1">{translateUi("Checkout session")}: <CopyValue value={p.checkoutSessionId} onCopy={() => copy(p.checkoutSessionId!, "Checkout session")} /></span>
                    )}
                    {p.amountRefunded > 0 && <span>{translateUi("Refunded")}: {formatPrice(p.amountRefunded, p.currency, uiLocale)}</span>}
                    {p.failureMessage && <span className="text-red-600">{p.failureMessage}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {/* ── Return card ─────────────────────────────────────────────────────── */}
        {order.returnStatus && (
          <Card className="order-6 xl:order-none">
            <SectionHeader className="flex items-center gap-1"><RotateCcw className="w-3 h-3" /> {translateUi("Return")}</SectionHeader>
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
        <Card className="order-7 xl:order-none">
          <SectionHeader>{translateUi("Activity")}</SectionHeader>
          <p className="mb-3 text-xs text-slate-500">{translateUi("SMS not configured")}</p>
          {communicationError && <p role="status" className="mb-3 text-xs text-amber-700">{communicationError}</p>}
          {activities.length === 0 ? (
            <p className="text-xs text-slate-400 pb-1">{translateUi("No activity yet.")}</p>
          ) : (
            <ol className="relative border-l-2 border-slate-100 ml-1 mb-4">
              {activities.map((a) => {
                const meta = ACTIVITY_META[a.type] ?? { label: a.type, dot: "bg-slate-300" };
                const isNote = a.type === "WORK_NOTE";
                const communication = communications.find((c) => (c.activityId === a.id || c.sourceActivityId === a.id));
                const isCommunication = !!communication || a.type === "CUSTOMER_NOTIFIED" || a.notified || a.type === "INVOICE_SENT";
                const status = communication?.status ?? a.status;
                return (
                  <li key={a.id} className="ml-5 pb-4 last:pb-0">
                    <span className={`absolute -left-[9px] w-4 h-4 rounded-full border-2 border-white ${meta.dot}`} />
                    <div className="flex items-center gap-2 flex-wrap">
                      {isCommunication ? <button type="button" onClick={() => setSelectedActivity(a)}
                        title={translateUi("View customer communication")}
                        className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md border border-matcha-200 bg-matcha-50 px-2 text-left text-xs font-semibold text-matcha-800 shadow-sm transition-colors hover:border-matcha-400 hover:bg-matcha-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-matcha-500 focus-visible:ring-offset-1">
                        {communication?.channel === "SMS"
                          ? <MessageSquare aria-hidden="true" className="h-3.5 w-3.5" />
                          : <Mail aria-hidden="true" className="h-3.5 w-3.5" />}
                        {translateUi(a.type === "CUSTOMER_NOTIFIED" ? "Customer communication" : meta.label)}
                      </button> : <span className={`text-xs font-semibold ${isNote ? "text-slate-400" : (meta.color ?? "text-slate-700")}`}>
                        {translateUi(meta.label)}
                      </span>}
                      {a.notified && !status && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-1.5 py-0.5">
                          <Send className="w-2.5 h-2.5" /> {translateUi("Notification requested")}</span>
                      )}
                      {status && <span className={`text-[10px] font-medium rounded-full px-1.5 py-0.5 ${status === "FAILED" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                        {translateUi(COMMUNICATION_STATUS[status] ?? status)}
                      </span>}
                      <span className="text-[11px] text-slate-400">{relativeTime(a.createdAt)}</span>
                    </div>
                    {a.message && (
                      <p className={`text-xs mt-0.5 leading-relaxed ${isNote ? "text-slate-400 italic" : "text-slate-500"}`}>
                        {a.message}
                      </p>
                    )}

                  </li>
                );
              })}
            </ol>
          )}
          <div className="flex gap-2 border-t border-slate-100 pt-3">
            <textarea
              rows={2}
              placeholder={translateUi("Add an internal note…")}
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
              {translateUi("Add note ")}</button>
          </div>
        </Card>
      </div>

      {/* ── Sidebar ── */}
      <div className="contents xl:flex xl:flex-col xl:gap-4 xl:min-w-0">
        {/* ── Customer + Ship-to ───────────────────────────────────────────── */}
        <>
          <Card className="order-2 xl:order-none">
            <SectionHeader className="flex items-center gap-1"><Mail className="w-3 h-3" /> {translateUi("Customer")}</SectionHeader>
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
                    <Phone className="w-3.5 h-3.5 shrink-0" /> {translateUi("No phone ")}</span>
              }
            </div>
          </Card>

          <Card className="order-3 xl:order-none">
            <SectionHeader className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {translateUi("Delivery")}</SectionHeader>
            {hasAddr ? (
              <address className="not-italic text-xs text-slate-600 leading-relaxed mb-3">
                {addr!.line1 && <div>{addr!.line1}</div>}
                {addr!.line2 && <div>{addr!.line2}</div>}
                <div>{[addr!.zipCode, addr!.city].filter(Boolean).join(" ")}{addr!.state ? `, ${addr!.state}` : ""}</div>
                {addr!.country && <div>{addr!.country}</div>}
              </address>
            ) : (
              <p className="text-xs text-slate-600 mb-3">{translateUi("Collect in salon — no shipping address.")}</p>
            )}
            {hasAddr && (
              <button type="button" onClick={printLabel}
                className="mb-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-matcha-200 cursor-pointer">
                <Printer className="w-3.5 h-3.5" /> {translateUi("Print shipping label")}
              </button>
            )}
            <div className="flex flex-col gap-1.5">
              {order.shippingMethodName && (
                <Row label={translateUi("Method")} value={`${order.shippingMethodName} · ${order.shippingCost ? formatPrice(order.shippingCost, order.currency, uiLocale) : translateUi("Free")}`} />
              )}
              {order.totalWeightGrams ? <Row label={translateUi("Parcel weight")} value={formatWeight(order.totalWeightGrams, uiLocale)} /> : null}
              {(order.trackingCarrier || order.trackingNumber) && (
                <Row label={translateUi("Tracking")} value={
                  <span className="inline-flex items-center gap-1">
                    {order.trackingCarrier}
                    {order.trackingNumber && <CopyValue value={order.trackingNumber} onCopy={() => copy(order.trackingNumber!, "Tracking number")} />}
                  </span>} />
              )}
              <Row label={translateUi("Customer updates")} value={translateUi(COMMUNICATION_LABEL[order.communicationPreference] ?? order.communicationPreference)} />
            </div>
          </Card>
        </>

        {/* ── Actions ───────────────────────────────────────────────────────── */}
        <Card className="order-4 xl:order-none">
          <SectionHeader>{translateUi("Actions")}</SectionHeader>
          <div className="flex flex-col gap-4">

            {/* Order lifecycle */}
            {!isClosed && (
              <ActionGroup label={translateUi("Order Status")}>
                {order.status === "NEW" && (
                  <ActionBtn icon={<Check className="w-3.5 h-3.5" />} label={translateUi("Confirm")} disabled={busy} onClick={() => setStatus("CONFIRMED")} variant="success" />
                )}
                {(order.status === "NEW" || order.status === "CONFIRMED") && (
                  <ActionBtn icon={<RefreshCcw className="w-3.5 h-3.5" />} label={translateUi("Mark Processing")} disabled={busy} onClick={() => setStatus("PROCESSING")} />
                )}
                {order.status === "PROCESSING" && (
                  <ActionBtn icon={<Package className="w-3.5 h-3.5" />} label={translateUi("Ready to Ship")} disabled={busy} onClick={() => setStatus("READY_TO_SHIP")} />
                )}
                {(order.status === "PROCESSING" || order.status === "READY_TO_SHIP") && (
                  <ActionBtn icon={<Truck className="w-3.5 h-3.5" />} label={translateUi("Mark Shipped")} disabled={busy} onClick={() => setStatus("SHIPPED")} />
                )}
                {order.status === "SHIPPED" && (
                  <ActionBtn icon={<Check className="w-3.5 h-3.5" />} label={translateUi("Mark Delivered")} disabled={busy} onClick={() => setStatus("DELIVERED")} variant="success" />
                )}
                {order.status === "DELIVERED" && (
                  <ActionBtn icon={<CheckCheck className="w-3.5 h-3.5" />} label={translateUi("Mark Fulfilled")} disabled={busy} onClick={() => setStatus("FULFILLED")} variant="success" />
                )}
                {order.status === "NEW" && (
                  <ActionBtn icon={<X className="w-3.5 h-3.5" />} label={translateUi("Put on Hold")} disabled={busy} onClick={() => setStatus("ON_HOLD")} variant="warning" />
                )}
                {!isShippedOrLater && order.status !== "FULFILLED" && (
                  <ActionBtn icon={<X className="w-3.5 h-3.5" />} label={translateUi("Cancel")} disabled={busy} onClick={() => setStatus("CANCELLED")} variant="danger" />
                )}
              </ActionGroup>
            )}

            {/* Fulfillment operations */}
            <ActionGroup label={translateUi("Fulfillment")}>
              <ActionBtn
                icon={<Truck className="w-3.5 h-3.5" />}
                label={hasTracking
                  ? `Shipping: ${order.trackingCarrier ?? ""}${order.trackingCarrier && order.trackingNumber ? " · " : ""}${order.trackingNumber ?? ""}`
                  : translateUi("Update Shipping")}
                // Still shown on a settled order so existing tracking stays readable, but not
                // editable: adding shipping moves an order to SHIPPED, which the server refuses
                // once the order is cancelled, fulfilled or failed.
                disabled={busy || isClosed}
                onClick={() => setModal({ kind: "shipping" })}
              />
              {isDelivered && !order.returnStatus && (
                <ActionBtn icon={<RotateCcw className="w-3.5 h-3.5" />} label={translateUi("Request Return")} disabled={busy}
                  onClick={() => setModal({ kind: "create-return" })} variant="warning" />
              )}
            </ActionGroup>

            {/* Communication */}
            <ActionGroup label={translateUi("Communication")}>
              <ActionBtn
                icon={<Bell className="w-3.5 h-3.5" />}
                label={translateUi("Notify Customer")}
                disabled={busy}
                onClick={() => { setNotifyMsg(""); setModal({ kind: "notify" }); }}
              />
              <ActionBtn
                icon={<FileText className="w-3.5 h-3.5" />}
                label={translateUi("Issue Invoice")}
                disabled={busy}
                onClick={sendInvoice}
              />
            </ActionGroup>

            {/* Financial */}
            <ActionGroup label={translateUi("Financial")}>
              <ActionBtn
                icon={<RefreshCcw className="w-3.5 h-3.5" />}
                label={translateUi("Refunds")}
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

      </div>
      </div>

      {selectedActivity && <CommunicationDetails activity={selectedActivity} message={selectedCommunication}
        busy={busy} onClose={() => setSelectedActivity(null)} onRetry={retryCommunication} />}

      {/* ── Modals ────────────────────────────────────────────────────────────── */}

      {/* Notify */}
      {(modal?.kind === "notify" || modal?.kind === "notify-line") && (
        <Modal
          title={modal.kind === "notify-line" ? `Notify — ${modal.productName}` : translateUi("Notify customer")}
          icon={<Bell className="w-4 h-4 text-matcha-600" />}
          onClose={closeModal}
        >
          <p className="text-xs text-slate-500 mb-3">
            {translateUi("Sending to ")}<span className="font-medium text-slate-700">{order.customerEmail}</span>
            {order.customerPhone ? ` · ${order.customerPhone}` : ""}.
          </p>
          <textarea autoFocus rows={4} className={`${inputCls} resize-none mb-4`}
            placeholder={translateUi("Your message…")} value={notifyMsg} onChange={(e) => setNotifyMsg(e.target.value)} />
          <ModalFooter>
            <ModalCancel onClick={closeModal} />
            <ModalSave label={translateUi("Send")} icon={<Send className="w-3.5 h-3.5" />} disabled={busy || !notifyMsg.trim()} onClick={submitNotify} />
          </ModalFooter>
        </Modal>
      )}

      {/* Note on one item */}
      {modal?.kind === "note-line" && (
        <Modal title={`${translateUi("Note")} — ${modal.productName}`} icon={<StickyNote className="w-4 h-4 text-matcha-600" />} onClose={closeModal}>
          <p className="text-xs text-slate-500 mb-3">{translateUi("Internal — the customer doesn't see item notes.")}</p>
          <textarea autoFocus rows={3} className={`${inputCls} resize-none mb-4`}
            placeholder={translateUi("e.g. Picked from back-room stock")} value={lineNote} onChange={(e) => setLineNote(e.target.value)} />
          <ModalFooter>
            <ModalCancel onClick={closeModal} />
            <ModalSave label={translateUi("Add note")} icon={<StickyNote className="w-3.5 h-3.5" />} disabled={busy || !lineNote.trim()} onClick={submitLineNote} />
          </ModalFooter>
        </Modal>
      )}

      {/* Shipping */}
      {modal?.kind === "shipping" && (
        <Modal title={translateUi("Shipping & tracking")} icon={<Truck className="w-4 h-4 text-teal-600" />} onClose={closeModal}>
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
              <label className="block text-xs text-slate-500 mb-1">{translateUi("Carrier")}</label>
              <select className={inputCls} value={trackingCarrier} onChange={(e) => setTrackingCarrier(e.target.value)}>
                <option value="">{translateUi("— Select —")}</option>
                {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">{translateUi("Tracking number")}</label>
              <input autoFocus className={inputCls} placeholder={translateUi("e.g. 1Z999AA10123456784")}
                value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitShipping()} />
            </div>
          </div>
          <ModalFooter>
            <ModalCancel onClick={closeModal} />
            <ModalSave label={translateUi("Save & notify")} icon={<Send className="w-3.5 h-3.5" />}
              disabled={busy || (!trackingCarrier.trim() && !trackingNumber.trim())}
              onClick={submitShipping} />
          </ModalFooter>
        </Modal>
      )}

      {/* Refunds */}
      {modal?.kind === "refunds" && (
        <Modal title={translateUi("Refund")} icon={<RefreshCcw className="w-4 h-4 text-orange-600" />} onClose={closeModal} wide>
          {/* Existing refund */}
          {hasRefund && (
            <div className="mb-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">{translateUi("Current refund")}</p>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-800">
                      {order.refundAmount != null ? formatPrice(order.refundAmount, order.currency, uiLocale) : ""}
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
                          <Check className="w-3 h-3" /> {translateUi("Approve ")}</button>
                        <button disabled={busy} onClick={rejectRefund}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-red-200 text-[11px] font-medium text-red-600 bg-white hover:bg-red-50 cursor-pointer disabled:opacity-40">
                          <X className="w-3 h-3" /> {translateUi("Reject ")}</button>
                      </>
                    )}
                    {order.refundStatus === "APPROVED" && (
                      <button disabled={busy} onClick={acceptRefund}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-blue-200 text-[11px] font-medium text-blue-700 bg-white hover:bg-blue-50 cursor-pointer disabled:opacity-40">
                        <Check className="w-3 h-3" /> {translateUi("Accept ")}</button>
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
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">{translateUi("Issue refund")}</p>
              <p className="text-xs text-slate-500 mb-3">
                {translateUi("Customer will be notified at ")}<span className="font-medium text-slate-700">{order.customerEmail}</span>.
              </p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{translateUi("Amount *")}</label>
                  <input type="number" min="0.01" step="0.01" max={order.total ?? order.subtotal}
                    className={inputCls} placeholder={`Max ${formatPrice(order.total ?? order.subtotal, order.currency, uiLocale)}`}
                    value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{translateUi("Reason")}</label>
                  <input className={inputCls} placeholder={translateUi("e.g. Item damaged")}
                    value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end">
                <ModalSave label={translateUi("Issue refund")} icon={<RefreshCcw className="w-3.5 h-3.5" />}
                  disabled={busy || !refundAmount || parseFloat(refundAmount) <= 0}
                  onClick={submitRefund} />
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Credit Notes */}
      {modal?.kind === "credit-notes" && order.creditNoteRef && (
        <Modal title={translateUi("Credit Note")} icon={<Receipt className="w-4 h-4 text-purple-600" />} onClose={closeModal}>
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {order.refundAmount != null && (
                  <span className="text-xs font-semibold text-slate-800">{formatPrice(order.refundAmount, order.currency, uiLocale)}</span>
                )}
                <span className="font-mono text-[10px] text-slate-400">{order.creditNoteRef}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${CN_STATUS_STYLE[order.creditNoteStatus ?? "PENDING"] ?? ""}`}>
                  {order.creditNoteStatus ?? "Pending"}
                </span>
              </div>
              {order.creditNoteStatus === "PENDING" && (
                <button disabled={busy} onClick={() => { payCreditNote(); closeModal(); }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-purple-200 text-[11px] font-medium text-purple-700 bg-white hover:bg-purple-50 cursor-pointer disabled:opacity-40 shrink-0">
                  <Banknote className="w-3 h-3" /> {translateUi("Pay back ")}</button>
              )}
            </div>
            {order.refundReason && <p className="text-[11px] text-slate-500 mt-1">{order.refundReason}</p>}
          </div>
        </Modal>
      )}

      {/* Create Return */}
      {modal?.kind === "create-return" && (
        <Modal title={translateUi("Request Return")} icon={<RotateCcw className="w-4 h-4 text-orange-600" />} onClose={closeModal}>
          <p className="text-xs text-slate-500 mb-3">{translateUi("Describe why the customer is returning items.")}</p>
          <div className="mb-4">
            <label className="block text-xs text-slate-500 mb-1">{translateUi("Reason")}</label>
            <input autoFocus className={inputCls} placeholder={translateUi("e.g. Item damaged in transit")}
              value={returnReason} onChange={(e) => setReturnReason(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitReturn()} />
          </div>
          <ModalFooter>
            <ModalCancel onClick={closeModal} />
            <ModalSave label={translateUi("Create return")} icon={<RotateCcw className="w-3.5 h-3.5" />}
              disabled={busy} onClick={submitReturn} />
          </ModalFooter>
        </Modal>
      )}

      <Toast toast={toast} />
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** A monospace id (payment reference, Stripe id, tracking number) with a copy button. */
function CopyValue({ value, onCopy }: { value: string; onCopy: () => void }) {
  const { t: translateUi } = useI18n();
  return (
    <span className="inline-flex items-center gap-1 min-w-0">
      <span className="font-mono text-[11px] text-slate-700 truncate max-w-[16rem]" title={value}>{value}</span>
      <button type="button" onClick={onCopy} title={translateUi("Copy")} aria-label={translateUi("Copy")}
        className="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0">
        <Copy className="w-3 h-3" />
      </button>
    </span>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-5 min-w-0 ${className}`}>{children}</div>;
}

function SectionHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3 ${className}`}>
      {children}
    </p>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  const { t: translateUi, locale: uiLocale } = useI18n();
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="text-slate-500 shrink-0">{typeof label === "string" ? translateUi(label) : label}</span>
      <span className="text-slate-800 text-right min-w-0 break-words">{value}</span>
    </div>
  );
}

function ActionGroup({ label, children }: { label: string; children: React.ReactNode }) {
  const { t: translateUi, locale: uiLocale } = useI18n();
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-300 mb-2">{translateUi(label)}</p>
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
  const { t: translateUi, locale: uiLocale } = useI18n();
  return (
    <button disabled={disabled} onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${BTN_CLS[variant]}`}>
      {icon}
      <span className="truncate max-w-[180px]">{translateUi(label)}</span>
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
        className={`bg-white rounded-2xl shadow-2xl border border-slate-200 w-full p-4 sm:p-6 max-h-[90dvh] overflow-y-auto ${wide ? "max-w-lg" : "max-w-md"}`}
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
  const { t: translateUi, locale: uiLocale } = useI18n();
  return (
    <button onClick={onClick}
      className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer">
      {translateUi("Cancel ")}</button>
  );
}

function ModalSave({ label, icon, disabled, onClick }: {
  label: string; icon: React.ReactNode; disabled: boolean; onClick: () => void;
}) {
  const { t: translateUi, locale: uiLocale } = useI18n();
  return (
    <button disabled={disabled} onClick={onClick}
      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-matcha-600 text-white text-xs font-semibold hover:bg-matcha-700 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
      {icon} {translateUi(label)}
    </button>
  );
}

function CommunicationDetails({ activity, message, busy, onClose, onRetry }: {
  activity: ShopOrderActivity; message?: Communication; busy: boolean; onClose: () => void;
  onRetry: (message: Communication) => Promise<void>;
}) {
  const { t, locale } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const [confirmRetry, setConfirmRetry] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  const status = message?.status ?? activity.status;
  const date = (value: string) => new Date(value).toLocaleString(locale);
  return <dialog ref={dialog} onCancel={onClose} aria-labelledby="communication-title"
    className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-full max-w-2xl overflow-y-auto border-0 bg-white p-5 shadow-xl backdrop:bg-slate-900/40 sm:p-7">
    <div className="mb-5 flex items-center justify-between gap-3">
      <h2 id="communication-title" className="text-lg font-bold text-slate-900">{t("Communication details")}</h2>
      <button type="button" onClick={onClose} aria-label={t("Close")} className="flex size-11 cursor-pointer items-center justify-center rounded-lg hover:bg-slate-100"><X className="size-5" /></button>
    </div>
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm text-slate-700">
      <dt>{t("Channel")}</dt><dd>{message?.channel ?? activity.channel ?? t("Not recorded")}</dd>
      <dt>{t("Recipient")}</dt><dd className="break-all">{message?.recipient ?? t("Not recorded")}</dd>
      <dt>{t("Status")}</dt><dd>{status ? t(COMMUNICATION_STATUS[status] ?? status) : t("Not recorded")}</dd>
      <dt>{t("Created")}</dt><dd>{date(message?.createdAt ?? activity.createdAt)}</dd>
      {message && <><dt>{t("Updated")}</dt><dd>{date(message.updatedAt)}</dd></>}
    </dl>
    <p className="mt-4 text-xs text-slate-500">{t("SMS not configured")}</p>
    {message?.failureReason && <p role="status" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{t(message.failureReason)}</p>}
    <h3 className="mt-6 font-semibold text-slate-900">{message?.subject ?? activity.subject ?? activity.message}</h3>
    {message?.htmlBody ? <section className="mt-4" aria-label={t("Email preview")}>
      <iframe title={t("Email preview")} sandbox="" referrerPolicy="no-referrer" className="h-[60dvh] min-h-80 w-full rounded-lg border border-slate-200"
        srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">${message.htmlBody}`} />
    </section> : <p className="mt-3 text-sm text-slate-500">{t("Email preview is unavailable for this activity.")}</p>}
    {message && message.history.length > 0 && <section className="mt-6">
      <h3 className="font-semibold text-slate-900">{t("Sending attempts")}</h3>
      <ol className="mt-3 space-y-3 text-sm">{message.history.map((attempt, index) => <li key={attempt.id} className="rounded-lg border border-slate-200 p-3">
        <p className="font-medium">{index + 1}. {t(COMMUNICATION_STATUS[attempt.status] ?? attempt.status)}</p>
        <p className="mt-1 text-xs text-slate-500">{date(attempt.startedAt)}{attempt.finishedAt ? ` — ${date(attempt.finishedAt)}` : ""}</p>
        {attempt.failureReason && <p className="mt-1 text-xs text-amber-800">{t(attempt.failureReason)}</p>}
      </li>)}</ol>
    </section>}
    {message?.status === "FAILED" && message.channel === "EMAIL" && message.recipient && message.body && <div className="mt-6 border-t border-slate-200 pt-4">
      {confirmRetry && <p className="mb-3 break-words text-sm text-slate-700">{t("Retry this saved email to {recipient}?", { recipient: message.recipient })}</p>}
      <button type="button" disabled={busy} onClick={() => { if (confirmRetry) void onRetry(message); else setConfirmRetry(true); }}
        className="min-h-11 cursor-pointer rounded-lg bg-matcha-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
        {t(confirmRetry ? "Confirm email retry" : "Retry email")}
      </button>
    </div>}
  </dialog>;
}
