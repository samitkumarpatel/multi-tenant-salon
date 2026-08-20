import { useState, useEffect, useRef } from "react";
import { useLoaderData, useOutletContext } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import {
  CalendarCheck, Users, Plus, Trash2, X, ChevronDown, ChevronLeft, ChevronRight, Clock,
  CheckCircle, AlertCircle, RefreshCw, Check, Ban, Sparkles, Settings, Filter, List,
  Maximize2, Minimize2, CalendarDays, LayoutGrid, CalendarOff, Link2, Copy,
} from "lucide-react";
import { ADMIN_API, CUSTOMER_API, apiFetch, resolveSalonUUID } from "~/lib/api";
import { DAYS, DAY_SHORT, CATEGORY_LABEL, STAFF_ROLE_LABEL, formatPrice } from "~/lib/constants";
import type {
  LayoutContext, StaffMember, ServiceItem, Booking, BookingStatus,
  StaffAvailability, StaffAvailabilityOverride, AvailableSlot, OperatingHours, SalonClosure,
} from "~/lib/types";
import InfoBar from "~/components/InfoBar";
import { Tooltip } from "~/components/Tooltip";
import { Toast, useToast } from "@salon/ui-shared";

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const sid = await resolveSalonUUID(params.salonId!);
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

const STATUS_DOT: Record<BookingStatus, string> = {
  PENDING:   "bg-amber-400",
  CONFIRMED: "bg-blue-500",
  CANCELLED: "bg-slate-300",
  COMPLETED: "bg-green-500",
  NO_SHOW:   "bg-red-400",
};

// 12-color palette for per-stylist identification (week/month views)
const STAFF_COLORS = [
  "#6366f1", // indigo
  "#ec4899", // pink
  "#0d9488", // teal
  "#d97706", // amber
  "#7c3aed", // violet
  "#dc2626", // red
  "#0284c7", // sky
  "#059669", // emerald
  "#ea580c", // orange
  "#65a30d", // lime
  "#db2777", // fuchsia
  "#0891b2", // cyan
] as const;

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
              {member.photoUrl ? (
                <img src={member.photoUrl} alt={member.name} className="w-5 h-5 rounded-full object-cover shrink-0 border border-slate-200" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                  <span className="text-[8px] font-bold text-slate-500">{member.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}</span>
                </div>
              )}
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
        <div className="hidden md:flex items-center gap-2 min-w-0 w-28 shrink-0">
          {member.photoUrl ? (
            <img src={member.photoUrl} alt={member.name} className="w-6 h-6 rounded-full object-cover shrink-0 border border-slate-200" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
              <span className="text-[8px] font-bold text-slate-500">{member.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}</span>
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-700 truncate">{member.name}</p>
            <p className="text-[10px] text-slate-400">{STAFF_ROLE_LABEL[member.role] ?? member.role}</p>
          </div>
        </div>
      )}
      <div className="shrink-0 flex items-center gap-1">
        {!isPast && booking.status !== "CANCELLED" && booking.status !== "COMPLETED" && booking.status !== "NO_SHOW" && (
          <>
            {booking.status === "PENDING" && (
              <Tooltip content="Confirm this appointment and notify the customer" side="top">
                <button onClick={() => onAction(booking.id, "confirm")}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold bg-blue-600 text-white hover:bg-blue-700 cursor-pointer transition-colors">
                  <Check className="w-3 h-3" /> Confirm
                </button>
              </Tooltip>
            )}
            {booking.status === "CONFIRMED" && (
              <>
                <Tooltip content="Mark this appointment as completed" side="top">
                  <button onClick={() => onAction(booking.id, "complete")}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold bg-green-600 text-white hover:bg-green-700 cursor-pointer transition-colors">
                    <CheckCircle className="w-3 h-3" /> Done
                  </button>
                </Tooltip>
                <Tooltip content="Customer didn't show up for their appointment" side="top">
                  <button onClick={() => onAction(booking.id, "no-show")}
                    className="p-1.5 rounded-md border border-amber-200 text-amber-600 hover:bg-amber-50 cursor-pointer transition-colors">
                    <AlertCircle className="w-3 h-3" />
                  </button>
                </Tooltip>
              </>
            )}
            <Tooltip content="Move this booking to a different date or time" side="top">
              <button onClick={() => onReschedule(booking)}
                className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 cursor-pointer transition-colors">
                <RefreshCw className="w-3 h-3" />
              </button>
            </Tooltip>
            <Tooltip content="Cancel this booking" side="top">
              <button onClick={() => onAction(booking.id, "cancel")}
                className="p-1.5 rounded-md border border-red-200 text-red-500 hover:bg-red-50 cursor-pointer transition-colors">
                <Ban className="w-3 h-3" />
              </button>
            </Tooltip>
          </>
        )}
        <Tooltip content="Permanently delete this booking record" side="top">
          <button onClick={() => onDelete(booking)}
            className="p-1.5 rounded-md text-slate-300 hover:text-red-500 cursor-pointer transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
        </Tooltip>
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

// ── Overlap lane assignment (week view) ───────────────────────────────────────

type LanedBooking = { booking: Booking; lane: number; totalLanes: number };

function assignLanes(bookings: Booking[]): LanedBooking[] {
  const sorted = [...bookings].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const laneEnds: string[] = [];
  const result: LanedBooking[] = [];
  for (const b of sorted) {
    let lane = laneEnds.findIndex((end) => b.startTime >= end);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(""); }
    laneEnds[lane] = b.endTime;
    result.push({ booking: b, lane, totalLanes: 0 });
  }
  for (let i = 0; i < result.length; i++) {
    const { booking: b, lane } = result[i];
    let max = lane;
    for (const other of result) {
      if (other.booking.startTime < b.endTime && other.booking.endTime > b.startTime) {
        max = Math.max(max, other.lane);
      }
    }
    result[i].totalLanes = max + 1;
  }
  return result;
}

// ── Week timeline grid ────────────────────────────────────────────────────────

const DOW_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function WeekTimelineGrid({
  weekDates, allBookings, calStart, calEnd, calHours,
  todayStr, serviceMap, staffMap, staffColorMap, filterStaffId, operatingHours, gridRef, maxHeight, onSelect,
}: {
  weekDates: string[];
  allBookings: Booking[];
  calStart: number;
  calEnd: number;
  calHours: number[];
  todayStr: string;
  serviceMap: Map<number, ServiceItem>;
  staffMap: Map<number, StaffMember>;
  staffColorMap: Map<number, string>;
  filterStaffId: number;
  operatingHours?: OperatingHours[];
  gridRef: React.RefObject<HTMLDivElement | null>;
  maxHeight: number | undefined;
  onSelect: (b: Booking) => void;
}) {
  const [hover, setHover] = useState<{ booking: Booking; x: number; y: number } | null>(null);
  const totalH = (calEnd - calStart) * HOUR_H;
  const now = new Date();
  const nowY = ((now.getHours() - calStart) * 60 + now.getMinutes()) * (HOUR_H / 60);
  const showNow = now.getHours() >= calStart && now.getHours() < calEnd;

  function initials(name: string) {
    return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  }

  return (
    <>
      {/* ── Day header row ── */}
      <div className="flex border-b border-slate-200 bg-white z-10 sticky top-0">
        <div className="w-14 shrink-0 border-r border-slate-100 py-2" />
        {weekDates.map((dateStr) => {
          const d = new Date(dateStr + "T12:00:00");
          const isToday = dateStr === todayStr;
          const oh = getDayOh(dateStr, operatingHours);
          const isClosed = oh?.closed ?? false;
          const count = allBookings.filter((b) => b.appointmentDate === dateStr).length;
          return (
            <div key={dateStr} className={`flex-1 min-w-[90px] px-2 py-2 border-r border-slate-100 last:border-r-0 text-center ${isToday ? "bg-matcha-50" : ""}`}>
              <p className={`text-[9px] font-semibold uppercase tracking-wider ${isToday ? "text-matcha-600" : isClosed ? "text-slate-300" : "text-slate-400"}`}>
                {DOW_ABBR[d.getDay()]}
              </p>
              <p className={`text-sm font-bold ${isToday ? "text-matcha-700" : isClosed ? "text-slate-300" : "text-slate-700"}`}>
                {d.getDate()}
              </p>
              {count > 0 && (
                <p className={`text-[9px] font-semibold ${isToday ? "text-matcha-500" : "text-slate-400"}`}>{count} appt</p>
              )}
              {isClosed && <p className="text-[9px] text-slate-300">Closed</p>}
            </div>
          );
        })}
      </div>

      {/* ── Time grid ── */}
      <div ref={gridRef} className="overflow-y-auto overflow-x-auto"
        style={maxHeight !== undefined ? { maxHeight } : { height: "100%" }}>
        <div className="flex" style={{ height: totalH }}>
          {/* Time axis */}
          <div className="w-14 shrink-0 border-r border-slate-100 relative select-none">
            {calHours.map((h) => (
              <div key={h} style={{ height: HOUR_H }} className="border-b border-slate-100" />
            ))}
            {calHours.map((h) => (
              <span key={h} className="absolute right-2 text-[9px] font-medium text-slate-400 leading-none"
                style={{ top: (h - calStart) * HOUR_H + 4 }}>{fmtHour(h)}</span>
            ))}
          </div>

          {/* Day columns */}
          {weekDates.map((dateStr) => {
            const dayBkgs = allBookings.filter((b) => b.appointmentDate === dateStr);
            const oh = getDayOh(dateStr, operatingHours);
            const isClosed = oh?.closed ?? false;
            const isToday = dateStr === todayStr;
            const openY  = oh && !oh.closed ? Math.max(0, timeToY(oh.openTime, calStart)) : null;
            const closeY = oh && !oh.closed ? Math.min(totalH, timeToY(oh.closeTime, calStart)) : null;
            const laned  = assignLanes(dayBkgs);
            return (
              <div key={dateStr} className={`flex-1 min-w-[90px] border-r border-slate-100 last:border-r-0 relative ${isToday ? "bg-matcha-50/30" : ""}`}>
                {calHours.map((h) => (
                  <div key={h} style={{ height: HOUR_H }} className="border-b border-slate-100" />
                ))}
                {isClosed && (
                  <div className="absolute inset-0 pointer-events-none"
                    style={{ background: "repeating-linear-gradient(135deg, transparent, transparent 8px, rgba(148,163,184,0.08) 8px, rgba(148,163,184,0.08) 16px)" }} />
                )}
                {openY !== null && openY > 0 && (
                  <div className="absolute inset-x-0 top-0 bg-slate-100/60 border-b border-slate-200/60 pointer-events-none" style={{ height: openY }} />
                )}
                {closeY !== null && closeY < totalH && (
                  <div className="absolute inset-x-0 bg-slate-100/60 border-t border-slate-200/60 pointer-events-none" style={{ top: closeY, bottom: 0 }} />
                )}
                {isToday && showNow && (
                  <div className="absolute inset-x-0 pointer-events-none z-10 flex items-center" style={{ top: nowY }}>
                    <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 -ml-1" />
                    <div className="flex-1 h-px bg-red-400" />
                  </div>
                )}

                {/* Booking blocks */}
                {laned.map(({ booking: b, lane, totalLanes }) => {
                  const top        = timeToY(b.startTime, calStart);
                  const height     = slotHeight(b.startTime, b.endTime);
                  const W          = 100 / totalLanes;
                  const left       = (lane / totalLanes) * 100;
                  const svc        = serviceMap.get(b.serviceId);
                  const member     = staffMap.get(b.staffId);
                  const staffColor = staffColorMap.get(b.staffId);
                  const isFiltered = filterStaffId !== 0 && b.staffId !== filterStaffId;

                  return (
                    <button key={b.id}
                      onMouseEnter={(e) => !isFiltered && setHover({ booking: b, x: e.clientX, y: e.clientY })}
                      onMouseMove={(e) => !isFiltered && setHover((h) => h ? { ...h, x: e.clientX, y: e.clientY } : null)}
                      onMouseLeave={() => setHover(null)}
                      onClick={() => { if (isFiltered) return; setHover(null); onSelect(b); }}
                      style={{
                        top, height, position: "absolute",
                        left: `calc(${left}% + 2px)`, width: `calc(${W}% - 4px)`,
                        borderLeftColor: staffColor,
                        opacity: isFiltered ? 0.12 : 1,
                        transition: "opacity 0.18s ease, transform 0.1s ease, box-shadow 0.1s ease",
                      }}
                      className={`rounded border-l-2 text-left overflow-hidden cursor-pointer shadow-sm ${
                        isFiltered ? "pointer-events-none" : "hover:shadow-md hover:scale-[1.01] hover:z-10"
                      } ${BLOCK_COLOR[b.status]}`}>

                      {/* Ultra-slim (< 22px): single-line name */}
                      {height < 22 && (
                        <p className="px-1.5 text-[8px] font-bold leading-none truncate" style={{ lineHeight: `${height}px` }}>
                          {b.customerName}
                        </p>
                      )}

                      {/* Compact (22–42px): status dot + name */}
                      {height >= 22 && height < 42 && (
                        <div className="px-1.5 py-1 flex items-center gap-1 min-w-0">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[b.status]}`} />
                          <p className="text-[9px] font-bold leading-tight truncate">{b.customerName}</p>
                        </div>
                      )}

                      {/* Medium (42–62px): time + name + service */}
                      {height >= 42 && height < 62 && (
                        <div className="px-1.5 py-1 space-y-0.5">
                          <p className="text-[8px] font-semibold opacity-55 leading-none tabular-nums">{fmt12(b.startTime)}</p>
                          <p className="text-[9px] font-bold leading-tight truncate">{b.customerName}</p>
                          {svc && <p className="text-[8px] leading-tight truncate opacity-65">{svc.name}</p>}
                        </div>
                      )}

                      {/* Tall (62–88px): time range + name + service + staff first name */}
                      {height >= 62 && height < 88 && (
                        <div className="px-1.5 py-1.5 space-y-1">
                          <div className="flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 opacity-45 shrink-0" />
                            <span className="text-[8px] font-semibold opacity-60 tabular-nums">
                              {fmt12(b.startTime)} – {fmt12(b.endTime)}
                            </span>
                          </div>
                          <p className="text-[9px] font-bold leading-tight truncate">{b.customerName}</p>
                          {svc && <p className="text-[8px] leading-tight truncate opacity-65">{svc.name}</p>}
                          {member && (
                            <p className="text-[8px] opacity-50 leading-tight truncate">{member.name.split(" ")[0]}</p>
                          )}
                        </div>
                      )}

                      {/* Full (≥ 88px): everything including staff avatar */}
                      {height >= 88 && (
                        <div className="px-1.5 py-1.5 space-y-1 h-full flex flex-col">
                          <div className="flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 opacity-45 shrink-0" />
                            <span className="text-[8px] font-semibold opacity-60 tabular-nums">
                              {fmt12(b.startTime)} – {fmt12(b.endTime)}
                            </span>
                          </div>
                          <p className="text-[9px] font-bold leading-snug">{b.customerName}</p>
                          {svc && (
                            <p className="text-[8px] leading-tight opacity-70 truncate">{svc.name}</p>
                          )}
                          {member && (
                            <div className="flex items-center gap-1 mt-auto pt-1">
                              {member.photoUrl ? (
                                <img src={member.photoUrl} alt={member.name} className="w-4 h-4 rounded-full object-cover shrink-0 ring-1 ring-black/10" />
                              ) : (
                                <div className="w-4 h-4 rounded-full bg-white/50 flex items-center justify-center shrink-0 ring-1 ring-black/10">
                                  <span className="text-[7px] font-black leading-none">{initials(member.name)}</span>
                                </div>
                              )}
                              <span className="text-[8px] opacity-60 truncate">{member.name.split(" ")[0]}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Hover detail card (fixed, pointer-events-none) ── */}
      {hover && (() => {
        const b      = hover.booking;
        const svc    = serviceMap.get(b.serviceId);
        const member = staffMap.get(b.staffId);
        const vw     = typeof window !== "undefined" ? window.innerWidth  : 1200;
        const vh     = typeof window !== "undefined" ? window.innerHeight : 900;
        const cardW  = 230;
        const x = Math.min(hover.x + 16, vw - cardW - 8);
        const y = Math.max(8, Math.min(hover.y - 24, vh - 280));
        const hoverStaffColor = staffColorMap.get(b.staffId) ?? "#94a3b8";
        return (
          <div style={{ position: "fixed", left: x, top: y, zIndex: 9999, width: cardW, pointerEvents: "none" }}
            className="bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden">
            {/* Staff color accent strip */}
            <div className="h-1.5 w-full" style={{ backgroundColor: hoverStaffColor }} />
            <div className="p-3 space-y-2.5">

              {/* Status + time */}
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[0.6rem] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${STATUS_COLOR[b.status]}`}>
                  {STATUS_LABEL[b.status]}
                </span>
                <span className="text-[10px] text-slate-400 font-mono shrink-0">
                  {fmt12(b.startTime)} – {fmt12(b.endTime)}
                </span>
              </div>

              {/* Customer */}
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 leading-tight truncate">{b.customerName}</p>
                {b.customerEmail && (
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">{b.customerEmail}</p>
                )}
                {b.customerPhone && (
                  <p className="text-[10px] text-slate-400 mt-0.5">{b.customerPhone}</p>
                )}
              </div>

              {/* Service */}
              {svc && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-700 truncate">{svc.name}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{svc.durationMinutes} min · {formatPrice(svc.price, svc.currency)}</p>
                </div>
              )}

              {/* Staff */}
              {member && (
                <div className="flex items-center gap-2">
                  {member.photoUrl ? (
                    <img src={member.photoUrl} alt={member.name} className="w-6 h-6 rounded-full object-cover shrink-0 ring-2 ring-white shadow-sm" />
                  ) : (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 ring-2 ring-white shadow-sm"
                      style={{ backgroundColor: hoverStaffColor }}>
                      <span className="text-[9px] font-black text-white">{initials(member.name)}</span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-700 leading-none truncate">{member.name}</p>
                    <p className="text-[9px] text-slate-400 mt-0.5">{STAFF_ROLE_LABEL[member.role] ?? member.role}</p>
                  </div>
                </div>
              )}

              {/* Notes */}
              {b.notes && (
                <p className="text-[10px] text-slate-400 italic border-t border-slate-100 pt-2 leading-relaxed">{b.notes}</p>
              )}
            </div>

            {/* Footer hint */}
            <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100">
              <p className="text-[9px] text-slate-400">Click to manage this booking</p>
            </div>
          </div>
        );
      })()}
    </>
  );
}

// ── Month grid ────────────────────────────────────────────────────────────────

function MonthGrid({
  allBookings, viewDate, todayStr, maxHeight, staffColorMap, filterStaffId, onSelectDate,
}: {
  allBookings: Booking[];
  viewDate: string;
  todayStr: string;
  maxHeight: number | undefined;
  staffColorMap: Map<number, string>;
  filterStaffId: number;
  onSelectDate: (d: string) => void;
}) {
  const d = new Date(viewDate + "T12:00:00");
  const year  = d.getFullYear();
  const month = d.getMonth();
  const firstDow  = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
  const daysInMth = new Date(year, month + 1, 0).getDate();

  const cells: string[] = [];
  for (let i = firstDow - 1; i >= 0; i--) {
    cells.push(new Date(year, month, -i).toISOString().split("T")[0]);
  }
  for (let day = 1; day <= daysInMth; day++) {
    cells.push(new Date(year, month, day).toISOString().split("T")[0]);
  }
  const tail = (7 - (cells.length % 7)) % 7;
  for (let i = 1; i <= tail; i++) {
    cells.push(new Date(year, month + 1, i).toISOString().split("T")[0]);
  }

  const byDate = new Map<string, Booking[]>();
  for (const b of allBookings) {
    if (!byDate.has(b.appointmentDate)) byDate.set(b.appointmentDate, []);
    byDate.get(b.appointmentDate)!.push(b);
  }

  const weeks: string[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const DAY_HDR = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="overflow-y-auto" style={maxHeight !== undefined ? { maxHeight } : {}}>
      <div className="grid grid-cols-7 border-b border-slate-200 sticky top-0 bg-white z-10">
        {DAY_HDR.map((h) => (
          <div key={h} className="py-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">{h}</div>
        ))}
      </div>
      <div className="divide-y divide-slate-100">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 divide-x divide-slate-100" style={{ minHeight: 88 }}>
            {week.map((dateStr) => {
              const isCurrentMonth = new Date(dateStr + "T12:00:00").getMonth() === month;
              const isToday    = dateStr === todayStr;
              const isSelected = dateStr === viewDate;
              const bkgs       = byDate.get(dateStr) ?? [];
              const visible    = bkgs.slice(0, 3);
              const extra      = bkgs.length - 3;
              return (
                <button key={dateStr} onClick={() => onSelectDate(dateStr)}
                  className={`p-1.5 text-left transition-colors cursor-pointer ${
                    isCurrentMonth ? "bg-white hover:bg-slate-50" : "bg-slate-50/40 hover:bg-slate-100/50"
                  } ${isToday ? "ring-1 ring-inset ring-matcha-400" : ""}`}>
                  <span className={`text-xs font-bold inline-flex w-6 h-6 items-center justify-center rounded-full ${
                    isToday ? "bg-matcha-600 text-white"
                      : isSelected ? "bg-slate-200 text-slate-800"
                      : isCurrentMonth ? "text-slate-700" : "text-slate-300"
                  }`}>
                    {new Date(dateStr + "T12:00:00").getDate()}
                  </span>
                  <div className="mt-0.5 space-y-0.5">
                    {visible.map((b) => {
                      const staffColor = staffColorMap.get(b.staffId);
                      const isFiltered = filterStaffId !== 0 && b.staffId !== filterStaffId;
                      return (
                        <div key={b.id}
                          className={`text-[8px] font-medium pl-1.5 pr-1 py-0.5 rounded-r border-l-2 truncate leading-tight ${
                            b.status === "CONFIRMED" ? "bg-blue-100 text-blue-800"
                              : b.status === "PENDING"   ? "bg-amber-100 text-amber-800"
                              : b.status === "COMPLETED" ? "bg-green-100 text-green-800"
                              : b.status === "CANCELLED" ? "bg-slate-100 text-slate-400"
                              : "bg-red-100 text-red-700"
                          }`}
                          style={{
                            borderLeftColor: staffColor ?? "transparent",
                            opacity: isFiltered ? 0.15 : 1,
                            transition: "opacity 0.18s ease",
                          }}>
                          {fmt12(b.startTime)} {b.customerName}
                        </div>
                      );
                    })}
                    {extra > 0 && <p className="text-[8px] text-slate-400 pl-1">+{extra} more</p>}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Bookings panel (day / week / month / list views with stats + filters) ──────

function BookingsPanel({
  bookings: allBookings, staffMap, serviceMap, staff, operatingHours, onAction, onReschedule, onDelete, onRefresh,
}: {
  bookings: Booking[];
  staffMap: Map<number, StaffMember>;
  serviceMap: Map<number, ServiceItem>;
  staff: StaffMember[];
  operatingHours?: OperatingHours[];
  onAction: (id: number, action: string) => void;
  onReschedule: (b: Booking) => void;
  onDelete: (b: Booking) => void;
  onRefresh: () => Promise<void>;
}) {
  const todayStr = new Date().toISOString().split("T")[0];
  const [viewDate, setViewDate]         = useState(todayStr);
  const [viewMode, setViewMode]         = useState<"day" | "week" | "month" | "list">("day");
  const [filterStatus, setFilterStatus]     = useState<BookingStatus | "ALL">("ALL");
  const [filterStaff, setFilterStaff]       = useState<number>(0);
  const [filterStaffWeek, setFilterStaffWeek] = useState<number>(0); // 0 = all (week/month views)
  const [selected, setSelected]             = useState<Booking | null>(null);
  const [expanded, setExpanded]             = useState(false);
  const [refreshing, setRefreshing]         = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const { calStart, calEnd } = deriveCalBounds(operatingHours);
  const calHours = Array.from({ length: calEnd - calStart }, (_, i) => calStart + i);
  const dayOh      = getDayOh(viewDate, operatingHours);
  const dayIsClosed = dayOh?.closed ?? false;

  const isToday      = viewDate === todayStr;
  const activeStaff  = staff.filter((s) => s.status === "ACTIVE");
  const dayBookings  = allBookings.filter((b) => b.appointmentDate === viewDate);
  const staffColorMap = new Map(activeStaff.map((s, i) => [s.id, STAFF_COLORS[i % STAFF_COLORS.length]]));

  // Week dates (Mon–Sun) containing viewDate
  const weekDates = (() => {
    const vd   = new Date(viewDate + "T12:00:00");
    const vDow = (vd.getDay() + 6) % 7;
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(vd);
      d.setDate(vd.getDate() - vDow + i);
      return d.toISOString().split("T")[0];
    });
  })();

  const monthStr       = viewDate.slice(0, 7); // "YYYY-MM"
  const weekInclToday  = weekDates.includes(todayStr);
  const monthInclToday = todayStr.startsWith(monthStr);

  // Bookings for the active period (for stats)
  const periodBookings = viewMode === "day" || viewMode === "list"
    ? dayBookings
    : viewMode === "week"
      ? allBookings.filter((b) => weekDates.includes(b.appointmentDate))
      : allBookings.filter((b) => b.appointmentDate.startsWith(monthStr));

  const counts = {
    total:     periodBookings.length,
    pending:   periodBookings.filter((b) => b.status === "PENDING").length,
    confirmed: periodBookings.filter((b) => b.status === "CONFIRMED").length,
    completed: periodBookings.filter((b) => b.status === "COMPLETED").length,
  };

  const listBookings = dayBookings
    .filter((b) => filterStatus === "ALL" || b.status === filterStatus)
    .filter((b) => filterStaff === 0 || b.staffId === filterStaff)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const now     = new Date();
  const nowY    = ((now.getHours() - calStart) * 60 + now.getMinutes()) * (HOUR_H / 60);
  const showNow = isToday && now.getHours() >= calStart && now.getHours() < calEnd;

  useEffect(() => {
    if (!gridRef.current || viewMode === "list" || viewMode === "month") return;
    const todayVisible = viewMode === "day" ? isToday : weekInclToday;
    gridRef.current.scrollTop = todayVisible ? Math.max(0, nowY - 120) : 0;
  }, [viewDate, viewMode]); // eslint-disable-line react-hooks/exhaustive-deps

  function go(offset: number) {
    const d = new Date(viewDate + "T12:00:00");
    if (viewMode === "week") {
      d.setDate(d.getDate() + offset * 7);
    } else if (viewMode === "month") {
      d.setMonth(d.getMonth() + offset, 1);
    } else {
      d.setDate(d.getDate() + offset);
    }
    setViewDate(d.toISOString().split("T")[0]);
  }

  const formattedDate = new Date(viewDate + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const weekLabel = [
    new Date(weekDates[0] + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    "–",
    new Date(weekDates[6] + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
  ].join(" ");
  const monthLabel = new Date(viewDate + "T12:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const periodLabel = viewMode === "week" ? weekLabel : viewMode === "month" ? monthLabel : formattedDate;

  const showTodayBtn = viewMode === "day" ? !isToday : viewMode === "week" ? !weekInclToday : !monthInclToday;
  const canExpand    = viewMode !== "list";

  const STAT_CARDS = [
    { label: "Appointments", value: counts.total,     colorCls: "text-slate-700", status: "ALL"       as const },
    { label: "Pending",      value: counts.pending,   colorCls: "text-amber-600", status: "PENDING"   as const },
    { label: "Confirmed",    value: counts.confirmed, colorCls: "text-blue-600",  status: "CONFIRMED" as const },
    { label: "Completed",    value: counts.completed, colorCls: "text-green-600", status: "COMPLETED" as const },
  ] as const;

  // Shared nav bar — includes view toggle so both inline and expanded share one row
  function NavBar({ onClose }: { onClose?: () => void }) {
    const VIEW_TABS = [
      { mode: "day"   as const, icon: <CalendarCheck className="w-3.5 h-3.5" />, label: "Day"   },
      { mode: "week"  as const, icon: <CalendarDays  className="w-3.5 h-3.5" />, label: "Week"  },
      { mode: "month" as const, icon: <LayoutGrid    className="w-3.5 h-3.5" />, label: "Month" },
      { mode: "list"  as const, icon: <List          className="w-3.5 h-3.5" />, label: "List"  },
    ];
    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        {/* Row 1 (mobile) / left (desktop): Prev / Next + period label */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Tooltip content={`Previous ${viewMode}`} side="bottom">
            <button onClick={() => go(-1)}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer transition-colors shrink-0">
              <ChevronLeft className="w-4 h-4" />
            </button>
          </Tooltip>
          <Tooltip content={`Next ${viewMode}`} side="bottom">
            <button onClick={() => go(1)}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer transition-colors shrink-0">
              <ChevronRight className="w-4 h-4" />
            </button>
          </Tooltip>
          <span className="text-sm font-semibold text-slate-800 truncate min-w-0">{periodLabel}</span>
        </div>

        {/* Row 2 (mobile) / right (desktop): view switcher + refresh + expand */}
        <div className="flex items-center gap-2 shrink-0">
          {/* View switcher */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            {VIEW_TABS.map(({ mode, icon, label }, i) => {
              const VIEW_HINTS: Record<string, string> = {
                day:   "Single-day timeline split by staff member",
                week:  "7-day overview with all bookings across the week",
                month: "Full month grid — click a day to drill into it",
                list:  "Flat list of appointments for the selected day with filters",
              };
              return (
                <Tooltip key={mode} content={VIEW_HINTS[mode]} side="bottom">
                  <button onClick={() => setViewMode(mode)}
                    className={`px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                      i > 0 ? "border-l border-slate-200" : ""
                    } ${viewMode === mode ? "bg-slate-800 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
                    {icon}
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                </Tooltip>
              );
            })}
          </div>

          {/* Refresh */}
          <Tooltip content="Reload the latest bookings from the server" side="bottom">
            <button
              onClick={async () => { setRefreshing(true); try { await onRefresh(); } finally { setRefreshing(false); } }}
              disabled={refreshing}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 cursor-pointer transition-colors shrink-0 disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </Tooltip>

          {/* Expand / Collapse */}
          {onClose ? (
            <Tooltip content="Collapse back to the page" side="bottom">
              <button onClick={onClose}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 cursor-pointer transition-colors shrink-0">
                <Minimize2 className="w-4 h-4" />
              </button>
            </Tooltip>
          ) : (
            canExpand && (
              <Tooltip content="Expand the calendar to full screen" side="bottom">
                <button onClick={() => setExpanded(true)}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 cursor-pointer transition-colors shrink-0">
                  <Maximize2 className="w-4 h-4" />
                </button>
              </Tooltip>
            )
          )}
        </div>
      </div>
    );
  }

  function ViewContent({ forExpanded }: { forExpanded: boolean }) {
    const mh = forExpanded ? undefined : 520;
    if (viewMode === "day") {
      if (activeStaff.length === 0) {
        return <div className="text-center py-20 text-slate-400 text-sm">No active staff — onboard staff first.</div>;
      }
      return (
        <>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <TimelineGrid
              activeStaff={activeStaff} dayBookings={dayBookings}
              calStart={calStart} calEnd={calEnd} calHours={calHours}
              showNow={showNow} nowY={nowY} serviceMap={serviceMap}
              gridRef={gridRef} maxHeight={mh} onSelect={setSelected}
              dayOh={dayOh}
            />
          </div>
          {dayBookings.length === 0 && (
            <p className="text-center text-xs text-slate-400">
              No appointments {isToday ? "today" : `on ${formattedDate}`}.
            </p>
          )}
        </>
      );
    }
    // Staff filter pill bar shared by week + month
    const staffPills = activeStaff.length > 1 ? (
      <div className="flex flex-wrap items-center gap-1.5 px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mr-0.5 shrink-0">Stylist</span>
        <button
          onClick={() => setFilterStaffWeek(0)}
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer ${
            filterStaffWeek === 0
              ? "bg-slate-800 text-white border-slate-800"
              : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
          }`}>
          All
        </button>
        {activeStaff.map((s) => {
          const color   = staffColorMap.get(s.id)!;
          const isActive = filterStaffWeek === s.id;
          return (
            <button key={s.id}
              onClick={() => setFilterStaffWeek(filterStaffWeek === s.id ? 0 : s.id)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer"
              style={{
                borderColor: color,
                color: isActive ? "#fff" : color,
                backgroundColor: isActive ? color : `${color}18`,
              }}>
              <span className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: isActive ? "rgba(255,255,255,0.75)" : color }} />
              {s.name.split(" ")[0]}
            </button>
          );
        })}
      </div>
    ) : null;

    if (viewMode === "week") {
      return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {staffPills}
          <WeekTimelineGrid
            weekDates={weekDates} allBookings={allBookings}
            calStart={calStart} calEnd={calEnd} calHours={calHours}
            todayStr={todayStr} serviceMap={serviceMap} staffMap={staffMap}
            staffColorMap={staffColorMap} filterStaffId={filterStaffWeek}
            operatingHours={operatingHours}
            gridRef={gridRef} maxHeight={mh} onSelect={setSelected}
          />
        </div>
      );
    }
    if (viewMode === "month") {
      return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {staffPills}
          <MonthGrid
            allBookings={allBookings} viewDate={viewDate} todayStr={todayStr}
            maxHeight={mh} staffColorMap={staffColorMap} filterStaffId={filterStaffWeek}
            onSelectDate={(d) => {
              setViewDate(d);
              setViewMode("day");
              if (forExpanded) setExpanded(false);
            }}
          />
        </div>
      );
    }
    return null;
  }

  return (
    <div className="space-y-4">

      {/* ── Summary stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {STAT_CARDS.map(({ label, value, colorCls, status }) => {
          const isActive = viewMode === "list" && filterStatus === status;
          return (
            <button key={label}
              onClick={() => { setFilterStatus(status); setViewMode("list"); }}
              className={`bg-white rounded-xl border px-3 sm:px-4 py-3 text-center cursor-pointer transition-all hover:shadow-sm ${
                isActive ? "border-matcha-400 ring-1 ring-matcha-200 bg-matcha-50/30" : "border-slate-200 hover:border-slate-300"
              }`}>
              <p className={`text-xl sm:text-2xl font-bold leading-none ${colorCls}`}>{value}</p>
              <p className="text-[11px] font-medium text-slate-500 mt-1.5">{label}</p>
            </button>
          );
        })}
      </div>

      {/* ── Single toolbar: nav + view switcher ── */}
      <NavBar />

      {/* ── Week strip (day mode only) ── */}
      {viewMode === "day" && operatingHours && operatingHours.length > 0 && (() => {
        const vd   = new Date(viewDate + "T12:00:00");
        const vDow = (vd.getDay() + 6) % 7;
        const monday = new Date(vd);
        monday.setDate(vd.getDate() - vDow);
        return (
          <div className="flex gap-1">
            {WEEK_ORDER.map((dayName, i) => {
              const oh = operatingHours.find((h) => h.day === dayName);
              const target = new Date(monday);
              target.setDate(monday.getDate() + i);
              const targetStr  = target.toISOString().split("T")[0];
              const isSelected = targetStr === viewDate;
              const isToday    = targetStr === todayStr;
              return (
                <button key={dayName} onClick={() => setViewDate(targetStr)}
                  title={oh?.closed ? `${DAY_SHORT[dayName]} – Closed` : `${DAY_SHORT[dayName]} ${fmt12(oh?.openTime ?? "00:00")} – ${fmt12(oh?.closeTime ?? "00:00")}`}
                  className={`flex flex-col items-center py-1 px-1.5 rounded-lg cursor-pointer transition-all min-w-[34px] ${
                    isSelected && isToday
                      ? "bg-matcha-600 text-white"
                      : isSelected
                        ? "bg-slate-800 text-white"
                        : isToday
                          ? "ring-1 ring-matcha-500 text-matcha-700"
                          : oh?.closed
                            ? "text-slate-300 hover:bg-slate-50"
                            : "text-slate-600 hover:bg-slate-100"
                  }`}>
                  <span className={`text-[9px] font-semibold uppercase tracking-wide ${
                    isSelected ? "text-white/70" : isToday ? "text-matcha-500" : oh?.closed ? "text-slate-300" : "text-slate-400"
                  }`}>
                    {DAY_SHORT[dayName]}
                  </span>
                  <span className={`text-xs font-bold mt-0.5 ${
                    isSelected ? "text-white" : isToday ? "text-matcha-700" : oh?.closed ? "text-slate-300" : "text-slate-700"
                  }`}>
                    {target.getDate()}
                  </span>
                  {!oh?.closed && (
                    <div className={`w-1 h-1 rounded-full mt-0.5 ${
                      isSelected ? "bg-white/60" : isToday ? "bg-matcha-500" : "bg-matcha-400/50"
                    }`} />
                  )}
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* ── Day / Week / Month views ── */}
      {viewMode !== "list" && !expanded && (
        <div className="space-y-2">
          <ViewContent forExpanded={false} />
        </div>
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

      {/* ── Fullscreen expanded overlay ── */}
      {expanded && canExpand && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm p-5 flex items-stretch">
          <div className="flex-1 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-white shrink-0 rounded-t-2xl">
              <NavBar onClose={() => setExpanded(false)} />
            </div>
            <div className="flex-1 overflow-hidden p-4 flex flex-col gap-3">
              <ViewContent forExpanded={true} />
            </div>
          </div>
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
  id: 0, salonId: "", staffId: 0, dayOfWeek: day,
  startTime: "09:00", endTime: "17:00", available: day !== "SUNDAY",
}));

function AvailabilityPanel({ salonId, staff, operatingHours }: { salonId: string; staff: StaffMember[]; operatingHours?: OperatingHours[] }) {
  const [selectedStaff, setSelectedStaff] = useState<number>(staff[0]?.id ?? 0);
  const [schedule, setSchedule] = useState<StaffAvailability[]>(DEFAULT_SCHEDULE);
  const [overrides, setOverrides] = useState<StaffAvailabilityOverride[]>([]);
  const [saving, setSaving] = useState(false);
  const { toast, notify } = useToast();
  const [addOverride, setAddOverride] = useState(false);
  const [overrideForm, setOverrideForm] = useState({
    overrideDate: "", startTime: "09:00", endTime: "17:00", available: true, reason: "",
  });

  // Stable key derived from operating hours content — triggers re-fetch when hours change
  // (the backend sync listener has already updated staff_availability by the time this fires)
  const ohKey = JSON.stringify(operatingHours);

  useEffect(() => {
    if (!selectedStaff) return;
    apiFetch<StaffAvailability[]>(`${ADMIN_API}/${salonId}/staff/${selectedStaff}/availability`)
      .then((data) => {
        if (data.length === 0) {
          setSchedule(DEFAULT_SCHEDULE);
        } else {
          setSchedule(DAYS.map((day) => {
            const found = data.find((d) => d.dayOfWeek === day);
            return found ?? { id: 0, salonId, staffId: selectedStaff, dayOfWeek: day, startTime: "09:00", endTime: "17:00", available: false };
          }));
        }
      })
      .catch((e) => { setSchedule(DEFAULT_SCHEDULE); notify(e instanceof Error ? e.message : "Failed to load schedule", "error"); });
    apiFetch<StaffAvailabilityOverride[]>(`${ADMIN_API}/${salonId}/staff/${selectedStaff}/availability/overrides`)
      .then(setOverrides)
      .catch((e) => { setOverrides([]); notify(e instanceof Error ? e.message : "Failed to load overrides", "error"); });
  }, [selectedStaff, salonId, ohKey]); // eslint-disable-line react-hooks/exhaustive-deps

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
        notify("Staff hours cannot exceed salon operating hours.", "error");
        return;
      }
    }
    setSaving(true);
    try {
      const body = schedule.map((s) => ({ dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime, available: s.available }));
      await apiFetch<StaffAvailability[]>(`${ADMIN_API}/${salonId}/staff/${selectedStaff}/availability`, {
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
        `${ADMIN_API}/${salonId}/staff/${selectedStaff}/availability/overrides`,
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
      await apiFetch(`${ADMIN_API}/${salonId}/staff/${selectedStaff}/availability/overrides/${oid}`, { method: "DELETE" });
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
            const salonClosed = operatingHours?.length && (!oh || oh.closed);
            const startErr = s.available && !salonClosed && !!oh && !oh.closed && toHHMM(s.startTime) < toHHMM(oh.openTime);
            const endErr   = s.available && !salonClosed && !!oh && !oh.closed && toHHMM(s.endTime)   > toHHMM(oh.closeTime);
            const hasErr   = startErr || endErr;
            return (
              <div key={s.dayOfWeek} className="px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold w-8 ${salonClosed ? "text-slate-300" : "text-slate-500"}`}>
                    {DAY_SHORT[s.dayOfWeek]}
                  </span>
                  <button onClick={() => !salonClosed && toggleDay(s.dayOfWeek)}
                    disabled={!!salonClosed}
                    className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
                      salonClosed ? "bg-slate-100 cursor-not-allowed" : `cursor-pointer ${s.available ? "bg-matcha-600" : "bg-slate-200"}`
                    }`}>
                    <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${s.available && !salonClosed ? "translate-x-4" : "translate-x-0"}`} />
                  </button>
                  {salonClosed ? (
                    <span className="text-xs text-slate-300 italic ml-1">Salon closed</span>
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
                    Outside salon hours ({oh!.openTime} – {oh!.closeTime})
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <div className="px-4 py-3 border-t border-slate-100 flex justify-end">
          <Tooltip content={scheduleHasErrors ? "Fix hours that exceed salon operating hours before saving" : "Save the recurring weekly availability for this staff member"} side="top">
            <button onClick={saveSchedule} disabled={saving || scheduleHasErrors}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-matcha-600 text-white text-xs font-medium hover:bg-matcha-700 transition-colors cursor-pointer disabled:opacity-50">
              {saving ? "Saving…" : "Save schedule"}
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Date overrides</h3>
            <p className="text-xs text-slate-400 mt-0.5">Override the weekly schedule for a specific date — e.g. vacation, public holiday, sick leave, or different hours on a particular day.</p>
          </div>
          <Tooltip content="Add a one-off exception — vacation, sick day, or different hours on a specific date" side="left">
            <button onClick={() => setAddOverride(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer shrink-0">
              <Plus className="w-3 h-3" /> Add override
            </button>
          </Tooltip>
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
                <Tooltip content="Remove this date override" side="left">
                  <button onClick={() => deleteOverride(o.id)}
                    className="text-slate-300 hover:text-red-500 transition-colors cursor-pointer ml-4">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </Tooltip>
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

      <Toast toast={toast} />
    </div>
  );
}

// ── Closures panel ────────────────────────────────────────────────────────────

function ClosuresPanel({ salonId }: { salonId: string }) {
  const [closures, setClosures] = useState<SalonClosure[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ startDate: "", endDate: "", reason: "" });
  const [formErr, setFormErr] = useState("");
  const { toast, notify } = useToast();

  useEffect(() => {
    apiFetch<SalonClosure[]>(`${ADMIN_API}/${salonId}/closures`)
      .then(setClosures)
      .catch((e) => notify(e instanceof Error ? e.message : "Failed to load closures", "error"))
      .finally(() => setLoading(false));
  }, [salonId]); // eslint-disable-line react-hooks/exhaustive-deps

  function validate() {
    if (!form.startDate || !form.endDate) return "Start and end dates are required.";
    if (form.endDate < form.startDate) return "End date must be on or after start date.";
    return "";
  }

  async function addClosure() {
    const err = validate();
    if (err) { setFormErr(err); return; }
    setSaving(true);
    try {
      const saved = await apiFetch<SalonClosure>(`${ADMIN_API}/${salonId}/closures`, {
        method: "POST",
        body: JSON.stringify({ startDate: form.startDate, endDate: form.endDate, reason: form.reason || null }),
      });
      setClosures((p) => [...p, saved].sort((a, b) => a.startDate.localeCompare(b.startDate)));
      setShowAdd(false);
      setForm({ startDate: "", endDate: "", reason: "" });
      setFormErr("");
      notify("Dates blocked.");
    } catch (e) { notify(e instanceof Error ? e.message : "Error", "error"); }
    finally { setSaving(false); }
  }

  async function removeClosure(id: number) {
    try {
      await apiFetch(`${ADMIN_API}/${salonId}/closures/${id}`, { method: "DELETE" });
      setClosures((p) => p.filter((c) => c.id !== id));
      notify("Blocked dates removed.");
    } catch (e) { notify(e instanceof Error ? e.message : "Error", "error"); }
  }

  function fmtDate(iso: string) {
    return new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }
  function fmtRange(start: string, end: string) {
    if (start === end) return fmtDate(start);
    return `${fmtDate(start)} – ${fmtDate(end)}`;
  }

  const today = new Date().toISOString().split("T")[0];
  const currentYear = new Date().getFullYear().toString();
  const displayClosures = closures.filter((c) => !c.holidayId || c.startDate.startsWith(currentYear));
  const upcoming = displayClosures.filter((c) => c.endDate >= today);
  const past     = displayClosures.filter((c) => c.endDate <  today);

  return (
    <div className="max-w-lg space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Blocked Dates</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Mark days or date ranges when the salon won't accept any bookings — public holidays, vacation, emergencies, or special occasions.
            </p>
          </div>
          <Tooltip content="Block a day or date range so no bookings can be made" side="left">
            <button onClick={() => { setShowAdd(true); setFormErr(""); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer shrink-0">
              <Plus className="w-3 h-3" /> Block Dates
            </button>
          </Tooltip>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-400">
            <div className="w-3.5 h-3.5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
            Loading…
          </div>
        ) : upcoming.length === 0 && past.length === 0 ? (
          <p className="text-xs text-slate-400 px-5 py-6 text-center">
            No blocked dates yet. Add one to mark public holidays, vacation, or any day the salon won't accept bookings.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {upcoming.length > 0 && (
              <>
                <p className="px-5 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400 bg-slate-50/70">
                  Upcoming
                </p>
                {upcoming.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${c.holidayId ? "bg-violet-100" : "bg-orange-100"}`}>
                        {c.holidayId
                          ? <CalendarDays className="w-3.5 h-3.5 text-violet-600" />
                          : <CalendarOff className="w-3.5 h-3.5 text-orange-600" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-800">
                            {c.holidayId ? (c.reason ?? fmtRange(c.startDate, c.endDate)) : fmtRange(c.startDate, c.endDate)}
                          </p>
                          {c.holidayId && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-600 border border-violet-200">Holiday</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">
                          {c.holidayId ? fmtRange(c.startDate, c.endDate) : (c.reason ?? "No reason specified")}
                        </p>
                      </div>
                    </div>
                    {c.holidayId ? (
                      <Tooltip content="Managed via the Holidays page — delete the holiday to remove this blocked date" side="left">
                        <span className="text-slate-200 ml-4 cursor-not-allowed">
                          <Trash2 className="w-4 h-4" />
                        </span>
                      </Tooltip>
                    ) : (
                      <Tooltip content="Remove this blocked period" side="left">
                        <button onClick={() => removeClosure(c.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors cursor-pointer ml-4">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </Tooltip>
                    )}
                  </div>
                ))}
              </>
            )}
            {past.length > 0 && (
              <>
                <p className="px-5 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400 bg-slate-50/70">
                  Past
                </p>
                {past.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-5 py-3 opacity-50">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                        {c.holidayId
                          ? <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                          : <CalendarOff className="w-3.5 h-3.5 text-slate-400" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-700">
                            {c.holidayId ? (c.reason ?? fmtRange(c.startDate, c.endDate)) : fmtRange(c.startDate, c.endDate)}
                          </p>
                          {c.holidayId && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400 border border-slate-200">Holiday</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">
                          {c.holidayId ? fmtRange(c.startDate, c.endDate) : (c.reason ?? "No reason specified")}
                        </p>
                      </div>
                    </div>
                    {c.holidayId ? (
                      <span className="text-slate-200 ml-4 cursor-not-allowed">
                        <Trash2 className="w-4 h-4" />
                      </span>
                    ) : (
                      <Tooltip content="Remove this blocked period" side="left">
                        <button onClick={() => removeClosure(c.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors cursor-pointer ml-4">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </Tooltip>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center">
                  <CalendarOff className="w-3.5 h-3.5 text-orange-600" />
                </div>
                <span className="text-base font-bold text-slate-900">Block Dates</span>
              </div>
              <button className="text-slate-400 hover:text-slate-600 cursor-pointer" onClick={() => setShowAdd(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={fieldLabel}>Start date <span className="text-red-500">*</span></label>
                  <input type="date" className={inputCls}
                    min={today}
                    value={form.startDate}
                    onChange={(e) => { setFormErr(""); setForm((p) => ({ ...p, startDate: e.target.value, endDate: p.endDate < e.target.value ? e.target.value : p.endDate })); }} />
                </div>
                <div>
                  <label className={fieldLabel}>End date <span className="text-red-500">*</span></label>
                  <input type="date" className={inputCls}
                    min={form.startDate || today}
                    value={form.endDate}
                    onChange={(e) => { setFormErr(""); setForm((p) => ({ ...p, endDate: e.target.value })); }} />
                </div>
              </div>
              <div>
                <label className={fieldLabel}>Reason (optional)</label>
                <input className={inputCls} placeholder="e.g. Annual vacation, Bank holiday, Staff training"
                  value={form.reason}
                  onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))} />
              </div>
              {formErr && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-red-600">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {formErr}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
              <button onClick={() => setShowAdd(false)}
                className="px-4 py-2 rounded-md border border-slate-200 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 cursor-pointer">
                Cancel
              </button>
              <button onClick={addClosure} disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 cursor-pointer disabled:opacity-50">
                <CalendarOff className="w-3.5 h-3.5" />
                {saving ? "Saving…" : "Block Dates"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
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

function BookingSettingsPanel({
  salon, onSaved, onError,
}: {
  salon: { id: string | number; bookingAdvanceDays?: number; bookingRequiresConfirmation?: boolean };
  onSaved: (days: number, requiresConfirmation: boolean) => void;
  onError: (msg: string) => void;
}) {
  const [days, setDays] = useState(salon.bookingAdvanceDays ?? 60);
  const [requiresConfirmation, setRequiresConfirmation] = useState(salon.bookingRequiresConfirmation ?? false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setDays(salon.bookingAdvanceDays ?? 60); }, [salon.bookingAdvanceDays]);
  useEffect(() => { setRequiresConfirmation(salon.bookingRequiresConfirmation ?? false); }, [salon.bookingRequiresConfirmation]);

  async function save() {
    setSaving(true);
    try {
      const res = await apiFetch(`${ADMIN_API}/${salon.id}/booking-settings`, {
        method: "PATCH",
        body: JSON.stringify({ bookingAdvanceDays: days, bookingRequiresConfirmation: requiresConfirmation }),
      });
      const r = res as { bookingAdvanceDays: number; bookingRequiresConfirmation: boolean };
      onSaved(r.bookingAdvanceDays ?? days, r.bookingRequiresConfirmation ?? requiresConfirmation);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { onError(e instanceof Error ? e.message : "Failed to save settings"); }
    finally { setSaving(false); }
  }

  return (
    <div className="max-w-lg space-y-4">
      {/* Booking confirmation */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">Booking confirmation</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            When enabled, new bookings are created as <strong>Pending</strong> and must be manually confirmed by an admin. When disabled, bookings are auto-confirmed immediately.
          </p>
        </div>
        <button type="button" onClick={() => setRequiresConfirmation((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors cursor-pointer">
          <div>
            <p className={`text-sm font-semibold ${requiresConfirmation ? "text-matcha-800" : "text-slate-700"}`}>
              Require manual confirmation
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {requiresConfirmation
                ? "New bookings will stay Pending until you confirm them."
                : "New bookings are confirmed automatically — no action needed."}
            </p>
          </div>
          <div className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${requiresConfirmation ? "bg-matcha-600" : "bg-slate-200"}`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${requiresConfirmation ? "left-5" : "left-0.5"}`} />
          </div>
        </button>
      </div>

      {/* Advance booking window */}
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
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/60">
          <p className="text-xs text-slate-400">
            Currently <strong className="text-slate-600">{days} days</strong> — customers can book up to{" "}
            <strong className="text-slate-600">{ADVANCE_OPTIONS.find((o) => o.days === days)?.label ?? `${days} days`}</strong> ahead.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-matcha-600 text-white text-xs font-medium hover:bg-matcha-700 transition-colors cursor-pointer disabled:opacity-50">
          {saved ? <><Check className="w-3 h-3" /> Saved!</> : saving ? "Saving…" : "Save settings"}
        </button>
      </div>
    </div>
  );
}

// ── dismissible info bar ──────────────────────────────────────────────────────

const BOOKING_INFO_KEY = "booking-calendar-info-dismissed";

function useDismissibleInfo() {
  const [visible, setVisible] = useState(() => {
    try { return localStorage.getItem(BOOKING_INFO_KEY) !== "1"; } catch { return true; }
  });
  function dismiss() {
    setVisible(false);
    try { localStorage.setItem(BOOKING_INFO_KEY, "1"); } catch {}
  }
  return { visible, dismiss };
}

// ── booking link banner ───────────────────────────────────────────────────────

const BOOKING_BASE = (import.meta.env.VITE_BOOKING_BASE_URL ?? "http://localhost:5177").replace(/\/$/, "");

function BookingLinkBanner({ handler }: { handler: string }) {
  const url = `${BOOKING_BASE}/${handler}`;
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-matcha-50 border border-matcha-200 mb-6 flex-wrap sm:flex-nowrap">
      <Link2 className="w-4 h-4 text-matcha-600 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-matcha-800 mb-0.5">Online booking link</p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-matcha-700 font-mono truncate block hover:underline"
        >
          {url}
        </a>
      </div>
      <button
        onClick={copy}
        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-matcha-700 bg-white border border-matcha-200 hover:bg-matcha-50 transition-colors cursor-pointer"
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  );
}

export default function BookingPage() {
  const { salon, setSalon } = useOutletContext<LayoutContext>();
  const { bookings: init, staff, services } = useLoaderData<typeof clientLoader>();
  const [bookings, setBookings] = useState<Booking[]>(init);
  const [tab, setTab] = useState<"bookings" | "availability" | "closures" | "settings">("bookings");
  const [busy, setBusy] = useState(false);
  const { toast, notify } = useToast();
  const { visible: infoVisible, dismiss: dismissInfo } = useDismissibleInfo();

  const [rescheduleTarget, setRescheduleTarget] = useState<Booking | null>(null);
  const [rsForm, setRsForm] = useState({ appointmentDate: "", startTime: "", staffId: 0, notes: "" });
  const [rsSlots, setRsSlots] = useState<AvailableSlot[] | null>(null);
  const [rsSlotsLoading, setRsSlotsLoading] = useState(false);
  const [rsSelectedSlot, setRsSelectedSlot] = useState<AvailableSlot | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Booking | null>(null);

  const sid = salon.id;
  const staffMap = new Map(staff.map((s) => [s.id, s]));
  const serviceMap = new Map(services.map((s) => [s.id, s]));



  useEffect(() => {
    if (!rescheduleTarget || !rsForm.appointmentDate) { setRsSlots(null); return; }
    let cancelled = false;
    setRsSlotsLoading(true);
    const params = new URLSearchParams({ serviceId: String(rescheduleTarget.serviceId), date: rsForm.appointmentDate });
    apiFetch<AvailableSlot[]>(`${CUSTOMER_API}/${String(sid)}/slots?${params}`)
      .then((slots) => { if (!cancelled) setRsSlots(slots); })
      .catch((e) => { if (!cancelled) { setRsSlots([]); notify(e instanceof Error ? e.message : "Failed to load slots", "error"); } })
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

  async function handleRefresh() {
    try {
      const fresh = await apiFetch<Booking[]>(`${ADMIN_API}/${sid}/booking`);
      setBookings(fresh ?? []);
    } catch (e) { notify(e instanceof Error ? e.message : "Failed to refresh bookings", "error"); }
  }

  const tabCls = (active: boolean) =>
    `px-4 py-2 text-sm font-medium rounded-md cursor-pointer transition-colors ${active ? "bg-matcha-600 text-white" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"}`;

  return (
    <>
      <div className="mb-6 space-y-2">
        <h1 className="text-xl font-bold text-slate-900">Booking Calendar</h1>
        {infoVisible && (
          <div className="relative">
            <InfoBar>
              Manage customer appointments and staff availability. Use <strong>Appointments</strong> to view, confirm, reschedule, or cancel appointments. Use <strong>Staff Availability</strong> to set each person's working hours and add date overrides. Use <strong>Blocked Dates</strong> to mark date ranges when the salon won't accept bookings — vacation, emergencies. Use <strong>Settings</strong> to control how far in advance customers can book.
            </InfoBar>
            <button
              onClick={dismissInfo}
              aria-label="Dismiss"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 hover:text-blue-600 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {salon.handler && salon.features?.includes("BOOKING") && (
        <BookingLinkBanner handler={salon.handler} />
      )}

      <div className="flex gap-1 p-1 bg-slate-100 rounded-lg mb-6 w-fit flex-wrap">
        <Tooltip content="View, confirm, reschedule, cancel, or complete customer appointments." side="bottom">
          <button className={tabCls(tab === "bookings")} onClick={() => setTab("bookings")}>
            <span className="flex items-center gap-2"><CalendarCheck className="w-4 h-4" /> Appointments</span>
          </button>
        </Tooltip>
        <Tooltip content="Set each staff member's weekly working hours and add one-off date overrides." side="bottom">
          <button className={tabCls(tab === "availability")} onClick={() => setTab("availability")}>
            <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> Staff Availability</span>
          </button>
        </Tooltip>
        <Tooltip content="Mark days or date ranges when the salon won't accept any bookings — holidays, vacation, emergencies." side="bottom">
          <button className={tabCls(tab === "closures")} onClick={() => setTab("closures")}>
            <span className="flex items-center gap-2"><CalendarOff className="w-4 h-4" /> Blocked Dates</span>
          </button>
        </Tooltip>
        <Tooltip content="Control how far ahead customers can book appointments." side="bottom">
          <button className={tabCls(tab === "settings")} onClick={() => setTab("settings")}>
            <span className="flex items-center gap-2"><Settings className="w-4 h-4" /> Settings</span>
          </button>
        </Tooltip>
      </div>

      {tab === "bookings" && (
        <BookingsPanel
          bookings={bookings} staffMap={staffMap} serviceMap={serviceMap}
          staff={staff} operatingHours={salon.operatingHours}
          onAction={handleAction} onReschedule={openReschedule} onDelete={setDeleteTarget}
          onRefresh={handleRefresh}
        />
      )}

      {tab === "availability" && (
        <AvailabilityPanel salonId={String(sid)} staff={staff} operatingHours={salon.operatingHours} />
      )}

      {tab === "closures" && (
        <ClosuresPanel salonId={String(sid)} />
      )}

      {tab === "settings" && (
        <BookingSettingsPanel
          salon={{ id: String(sid), bookingAdvanceDays: salon.bookingAdvanceDays, bookingRequiresConfirmation: salon.bookingRequiresConfirmation }}
          onSaved={(days, requiresConfirmation) => setSalon({ ...salon, bookingAdvanceDays: days, bookingRequiresConfirmation: requiresConfirmation })}
          onError={(msg) => notify(msg, "error")}
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

      <Toast toast={toast} />
    </>
  );
}
