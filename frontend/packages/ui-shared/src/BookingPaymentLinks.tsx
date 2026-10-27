import { useI18n } from "@salon/i18n";
import { useMemo, useRef, useState } from "react";

/**
 * Following up on the payment links a salon sends for appointments (a no-show fee, an unpaid visit): the status of a
 * link, an appointment's history of links, and the salon-wide "waiting for payment" list. Shared by the admin app and
 * the desk. Everything is data + callbacks, like {@link BookingPaymentLinkDialog}: each app owns its own `apiFetch`.
 */

export type PaymentLinkStatus = "OPEN" | "PAID" | "EXPIRED" | "SUPERSEDED";

/** A payment link as the API returns it (`GET …/booking/{id}/payment-links`). */
export interface BookingPaymentLink {
  id: number;
  bookingId: number;
  status: PaymentLinkStatus;
  amount: number;
  currency: string;
  url: string;
  /** Who sent it (their sign-in email). */
  createdBy: string | null;
  createdAt: string;
  expiresAt: string;
  paidAt: string | null;
  emailedTo: string | null;
  lastEmailedAt: string | null;
  emailCount: number;
}

/** The latest link of one appointment with what is needed to chase it (`GET …/booking/payment-links`). */
export interface PaymentFollowUp {
  link: BookingPaymentLink;
  customerName: string;
  customerEmail: string | null;
  serviceName: string;
  /** YYYY-MM-DD */
  appointmentDate: string;
  bookingStatus: string;
}

const CHIP: Record<PaymentLinkStatus, { label: string; cls: string }> = {
  OPEN: { label: "Awaiting payment", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  PAID: { label: "Paid", cls: "bg-green-50 text-green-700 border-green-200" },
  EXPIRED: { label: "Link expired", cls: "bg-red-50 text-red-600 border-red-200" },
  SUPERSEDED: { label: "Replaced", cls: "bg-slate-50 text-slate-400 border-slate-200" },
};

/** "3 h", "12 min" until {@code iso}, or null once it has passed. */
function timeLeft(iso: string, now = Date.now()): { value: number; unit: "h" | "min" } | null {
  const minutes = Math.floor((new Date(iso).getTime() - now) / 60000);
  if (minutes <= 0) return null;
  return minutes >= 60 ? { value: Math.round(minutes / 60), unit: "h" } : { value: minutes, unit: "min" };
}

function ago(iso: string, locale: string): string {
  const diffMin = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const abs = Math.abs(diffMin);
  if (abs < 60) return rtf.format(diffMin, "minute");
  if (abs < 60 * 24) return rtf.format(Math.round(diffMin / 60), "hour");
  return rtf.format(Math.round(diffMin / 1440), "day");
}

function money(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

function dateTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Where a link stands, for a badge on an appointment: awaiting payment (with the time left), paid, expired, replaced. */
export function PaymentLinkStatusChip({ link, compact = false }: { link: Pick<BookingPaymentLink, "status" | "expiresAt">; compact?: boolean }) {
  const { t } = useI18n();
  const meta = CHIP[link.status];
  const left = link.status === "OPEN" ? timeLeft(link.expiresAt) : null;
  const suffix = left && !compact ? ` · ${t("expires in {n} {unit}", { n: left.value, unit: left.unit === "h" ? t("h") : t("min") })}` : "";
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold ${meta.cls}`}>
      {t(meta.label)}{suffix}
    </span>
  );
}

/** Copies {@code url}; when the browser refuses, shows it selected so it can be copied by hand. */
function CopyLinkButton({ url, className }: { url: string; className: string }) {
  const { t } = useI18n();
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const input = useRef<HTMLInputElement>(null);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("manual");
      setTimeout(() => input.current?.select(), 0);
    }
  }
  return (
    <>
      <button type="button" onClick={() => void copy()} className={className}>{state === "copied" ? t("Copied") : t("Copy link")}</button>
      {state === "manual" && (
        <input ref={input} readOnly value={url} onFocus={(e) => e.currentTarget.select()}
          aria-label={t("Payment link")} className="mt-2 w-full basis-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700" />
      )}
    </>
  );
}

const btn = "rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50";
const btnPrimary = "rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-700 disabled:opacity-50";

/** Sends the email again, showing why it was refused (just sent, expired, paid, no address) instead of failing silently. */
function useResend(onResend: (link: BookingPaymentLink) => Promise<unknown>) {
  const { t } = useI18n();
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState<{ id: number; text: string; ok: boolean } | null>(null);
  async function resend(link: BookingPaymentLink) {
    setBusy(link.id);
    setMessage(null);
    try {
      await onResend(link);
      setMessage({ id: link.id, text: t("Email sent."), ok: true });
    } catch (e) {
      setMessage({ id: link.id, text: e instanceof Error ? e.message : t("Could not send the email."), ok: false });
    } finally {
      setBusy(null);
    }
  }
  return { busy, message, resend };
}

export interface BookingPaymentLinkHistoryProps {
  /** Newest first; null while loading. */
  links: BookingPaymentLink[] | null;
  customerEmail?: string | null;
  /** Emails the same link again; reject with a readable message. */
  onResend: (link: BookingPaymentLink) => Promise<unknown>;
  /** Opens the dialog to send a fresh link (which replaces any open one). */
  onNew?: () => void;
  error?: string | null;
}

/** Every payment link sent for one appointment, newest first, with what the salon can do about each. */
export function BookingPaymentLinkHistory({ links, customerEmail, onResend, onNew, error }: BookingPaymentLinkHistoryProps) {
  const { t, locale } = useI18n();
  const { busy, message, resend } = useResend(onResend);
  const hasEmail = Boolean(customerEmail?.trim());
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t("Payment links")}</p>
        {onNew && <button type="button" onClick={onNew} className={btnPrimary}>{t("New payment link")}</button>}
      </div>
      {error && <p role="alert" className="text-xs font-medium text-red-600">{error}</p>}
      {links === null ? (
        <p role="status" className="text-xs text-slate-400">{t("Loading…")}</p>
      ) : links.length === 0 ? (
        <p className="text-xs text-slate-400">{t("No payment link has been sent for this appointment.")}</p>
      ) : (
        <ul className="space-y-2">
          {links.map((link) => {
            const open = link.status === "OPEN";
            const note = message?.id === link.id ? message : null;
            return (
              <li key={link.id} className={`rounded-lg border border-slate-200 p-3 ${link.status === "SUPERSEDED" ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-800 tabular-nums">{money(link.amount, link.currency, locale)}</span>
                  <PaymentLinkStatusChip link={link} />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {t("Sent {when}", { when: ago(link.createdAt, locale) })}{link.createdBy ? ` ${t("by {name}", { name: link.createdBy })}` : ""}
                </p>
                {link.emailedTo ? (
                  <p className="text-[11px] text-slate-500">
                    {t("Emailed to {email}", { email: link.emailedTo })}
                    {link.lastEmailedAt ? ` · ${ago(link.lastEmailedAt, locale)}` : ""}
                    {link.emailCount > 1 ? ` · ${t("sent {n} times", { n: link.emailCount })}` : ""}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400">{t("Not emailed — copy the link and send it yourself.")}</p>
                )}
                <p className="text-[11px] text-slate-500">
                  {link.status === "PAID" && link.paidAt ? t("Paid {when}", { when: dateTime(link.paidAt, locale) })
                    : link.status === "SUPERSEDED" ? t("Replaced by a newer link.")
                    : open ? t("Open until {when}", { when: dateTime(link.expiresAt, locale) })
                    : t("Expired {when}", { when: dateTime(link.expiresAt, locale) })}
                </p>
                {open && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <CopyLinkButton url={link.url} className={btn} />
                    {hasEmail && (
                      <button type="button" disabled={busy === link.id} onClick={() => void resend(link)} className={btn}>
                        {busy === link.id ? t("Sending…") : t("Resend email")}
                      </button>
                    )}
                  </div>
                )}
                {note && <p role={note.ok ? "status" : "alert"} className={`mt-1 text-[11px] font-medium ${note.ok ? "text-green-700" : "text-red-600"}`}>{note.text}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

type FollowUpFilter = "OPEN" | "EXPIRED" | "PAID" | "ALL";

export interface PaymentFollowUpsProps {
  /** The latest link of every appointment that has one (status ALL); null while loading. */
  items: PaymentFollowUp[] | null;
  error?: string | null;
  onRefresh?: () => void;
  onResend: (item: PaymentFollowUp) => Promise<unknown>;
  /** Opens the dialog to send a fresh link for this appointment. */
  onNew: (item: PaymentFollowUp) => void;
}

/** What is still owed, and who to chase: open, expired and paid links with the actions to follow up. */
export function PaymentFollowUps({ items, error, onRefresh, onResend, onNew }: PaymentFollowUpsProps) {
  const { t, locale } = useI18n();
  const [filter, setFilter] = useState<FollowUpFilter>("OPEN");
  const { busy, message, resend } = useResend((link) => {
    const item = items?.find((i) => i.link.id === link.id);
    return item ? onResend(item) : Promise.resolve();
  });
  const counts = useMemo(() => {
    const c = { OPEN: 0, EXPIRED: 0, PAID: 0, ALL: items?.length ?? 0 };
    for (const i of items ?? []) if (i.link.status === "OPEN" || i.link.status === "EXPIRED" || i.link.status === "PAID") c[i.link.status]++;
    return c;
  }, [items]);
  const shown = (items ?? []).filter((i) => filter === "ALL" || i.link.status === filter);
  const tabs: [FollowUpFilter, string][] = [["OPEN", t("Open")], ["EXPIRED", t("Expired")], ["PAID", t("Paid")], ["ALL", t("All")]];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
          {tabs.map(([key, label]) => (
            <button key={key} role="tab" aria-selected={filter === key} onClick={() => setFilter(key)}
              className={`rounded-md px-3 py-1 text-xs font-semibold ${filter === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              {label} <span className="tabular-nums text-slate-400">{counts[key]}</span>
            </button>
          ))}
        </div>
        {onRefresh && <button type="button" onClick={onRefresh} className={btn}>{t("Refresh")}</button>}
      </div>
      {error && <p role="alert" className="text-xs font-medium text-red-600">{error}</p>}
      {items === null ? (
        <p role="status" className="py-8 text-center text-sm text-slate-400">{t("Loading…")}</p>
      ) : shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
          {filter === "OPEN" ? t("Nothing is waiting for payment.") : t("No payment links here.")}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {shown.map((item) => {
            const { link } = item;
            const open = link.status === "OPEN";
            const note = message?.id === link.id ? message : null;
            return (
              <li key={link.id} className="space-y-1.5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-semibold text-slate-800">
                    {item.customerName} <span className="font-normal text-slate-400">#{link.bookingId}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums text-slate-800">{money(link.amount, link.currency, locale)}</span>
                    <PaymentLinkStatusChip link={link} />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  {item.serviceName} · {new Date(`${item.appointmentDate}T12:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}
                </p>
                <p className="text-[11px] text-slate-500">
                  {t("Sent {when}", { when: ago(link.createdAt, locale) })}{link.createdBy ? ` ${t("by {name}", { name: link.createdBy })}` : ""}
                  {" · "}
                  {link.emailedTo && link.lastEmailedAt
                    ? t("emailed {when}{times}", { when: ago(link.lastEmailedAt, locale), times: link.emailCount > 1 ? ` (${link.emailCount}×)` : "" })
                    : t("not emailed")}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {open && <CopyLinkButton url={link.url} className={btn} />}
                  {open && Boolean(item.customerEmail?.trim()) && (
                    <button type="button" disabled={busy === link.id} onClick={() => void resend(link)} className={btn}>
                      {busy === link.id ? t("Sending…") : t("Resend email")}
                    </button>
                  )}
                  {link.status !== "PAID" && <button type="button" onClick={() => onNew(item)} className={open ? btn : btnPrimary}>{t("New payment link")}</button>}
                </div>
                {note && <p role={note.ok ? "status" : "alert"} className={`text-[11px] font-medium ${note.ok ? "text-green-700" : "text-red-600"}`}>{note.text}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Indexes the follow-up list by appointment so a calendar/list can show each one's latest link without an extra request each. */
export function latestLinkByBooking(items: PaymentFollowUp[] | null | undefined): Map<number, BookingPaymentLink> {
  const byBooking = new Map<number, BookingPaymentLink>();
  for (const item of items ?? []) byBooking.set(item.link.bookingId, item.link);
  return byBooking;
}
