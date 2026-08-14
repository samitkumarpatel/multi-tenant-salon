import { useState } from "react";
import { useOutletContext, useLoaderData } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import {
  CalendarCheck, Check, X, Ban, Clock, User, Phone, Mail,
  RefreshCw, ChevronDown, AlertTriangle,
} from "lucide-react";
import { apiFetch, ADMIN_API } from "~/lib/api";
import type { Booking, BookingStatus, ServiceItem, StaffMember, SalonManageContext } from "~/lib/types";

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const id = params.salonId!;
  const [bookings, services, staff] = await Promise.all([
    apiFetch<Booking[]>(`${ADMIN_API}/${id}/booking`).catch((): Booking[] => []),
    apiFetch<ServiceItem[]>(`${ADMIN_API}/${id}/services`).catch((): ServiceItem[] => []),
    apiFetch<StaffMember[]>(`${ADMIN_API}/${id}/staff`).catch((): StaffMember[] => []),
  ]);
  return { bookings, services, staff };
}

const STATUS_CONFIG: Record<BookingStatus, { label: string; dot: string; bg: string; text: string }> = {
  PENDING:   { label:"Pending",   dot:"bg-amber-500",   bg:"bg-amber-50 border-amber-200",    text:"text-amber-700" },
  CONFIRMED: { label:"Confirmed", dot:"bg-emerald-500", bg:"bg-emerald-50 border-emerald-200", text:"text-emerald-700" },
  CANCELLED: { label:"Cancelled", dot:"bg-red-500",     bg:"bg-red-50 border-red-200",         text:"text-red-600" },
  COMPLETED: { label:"Completed", dot:"bg-stone-400",   bg:"bg-stone-100 border-stone-200",    text:"text-stone-500" },
  NO_SHOW:   { label:"No-show",   dot:"bg-orange-500",  bg:"bg-orange-50 border-orange-200",   text:"text-orange-700" },
};

const STATUS_FILTERS: (BookingStatus | "ALL")[] = ["ALL","PENDING","CONFIRMED","COMPLETED","CANCELLED","NO_SHOW"];

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short", year:"numeric" });
}

export default function SalonBookings() {
  const { salon } = useOutletContext<SalonManageContext>();
  const { bookings: initial, services, staff } = useLoaderData<typeof clientLoader>();

  const [bookings, setBookings] = useState<Booking[]>(initial);
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "ALL">("ALL");
  const [actioning, setActioning] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const serviceMap = Object.fromEntries(services.map((s) => [s.id, s]));
  const staffMap   = Object.fromEntries(staff.map((m) => [m.id, m]));

  const filtered = bookings
    .filter((b) => statusFilter === "ALL" || b.status === statusFilter)
    .sort((a, b) => new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime() || b.startTime.localeCompare(a.startTime));

  async function doAction(bookingId: number, action: string) {
    setActioning(bookingId); setErr(null);
    try {
      const updated = await apiFetch<Booking>(`${ADMIN_API}/${salon.id}/booking/${bookingId}/${action}`, { method:"POST" });
      setBookings((p) => p.map((b) => (b.id === updated.id ? updated : b)));
      if (expanded === bookingId) setExpanded(null);
    } catch (e) { setErr(e instanceof Error ? e.message : `Failed to ${action}`); }
    finally { setActioning(null); }
  }

  async function refresh() {
    setLoading(true); setErr(null);
    try {
      const data = await apiFetch<Booking[]>(`${ADMIN_API}/${salon.id}/booking`);
      setBookings(data);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed to refresh"); }
    finally { setLoading(false); }
  }

  const counts = Object.fromEntries(
    (["PENDING","CONFIRMED","COMPLETED","CANCELLED","NO_SHOW"] as BookingStatus[]).map((s) => [s, bookings.filter((b) => b.status === s).length])
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Bookings</h1>
          <p className="text-xs text-stone-400 mt-0.5">{bookings.length} total · {counts.PENDING} pending · {counts.CONFIRMED} confirmed</p>
        </div>
        <button onClick={refresh} disabled={loading} className="p-2 rounded-lg text-stone-400 hover:text-stone-800 hover:bg-stone-100 transition-colors cursor-pointer disabled:opacity-40">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {err && (
        <div className="flex items-center gap-2 px-4 py-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {err}
        </div>
      )}

      {/* Status filter */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {STATUS_FILTERS.map((s) => {
          const cfg = s === "ALL" ? null : STATUS_CONFIG[s];
          const count = s === "ALL" ? bookings.length : counts[s] ?? 0;
          return (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === s ? "bg-matcha-600 text-white" : "bg-white border border-stone-200 text-stone-500 hover:text-stone-800"
              }`}>
              {cfg && <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />}
              {s === "ALL" ? "All" : cfg!.label}
              <span className={`px-1 rounded text-[10px] font-bold ${statusFilter === s ? "bg-white/20" : "bg-stone-100"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CalendarCheck className="w-10 h-10 text-stone-300 mb-3" />
          <p className="text-stone-400 text-sm">{statusFilter === "ALL" ? "No bookings yet." : `No ${STATUS_CONFIG[statusFilter as BookingStatus].label.toLowerCase()} bookings.`}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((b) => {
            const cfg = STATUS_CONFIG[b.status];
            const svc = serviceMap[b.serviceId];
            const stf = staffMap[b.staffId];
            const isOpen = expanded === b.id;
            const busy = actioning === b.id;

            return (
              <div key={b.id} className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : b.id)}
                  className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-stone-100/30 transition-colors cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-stone-800">{b.customerName}</span>
                      <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${cfg.bg} ${cfg.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} /> {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs text-stone-400">{formatDate(b.appointmentDate)}</span>
                      <span className="text-xs text-stone-400">{b.startTime.slice(0,5)}–{b.endTime.slice(0,5)}</span>
                      {svc && <span className="text-xs text-matcha-500">{svc.name}</span>}
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-stone-400 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 border-t border-stone-200">
                    <div className="pt-3 space-y-2 mb-3">
                      <Row icon={User}  label="Customer" value={b.customerName} />
                      <Row icon={Mail}  label="Email"    value={b.customerEmail} />
                      {b.customerPhone && <Row icon={Phone} label="Phone" value={b.customerPhone} />}
                      {stf && <Row icon={User} label="Staff" value={stf.name} />}
                      {svc && <Row icon={CalendarCheck} label="Service" value={`${svc.name} · ${svc.durationMinutes}m`} />}
                      <Row icon={Clock} label="Time" value={`${formatDate(b.appointmentDate)} · ${b.startTime.slice(0,5)}–${b.endTime.slice(0,5)}`} />
                      {b.notes && <Row icon={AlertTriangle} label="Notes" value={b.notes} />}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {b.status === "PENDING" && (
                        <>
                          <ActionBtn label="Confirm" color="emerald" disabled={busy} onClick={() => doAction(b.id, "confirm")} />
                          <ActionBtn label="Cancel"  color="red"     disabled={busy} onClick={() => doAction(b.id, "cancel")} />
                        </>
                      )}
                      {b.status === "CONFIRMED" && (
                        <>
                          <ActionBtn label="Complete" color="indigo" disabled={busy} onClick={() => doAction(b.id, "complete")} />
                          <ActionBtn label="No-show"  color="amber"  disabled={busy} onClick={() => doAction(b.id, "no-show")} />
                          <ActionBtn label="Cancel"   color="red"    disabled={busy} onClick={() => doAction(b.id, "cancel")} />
                        </>
                      )}
                      {(b.status === "CANCELLED" || b.status === "NO_SHOW") && (
                        <ActionBtn label="Re-confirm" color="emerald" disabled={busy} onClick={() => doAction(b.id, "confirm")} />
                      )}
                    </div>
                    {busy && <p className="text-xs text-stone-400 mt-2">Updating…</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 text-xs">
      <Icon className="w-3.5 h-3.5 text-stone-400 mt-0.5 shrink-0" />
      <span className="text-stone-400 w-14 shrink-0">{label}</span>
      <span className="text-stone-600">{value}</span>
    </div>
  );
}

const COLOR_MAP: Record<string, string> = {
  emerald: "bg-emerald-600 hover:bg-emerald-500 text-white",
  red:     "bg-white hover:bg-red-50 text-red-600 border border-red-200 hover:border-red-300",
  indigo:  "bg-matcha-600 hover:bg-matcha-500 text-white",
  amber:   "bg-white hover:bg-amber-50 text-amber-700 border border-amber-200 hover:border-amber-300",
};
function ActionBtn({ label, color, disabled, onClick }: { label: string; color: string; disabled: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-40 transition-colors ${COLOR_MAP[color]}`}>
      {label === "Confirm" || label === "Re-confirm" ? <Check className="w-3 h-3" /> :
       label === "Cancel" ? <X className="w-3 h-3" /> :
       label === "Complete" ? <Check className="w-3 h-3" /> :
       <Ban className="w-3 h-3" />}
      {label}
    </button>
  );
}
