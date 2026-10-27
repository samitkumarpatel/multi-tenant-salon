import { useI18n } from "@salon/i18n";
import { useDeferredValue, useMemo, useState } from "react";
import { CalendarDays, Search, X } from "lucide-react";
import type { Booking, ServiceItem, StaffMember } from "@salon/ui-website";
import { searchBookings } from "~/lib/bookingSearch";

const STATUS_STYLE: Record<string, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  CONFIRMED: "border-sky-200 bg-sky-50 text-sky-700",
  COMPLETED: "border-green-200 bg-green-50 text-green-700",
  CANCELLED: "border-slate-200 bg-slate-50 text-slate-500",
  NO_SHOW: "border-red-200 bg-red-50 text-red-600",
};

/**
 * Find an appointment on any date by customer name, booking number, email or phone. The desk already holds every
 * booking, so this searches that list as you type; picking a result opens the same detail dialog as the calendar.
 */
export function BookingSearch({ salonId, bookings, staff, services, onOpen, onGoToDate }: {
  /** The salon the desk is working in. The list comes from that salon's API, but only its own bookings are ever searched. */
  salonId: string; bookings: Booking[]; staff: StaffMember[]; services: ServiceItem[];
  onOpen: (booking: Booking) => void; onGoToDate: (date: string) => void;
}) {
  const { t: translateUi, locale } = useI18n();
  const [query, setQuery] = useState("");
  // Typing stays responsive on a long booking list: the list is filtered a beat behind the keystrokes.
  const deferred = useDeferredValue(query);
  const own = useMemo(() => bookings.filter((booking) => String(booking.salonId).toLowerCase() === salonId.toLowerCase()), [bookings, salonId]);
  const { results, total } = useMemo(() => searchBookings(own, deferred), [own, deferred]);
  const staffName = useMemo(() => new Map(staff.map((member) => [member.id, member.name])), [staff]);
  const serviceName = useMemo(() => new Map(services.map((service) => [service.id, service.name])), [services]);
  const searching = query.trim() !== "";

  return (
    <section role="search" className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 px-4 py-2.5">
        <Search className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Escape") setQuery(""); else if (event.key === "Enter" && results[0]) onOpen(results[0]); }}
          aria-label={translateUi("Search appointments")} autoComplete="off" spellCheck={false}
          placeholder={translateUi("Search by customer name, booking number, email or phone")}
          className="min-h-9 min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 [&::-webkit-search-cancel-button]:hidden" />
        {searching && (
          <button type="button" onClick={() => setQuery("")} aria-label={translateUi("Clear search")}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X className="size-4" /></button>
        )}
      </div>

      {searching && (
        <div className="border-t border-slate-100">
          <p role="status" aria-live="polite" className="px-4 pt-2 text-[11px] font-medium text-slate-400">
            {total === 0 ? translateUi("No appointments match “{query}”.", { query: query.trim() })
              : total > results.length ? translateUi("Showing {shown} of {total} matches — type more to narrow it down.", { shown: results.length, total })
              : translateUi("{count} found", { count: total })}
          </p>
          {results.length > 0 && (
            <ul className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto">
              {results.map((booking) => (
                <li key={booking.id} className="flex items-stretch">
                  <button type="button" onClick={() => onOpen(booking)}
                    className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none">
                    <span className="w-14 shrink-0 text-center text-xs leading-tight text-slate-500">
                      <span className="block font-semibold text-slate-700">{new Date(`${booking.appointmentDate}T00:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short" })}</span>
                      <span className="tabular-nums">{booking.startTime.slice(0, 5)}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="truncate text-sm font-semibold text-slate-800">{booking.customerName || translateUi("Customer")}</span>
                        <span className="shrink-0 text-[11px] tabular-nums text-slate-400">#{booking.id}</span>
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {[serviceName.get(booking.serviceId), staffName.get(booking.staffId)].filter(Boolean).join(" · ")}
                      </span>
                      <span className="block truncate text-[11px] text-slate-400">{[booking.customerPhone, booking.customerEmail].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[booking.status] ?? STATUS_STYLE.PENDING}`}>{booking.status.replace("_", " ")}</span>
                  </button>
                  <button type="button" onClick={() => onGoToDate(booking.appointmentDate)}
                    title={translateUi("Show this day")} aria-label={translateUi("Show this day")}
                    className="shrink-0 border-l border-slate-100 px-3 text-slate-400 hover:bg-slate-50 hover:text-slate-700">
                    <CalendarDays className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
