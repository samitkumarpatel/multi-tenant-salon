import type { ShopOrder, ShopOrderStatus, OrderLineActivityType, ShopOrderActivityType, CommunicationPreference } from "~/lib/types";
export type { CommunicationPreference };

/** Server-side page envelope returned by `GET /shop/orders`. */
export interface ShopOrdersPage {
  content: ShopOrder[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  statusCounts: Partial<Record<ShopOrderStatus, number>>;
}

export type OrderSort = "newest" | "oldest";

export const ORDER_STATUS_STYLE: Record<ShopOrderStatus, string> = {
  NEW: "bg-slate-100 text-slate-600 border-slate-200",
  CONFIRMED: "bg-sky-50 text-sky-700 border-sky-200",
  PROCESSING: "bg-amber-50 text-amber-700 border-amber-200",
  READY_TO_SHIP: "bg-violet-50 text-violet-700 border-violet-200",
  SHIPPED: "bg-blue-50 text-blue-700 border-blue-200",
  DELIVERED: "bg-teal-50 text-teal-700 border-teal-200",
  FULFILLED: "bg-green-50 text-green-700 border-green-200",
  CANCELLED: "bg-red-50 text-red-600 border-red-200",
  FAILED: "bg-rose-100 text-rose-700 border-rose-200",
  ON_HOLD: "bg-orange-50 text-orange-700 border-orange-200",
};

export const ORDER_STATUS_LABEL: Record<ShopOrderStatus, string> = {
  NEW: "New",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  READY_TO_SHIP: "Ready to Ship",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  FULFILLED: "Fulfilled",
  CANCELLED: "Cancelled",
  FAILED: "Failed",
  ON_HOLD: "On Hold",
};

export const RETURN_STATUS_LABEL: Record<string, string> = {
  REQUESTED: "Requested",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  ITEM_SHIPPED: "Item Shipped",
  RECEIVED: "Received",
  INSPECTING: "Inspecting",
  ACCEPTED: "Accepted",
  CLOSED: "Closed",
};

export const RETURN_STATUS_STYLE: Record<string, string> = {
  REQUESTED: "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED: "bg-blue-50 text-blue-700 border-blue-200",
  REJECTED: "bg-red-50 text-red-600 border-red-200",
  ITEM_SHIPPED: "bg-violet-50 text-violet-700 border-violet-200",
  RECEIVED: "bg-teal-50 text-teal-700 border-teal-200",
  INSPECTING: "bg-orange-50 text-orange-700 border-orange-200",
  ACCEPTED: "bg-green-50 text-green-700 border-green-200",
  CLOSED: "bg-slate-100 text-slate-600 border-slate-200",
};

export const ACTIVITY_LABEL: Record<OrderLineActivityType, string> = {
  LINE_CREATED: "Ordered",
  STATUS_CHANGED: "Status changed",
  USER_NOTIFIED: "Customer notified",
  NOTE_ADDED: "Note",
};

export const ORDER_ACTIVITY_META: Partial<Record<ShopOrderActivityType | string, { label: string; color: string; dot: string }>> & Record<ShopOrderActivityType, { label: string; color: string; dot: string }> = {
  ORDER_PLACED:           { label: "Order placed",           color: "text-slate-600",  dot: "bg-slate-400" },
  INVOICE_SENT:           { label: "Invoice sent",           color: "text-blue-600",   dot: "bg-blue-400" },
  STATUS_CHANGED:         { label: "Status changed",         color: "text-amber-700",  dot: "bg-amber-400" },
  REFUND_INITIATED:       { label: "Refund initiated",       color: "text-orange-600", dot: "bg-orange-400" },
  REFUND_APPROVED:        { label: "Refund approved",        color: "text-sky-600",    dot: "bg-sky-400" },
  REFUND_ACCEPTED:        { label: "Refund processed",       color: "text-green-600",  dot: "bg-green-400" },
  REFUND_REJECTED:        { label: "Refund rejected",        color: "text-red-600",    dot: "bg-red-400" },
  CREDIT_NOTE_CREATED:    { label: "Credit note created",    color: "text-purple-600", dot: "bg-purple-400" },
  CREDIT_PAID:            { label: "Credit paid",            color: "text-green-700",  dot: "bg-green-600" },
  WORK_NOTE:              { label: "Internal note",          color: "text-slate-500",  dot: "bg-slate-300" },
  SHIPMENT_CREATED:       { label: "Shipment dispatched",    color: "text-blue-700",   dot: "bg-blue-500" },
  CUSTOMER_NOTIFIED:      { label: "Customer notified",      color: "text-teal-600",   dot: "bg-teal-400" },
  FULFILLMENT_CREATED:    { label: "Fulfillment created",    color: "text-violet-600", dot: "bg-violet-400" },
  FULFILLMENT_UPDATED:    { label: "Fulfillment updated",    color: "text-violet-700", dot: "bg-violet-500" },
  SHIPMENT_UPDATED:       { label: "Shipment updated",       color: "text-blue-600",   dot: "bg-blue-400" },
  INVOICE_VOIDED:         { label: "Invoice voided",         color: "text-slate-500",  dot: "bg-slate-300" },
  RETURN_REQUESTED:       { label: "Return requested",       color: "text-orange-600", dot: "bg-orange-400" },
  RETURN_UPDATED:         { label: "Return updated",         color: "text-orange-700", dot: "bg-orange-500" },
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
