import { ADMIN_API } from "~/lib/api";
import { AUTH_MODE, getAccessToken } from "~/lib/auth";
import { formatPrice } from "~/lib/constants";
import type { MembershipBillingInterval, MembershipMoney, MembershipPlanStatus, MembershipStatus } from "~/lib/types";

export const MEMBERSHIP_STATUS_LABEL: Record<MembershipStatus, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  ACTIVE: "Active",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
  INCOMPLETE: "Checkout abandoned",
};

export const MEMBERSHIP_STATUS_STYLE: Record<MembershipStatus, string> = {
  PENDING_PAYMENT: "bg-slate-100 text-slate-600 border-slate-200",
  ACTIVE: "bg-green-50 text-green-700 border-green-200",
  EXPIRED: "bg-amber-50 text-amber-700 border-amber-200",
  CANCELLED: "bg-red-50 text-red-600 border-red-200",
  INCOMPLETE: "bg-slate-50 text-slate-400 border-slate-200",
};

export const PLAN_STATUS_LABEL: Record<MembershipPlanStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "On sale",
  ARCHIVED: "Archived",
};

export const PLAN_STATUS_STYLE: Record<MembershipPlanStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600 border-slate-200",
  ACTIVE: "bg-green-50 text-green-700 border-green-200",
  ARCHIVED: "bg-yellow-50 text-yellow-800 border-yellow-200",
};

export const INTERVAL_LABEL: Record<MembershipBillingInterval, string> = {
  MONTHLY: "Monthly",
  QUARTERLY: "Every 3 months",
  YEARLY: "Yearly",
};

export const INTERVAL_SUFFIX: Record<MembershipBillingInterval, string> = {
  MONTHLY: "/ month",
  QUARTERLY: "/ 3 months",
  YEARLY: "/ year",
};

export const BILLING_INTERVALS: MembershipBillingInterval[] = ["MONTHLY", "QUARTERLY", "YEARLY"];

/** "€49.00 / month". */
export function planPrice(price: number, currency: string, interval: MembershipBillingInterval, locale = "en") {
  return `${formatPrice(price, currency, locale)} ${INTERVAL_SUFFIX[interval]}`;
}

/** Per-currency totals as one line — "€1,240.00 · $90.00", or a formatted zero. */
export function moneyList(amounts: MembershipMoney[], fallbackCurrency = "EUR", locale = "en") {
  if (!amounts.length) return formatPrice(0, fallbackCurrency, locale);
  return amounts.map((m) => formatPrice(m.amount, m.currency, locale)).join(" · ");
}

export function fmtDate(ts?: string | null, locale = "en") {
  return ts ? new Date(ts).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" }) : "—";
}

export function fmtDateTime(ts?: string | null, locale = "en") {
  return ts ? new Date(ts).toLocaleString(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
}

/** The member's QR code as an object URL — the endpoint is owner-gated, so an <img src> can't fetch it directly. */
export async function memberQrUrl(sid: string, subscriptionId: number): Promise<string> {
  const token = AUTH_MODE === "oauth2" ? getAccessToken() : null;
  const res = await fetch(`${ADMIN_API}/${sid}/membership/subscriptions/${subscriptionId}/qr.png`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Could not load the QR code");
  return URL.createObjectURL(await res.blob());
}
