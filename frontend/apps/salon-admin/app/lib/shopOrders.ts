import type { ShopOrderStatus, OrderLineActivityType, ShopOrderActivityType } from "~/lib/types";

export const ORDER_STATUS_STYLE: Record<ShopOrderStatus, string> = {
  NEW: "bg-slate-100 text-slate-600 border-slate-200",
  PROCESSING: "bg-amber-50 text-amber-700 border-amber-200",
  SHIPPED: "bg-blue-50 text-blue-700 border-blue-200",
  FULFILLED: "bg-green-50 text-green-700 border-green-200",
  CANCELLED: "bg-red-50 text-red-600 border-red-200",
};

export const ORDER_STATUS_LABEL: Record<ShopOrderStatus, string> = {
  NEW: "New",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  FULFILLED: "Fulfilled",
  CANCELLED: "Cancelled",
};

export const ACTIVITY_LABEL: Record<OrderLineActivityType, string> = {
  LINE_CREATED: "Ordered",
  STATUS_CHANGED: "Status changed",
  USER_NOTIFIED: "Customer notified",
  NOTE_ADDED: "Note",
};

export const ORDER_ACTIVITY_META: Record<
  ShopOrderActivityType,
  { label: string; color: string; dot: string }
> = {
  ORDER_PLACED:       { label: "Order placed",       color: "text-slate-600",  dot: "bg-slate-400" },
  INVOICE_SENT:       { label: "Invoice sent",        color: "text-blue-600",   dot: "bg-blue-400" },
  STATUS_CHANGED:     { label: "Status changed",      color: "text-amber-700",  dot: "bg-amber-400" },
  REFUND_INITIATED:   { label: "Refund initiated",    color: "text-orange-600", dot: "bg-orange-400" },
  REFUND_ACCEPTED:    { label: "Refund accepted",     color: "text-green-600",  dot: "bg-green-400" },
  REFUND_REJECTED:    { label: "Refund rejected",     color: "text-red-600",    dot: "bg-red-400" },
  CREDIT_NOTE_CREATED:{ label: "Credit note created", color: "text-purple-600", dot: "bg-purple-400" },
  CREDIT_PAID:        { label: "Credit paid",         color: "text-green-700",  dot: "bg-green-600" },
  WORK_NOTE:          { label: "Internal note",       color: "text-slate-500",  dot: "bg-slate-300" },
  SHIPMENT_CREATED:   { label: "Shipment dispatched", color: "text-blue-700",   dot: "bg-blue-500" },
  CUSTOMER_NOTIFIED:  { label: "Customer notified",   color: "text-teal-600",   dot: "bg-teal-400" },
};

/** "3m ago", "2h ago", "Apr 5" */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
