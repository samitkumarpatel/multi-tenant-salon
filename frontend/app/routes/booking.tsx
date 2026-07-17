import { useState, useEffect, useRef } from "react";
import { useLoaderData, useOutletContext } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import {
  CalendarCheck, Users, Plus, Trash2, X, ChevronDown, ChevronLeft, ChevronRight, Clock,
  CheckCircle, AlertCircle, RefreshCw, Check, Ban,
} from "lucide-react";
import { SALOON_ADMIN_API, apiFetch, resolveSaloonUUID } from "~/lib/api";
import { DAYS, DAY_SHORT, CATEGORY_LABEL, STAFF_ROLE_LABEL, formatPrice } from "~/lib/constants";
import type {
  LayoutContext, StaffMember, ServiceItem, Booking, BookingStatus,
  StaffAvailability, StaffAvailabilityOverride,
} from "~/lib/types";
import InfoBar from "~/components/InfoBar";

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const sid = await resolveSaloonUUID(params.saloonId!);
  const [bookings, staff, services] = await Promise.all([
    apiFetch<Booking[]>(`${SALOON_ADMIN_API}/${sid}/booking`),
    apiFetch<StaffMember[]>(`${SALOON_ADMIN_API}/${sid}/staff`),
    apiFetch<ServiceItem[]>(`${SALOON_ADMIN_API}/${sid}/services`),
  ]);
  return { bookings, staff, services };
}

// ── shared styles ─────────────────────────────────────────────────────────────

const inputCls =
  "w-full px-3 py-2 border border-slate-200 rounded-md text-sm outline-none transition focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 bg-white text-slate-900";
const fieldLabel = "block text-sm font-medium text-slate-700 mb-1";

// ── status helpers ─────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<BookingStatus, string> = {
  PENDING:   "bg-amber-100 text-amber-800 border-amber-200",
  CONFIRMED: "bg-blue-100 text-blue-800 border-blue-200",
  CANCELLED: "bg-slate-100 text-slate-500 border-slate-200",
  COMPLETED: "bg-green-100 text-green-800 border-green-200",
  NO_SHOW:   "bg-red-100 text-red-700 border-red-200",
};

const STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING: "Pending", CONFIRMED: "Confirmed", CANCELLED: "Cancelled",
  COMPLETED: "Completed", NO_SHOW: "No-show",
};

const ALL_STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"];

function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

// ── Calendar constants ────────────────────────────────────────────────────────

const HOUR_H    = 64;   // px per hour
const CAL_START = 8;    // 08:00
const CAL_END   = 20;   // 20:00
const CAL_HOURS = Array.from({ length: CAL_END - CAL_START }, (_, i) => CAL_START + i);

function timeToY(t: string) {
  const [h, m] = t.split(":").map(Number);
  return ((h - CAL_START) * 60 + m) * (HOUR_H / 60);
}
function slotHeight(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(((eh * 60 + em) - (sh * 60 + sm)) * (HOUR_H / 60), 24);
}
function fmtHour(h: number) {
  if (h === 0)  return "12am";
  if (h === 12) return "12pm";
  return h > 12 ? `${h - 12}pm` : `${h}am`;
}

const BLOCK_COLOR: Record<BookingStatus, string> = {
  PENDING:   "bg-amber-50  border-l-amber-400  text-amber-900",
  CONFIRMED: "bg-blue-50   border-l-blue-500   text-blue-900",
  CANCELLED: "bg-slate-100 border-l-slate-300  text-slate-400",
  COMPLETED: "bg-green-50  border-l-green-500  text-green-900",
  NO_SHOW:   "bg-red-50    border-l-red-400    text-red-900",
};

// ── Booking detail modal ──────────────────────────────────────────────────────

function BookingDetailModal({
  booking, staffMap, serviceMap, onClose, onAction, onReschedule, onDelete,
}: {
  booking: Booking;
  staffMap: Map<number, StaffMember>;
  serviceMap: Map<number, ServiceItem>;
  onClose: () => void;
  onAction: (id: number, action: string) => void;
  onReschedule: (b: Booking) => void;
  onDelete: (b: Booking) => void;
}) {
  const member  = staffMap.get(booking.staffId);
  const service = serviceMap.get(booking.serviceId);
  const isPast  = new Date(booking.appointmentDate) < new Date(new Date().toDateString());

  return (
    <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-slate-200">
        <div className="flex items-start justify-between mb-4 pb-4 border-b border-slate-100">
          <div>
            <p className="font-semibold text-slate-900">{booking.customerName}</p>
            <p className="text-xs text-slate-500 mt-0.5">{booking.customerEmail}</p>
            {booking.customerPhone && <p className="text-xs text-slate-400">{booking.customerPhone}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[0.65rem] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${STATUS_COLOR[booking.status]}`}>
              {STATUS_LABEL[booking.status]}
            </span>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="space-y-2 text-sm text-slate-600 mb-4">
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{booking.appointmentDate} · {fmt12(booking.startTime)} – {fmt12(booking.endTime)}</span>
          </div>
          {service && (
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-[0.65rem] font-bold uppercase shrink-0">Svc</span>
              <span>{service.name} ({service.durationMinutes} min · {formatPrice(service.price, service.currency)})</span>
            </div>
          )}
          {member && (
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{member.name} · {STAFF_ROLE_LABEL[member.role] ?? member.role}</span>
            </div>
          )}
          {booking.notes && <p className="text-xs text-slate-400 italic">{booking.notes}</p>}
        </div>

        {!isPast && booking.status !== "CANCELLED" && booking.status !== "COMPLETED" && booking.status !== "NO_SHOW" && (
          <div className="flex flex-wrap gap-1.5 pt-4 border-t border-slate-100 mb-4">
            {booking.status === "PENDING" && (
              <button onClick={() => onAction(booking.id, "confirm")}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 cursor-pointer">
                <Check className="w-3 h-3" /> Confirm
              </button>
            )}
            {(booking.status === "PENDING" || booking.status === "CONFIRMED") && (
              <>
                <button onClick={() => onReschedule(booking)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer">
                  <RefreshCw className="w-3 h-3" /> Reschedule
                </button>
                <button onClick={() => onAction(booking.id, "cancel")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer">
                  <Ban className="w-3 h-3" /> Cancel
                </button>
              </>
            )}
            {booking.status === "CONFIRMED" && (
              <>
                <button onClick={() => onAction(booking.id, "complete")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-green-600 text-white hover:bg-green-700 cursor-pointer">
                  <CheckCircle className="w-3 h-3" /> Complete
                </button>
                <button onClick={() => onAction(booking.id, "no-show")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border border-amber-200 text-amber-700 hover:bg-amber-50 cursor-pointer">
                  <AlertCircle className="w-3 h-3" /> No-show
                </button>
              </>
            )}
          </div>
        )}

        <button onClick={() => onDelete(booking)}
          className="flex items-center gap-1 text-[0.65rem] font-medium text-slate-400 hover:text-red-500 cursor-pointer">
          <Trash2 className="w-3 h-3" /> Delete booking
        </button>
      </div>
    </div>
  );
}

// ── Day calendar view ─────────────────────────────────────────────────────────

function DayCalendarView({
  bookings, staffMap, serviceMap, staff, onAction, onReschedule, onDelete,
}: {
  bookings: Booking[];
  staffMap: Map<number, StaffMember>;
  serviceMap: Map<number, ServiceItem>;
  staff: StaffMember[];
  onAction: (id: number, action: string) => void;
  onReschedule: (b: Booking) => void;
  onDelete: (b: Booking) => void;
}) {
  const todayStr = new Date().toISOString().split("T")[0];
  const [viewDate, setViewDate] = useState(todayStr);
  const [selected, setSelected] = useState<Booking | null>(null);
  const gridRef   = useRef<HTMLDivElement>(null);

  const isToday    = viewDate === todayStr;
  const activeStaff = staff.filter((s) => s.status === "ACTIVE");
  const dayBookings = bookings.filter((b) => b.appointmentDate === viewDate);

  const now     = new Date();
  const nowY    = ((now.getHours() - CAL_START) * 60 + now.getMinutes()) * (HOUR_H / 60);
  const showNow = isToday && now.getHours() >= CAL_START && now.getHours() < CAL_END;

  // Scroll near the current time (or start of day) when the date changes
  useEffect(() => {
    if (!gridRef.current) return;
    gridRef.current.scrollTop = isToday ? Math.max(0, nowY - 120) : 0;
  }, [viewDate]); // eslint-disable-line react-hooks/exhaustive-deps

  function goDay(offset: number) {
    const d = new Date(viewDate + "T12:00:00");
    d.setDate(d.getDate() + offset);
    setViewDate(d.toISOString().split("T")[0]);
  }

  const formattedDate = new Date(viewDate + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="space-y-3">
      {/* ── Date navigation ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => goDay(-1)}
          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button onClick={() => goDay(1)}
          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-slate-800 flex-1 min-w-0 truncate">{formattedDate}</span>
        {!isToday && (
          <button onClick={() => setViewDate(todayStr)}
            className="px-3 py-1 text-xs font-medium rounded-md bg-matcha-600 text-white hover:bg-matcha-700 cursor-pointer transition-colors shrink-0">
            Today
          </button>
        )}
        <input type="date" value={viewDate}
          onChange={(e) => e.target.value && setViewDate(e.target.value)}
          className="border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-700 outline-none focus:border-matcha-500 cursor-pointer shrink-0" />
      </div>

      {/* ── Calendar grid ── */}
      {activeStaff.length === 0 ? (
        <div className="text-center py-20 text-slate-400 text-sm">No active staff — onboard staff first.</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Sticky staff header */}
          <div className="flex border-b border-slate-200 bg-white z-10 sticky top-0">
            {/* Time gutter header */}
            <div className="w-14 shrink-0 border-r border-slate-100 py-2" />
            {/* One column per stylist */}
            {activeStaff.map((s) => {
              const count = dayBookings.filter((b) => b.staffId === s.id).length;
              return (
                <div key={s.id}
                  className="flex-1 min-w-[140px] px-2 py-2 border-r border-slate-100 last:border-r-0 overflow-hidden">
                  <p className="text-xs font-semibold text-slate-800 truncate">{s.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {STAFF_ROLE_LABEL[s.role] ?? s.role}
                    {count > 0 && <span className="ml-1 text-matcha-600 font-semibold">{count} appt</span>}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Scrollable time grid */}
          <div ref={gridRef} className="overflow-y-auto" style={{ maxHeight: 560 }}>
            <div className="flex" style={{ height: (CAL_END - CAL_START) * HOUR_H }}>

              {/* ── Time gutter ── */}
              <div className="w-14 shrink-0 border-r border-slate-100 relative select-none">
                {CAL_HOURS.map((h) => (
                  <div key={h} style={{ height: HOUR_H }} className="border-b border-slate-100" />
                ))}
                {CAL_HOURS.map((h) => (
                  <span
                    key={h}
                    className="absolute right-2 text-[9px] font-medium text-slate-400 leading-none"
                    style={{ top: (h - CAL_START) * HOUR_H + 4 }}
                  >
                    {fmtHour(h)}
                  </span>
                ))}
              </div>

              {/* ── Stylist columns ── */}
              {activeStaff.map((s) => {
                const col = dayBookings.filter((b) => b.staffId === s.id);
                return (
                  <div key={s.id}
                    className="flex-1 min-w-[140px] border-r border-slate-100 last:border-r-0 relative">
                    {/* Hour gridlines */}
                    {CAL_HOURS.map((h) => (
                      <div key={h} style={{ height: HOUR_H }} className="border-b border-slate-100" />
                    ))}

                    {/* Current-time indicator */}
                    {showNow && (
                      <div className="absolute inset-x-0 pointer-events-none z-10 flex items-center"
                        style={{ top: nowY }}>
                        <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 -ml-1" />
                        <div className="flex-1 h-px bg-red-400" />
                      </div>
                    )}

                    {/* Booking blocks */}
                    {col.map((b) => {
                      const top    = timeToY(b.startTime);
                      const height = slotHeight(b.startTime, b.endTime);
                      const svc    = serviceMap.get(b.serviceId);
                      return (
                        <button
                          key={b.id}
                          onClick={() => setSelected(b)}
                          style={{ top, height, position: "absolute", left: 3, right: 3 }}
                          className={`rounded border-l-2 px-1.5 py-0.5 text-left overflow-hidden hover:brightness-95 transition-all cursor-pointer shadow-sm ${BLOCK_COLOR[b.status]}`}
                        >
                          <p className="text-[10px] font-bold leading-tight truncate">{b.customerName}</p>
                          {height > 34 && (
                            <p className="text-[9px] leading-tight truncate opacity-70 mt-0.5">
                              {fmt12(b.startTime)}{svc ? ` · ${svc.name}` : ""}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Empty-day note */}
      {activeStaff.length > 0 && dayBookings.length === 0 && (
        <p className="text-center text-xs text-slate-400">
          No appointments {isToday ? "today" : `on ${formattedDate}`}.
        </p>
      )}

      {/* Booking detail modal */}
      {selected && (
        <BookingDetailModal
          booking={selected}
          staffMap={staffMap}
          serviceMap={serviceMap}
          onClose={() => setSelected(null)}
          onAction={(id, action) => { onAction(id, action); setSelected(null); }}
          onReschedule={(b) => { onReschedule(b); setSelected(null); }}
          onDelete={(b) => { onDelete(b); setSelected(null); }}
        />
      )}
    </div>
  );
}

// ── Booking card ──────────────────────────────────────────────────────────────

function BookingCard({
  booking, staffMap, serviceMap,
  onAction, onReschedule, onDelete,
}: {
  booking: Booking;
  staffMap: Map<number, StaffMember>;
  serviceMap: Map<number, ServiceItem>;
  onAction: (id: number, action: string) => void;
  onReschedule: (b: Booking) => void;
  onDelete: (b: Booking) => void;
}) {
  const staff = staffMap.get(booking.staffId);
  const service = serviceMap.get(booking.serviceId);
  const isPast = new Date(booking.appointmentDate) < new Date(new Date().toDateString());

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-sm text-slate-900">{booking.customerName}</p>
          <p className="text-xs text-slate-500">{booking.customerEmail}</p>
          {booking.customerPhone && <p className="text-xs text-slate-400">{booking.customerPhone}</p>}
        </div>
        <span className={`shrink-0 text-[0.65rem] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${STATUS_COLOR[booking.status]}`}>
          {STATUS_LABEL[booking.status]}
        </span>
      </div>

      <div className="text-xs text-slate-600 space-y-1 border-t border-slate-100 pt-3">
        <div className="flex items-center gap-2">
          <CalendarCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>{booking.appointmentDate} · {fmt12(booking.startTime)} – {fmt12(booking.endTime)}</span>
        </div>
        {service && (
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[0.7rem] font-bold uppercase tracking-wider shrink-0">Svc</span>
            <span>{service.name} ({service.durationMinutes} min · {formatPrice(service.price, service.currency)})</span>
          </div>
        )}
        {staff && (
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{staff.name} · {STAFF_ROLE_LABEL[staff.role] ?? staff.role}</span>
          </div>
        )}
        {booking.notes && <p className="text-slate-400 italic">{booking.notes}</p>}
      </div>

      {!isPast && booking.status !== "CANCELLED" && booking.status !== "COMPLETED" && booking.status !== "NO_SHOW" && (
        <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
          {booking.status === "PENDING" && (
            <button onClick={() => onAction(booking.id, "confirm")}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer">
              <Check className="w-3 h-3" /> Confirm
            </button>
          )}
          {(booking.status === "PENDING" || booking.status === "CONFIRMED") && (
            <>
              <button onClick={() => onReschedule(booking)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer">
                <RefreshCw className="w-3 h-3" /> Reschedule
              </button>
              <button onClick={() => onAction(booking.id, "cancel")}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors cursor-pointer">
                <Ban className="w-3 h-3" /> Cancel
              </button>
            </>
          )}
          {booking.status === "CONFIRMED" && (
            <>
              <button onClick={() => onAction(booking.id, "complete")}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors cursor-pointer">
                <CheckCircle className="w-3 h-3" /> Complete
              </button>
              <button onClick={() => onAction(booking.id, "no-show")}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer">
                <AlertCircle className="w-3 h-3" /> No-show
              </button>
            </>
          )}
        </div>
      )}

      <button onClick={() => onDelete(booking)}
        className="self-end inline-flex items-center gap-1 text-[0.65rem] font-medium text-slate-400 hover:text-red-500 transition-colors cursor-pointer mt-auto">
        <Trash2 className="w-3 h-3" /> Delete
      </button>
    </div>
  );
}

// ── Weekly schedule editor ────────────────────────────────────────────────────

const DEFAULT_SCHEDULE: StaffAvailability[] = DAYS.map((day) => ({
  id: 0, saloonId: "", staffId: 0, dayOfWeek: day,
  startTime: "09:00", endTime: "17:00", available: day !== "SUNDAY",
}));

function AvailabilityPanel({ saloonId, staff }: { saloonId: string; staff: StaffMember[] }) {
  const [selectedStaff, setSelectedStaff] = useState<number>(staff[0]?.id ?? 0);
  const [schedule, setSchedule] = useState<StaffAvailability[]>(DEFAULT_SCHEDULE);
  const [overrides, setOverrides] = useState<StaffAvailabilityOverride[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [addOverride, setAddOverride] = useState(false);
  const [overrideForm, setOverrideForm] = useState({
    overrideDate: "", startTime: "09:00", endTime: "17:00", available: true, reason: "",
  });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function notify(msg: string, type = "success") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    if (!selectedStaff) return;
    apiFetch<StaffAvailability[]>(`${SALOON_ADMIN_API}/${saloonId}/staff/${selectedStaff}/availability`)
      .then((data) => {
        if (data.length === 0) {
          setSchedule(DEFAULT_SCHEDULE);
        } else {
          setSchedule(DAYS.map((day) => {
            const found = data.find((d) => d.dayOfWeek === day);
            return found ?? { id: 0, saloonId, staffId: selectedStaff, dayOfWeek: day, startTime: "09:00", endTime: "17:00", available: false };
          }));
        }
      })
      .catch(() => setSchedule(DEFAULT_SCHEDULE));
    apiFetch<StaffAvailabilityOverride[]>(`${SALOON_ADMIN_API}/${saloonId}/staff/${selectedStaff}/availability/overrides`)
      .then(setOverrides)
      .catch(() => setOverrides([]));
  }, [selectedStaff, saloonId]);

  function toggleDay(day: string) {
    setSchedule((prev) => prev.map((s) => s.dayOfWeek === day ? { ...s, available: !s.available } : s));
  }
  function setTime(day: string, field: "startTime" | "endTime", value: string) {
    setSchedule((prev) => prev.map((s) => s.dayOfWeek === day ? { ...s, [field]: value } : s));
  }

  async function saveSchedule() {
    setSaving(true);
    try {
      const body = schedule.map((s) => ({ dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime, available: s.available }));
      await apiFetch<StaffAvailability[]>(`${SALOON_ADMIN_API}/${saloonId}/staff/${selectedStaff}/availability`, {
        method: "PUT", body: JSON.stringify(body),
      });
      notify("Schedule saved!");
    } catch (e) { notify(e instanceof Error ? e.message : "Error", "error"); }
    finally { setSaving(false); }
  }

  async function saveOverride() {
    if (!overrideForm.overrideDate) return;
    setSaving(true);
    try {
      const saved = await apiFetch<StaffAvailabilityOverride>(
        `${SALOON_ADMIN_API}/${saloonId}/staff/${selectedStaff}/availability/overrides`,
        { method: "POST", body: JSON.stringify({
          overrideDate: overrideForm.overrideDate,
          startTime: overrideForm.available ? overrideForm.startTime : null,
          endTime: overrideForm.available ? overrideForm.endTime : null,
          available: overrideForm.available,
          reason: overrideForm.reason || null,
        }) },
      );
      setOverrides((p) => [...p, saved]);
      setAddOverride(false);
      setOverrideForm({ overrideDate: "", startTime: "09:00", endTime: "17:00", available: true, reason: "" });
      notify("Exception added!");
    } catch (e) { notify(e instanceof Error ? e.message : "Error", "error"); }
    finally { setSaving(false); }
  }

  async function deleteOverride(oid: number) {
    try {
      await apiFetch(`${SALOON_ADMIN_API}/${saloonId}/staff/${selectedStaff}/availability/overrides/${oid}`, { method: "DELETE" });
      setOverrides((p) => p.filter((o) => o.id !== oid));
      notify("Exception removed.");
    } catch (e) { notify(e instanceof Error ? e.message : "Error", "error"); }
  }

  if (!staff.length) return (
    <div className="text-center py-20 text-slate-400 text-sm">No staff members yet — onboard staff first.</div>
  );

  const currentStaff = staff.find((s) => s.id === selectedStaff);

  return (
    <div className="space-y-6">
      {/* Staff selector */}
      <div className="flex items-center gap-3 relative z-10">
        <label className="text-sm font-medium text-slate-700 shrink-0">Staff member</label>
        <div className="relative">
          <select
            className={`${inputCls} pr-8 w-auto`}
            value={selectedStaff}
            onChange={(e) => setSelectedStaff(Number(e.target.value))}
          >
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
        {currentStaff && (
          <span className="text-xs text-slate-400">{STAFF_ROLE_LABEL[currentStaff.role] ?? currentStaff.role}</span>
        )}
      </div>

      {/* Weekly schedule */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Weekly schedule</h3>
            <p className="text-xs text-slate-400 mt-0.5">The default repeating hours for this staff member. Toggle a day off to mark them unavailable every week on that day.</p>
          </div>
          <button
            onClick={saveSchedule}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-matcha-600 text-white text-xs font-medium hover:bg-matcha-700 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
          >
            {saving ? "Saving…" : "Save schedule"}
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {schedule.map((s) => (
            <div key={s.dayOfWeek} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-xs font-semibold text-slate-500 w-8">{DAY_SHORT[s.dayOfWeek]}</span>
              <button
                onClick={() => toggleDay(s.dayOfWeek)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${s.available ? "bg-matcha-600" : "bg-slate-200"}`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${s.available ? "translate-x-4" : "translate-x-0"}`} />
              </button>
              {s.available ? (
                <div className="flex items-center gap-2 ml-1">
                  <input
                    type="time"
                    value={s.startTime}
                    onChange={(e) => setTime(s.dayOfWeek, "startTime", e.target.value)}
                    className="border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-700 outline-none focus:border-matcha-500"
                  />
                  <span className="text-slate-400 text-xs">–</span>
                  <input
                    type="time"
                    value={s.endTime}
                    onChange={(e) => setTime(s.dayOfWeek, "endTime", e.target.value)}
                    className="border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-700 outline-none focus:border-matcha-500"
                  />
                </div>
              ) : (
                <span className="text-xs text-slate-400 ml-1">Unavailable</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Overrides */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Calendar exceptions</h3>
            <p className="text-xs text-slate-400 mt-0.5">Override the weekly schedule for a specific date — e.g. vacation, public holiday, sick leave, or different hours on a particular day.</p>
          </div>
          <button
            onClick={() => setAddOverride(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-3 h-3" /> Add exception
          </button>
        </div>

        {overrides.length === 0 ? (
          <p className="text-xs text-slate-400 px-4 py-5 text-center">No exceptions yet. Add one to block off a vacation, holiday, or adjust hours on a specific date.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {overrides.map((o) => (
              <div key={o.id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium text-slate-800">{o.overrideDate}</p>
                  <p className="text-xs text-slate-400">
                    {o.available
                      ? `Available ${fmt12(o.startTime!)} – ${fmt12(o.endTime!)}`
                      : "Unavailable (blocked)"}
                    {o.reason && ` · ${o.reason}`}
                  </p>
                </div>
                <button onClick={() => deleteOverride(o.id)}
                  className="text-slate-300 hover:text-red-500 transition-colors cursor-pointer ml-4">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add override modal */}
      {addOverride && (
        <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setAddOverride(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
              <span className="text-base font-bold text-slate-900">Add calendar exception</span>
              <button className="text-slate-400 hover:text-slate-600 cursor-pointer" onClick={() => setAddOverride(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div><label className={fieldLabel}>Date <span className="text-red-500">*</span></label>
                <input type="date" className={inputCls} value={overrideForm.overrideDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setOverrideForm((p) => ({ ...p, overrideDate: e.target.value }))} />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-slate-700">Available on this day?</label>
                <button
                  onClick={() => setOverrideForm((p) => ({ ...p, available: !p.available }))}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${overrideForm.available ? "bg-matcha-600" : "bg-slate-200"}`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${overrideForm.available ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              </div>
              {overrideForm.available && (
                <div className="flex items-center gap-2">
                  <div className="flex-1"><label className={fieldLabel}>Start</label>
                    <input type="time" className={inputCls} value={overrideForm.startTime}
                      onChange={(e) => setOverrideForm((p) => ({ ...p, startTime: e.target.value }))} />
                  </div>
                  <div className="flex-1"><label className={fieldLabel}>End</label>
                    <input type="time" className={inputCls} value={overrideForm.endTime}
                      onChange={(e) => setOverrideForm((p) => ({ ...p, endTime: e.target.value }))} />
                  </div>
                </div>
              )}
              <div><label className={fieldLabel}>Reason (optional)</label>
                <input className={inputCls} placeholder="e.g. Vacation, Public holiday, Training day" value={overrideForm.reason}
                  onChange={(e) => setOverrideForm((p) => ({ ...p, reason: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
              <button onClick={() => setAddOverride(false)}
                className="px-4 py-2 rounded-md border border-slate-200 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 cursor-pointer">Cancel</button>
              <button onClick={saveOverride} disabled={saving || !overrideForm.overrideDate}
                className="px-4 py-2 rounded-md bg-matcha-600 text-white text-sm font-medium hover:bg-matcha-700 cursor-pointer disabled:opacity-50">
                {saving ? "Saving…" : "Add exception"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-2.5 rounded-lg text-sm font-medium text-white shadow-lg z-[1000] animate-[slide-up_0.16s_ease] ${toast.type === "error" ? "bg-red-600" : "bg-matcha-600"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BookingPage() {
  const { saloon } = useOutletContext<LayoutContext>();
  const { bookings: init, staff, services } = useLoaderData<typeof clientLoader>();
  const [bookings, setBookings] = useState<Booking[]>(init);
  const [tab, setTab] = useState<"bookings" | "availability">("bookings");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reschedule modal
  const [rescheduleTarget, setRescheduleTarget] = useState<Booking | null>(null);
  const [rsForm, setRsForm] = useState({ appointmentDate: "", startTime: "", staffId: 0, notes: "" });

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<Booking | null>(null);

  const sid = saloon.id;
  const staffMap = new Map(staff.map((s) => [s.id, s]));
  const serviceMap = new Map(services.map((s) => [s.id, s]));

  function notify(msg: string, type = "success") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  async function handleAction(id: number, action: string) {
    setBusy(true);
    try {
      const updated = await apiFetch<Booking>(`${SALOON_ADMIN_API}/${sid}/booking/${id}/${action}`, { method: "POST" });
      setBookings((p) => p.map((b) => b.id === updated.id ? updated : b));
      notify(`Booking ${action}ed.`);
    } catch (e) { notify(e instanceof Error ? e.message : "Error", "error"); }
    finally { setBusy(false); }
  }

  function openReschedule(b: Booking) {
    setRescheduleTarget(b);
    setRsForm({ appointmentDate: b.appointmentDate, startTime: b.startTime, staffId: b.staffId, notes: b.notes ?? "" });
  }

  async function submitReschedule() {
    if (!rescheduleTarget) return;
    setBusy(true);
    try {
      const updated = await apiFetch<Booking>(`${SALOON_ADMIN_API}/${sid}/booking/${rescheduleTarget.id}`, {
        method: "PUT",
        body: JSON.stringify({
          appointmentDate: rsForm.appointmentDate,
          startTime: rsForm.startTime,
          staffId: rsForm.staffId || null,
          notes: rsForm.notes || null,
        }),
      });
      setBookings((p) => p.map((b) => b.id === updated.id ? updated : b));
      setRescheduleTarget(null);
      notify("Booking rescheduled!");
    } catch (e) { notify(e instanceof Error ? e.message : "Error", "error"); }
    finally { setBusy(false); }
  }

  async function submitDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await apiFetch(`${SALOON_ADMIN_API}/${sid}/booking/${deleteTarget.id}`, { method: "DELETE" });
      setBookings((p) => p.filter((b) => b.id !== deleteTarget.id));
      setDeleteTarget(null);
      notify("Booking deleted.");
    } catch (e) { notify(e instanceof Error ? e.message : "Error", "error"); }
    finally { setBusy(false); }
  }

  const tabCls = (active: boolean) =>
    `px-4 py-2 text-sm font-medium rounded-md cursor-pointer transition-colors ${active ? "bg-matcha-600 text-white" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"}`;

  return (
    <>
      <div className="mb-6 space-y-2">
        <h1 className="text-xl font-bold text-slate-900">Calendar</h1>
        <InfoBar>
          Manage customer appointments and staff availability. Use <strong>Bookings</strong> to confirm, reschedule, or cancel appointments. Use <strong>Staff Availability</strong> to set each person's working hours and mark exceptions like vacations or public holidays.
        </InfoBar>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-lg mb-6 w-fit">
        <button className={tabCls(tab === "bookings")} onClick={() => setTab("bookings")}>
          <span className="flex items-center gap-2"><CalendarCheck className="w-4 h-4" /> Bookings ({bookings.length})</span>
        </button>
        <button className={tabCls(tab === "availability")} onClick={() => setTab("availability")}>
          <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> Staff Availability</span>
        </button>
      </div>

      {tab === "bookings" && (
        <DayCalendarView
          bookings={bookings}
          staffMap={staffMap}
          serviceMap={serviceMap}
          staff={staff}
          onAction={handleAction}
          onReschedule={openReschedule}
          onDelete={setDeleteTarget}
        />
      )}

      {tab === "availability" && (
        <AvailabilityPanel saloonId={String(sid)} staff={staff} />
      )}

      {/* Reschedule modal */}
      {rescheduleTarget && (
        <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setRescheduleTarget(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
              <span className="text-base font-bold text-slate-900">Reschedule booking</span>
              <button className="text-slate-400 hover:text-slate-600 cursor-pointer" onClick={() => setRescheduleTarget(null)}><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-slate-500 mb-4">Customer: <strong>{rescheduleTarget.customerName}</strong></p>
            <div className="space-y-3">
              <div><label className={fieldLabel}>New date</label>
                <input type="date" className={inputCls} value={rsForm.appointmentDate}
                  onChange={(e) => setRsForm((p) => ({ ...p, appointmentDate: e.target.value }))} />
              </div>
              <div><label className={fieldLabel}>New start time</label>
                <input type="time" className={inputCls} value={rsForm.startTime}
                  onChange={(e) => setRsForm((p) => ({ ...p, startTime: e.target.value }))} />
              </div>
              <div><label className={fieldLabel}>Staff member</label>
                <div className="relative">
                  <select className={`${inputCls} pr-7`} value={rsForm.staffId}
                    onChange={(e) => setRsForm((p) => ({ ...p, staffId: Number(e.target.value) }))}>
                    {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div><label className={fieldLabel}>Notes</label>
                <input className={inputCls} placeholder="Optional note" value={rsForm.notes}
                  onChange={(e) => setRsForm((p) => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
              <button onClick={() => setRescheduleTarget(null)}
                className="px-4 py-2 rounded-md border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">Cancel</button>
              <button onClick={submitReschedule} disabled={busy || !rsForm.appointmentDate || !rsForm.startTime}
                className="px-4 py-2 rounded-md bg-matcha-600 text-white text-sm font-medium hover:bg-matcha-700 cursor-pointer disabled:opacity-50">
                {busy ? "Saving…" : "Reschedule"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
              <span className="text-base font-bold text-slate-900">Delete booking</span>
              <button className="text-slate-400 hover:text-slate-600 cursor-pointer" onClick={() => setDeleteTarget(null)}><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-slate-600">
              Remove the booking for <strong>{deleteTarget.customerName}</strong> on {deleteTarget.appointmentDate}?
            </p>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
              <button onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-md border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">Cancel</button>
              <button onClick={submitDelete} disabled={busy}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-red-500 text-sm font-medium text-white bg-red-600 hover:bg-red-700 cursor-pointer disabled:opacity-50">
                <Trash2 className="w-3.5 h-3.5" /> {busy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-2.5 rounded-lg text-sm font-medium text-white shadow-lg z-[1000] ${toast.type === "error" ? "bg-red-600" : "bg-matcha-600"}`}>
          {toast.msg}
        </div>
      )}
    </>
  );
}
