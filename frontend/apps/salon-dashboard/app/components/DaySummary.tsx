import { useI18n } from "@salon/i18n";
import type { Booking, ServiceItem, StaffMember } from "@salon/ui-website";
import { CalendarClock, CircleDollarSign, UserRoundX } from "lucide-react";
import { formatPrice } from "~/lib/format";

/** One glance at the day: how many, in what state, what is owed, and who is next. */
export function DaySummary({ date, bookings, services, staff, onOpen }: {
  date: string; bookings: Booking[]; services: ServiceItem[]; staff: StaffMember[]; onOpen: (booking: Booking) => void;
}) {
  const { t, locale } = useI18n();
  const day = bookings.filter((b) => b.appointmentDate === date).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const live = day.filter((b) => b.status !== "CANCELLED");
  const count = (status: Booking["status"]) => day.filter((b) => b.status === status).length;
  const priceOf = (b: Booking) => services.find((s) => s.id === b.serviceId);
  // Money the day should bring in: everything that is not cancelled or a no-show.
  const expecting = live.filter((b) => b.status !== "NO_SHOW");
  const currency = priceOf(expecting[0] ?? live[0] ?? day[0] ?? ({} as Booking))?.currency ?? "";
  const expected = expecting.reduce((sum, b) => sum + (priceOf(b)?.price ?? 0), 0);
  const unpaid = live.filter((b) => (b.status === "COMPLETED" || b.status === "CONFIRMED") && b.paymentStatus !== "PAID" && b.paymentStatus !== "NOT_REQUIRED").length;
  const nowKey = new Date().toTimeString().slice(0, 5);
  const todayKey = new Date().toLocaleDateString("sv-SE");
  const next = date === todayKey ? live.find((b) => (b.status === "PENDING" || b.status === "CONFIRMED") && b.startTime.slice(0, 5) >= nowKey) : undefined;
  const stylist = (b: Booking) => staff.find((s) => s.id === b.staffId)?.name;

  const tile = "rounded-xl border border-slate-200 bg-white px-4 py-3";
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <div className={tile}>
      <p className="text-xs font-medium text-slate-500">{t("Appointments")}</p>
      <p className="mt-0.5 text-2xl font-bold text-slate-900">{live.length}</p>
      <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-slate-500">
        <span>{count("PENDING")} {t("pending")}</span><span>{count("CONFIRMED")} {t("confirmed")}</span><span>{count("COMPLETED")} {t("done")}</span>
      </p>
    </div>
    <div className={tile}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><CircleDollarSign className="size-3.5" />{t("Expected takings")}</p>
      <p className="mt-0.5 text-2xl font-bold text-slate-900">{currency ? formatPrice(expected, currency, locale) : "—"}</p>
      <p className="mt-1 text-[11px] text-slate-500">{unpaid ? `${unpaid} ${t("not paid yet")}` : t("Everything settled")}</p>
    </div>
    <div className={tile}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><UserRoundX className="size-3.5" />{t("No-shows & cancellations")}</p>
      <p className="mt-0.5 text-2xl font-bold text-slate-900">{count("NO_SHOW") + count("CANCELLED")}</p>
      <p className="mt-1 text-[11px] text-slate-500">{count("NO_SHOW")} {t("no-show")} · {count("CANCELLED")} {t("cancelled")}</p>
    </div>
    <button type="button" disabled={!next} onClick={() => next && onOpen(next)} className={`${tile} text-left ${next ? "hover:border-matcha-400" : "cursor-default"}`}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><CalendarClock className="size-3.5" />{t("Next up")}</p>
      {next ? <>
        <p className="mt-0.5 truncate text-lg font-bold text-slate-900">{next.startTime.slice(0, 5)} · {next.customerName}</p>
        <p className="mt-1 truncate text-[11px] text-slate-500">{priceOf(next)?.name ?? t("Service")}{stylist(next) ? ` · ${stylist(next)}` : ""}</p>
      </> : <p className="mt-1 text-sm text-slate-400">{date === todayKey ? t("No more appointments today") : t("Shown for today")}</p>}
    </button>
  </div>;
}
