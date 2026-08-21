import { useEffect, useState } from "react";
import { CalendarCheck, Filter } from "lucide-react";
import { STAFF_PORTAL_API, apiFetch } from "~/lib/api";
import { getStaffSession } from "~/lib/auth";
import { InfoBar } from "@salon/ui-shared";
import type { Booking } from "~/lib/types";

const STATUS_COLOR: Record<string, string> = {
  PENDING:   "bg-amber-100 text-amber-800 border-amber-200",
  CONFIRMED: "bg-blue-100 text-blue-800 border-blue-200",
  CANCELLED: "bg-slate-100 text-slate-500 border-slate-200",
  COMPLETED: "bg-green-100 text-green-800 border-green-200",
  NO_SHOW:   "bg-red-100 text-red-700 border-red-200",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending", CONFIRMED: "Confirmed", CANCELLED: "Cancelled",
  COMPLETED: "Completed", NO_SHOW: "No-show",
};

const ALL_STATUSES = ["ALL", "PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;

function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

export default function Appointments() {
  const session = getStaffSession()!;
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<string>("ALL");

  useEffect(() => {
    apiFetch<Booking[]>(`${STAFF_PORTAL_API}/${session.staffId}/appointments`)
      .then(setBookings)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session.staffId]);

  const filtered = bookings
    .filter((b) => filter === "ALL" || b.status === filter)
    .sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate) || b.startTime.localeCompare(a.startTime));

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="mb-6 space-y-2">
        <h1 className="text-xl font-bold text-slate-900">My Appointments</h1>
        <InfoBar>
          All appointments assigned to you across all dates. Use the filter to narrow down by status.
        </InfoBar>
      </div>

      {/* ── Filter row ── */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors border ${
              filter === s
                ? "bg-matcha-600 text-white border-matcha-600"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {s === "ALL" ? "All" : STATUS_LABEL[s]}
          </button>
        ))}
        <span className="text-xs text-slate-400 ml-auto">
          {loading ? "…" : `${filtered.length} result${filtered.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-xs text-slate-400">
          <div className="w-3.5 h-3.5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-10 text-center">
          <CalendarCheck className="w-8 h-8 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">No appointments found</p>
          <p className="text-xs text-slate-400 mt-1">
            {filter === "ALL" ? "You have no appointments yet." : `No ${STATUS_LABEL[filter]?.toLowerCase()} appointments.`}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden divide-y divide-slate-100">
          {filtered.map((b) => {
            const isPast = b.appointmentDate < today;
            return (
              <div key={b.id} className={`flex items-start gap-4 px-5 py-4 ${isPast && b.status !== "COMPLETED" ? "opacity-60" : ""}`}>
                <div className="shrink-0 pt-0.5">
                  <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex flex-col items-center justify-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase leading-none">
                      {new Date(b.appointmentDate + "T00:00:00").toLocaleDateString("en-US", { month: "short" })}
                    </span>
                    <span className="text-sm font-bold text-slate-800 leading-none">
                      {new Date(b.appointmentDate + "T00:00:00").getDate()}
                    </span>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{b.customerName}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {fmtDate(b.appointmentDate)} · {fmt12(b.startTime)} – {fmt12(b.endTime)}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{b.customerEmail}</p>
                      {b.customerPhone && (
                        <p className="text-xs text-slate-400">{b.customerPhone}</p>
                      )}
                      {b.notes && (
                        <p className="text-xs text-slate-500 mt-1 italic">"{b.notes}"</p>
                      )}
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${STATUS_COLOR[b.status]}`}>
                      {STATUS_LABEL[b.status]}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
