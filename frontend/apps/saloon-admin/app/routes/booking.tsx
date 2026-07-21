import { useState, useEffect, useRef } from "react";
import { useLoaderData, useOutletContext } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import {
  CalendarCheck, Users, Plus, Trash2, X, ChevronDown, ChevronLeft, ChevronRight, Clock,
  CheckCircle, AlertCircle, RefreshCw, Check, Ban, Sparkles, Settings, Filter, List,
  Maximize2, Minimize2,
} from "lucide-react";
import { ADMIN_API, CUSTOMER_API, apiFetch, resolveSaloonUUID } from "~/lib/api";
import { DAYS, DAY_SHORT, CATEGORY_LABEL, STAFF_ROLE_LABEL, formatPrice } from "~/lib/constants";
import type {
  LayoutContext, StaffMember, ServiceItem, Booking, BookingStatus,
  StaffAvailability, StaffAvailabilityOverride, AvailableSlot, OperatingHours,
} from "~/lib/types";
import InfoBar from "~/components/InfoBar";

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const sid = await resolveSaloonUUID(params.saloonId!);
  const [bookings, staff, services] = await Promise.all([
    apiFetch<Booking[]>(`${ADMIN_API}/${sid}/booking`),
    apiFetch<StaffMember[]>(`${ADMIN_API}/${sid}/staff`),
    apiFetch<ServiceItem[]>(`${ADMIN_API}/${sid}/services`),
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

const HOUR_H = 64; // px per hour

const toHHMM = (t: string) => t.slice(0, 5);

function deriveCalBounds(operatingHours?: OperatingHours[]): { calStart: number; calEnd: number } {
  const openDays = operatingHours?.filter((h) => !h.closed) ?? [];
  if (!openDays.length) return { calStart: 8, calEnd: 20 };
  const minOpen  = Math.min(...openDays.map((h) => parseInt(h.openTime.split(":")[0], 10)));
  const maxClose = Math.max(...openDays.map((h) => {
    const [hh, mm] = h.closeTime.split(":").map(Number);
    return mm > 0 ? hh + 1 : hh;
  }));
  return { calStart: Math.max(0, minOpen), calEnd: Math.min(24, maxClose) };
}

function timeToY(t: string, calStart: number) {
  const [h, m] = t.split(":").map(Number);
  return ((h - calStart) * 60 + m) * (HOUR_H / 60);
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

const JS_DOW = ["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"] as const;
const WEEK_ORDER = ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"] as const;

function getDayOh(dateStr: string, operatingHours?: OperatingHours[]) {
  if (!operatingHours?.length) return null;
  const dow = JS_DOW[new Date(dateStr + "T12:00:00").getDay()];
  return operatingHours.find((h) => h.day === dow) ?? null;
}

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

// ── Booking row (compact list item) ──────────────────────────────────────────

function BookingRow({
  booking, staffMap, serviceMap, onAction, onReschedule, onDelete,
}: {
  booking: Booking;
  staffMap: Map<number, StaffMember>;
  serviceMap: Map<number, ServiceItem>;
  onAction: (id: number, action: string) => void;
  onReschedule: (b: Booking) => void;
  onDelete: (b: Booking) => void;
}) {
  const member  = staffMap.get(booking.staffId);
  const service = serviceMap.get(booking.serviceId);
  const isPast  = new Date(booking.appointmentDate) < new Date(new Date().toDateString());

  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3 hover:shadow-sm transition-shadow">
      <div className="shrink-0 w-[4.5rem] text-right border-r border-slate-100 pr-3">
        <p className="text-sm font-bold text-slate-800">{fmt12(booking.startTime)}</p>
        <p className="text-[10px] text-slate-400">{fmt12(booking.endTime)}</p>
      </div>
      <span className={`shrink-0 text-[0.6rem] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${STATUS_COLOR[booking.status]}`}>
        {STATUS_LABEL[booking.status]}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{booking.customerName}</p>
        <p className="text-[11px] text-slate-400 truncate">
          {booking.customerEmail}{booking.customerPhone ? ` · ${booking.customerPhone}` : ""}
        </p>
      </div>
      {service && (
        <div className="hidden sm:block min-w-0 w-36 shrink-0">
          <p className="text-xs font-medium text-slate-700 truncate">{service.name}</p>
          <p className="text-[10px] text-slate-400">{service.durationMinutes} min · {formatPrice(service.price, service.currency)}</p>
        </div>
      )}
      {member && (
        <div className="hidden md:block min-w-0 w-28 shrink-0">
          <p className="text-xs font-medium text-slate-700 truncate">{member.name}</p>
          <p className="text-[10px] text-slate-400">{STAFF_ROLE_LABEL[member.role] ?? member.role}</p>
        </div>
      )}
      <div className="shrink-0 flex items-center gap-1">
        {!isPast && booking.status !== "CANCELLED" && booking.status !== "COMPLETED" && booking.status !== "NO_SHOW" && (
          <>
            {booking.status === "PENDING" && (
              <button onClick={() => onAction(booking.id, "confirm")}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold bg-blue-600 text-white hover:bg-blue-700 cursor-pointer transition-colors">
                <Check className="w-3 h-3" /> Confirm
              </button>
            )}
            {booking.status === "CONFIRMED" && (
              <>
                <button onClick={() => onAction(booking.id, "complete")}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold bg-green-600 text-white hover:bg-green-700 cursor-pointer transition-colors">
                  <CheckCircle className="w-3 h-3" /> Done
                </button>
                <button onClick={() => onAction(booking.id, "no-show")} title="No-show"
                  className="p-1.5 rounded-md border border-amber-200 text-amber-600 hover:bg-amber-50 cursor-pointer transition-colors">
                  <AlertCircle className="w-3 h-3" />
                </button>
              </>
            )}
            <button onClick={() => onReschedule(booking)} title="Reschedule"
              className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 cursor-pointer transition-colors">
              <RefreshCw className="w-3 h-3" />
            </button>
            <button onClick={() => onAction(booking.id, "cancel")} title="Cancel"
              className="p-1.5 rounded-md border border-red-200 text-red-500 hover:bg-red-50 cursor-pointer transition-colors">
              <Ban className="w-3 h-3" />
            </button>
          </>
        )}
        <button onClick={() => onDelete(booking)} title="Delete"
          className="p-1.5 rounded-md text-slate-300 hover:text-red-500 cursor-pointer transition-colors">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ── Timeline grid (shared between normal and full-page view) ─────────────────

function TimelineGrid({
  activeStaff, dayBookings, calStart, calEnd, calHours,
  showNow, nowY, serviceMap, gridRef, maxHeight, onSelect, dayOh,
}: {
  activeStaff: StaffMember[];
  dayBookings: Booking[];
  calStart: number;
  calEnd: number;
  calHours: number[];
  showNow: boolean;
  nowY: number;
  serviceMap: Map<number, ServiceItem>;
  gridRef: React.RefObject<HTMLDivElement | null>;
  maxHeight: number | undefined;
  onSelect: (b: Booking) => void;
  dayOh: OperatingHours | null;
}) {
  const totalH = (calEnd - calStart) * HOUR_H;
  const openY  = dayOh && !dayOh.closed
    ? Math.max(0, timeToY(dayOh.openTime, calStart))
    : null;
  const closeY = dayOh && !dayOh.closed
    ? Math.min(totalH, timeToY(dayOh.closeTime, calStart))
    : null;

  return (
    <>
      <div className="flex border-b border-slate-200 bg-white z-10 sticky top-0">
        <div className="w-14 shrink-0 border-r border-slate-100 py-2" />
        {activeStaff.map((s) => {
          const count = dayBookings.filter((b) => b.staffId === s.id).length;
          const paused = s.availableForBooking === false;
          return (
            <div key={s.id} className={`flex-1 min-w-[140px] px-2 py-2 border-r border-slate-100 last:border-r-0 overflow-hidden ${paused ? "bg-amber-50/60" : ""}`}>
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">{s.name}</p>
                {paused && (
                  <span className="inline-flex items-center gap-0.5 shrink-0 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[9px] font-semibold border border-amber-200">
                    <Ban className="w-2.5 h-2.5" /> Paused
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 truncate">
                {STAFF_ROLE_LABEL[s.role] ?? s.role}
                {count > 0 && <span className="ml-1 text-matcha-600 font-semibold">{count} appt</span>}
              </p>
            </div>
          );
        })}
      </div>
      <div
        ref={gridRef}
        className="overflow-y-auto overflow-x-auto"
        style={maxHeight !== undefined ? { maxHeight } : { height: "100%" }}
      >
        <div className="flex" style={{ height: (calEnd - calStart) * HOUR_H }}>
          <div className="w-14 shrink-0 border-r border-slate-100 relative select-none">
            {calHours.map((h) => (
              <div key={h} style={{ height: HOUR_H }} className="border-b border-slate-100" />
            ))}
            {calHours.map((h) => (
              <span key={h} className="absolute right-2 text-[9px] font-medium text-slate-400 leading-none"
                style={{ top: (h - calStart) * HOUR_H + 4 }}>{fmtHour(h)}</span>
            ))}
          </div>
          {activeStaff.map((s) => {
            const col = dayBookings.filter((b) => b.staffId === s.id);
            const paused = s.availableForBooking === false;
            return (
              <div key={s.id} className="flex-1 min-w-[140px] border-r border-slate-100 last:border-r-0 relative">
                {calHours.map((h) => (
                  <div key={h} style={{ height: HOUR_H }} className="border-b border-slate-100" />
                ))}
                {/* Closed-day overlay */}
                {dayOh?.closed && (
                  <div className="absolute inset-0 pointer-events-none"
                    style={{ background: "repeating-linear-gradient(135deg, transparent, transparent 8px, rgba(148,163,184,0.08) 8px, rgba(148,163,184,0.08) 16px)" }} />
                )}
                {/* Not-available-for-booking overlay */}
                {paused && !dayOh?.closed && (
                  <div className="absolute inset-0 pointer-events-none"
                    style={{ background: "repeating-linear-gradient(135deg, transparent, transparent 8px, rgba(251,191,36,0.07) 8px, rgba(251,191,36,0.07) 16px)" }} />
                )}
                {/* Before-open shading */}
                {openY !== null && openY > 0 && (
                  <div className="absolute inset-x-0 top-0 bg-slate-100/60 border-b border-slate-200/60 pointer-events-none" style={{ height: openY }} />
                )}
                {/* After-close shading */}
                {closeY !== null && closeY < totalH && (
                  <div className="absolute inset-x-0 bg-slate-100/60 border-t border-slate-200/60 pointer-events-none" style={{ top: closeY, bottom: 0 }} />
                )}
                {showNow && (
                  <div className="absolute inset-x-0 pointer-events-none z-10 flex items-center" style={{ top: nowY }}>
                    <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 -ml-1" />
                    <div className="flex-1 h-px bg-red-400" />
                  </div>
                )}
                {col.map((b) => {
                  const top    = timeToY(b.startTime, calStart);
                  const height = slotHeight(b.startTime, b.endTime);
                  const svc    = serviceMap.get(b.serviceId);
                  return (
                    <button key={b.id} onClick={() => onSelect(b)}
                      style={{ top, height, position: "absolute", left: 3, right: 3 }}
                      className={`rounded border-l-2 px-1.5 py-0.5 text-left overflow-hidden hover:brightness-95 transition-all cursor-pointer shadow-sm ${BLOCK_COLOR[b.status]}`}>
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
    </>
  );
}

// ── Bookings panel (calendar + list views with stats + filters) ───────────────

function BookingsPanel({
  bookings: allBookings, staffMap, serviceMap, staff, operatingHours, onAction, onReschedule, onDelete,
}: {
  bookings: Booking[];
  staffMap: Map<number, StaffMember>;
  serviceMap: Map<number, ServiceItem>;
  staff: StaffMember[];
  operatingHours?: OperatingHours[];
  onAction: (id: number, action: string) => void;
  onReschedule: (b: Booking) => void;
  onDelete: (b: Booking) => void;
}) {
  const todayStr = new Date().toISOString().split("T")[0];
  const [viewDate, setViewDate]         = useState(todayStr);
  const [viewMode, setViewMode]         = useState<"calendar" | "list">("calendar");
  const [filterStatus, setFilterStatus] = useState<BookingStatus | "ALL">("ALL");
  const [filterStaff, setFilterStaff]   = useState<number>(0);
  const [selected, setSelected]         = useState<Booking | null>(null);
  const [expanded, setExpanded]         = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const { calStart, calEnd } = deriveCalBounds(operatingHours);
  const calHours = Array.from({ length: calEnd - calStart }, (_, i) => calStart + i);
  const dayOh      = getDayOh(viewDate, operatingHours);
  const dayIsClosed = dayOh?.closed ?? false;

  const isToday     = viewDate === todayStr;
  const activeStaff = staff.filter((s) => s.status === "ACTIVE");
  const dayBookings = allBookings.filter((b) => b.appointmentDate === viewDate);

  const counts = {
    total:     dayBookings.length,
    pending:   dayBookings.filter((b) => b.status === "PENDING").length,
    confirmed: dayBookings.filter((b) => b.status === "CONFIRMED").length,
    completed: dayBookings.filter((b) => b.status === "COMPLETED").length,
  };

  const listBookings = dayBookings
    .filter((b) => filterStatus === "ALL" || b.status === filterStatus)
    .filter((b) => filterStaff === 0 || b.staffId === filterStaff)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const now     = new Date();
  const nowY    = ((now.getHours() - calStart) * 60 + now.getMinutes()) * (HOUR_H / 60);
  const showNow = isToday && now.getHours() >= calStart && now.getHours() < calEnd;

  useEffect(() => {
    if (!gridRef.current || viewMode !== "calendar") return;
    gridRef.current.scrollTop = isToday ? Math.max(0, nowY - 120) : 0;
  }, [viewDate, viewMode]); // eslint-disable-line react-hooks/exhaustive-deps

  function goDay(offset: number) {
    const d = new Date(viewDate + "T12:00:00");
    d.setDate(d.getDate() + offset);
    setViewDate(d.toISOString().split("T")[0]);
  }

  const formattedDate = new Date(viewDate + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const STAT_CARDS = [
    { label: "Appointments", value: counts.total,     colorCls: "text-slate-700", status: "ALL"       as const },
    { label: "Pending",      value: counts.pending,   colorCls: "text-amber-600", status: "PENDING"   as const },
    { label: "Confirmed",    value: counts.confirmed, colorCls: "text-blue-600",  status: "CONFIRMED" as const },
    { label: "Completed",    value: counts.completed, colorCls: "text-green-600", status: "COMPLETED" as const },
  ] as const;

  return (
    <div className="space-y-4">

      {/* ── Summary stats ── */}
      <div className="grid grid-cols-4 gap-3">
        {STAT_CARDS.map(({ label, value, colorCls, status }) => {
          const isActive = viewMode === "list" && filterStatus === status;
          return (
            <button key={label}
              onClick={() => { setFilterStatus(status); setViewMode("list"); }}
              className={`bg-white rounded-xl border px-4 py-3 text-center cursor-pointer transition-all hover:shadow-sm ${
                isActive ? "border-matcha-400 ring-1 ring-matcha-200 bg-matcha-50/30" : "border-slate-200 hover:border-slate-300"
              }`}>
              <p className={`text-2xl font-bold leading-none ${colorCls}`}>{value}</p>
              <p className="text-[11px] font-medium text-slate-500 mt-1.5">{label}</p>
            </button>
          );
        })}
      </div>

      {/* ── Date nav + view toggle ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => goDay(-1)}
          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button onClick={() => goDay(1)}
          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-slate-800 truncate">{formattedDate}</span>
        {dayIsClosed ? (
          <span className="text-[10px] font-semibold text-slate-400 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 shrink-0">
            Closed
          </span>
        ) : dayOh ? (
          <span className="text-[10px] font-medium text-matcha-700 px-2 py-0.5 rounded-full bg-matcha-50 border border-matcha-100 shrink-0">
            {fmt12(dayOh.openTime)} – {fmt12(dayOh.closeTime)}
          </span>
        ) : null}
        <span className="flex-1" />
        {!isToday && (
          <button onClick={() => setViewDate(todayStr)}
            className="px-3 py-1 text-xs font-medium rounded-md bg-matcha-600 text-white hover:bg-matcha-700 cursor-pointer transition-colors shrink-0">
            Today
          </button>
        )}
        <input type="date" value={viewDate}
          onChange={(e) => e.target.value && setViewDate(e.target.value)}
          className="border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-700 outline-none focus:border-matcha-500 cursor-pointer shrink-0" />
        <div className="flex rounded-md border border-slate-200 overflow-hidden shrink-0">
          <button onClick={() => setViewMode("calendar")} title="Timeline view"
            className={`px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              viewMode === "calendar" ? "bg-slate-800 text-white" : "bg-white text-slate-500 hover:bg-slate-50"
            }`}>
            <CalendarCheck className="w-3.5 h-3.5" /> Timeline
          </button>
          <button onClick={() => setViewMode("list")} title="List view"
            className={`px-2.5 py-1.5 text-xs font-medium border-l border-slate-200 transition-colors cursor-pointer flex items-center gap-1.5 ${
              viewMode === "list" ? "bg-slate-800 text-white" : "bg-white text-slate-500 hover:bg-slate-50"
            }`}>
            <List className="w-3.5 h-3.5" /> List
          </button>
        </div>
        {viewMode === "calendar" && (
          <button
            onClick={() => setExpanded((v) => !v)}
            title="Expand to full page"
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 cursor-pointer transition-colors shrink-0"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Week strip ── */}
      {operatingHours && operatingHours.length > 0 && (() => {
        const vd   = new Date(viewDate + "T12:00:00");
        const vDow = (vd.getDay() + 6) % 7; // Mon=0 … Sun=6
        const monday = new Date(vd);
        monday.setDate(vd.getDate() - vDow);
        return (
          <div className="flex gap-1">
            {WEEK_ORDER.map((dayName, i) => {
              const oh = operatingHours.find((h) => h.day === dayName);
              const target = new Date(monday);
              target.setDate(monday.getDate() + i);
              const targetStr = target.toISOString().split("T")[0];
              const isSelected = targetStr === viewDate;
              return (
                <button key={dayName} onClick={() => setViewDate(targetStr)}
                  title={oh?.closed ? `${DAY_SHORT[dayName]} – Closed` : `${DAY_SHORT[dayName]} ${fmt12(oh?.openTime ?? "00:00")} – ${fmt12(oh?.closeTime ?? "00:00")}`}
                  className={`flex flex-col items-center py-1 px-1.5 rounded-lg cursor-pointer transition-all min-w-[34px] ${
                    isSelected
                      ? "bg-slate-800 text-white"
                      : oh?.closed
                        ? "text-slate-300 hover:bg-slate-50"
                        : "text-slate-600 hover:bg-slate-100"
                  }`}>
                  <span className={`text-[9px] font-semibold uppercase tracking-wide ${isSelected ? "text-white/70" : oh?.closed ? "text-slate-300" : "text-slate-400"}`}>
                    {DAY_SHORT[dayName]}
                  </span>
                  <span className={`text-xs font-bold mt-0.5 ${isSelected ? "text-white" : oh?.closed ? "text-slate-300" : "text-slate-700"}`}>
                    {target.getDate()}
                  </span>
                  {!oh?.closed && (
                    <div className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? "bg-white/60" : "bg-matcha-500"}`} />
                  )}
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* ── Timeline (calendar) view ── */}
      {viewMode === "calendar" && (
        activeStaff.length === 0 ? (
          <div className="text-center py-20 text-slate-400 text-sm">No active staff — onboard staff first.</div>
        ) : (
          <>
            {!expanded && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <TimelineGrid
                  activeStaff={activeStaff} dayBookings={dayBookings}
                  calStart={calStart} calEnd={calEnd} calHours={calHours}
                  showNow={showNow} nowY={nowY} serviceMap={serviceMap}
                  gridRef={gridRef} maxHeight={520} onSelect={setSelected}
                  dayOh={dayOh}
                />
              </div>
            )}

            {expanded && (
              <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm p-5 flex items-stretch">
                <div className="flex-1 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white shrink-0 flex-wrap rounded-t-2xl">
                    <button onClick={() => goDay(-1)} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer transition-colors">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button onClick={() => goDay(1)} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-semibold text-slate-800 truncate">{formattedDate}</span>
                    {dayIsClosed ? (
                      <span className="text-[10px] font-semibold text-slate-400 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 shrink-0">
                        Closed
                      </span>
                    ) : dayOh ? (
                      <span className="text-[10px] font-medium text-matcha-700 px-2 py-0.5 rounded-full bg-matcha-50 border border-matcha-100 shrink-0">
                        {fmt12(dayOh.openTime)} – {fmt12(dayOh.closeTime)}
                      </span>
                    ) : null}
                    <span className="flex-1" />
                    {!isToday && (
                      <button onClick={() => setViewDate(todayStr)} className="px-3 py-1 text-xs font-medium rounded-md bg-matcha-600 text-white hover:bg-matcha-700 cursor-pointer transition-colors shrink-0">
                        Today
                      </button>
                    )}
                    <input type="date" value={viewDate}
                      onChange={(e) => e.target.value && setViewDate(e.target.value)}
                      className="border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-700 outline-none focus:border-matcha-500 cursor-pointer shrink-0" />
                    <button onClick={() => setExpanded(false)} title="Collapse"
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 cursor-pointer transition-colors shrink-0">
                      <Minimize2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <TimelineGrid
                      activeStaff={activeStaff} dayBookings={dayBookings}
                      calStart={calStart} calEnd={calEnd} calHours={calHours}
                      showNow={showNow} nowY={nowY} serviceMap={serviceMap}
                      gridRef={gridRef} maxHeight={undefined} onSelect={setSelected}
                      dayOh={dayOh}
                    />
                  </div>
                </div>
              </div>
            )}

            {dayBookings.length === 0 && !expanded && (
              <p className="text-center text-xs text-slate-400">
                No appointments {isToday ? "today" : `on ${formattedDate}`}.
              </p>
            )}
          </>
        )
      )}

      {/* ── List view ── */}
      {viewMode === "list" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap bg-white border border-slate-200 rounded-xl px-4 py-2.5">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1 shrink-0">Status</span>
            <div className="flex flex-wrap gap-1.5 flex-1">
              {(["ALL", ...ALL_STATUSES] as (BookingStatus | "ALL")[]).map((s) => (
                <button key={s} onClick={() => setFilterStatus(s)}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer ${
                    filterStatus === s
                      ? "bg-slate-800 text-white border-slate-800"
                      : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  }`}>
                  {s === "ALL" ? "All" : STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            {staff.length > 0 && (
              <div className="relative shrink-0">
                <select value={filterStaff} onChange={(e) => setFilterStaff(Number(e.target.value))}
                  className="appearance-none border border-slate-200 rounded-lg pl-3 pr-7 py-1 text-xs text-slate-700 outline-none focus:border-matcha-500 cursor-pointer bg-white">
                  <option value={0}>All staff</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>
            )}
          </div>

          {listBookings.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              {dayBookings.length === 0
                ? `No appointments ${isToday ? "today" : `on ${formattedDate}`}.`
                : "No bookings match the selected filters."}
            </div>
          ) : (
            <div className="space-y-2">
              {listBookings.map((b) => (
                <BookingRow key={b.id} booking={b} staffMap={staffMap} serviceMap={serviceMap}
                  onAction={onAction} onReschedule={onReschedule} onDelete={onDelete} />
              ))}
            </div>
          )}
        </div>
      )}

      {selected && (
        <BookingDetailModal
          booking={selected} staffMap={staffMap} serviceMap={serviceMap}
          onClose={() => setSelected(null)}
          onAction={(id, action) => { onAction(id, action); setSelected(null); }}
          onReschedule={(b) => { onReschedule(b); setSelected(null); }}
          onDelete={(b) => { onDelete(b); setSelected(null); }}
        />
      )}
    </div>
  );
}

// ── Weekly schedule editor ────────────────────────────────────────────────────

const DEFAULT_SCHEDULE: StaffAvailability[] = DAYS.map((day) => ({
  id: 0, saloonId: "", staffId: 0, dayOfWeek: day,
  startTime: "09:00", endTime: "17:00", available: day !== "SUNDAY",
}));

function AvailabilityPanel({ saloonId, staff, operatingHours }: { saloonId: string; staff: StaffMember[]; operatingHours?: OperatingHours[] }) {
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
    apiFetch<StaffAvailability[]>(`${ADMIN_API}/${saloonId}/staff/${selectedStaff}/availability`)
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
    apiFetch<StaffAvailabilityOverride[]>(`${ADMIN_API}/${saloonId}/staff/${selectedStaff}/availability/overrides`)
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
    if (operatingHours?.length) {
      const violation = schedule.find((s) => {
        if (!s.available) return false;
        const oh = operatingHours.find((h) => h.day === s.dayOfWeek);
        if (!oh || oh.closed) return false;
        return toHHMM(s.startTime) < toHHMM(oh.openTime) || toHHMM(s.endTime) > toHHMM(oh.closeTime);
      });
      if (violation) {
        notify("Staff hours cannot exceed saloon operating hours.", "error");
        return;
      }
    }
    setSaving(true);
    try {
      const body = schedule.map((s) => ({ dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime, available: s.available }));
      await apiFetch<StaffAvailability[]>(`${ADMIN_API}/${saloonId}/staff/${selectedStaff}/availability`, {
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
        `${ADMIN_API}/${saloonId}/staff/${selectedStaff}/availability/overrides`,
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
      notify("Override added!");
    } catch (e) { notify(e instanceof Error ? e.message : "Error", "error"); }
    finally { setSaving(false); }
  }

  async function deleteOverride(oid: number) {
    try {
      await apiFetch(`${ADMIN_API}/${saloonId}/staff/${selectedStaff}/availability/overrides/${oid}`, { method: "DELETE" });
      setOverrides((p) => p.filter((o) => o.id !== oid));
      notify("Override removed.");
    } catch (e) { notify(e instanceof Error ? e.message : "Error", "error"); }
  }

  if (!staff.length) return (
    <div className="text-center py-20 text-slate-400 text-sm">No staff members yet — onboard staff first.</div>
  );

  const currentStaff = staff.find((s) => s.id === selectedStaff);

  const scheduleHasErrors = operatingHours?.length
    ? schedule.some((s) => {
        if (!s.available) return false;
        const oh = operatingHours.find((h) => h.day === s.dayOfWeek);
        if (!oh || oh.closed) return false;
        return toHHMM(s.startTime) < toHHMM(oh.openTime) || toHHMM(s.endTime) > toHHMM(oh.closeTime);
      })
    : false;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 relative z-10">
        <label className="text-sm font-medium text-slate-700 shrink-0">Staff member</label>
        <div className="relative">
          <select className={`${inputCls} pr-8 w-auto`} value={selectedStaff}
            onChange={(e) => setSelectedStaff(Number(e.target.value))}>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
        {currentStaff && (
          <span className="text-xs text-slate-400">{STAFF_ROLE_LABEL[currentStaff.role] ?? currentStaff.role}</span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">Weekly schedule</h3>
          <p className="text-xs text-slate-400 mt-0.5">The default repeating hours for this staff member. Toggle a day off to mark them unavailable every week on that day.</p>
        </div>
        <div className="divide-y divide-slate-100">
          {schedule.map((s) => {
            const oh = operatingHours?.find((h) => h.day === s.dayOfWeek);
            const saloonClosed = operatingHours?.length && (!oh || oh.closed);
            const startErr = s.available && !saloonClosed && !!oh && !oh.closed && toHHMM(s.startTime) < toHHMM(oh.openTime);
            const endErr   = s.available && !saloonClosed && !!oh && !oh.closed && toHHMM(s.endTime)   > toHHMM(oh.closeTime);
            const hasErr   = startErr || endErr;
            return (
              <div key={s.dayOfWeek} className="px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold w-8 ${saloonClosed ? "text-slate-300" : "text-slate-500"}`}>
                    {DAY_SHORT[s.dayOfWeek]}
                  </span>
                  <button onClick={() => !saloonClosed && toggleDay(s.dayOfWeek)}
                    disabled={!!saloonClosed}
                    className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
                      saloonClosed ? "bg-slate-100 cursor-not-allowed" : `cursor-pointer ${s.available ? "bg-matcha-600" : "bg-slate-200"}`
                    }`}>
                    <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${s.available && !saloonClosed ? "translate-x-4" : "translate-x-0"}`} />
                  </button>
                  {saloonClosed ? (
                    <span className="text-xs text-slate-300 italic ml-1">Saloon closed</span>
                  ) : s.available ? (
                    <div className="flex items-center gap-2 ml-1">
                      <input type="time" value={s.startTime}
                        min={oh?.openTime}
                        max={s.endTime}
                        onChange={(e) => setTime(s.dayOfWeek, "startTime", e.target.value)}
                        className={`border rounded-md px-2 py-1 text-xs outline-none focus:ring-1 ${
                          startErr
                            ? "border-amber-300 bg-amber-50 text-amber-800 focus:border-amber-400 focus:ring-amber-300/20"
                            : "border-slate-200 text-slate-700 focus:border-matcha-500 focus:ring-matcha-500/10"
                        }`} />
                      <span className="text-slate-400 text-xs">–</span>
                      <input type="time" value={s.endTime}
                        min={s.startTime}
                        max={oh?.closeTime}
                        onChange={(e) => setTime(s.dayOfWeek, "endTime", e.target.value)}
                        className={`border rounded-md px-2 py-1 text-xs outline-none focus:ring-1 ${
                          endErr
                            ? "border-amber-300 bg-amber-50 text-amber-800 focus:border-amber-400 focus:ring-amber-300/20"
                            : "border-slate-200 text-slate-700 focus:border-matcha-500 focus:ring-matcha-500/10"
                        }`} />
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 ml-1">Unavailable</span>
                  )}
                </div>
                {hasErr && (
                  <p className="flex items-center gap-1 text-[10px] font-medium text-amber-600 mt-1 pl-[76px]">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    Outside saloon hours ({oh!.openTime} – {oh!.closeTime})
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <div className="px-4 py-3 border-t border-slate-100 flex justify-end">
          <button onClick={saveSchedule} disabled={saving || scheduleHasErrors}
            title={scheduleHasErrors ? "Fix hours that exceed saloon operating hours before saving" : undefined}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-matcha-600 text-white text-xs font-medium hover:bg-matcha-700 transition-colors cursor-pointer disabled:opacity-50">
            {saving ? "Saving…" : "Save schedule"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Date overrides</h3>
            <p className="text-xs text-slate-400 mt-0.5">Override the weekly schedule for a specific date — e.g. vacation, public holiday, sick leave, or different hours on a particular day.</p>
          </div>
          <button onClick={() => setAddOverride(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer shrink-0">
            <Plus className="w-3 h-3" /> Add override
          </button>
        </div>

        {overrides.length === 0 ? (
          <p className="text-xs text-slate-400 px-4 py-5 text-center">No overrides yet. Add one to block off a vacation, holiday, or adjust hours on a specific date.</p>
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
      </div>

      {addOverride && (
        <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setAddOverride(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
              <span className="text-base font-bold text-slate-900">Add date override</span>
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
                <button onClick={() => setOverrideForm((p) => ({ ...p, available: !p.available }))}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${overrideForm.available ? "bg-matcha-600" : "bg-slate-200"}`}>
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
                {saving ? "Saving…" : "Add override"}
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

// ── Booking settings panel ────────────────────────────────────────────────────

const ADVANCE_OPTIONS = [
  { days: 30,  label: "1 month",  desc: "Short-term schedule" },
  { days: 60,  label: "2 months", desc: "Recommended default" },
  { days: 90,  label: "3 months", desc: "Seasonal planning" },
  { days: 180, label: "6 months", desc: "Long-term advance" },
] as const;

function BookingSettingsPanel({ saloon, onSaved }: { saloon: { id: string | number; bookingAdvanceDays?: number }; onSaved: (days: number) => void }) {
  const [days, setDays] = useState(saloon.bookingAdvanceDays ?? 60);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await apiFetch(`${ADMIN_API}/${saloon.id}`, {
        method: "PUT",
        body: JSON.stringify({ bookingAdvanceDays: days }),
      });
      onSaved((res as { bookingAdvanceDays: number }).bookingAdvanceDays ?? days);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  return (
    <div className="max-w-lg space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">Advance booking window</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            How far in advance customers can book an appointment. Dates beyond this window will not be shown in the booking calendar.
          </p>
        </div>
        <div className="divide-y divide-slate-100">
          {ADVANCE_OPTIONS.map((opt) => (
            <button key={opt.days} type="button" onClick={() => setDays(opt.days)}
              className={`w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors cursor-pointer ${days === opt.days ? "bg-matcha-50" : "hover:bg-slate-50"}`}>
              <div>
                <p className={`text-sm font-semibold ${days === opt.days ? "text-matcha-800" : "text-slate-700"}`}>{opt.label}</p>
                <p className="text-xs text-slate-400">{opt.desc}</p>
              </div>
              <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${days === opt.days ? "border-matcha-600 bg-matcha-600" : "border-slate-300"}`}>
                {days === opt.days && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
              </span>
            </button>
          ))}
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-4 bg-slate-50/60">
          <p className="text-xs text-slate-400">
            Currently <strong className="text-slate-600">{days} days</strong> — customers can book up to{" "}
            <strong className="text-slate-600">{ADVANCE_OPTIONS.find((o) => o.days === days)?.label ?? `${days} days`}</strong> ahead.
          </p>
          <button onClick={save} disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-matcha-600 text-white text-xs font-medium hover:bg-matcha-700 transition-colors cursor-pointer disabled:opacity-50 shrink-0">
            {saved ? <><Check className="w-3 h-3" /> Saved!</> : saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BookingPage() {
  const { saloon, setSaloon } = useOutletContext<LayoutContext>();
  const { bookings: init, staff, services } = useLoaderData<typeof clientLoader>();
  const [bookings, setBookings] = useState<Booking[]>(init);
  const [tab, setTab] = useState<"bookings" | "availability" | "settings">("bookings");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [rescheduleTarget, setRescheduleTarget] = useState<Booking | null>(null);
  const [rsForm, setRsForm] = useState({ appointmentDate: "", startTime: "", staffId: 0, notes: "" });
  const [rsSlots, setRsSlots] = useState<AvailableSlot[] | null>(null);
  const [rsSlotsLoading, setRsSlotsLoading] = useState(false);
  const [rsSelectedSlot, setRsSelectedSlot] = useState<AvailableSlot | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Booking | null>(null);

  const sid = saloon.id;
  const staffMap = new Map(staff.map((s) => [s.id, s]));
  const serviceMap = new Map(services.map((s) => [s.id, s]));

  function notify(msg: string, type = "success") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  useEffect(() => {
    if (!rescheduleTarget || !rsForm.appointmentDate) { setRsSlots(null); return; }
    let cancelled = false;
    setRsSlotsLoading(true);
    const params = new URLSearchParams({ serviceId: String(rescheduleTarget.serviceId), date: rsForm.appointmentDate });
    apiFetch<AvailableSlot[]>(`${CUSTOMER_API}/${String(sid)}/slots?${params}`)
      .then((slots) => { if (!cancelled) setRsSlots(slots); })
      .catch(() => { if (!cancelled) setRsSlots([]); })
      .finally(() => { if (!cancelled) setRsSlotsLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rescheduleTarget?.id, rsForm.appointmentDate]);

  async function handleAction(id: number, action: string) {
    setBusy(true);
    try {
      const updated = await apiFetch<Booking>(`${ADMIN_API}/${sid}/booking/${id}/${action}`, { method: "POST" });
      setBookings((p) => p.map((b) => b.id === updated.id ? updated : b));
      notify(`Booking ${action}ed.`);
    } catch (e) { notify(e instanceof Error ? e.message : "Error", "error"); }
    finally { setBusy(false); }
  }

  function openReschedule(b: Booking) {
    setRescheduleTarget(b);
    setRsForm({ appointmentDate: b.appointmentDate, startTime: b.startTime, staffId: b.staffId, notes: b.notes ?? "" });
    setRsSlots(null);
    setRsSelectedSlot(null);
  }

  async function submitReschedule() {
    if (!rescheduleTarget) return;
    setBusy(true);
    try {
      const updated = await apiFetch<Booking>(`${ADMIN_API}/${sid}/booking/${rescheduleTarget.id}`, {
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
      await apiFetch(`${ADMIN_API}/${sid}/booking/${deleteTarget.id}`, { method: "DELETE" });
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
        <h1 className="text-xl font-bold text-slate-900">Booking Calendar</h1>
        <InfoBar>
          Manage customer appointments and staff availability. Use <strong>Bookings</strong> to view, confirm, reschedule, or cancel appointments. Use <strong>Manage Staff Availability</strong> to set each person's working hours and add date overrides like vacations or public holidays. Use <strong>Settings</strong> to control how far in advance customers can book.
        </InfoBar>
      </div>

      <div className="flex gap-1 p-1 bg-slate-100 rounded-lg mb-6 w-fit">
        <button className={tabCls(tab === "bookings")} onClick={() => setTab("bookings")}>
          <span className="flex items-center gap-2"><CalendarCheck className="w-4 h-4" /> Bookings</span>
        </button>
        <button className={tabCls(tab === "availability")} onClick={() => setTab("availability")}>
          <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> Manage Staff Availability</span>
        </button>
        <button className={tabCls(tab === "settings")} onClick={() => setTab("settings")}>
          <span className="flex items-center gap-2"><Settings className="w-4 h-4" /> Settings</span>
        </button>
      </div>

      {tab === "bookings" && (
        <BookingsPanel
          bookings={bookings} staffMap={staffMap} serviceMap={serviceMap}
          staff={staff} operatingHours={saloon.operatingHours}
          onAction={handleAction} onReschedule={openReschedule} onDelete={setDeleteTarget}
        />
      )}

      {tab === "availability" && (
        <AvailabilityPanel saloonId={String(sid)} staff={staff} operatingHours={saloon.operatingHours} />
      )}

      {tab === "settings" && (
        <BookingSettingsPanel
          saloon={{ id: String(sid), bookingAdvanceDays: saloon.bookingAdvanceDays }}
          onSaved={(days) => setSaloon({ ...saloon, bookingAdvanceDays: days })}
        />
      )}

      {/* Reschedule modal */}
      {rescheduleTarget && (
        <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setRescheduleTarget(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
              <span className="text-base font-bold text-slate-900">Reschedule booking</span>
              <button className="text-slate-400 hover:text-slate-600 cursor-pointer" onClick={() => setRescheduleTarget(null)}><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-slate-500 mb-4">Customer: <strong>{rescheduleTarget.customerName}</strong></p>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={fieldLabel}>New date</label>
                  <input type="date" className={inputCls} value={rsForm.appointmentDate}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) => {
                      setRsSelectedSlot(null);
                      setRsForm((p) => ({ ...p, appointmentDate: e.target.value, startTime: "" }));
                    }} />
                </div>
                <div>
                  <label className={fieldLabel}>Staff member</label>
                  <div className="relative">
                    <select className={`${inputCls} pr-7`} value={rsForm.staffId}
                      onChange={(e) => {
                        setRsSelectedSlot(null);
                        setRsForm((p) => ({ ...p, staffId: Number(e.target.value), startTime: "" }));
                      }}>
                      <option value={0}>Any available</option>
                      {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div>
                <label className={fieldLabel}>
                  Available times
                  {rsSelectedSlot && (
                    <span className="ml-2 font-semibold text-matcha-600">
                      · {fmt12(rsSelectedSlot.startTime)} – {fmt12(rsSelectedSlot.endTime)} selected
                    </span>
                  )}
                </label>
                {!rsForm.appointmentDate ? (
                  <p className="text-xs text-slate-400 py-2">Select a date to see availability.</p>
                ) : rsSlotsLoading ? (
                  <div className="flex items-center gap-2 py-4 text-xs text-slate-400">
                    <div className="w-3.5 h-3.5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
                    Loading availability…
                  </div>
                ) : (() => {
                  let displaySlots: AvailableSlot[];
                  if (rsForm.staffId) {
                    displaySlots = (rsSlots ?? []).filter((s) => s.staffId === rsForm.staffId);
                  } else {
                    const map = new Map<string, AvailableSlot>();
                    for (const s of rsSlots ?? []) {
                      const ex = map.get(s.startTime);
                      if (!ex || ex.booked) map.set(s.startTime, s);
                    }
                    displaySlots = [...map.values()].sort((a, b) => a.startTime.localeCompare(b.startTime));
                  }
                  return displaySlots.length === 0 ? (
                    <p className="text-xs text-slate-400 py-2">No slots available for this date.</p>
                  ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 max-h-44 overflow-y-auto pr-1">
                      {displaySlots.map((s) => {
                        const isSelected = rsSelectedSlot?.startTime === s.startTime && rsSelectedSlot?.staffId === s.staffId;
                        const isBooked = !!s.booked;
                        const memberFirst = staffMap.get(s.staffId)?.name?.split(" ")[0];
                        return (
                          <button key={`${s.staffId}-${s.startTime}`} type="button" disabled={isBooked}
                            onClick={() => {
                              setRsSelectedSlot(s);
                              setRsForm((p) => ({ ...p, startTime: s.startTime, staffId: s.staffId }));
                            }}
                            className={`py-2 px-1 rounded-lg text-[10px] font-semibold transition-all border flex flex-col items-center gap-0.5
                              ${isBooked ? "cursor-not-allowed" : "cursor-pointer hover:scale-[1.03]"}
                              ${isSelected ? "bg-matcha-600 text-white border-matcha-600"
                                : isBooked ? "bg-slate-50 text-slate-300 border-slate-100"
                                : "bg-matcha-50 text-matcha-700 border-transparent hover:border-matcha-200"}`}
                            title={isBooked ? `${fmt12(s.startTime)} – Booked` : `${fmt12(s.startTime)} – ${fmt12(s.endTime)}${memberFirst ? ` · ${memberFirst}` : ""}`}
                          >
                            {isBooked ? <span className="line-through opacity-50">{fmt12(s.startTime)}</span> : fmt12(s.startTime)}
                            {rsForm.staffId === 0 && memberFirst && (
                              <span className={`text-[8px] truncate max-w-full ${isSelected ? "opacity-80" : isBooked ? "opacity-40" : "opacity-70"}`}>
                                {memberFirst}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className={fieldLabel}>Notes</label>
                <input className={inputCls} placeholder="Optional note" value={rsForm.notes}
                  onChange={(e) => setRsForm((p) => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 mt-5 pt-4 border-t border-slate-100">
              <button type="button" disabled
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-violet-200 text-violet-400 bg-violet-50 cursor-not-allowed opacity-75">
                <Sparkles className="w-3.5 h-3.5" />
                Assist with AI
                <span className="ml-0.5 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-500">
                  Coming soon
                </span>
              </button>
              <div className="flex gap-2">
                <button onClick={() => setRescheduleTarget(null)}
                  className="px-4 py-2 rounded-md border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">Cancel</button>
                <button onClick={submitReschedule} disabled={busy || !rsForm.appointmentDate || !rsForm.startTime}
                  className="px-4 py-2 rounded-md bg-matcha-600 text-white text-sm font-medium hover:bg-matcha-700 cursor-pointer disabled:opacity-50">
                  {busy ? "Saving…" : "Reschedule"}
                </button>
              </div>
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
