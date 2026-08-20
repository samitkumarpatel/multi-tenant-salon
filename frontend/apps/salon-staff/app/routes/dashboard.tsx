import { useEffect, useState } from "react";
import { Link } from "react-router";
import { CalendarCheck, CalendarDays, Clock, ArrowRight, UserCircle } from "lucide-react";
import { STAFF_PORTAL_API, apiFetch } from "~/lib/api";
import { getStaffSession } from "~/lib/auth";
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

function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

export default function Dashboard() {
  const session = getStaffSession()!;
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    apiFetch<Booking[]>(`${STAFF_PORTAL_API}/${session.staffId}/appointments`)
      .then(setBookings)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session.staffId]);

  const today = new Date().toISOString().slice(0, 10);
  const todayBookings = bookings
    .filter((b) => b.appointmentDate === today && b.status !== "CANCELLED")
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const upcoming = bookings
    .filter((b) => b.appointmentDate > today && b.status !== "CANCELLED")
    .sort((a, b) => a.appointmentDate.localeCompare(b.appointmentDate) || a.startTime.localeCompare(b.startTime))
    .slice(0, 5);

  const pending   = bookings.filter((b) => b.status === "PENDING").length;
  const confirmed = bookings.filter((b) => b.status === "CONFIRMED" && b.appointmentDate >= today).length;
  const completed = bookings.filter((b) => b.status === "COMPLETED").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Welcome back, {session.name.split(" ")[0]}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {session.salonName
            ? <>Working at <span className="font-semibold text-matcha-700">{session.salonName}</span> · here's your schedule.</>
            : "Here's your schedule at a glance."
          }
        </p>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Today's sessions", value: todayBookings.length, icon: CalendarCheck, color: "bg-matcha-50 text-matcha-600" },
          { label: "Upcoming", value: confirmed, icon: Clock, color: "bg-blue-50 text-blue-600" },
          { label: "Completed", value: completed, icon: CalendarDays, color: "bg-slate-50 text-slate-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center mb-2.5`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{loading ? "–" : value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Today ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Today's appointments</h2>
            <p className="text-xs text-slate-400 mt-0.5">{fmtDate(today)}</p>
          </div>
          <Link
            to="/portal/appointments"
            className="inline-flex items-center gap-1 text-xs font-medium text-matcha-600 hover:text-matcha-700 transition-colors"
          >
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-400">
            <div className="w-3.5 h-3.5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
            Loading…
          </div>
        ) : todayBookings.length === 0 ? (
          <p className="text-xs text-slate-400 px-5 py-6 text-center">No appointments scheduled for today.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {todayBookings.map((b) => (
              <div key={b.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="text-center shrink-0 w-14">
                  <p className="text-sm font-bold text-slate-800">{fmt12(b.startTime)}</p>
                  <p className="text-[10px] text-slate-400">– {fmt12(b.endTime)}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{b.customerName}</p>
                  <p className="text-xs text-slate-400 truncate">{b.customerEmail}</p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLOR[b.status]}`}>
                  {STATUS_LABEL[b.status]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Upcoming ── */}
      {!loading && upcoming.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-800">Upcoming appointments</h2>
            <p className="text-xs text-slate-400 mt-0.5">Next {upcoming.length} confirmed booking{upcoming.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="divide-y divide-slate-100">
            {upcoming.map((b) => (
              <div key={b.id} className="flex items-center gap-4 px-5 py-3">
                <div className="shrink-0">
                  <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex flex-col items-center justify-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase leading-none">
                      {new Date(b.appointmentDate + "T00:00:00").toLocaleDateString("en-US", { month: "short" })}
                    </span>
                    <span className="text-sm font-bold text-slate-800 leading-none">
                      {new Date(b.appointmentDate + "T00:00:00").getDate()}
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{b.customerName}</p>
                  <p className="text-xs text-slate-400">{fmt12(b.startTime)} – {fmt12(b.endTime)}</p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLOR[b.status]}`}>
                  {STATUS_LABEL[b.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && pending > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
          <p className="text-xs text-amber-700">
            You have <span className="font-semibold">{pending} pending</span> appointment{pending !== 1 ? "s" : ""} awaiting confirmation by the admin.
          </p>
        </div>
      )}

      {/* ── Quick links ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { to: "/portal/holidays", label: "Book a holiday", desc: "Mark days you won't be available", icon: CalendarDays },
          { to: "/portal/profile", label: "Edit my profile", desc: "Update your name or phone number", icon: UserCircle },
        ].map(({ to, label, desc, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3 hover:border-matcha-300 hover:bg-matcha-50/30 transition-colors group"
          >
            <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 group-hover:bg-matcha-100 group-hover:border-matcha-200 transition-colors">
              <Icon className="w-4 h-4 text-slate-400 group-hover:text-matcha-600 transition-colors" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">{label}</p>
              <p className="text-xs text-slate-400">{desc}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-matcha-500 ml-auto shrink-0 transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}
