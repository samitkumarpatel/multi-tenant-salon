import React, { useEffect, useRef, useState } from "react";
import { Sparkles, Users, User, Clock, MapPin, Phone, Mail, Globe, ChevronRight, ChevronLeft, Loader2, Images, Quote } from "lucide-react";
import { formatPrice, CATEGORY_LABEL, STAFF_ROLE_LABEL, DAY_SHORT } from "./constants";
import { apiFetch, API_BASE } from "./api";
import { staffAvatar, MediaThumb, Lightbox } from "./StaffMedia";
import { type ClosureRange, isDateClosed, firstBookableDate, closedWeekdays, isPastSlot } from "./bookingDates";
import type { Salon, ServiceItem, StaffMember, WebsiteTheme, OperatingHours, AvailableSlot, StaffSchedule } from "./types";

// ── Shared tokens & shell ────────────────────────────────────────────────────

export interface CardTokens {
  theme: WebsiteTheme;
  msgText: string;
  msgDim: string;
  bubbleBorder: string;
  bubbleShadow: string;
  asBubbleBg: string;
  accentText: string;
}

type IconType = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

export function CardShell({ title, icon: Icon, tokens, children }: { title: string; icon: IconType; tokens: CardTokens; children: React.ReactNode }) {
  const { theme, bubbleBorder, bubbleShadow, asBubbleBg } = tokens;
  return (
    <div
      className="mt-2.5 rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${bubbleBorder}`, boxShadow: bubbleShadow, backgroundColor: asBubbleBg, maxWidth: 420 }}
    >
      <div className="px-3.5 py-2.5 flex items-center gap-2 sm:px-4" style={{ borderBottom: `1px solid ${bubbleBorder}` }}>
        <Icon className="w-3.5 h-3.5" style={{ color: theme.accentColor }} />
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: theme.accentColor }}>{title}</p>
      </div>
      <div className="px-3.5 py-3 sm:px-4">{children}</div>
    </div>
  );
}

function BookPill({ label, tokens, onClick }: { label: string; tokens: CardTokens; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-transform active:scale-95"
      style={{ backgroundColor: tokens.theme.accentColor, color: tokens.accentText }}
    >
      {label}
    </button>
  );
}

function initials(name: string) {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}
const CARD_COLORS = ["#7C3AED", "#0284C7", "#D97706", "#DC2626", "#059669", "#EA580C", "#4F46E5"];
function avatarColor(name: string) {
  return CARD_COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % CARD_COLORS.length];
}

// ── Services ─────────────────────────────────────────────────────────────────

function groupByCategory(list: ServiceItem[]): [string, ServiceItem[]][] {
  const map = new Map<string, ServiceItem[]>();
  for (const s of list) {
    const cat = s.category ?? "OTHER";
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(s);
  }
  return [...map.entries()];
}

export function ServicesCard({ services, tokens, showBookPill, onBook }: {
  services: ServiceItem[]; tokens: CardTokens; showBookPill: boolean; onBook: (service: ServiceItem) => void;
}) {
  const { msgText, msgDim } = tokens;
  const grouped = groupByCategory(services.filter((s) => s.active));
  if (grouped.length === 0) return null;

  return (
    <CardShell title="Our services" icon={Sparkles} tokens={tokens}>
      <div className="space-y-3.5">
        {grouped.map(([cat, items]) => (
          <div key={cat}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: msgDim }}>
              {CATEGORY_LABEL[cat] ?? cat}
            </p>
            <div className="space-y-2">
              {items.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: msgText }}>{s.name}</p>
                    <p className="text-[11px]" style={{ color: msgDim }}>{s.durationMinutes ?? 30} min</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-semibold tabular-nums" style={{ color: msgText }}>{formatPrice(s.price, s.currency)}</span>
                    {showBookPill && <BookPill label="Book" tokens={tokens} onClick={() => onBook(s)} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

// ── Staff ────────────────────────────────────────────────────────────────────

export function StaffCard({ staff, tokens, showBookPill, onBook, onViewProfile }: {
  staff: StaffMember[]; tokens: CardTokens; showBookPill: boolean; onBook: (member: StaffMember) => void; onViewProfile?: (member: StaffMember) => void;
}) {
  const { theme, msgText, msgDim } = tokens;
  const active = staff.filter((m) => m.status === "ACTIVE");
  if (active.length === 0) return null;

  return (
    <CardShell title="Meet the team" icon={Users} tokens={tokens}>
      <div className="space-y-3">
        {active.map((m) => (
          <div key={m.id} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 overflow-hidden" style={{ backgroundColor: avatarColor(m.name) }}>
              {m.avatarUrl ? (
                <img src={m.avatarUrl} alt={m.name} className="w-full h-full object-cover" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
              ) : (
                <span className="text-xs font-black text-white">{initials(m.name)}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate" style={{ color: msgText }}>{m.name}</p>
              <p className="text-[11px]" style={{ color: msgDim }}>{STAFF_ROLE_LABEL[m.role] ?? m.role}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {onViewProfile && (
                <button
                  type="button"
                  onClick={() => onViewProfile(m)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-opacity hover:opacity-70 border"
                  style={{ color: theme.accentColor, borderColor: theme.accentColor, background: "transparent" }}
                >
                  Profile
                </button>
              )}
              {showBookPill && <BookPill label="Book" tokens={tokens} onClick={() => onBook(m)} />}
            </div>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

// ── Single staff profile (bio + interactive work gallery) ───────────────────

export function StaffProfileCard({ member, tokens, showBookPill, onBook }: {
  member: StaffMember; tokens: CardTokens; showBookPill: boolean; onBook: (member: StaffMember) => void;
}) {
  const { theme, msgText, msgDim, accentText } = tokens;
  const media = member.workMedia ?? [];
  const avatar = staffAvatar(member);
  const firstName = member.name.split(/\s+/)[0];
  const [lb, setLb] = useState<number | null>(null);

  return (
    <CardShell title={`Meet ${firstName}`} icon={User} tokens={tokens}>
      <div className="flex items-start gap-3 mb-3">
        <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 overflow-hidden" style={{ backgroundColor: avatarColor(member.name) }}>
          {avatar ? (
            <img src={avatar} alt={member.name} className="w-full h-full object-cover" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          ) : (
            <span className="text-sm font-black text-white">{initials(member.name)}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate" style={{ color: msgText }}>{member.name}</p>
          <p className="text-[11px]" style={{ color: msgDim }}>{STAFF_ROLE_LABEL[member.role] ?? member.role}</p>
          {member.specializations && member.specializations.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {member.specializations.map((s) => (
                <span key={s} className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: theme.accentColor, color: accentText }}>
                  {CATEGORY_LABEL[s] ?? s}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {member.bio && (
        <div className="relative pl-3 mb-3.5">
          <span className="absolute bottom-0 left-0 top-0.5 w-0.5 rounded-full" style={{ backgroundColor: theme.accentColor }} />
          <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: theme.accentColor }}>
            <Quote className="w-3 h-3" /> About {firstName}
          </p>
          <p className="whitespace-pre-line text-xs leading-relaxed" style={{ color: msgDim }}>{member.bio}</p>
        </div>
      )}

      {media.length > 0 && (
        <div className="mb-3.5">
          <div className="mb-1.5 flex items-center gap-1.5">
            <Images className="w-3 h-3" style={{ color: msgDim }} />
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: msgDim }}>{firstName}&rsquo;s work</p>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {media.map((url, i) => (
              <MediaThumb key={url} url={url} className="aspect-square rounded-lg" onClick={() => setLb(i)} />
            ))}
          </div>
        </div>
      )}

      {!member.bio && media.length === 0 && (
        <p className="text-xs py-2 mb-1" style={{ color: msgDim }}>{firstName} hasn&rsquo;t added a portfolio yet.</p>
      )}

      {showBookPill && (
        <button
          type="button"
          onClick={() => onBook(member)}
          className="w-full px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-transform active:scale-[0.98]"
          style={{ backgroundColor: theme.accentColor, color: accentText }}
        >
          Book with {firstName}
        </button>
      )}

      {lb !== null && media[lb] && (
        <Lightbox
          items={media}
          index={lb}
          title={member.name}
          onClose={() => setLb(null)}
          onPrev={() => setLb((i) => ((i ?? 0) - 1 + media.length) % media.length)}
          onNext={() => setLb((i) => ((i ?? 0) + 1) % media.length)}
        />
      )}
    </CardShell>
  );
}

// ── Hours ────────────────────────────────────────────────────────────────────

const DAY_ORDER = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

function isOpenNow(hours?: OperatingHours[]): boolean {
  if (!hours?.length) return false;
  const d = new Date();
  const today = hours.find((h) => h.day === DAY_ORDER[d.getDay()]);
  if (!today || today.closed) return false;
  const [oh, om] = today.openTime.split(":").map(Number);
  const [ch, cm] = today.closeTime.split(":").map(Number);
  const cur = d.getHours() * 60 + d.getMinutes();
  return cur >= oh * 60 + om && cur < ch * 60 + cm;
}

export function HoursCard({ salon, tokens }: { salon: Salon; tokens: CardTokens }) {
  const { theme, msgText, msgDim } = tokens;
  const hours = salon.operatingHours;
  if (!hours?.length) return null;
  const todayIdx = new Date().getDay();
  const open = isOpenNow(hours);

  return (
    <CardShell title="Opening hours" icon={Clock} tokens={tokens}>
      <div className="flex items-center gap-1.5 mb-2.5">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: open ? "#34D399" : msgDim }} />
        <span className="text-xs font-semibold" style={{ color: open ? theme.accentColor : msgDim }}>{open ? "Open now" : "Closed now"}</span>
      </div>
      <div className="space-y-1">
        {DAY_ORDER.map((day, i) => {
          const h = hours.find((x) => x.day === day);
          if (!h) return null;
          const isToday = i === todayIdx;
          return (
            <div
              key={day}
              className="flex items-center justify-between text-xs py-0.5"
              style={{ color: isToday ? theme.accentColor : msgText, fontWeight: isToday ? 700 : 400 }}
            >
              <span>{DAY_SHORT[day] ?? day}</span>
              <span className="font-mono" style={{ color: isToday ? theme.accentColor : msgDim }}>
                {h.closed ? "Closed" : `${h.openTime} – ${h.closeTime}`}
              </span>
            </div>
          );
        })}
      </div>
    </CardShell>
  );
}

// ── Location ─────────────────────────────────────────────────────────────────

export function LocationCard({ salon, tokens }: { salon: Salon; tokens: CardTokens }) {
  const { theme, msgText, msgDim } = tokens;
  const loc = salon.location;
  if (!loc?.address && !loc?.city) return null;
  const mapsUrl = theme.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [loc.address, loc.zipCode, loc.city, loc.country].filter(Boolean).join(", ")
  )}`;

  return (
    <CardShell title="Find us" icon={MapPin} tokens={tokens}>
      <div className="space-y-0.5 mb-2.5">
        {loc.address && <p className="text-sm font-medium" style={{ color: msgText }}>{loc.address}</p>}
        {(loc.zipCode || loc.city) && (
          <p className="text-xs" style={{ color: msgDim }}>{[loc.zipCode, loc.city].filter(Boolean).join(" ")}{loc.state ? `, ${loc.state}` : ""}</p>
        )}
        {loc.country && <p className="text-xs" style={{ color: msgDim }}>{loc.country}</p>}
      </div>
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold select-none opacity-40 cursor-not-allowed" style={{ color: theme.accentColor }}>
        Open in Maps <ChevronRight className="w-3 h-3" />
        <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full border border-current">soon</span>
      </span>
    </CardShell>
  );
}

// ── Contact ──────────────────────────────────────────────────────────────────

export function ContactCard({ salon, tokens }: { salon: Salon; tokens: CardTokens }) {
  const { theme, msgText } = tokens;
  const c = salon.contact;
  if (!c?.phone && !c?.email && !c?.website) return null;

  return (
    <CardShell title="Contact us" icon={Phone} tokens={tokens}>
      <div className="space-y-2">
        {c.phone && (
          <a href={`tel:${c.phone}`} className="flex items-center gap-2.5 no-underline" style={{ color: msgText }}>
            <Phone className="w-3.5 h-3.5 shrink-0" style={{ color: theme.accentColor }} />
            <span className="text-sm font-medium">{c.phone}</span>
          </a>
        )}
        {c.email && (
          <a href={`mailto:${c.email}`} className="flex items-center gap-2.5 no-underline" style={{ color: msgText }}>
            <Mail className="w-3.5 h-3.5 shrink-0" style={{ color: theme.accentColor }} />
            <span className="text-sm font-medium truncate">{c.email}</span>
          </a>
        )}
        {c.website && (
          <a href={c.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 no-underline" style={{ color: msgText }}>
            <Globe className="w-3.5 h-3.5 shrink-0" style={{ color: theme.accentColor }} />
            <span className="text-sm font-medium truncate">{c.website}</span>
          </a>
        )}
      </div>
    </CardShell>
  );
}

// ── Booking picker — interactive calendar + staff dropdown + time slots ─────
// Replaces asking the visitor to type a date in free text: date/staff/time all
// come from the salon's real availability (same /slots endpoint the step-by-step
// BookingWizard uses), so there's nothing for the model to get wrong. Only the
// final review card (rendered by the caller from the returned fields) still
// goes through the usual confirm/dismiss flow.

export type PendingBookingFields = {
  serviceId: number;
  staffId: number | null;
  appointmentDate: string;
  startTime: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  notes: string | null;
};

function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_PATTERN = /^[+\d][\d\s().-]{6,}$/;
const NAME_MIN_LEN = 2;

export function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export function MiniCalendar({ value, onChange, minDate, maxDate, closedDays, closedDateRanges, tokens }: {
  value: string;
  onChange: (iso: string) => void;
  minDate: Date;
  maxDate: Date;
  closedDays: Set<string>;
  closedDateRanges: ClosureRange[];
  tokens: CardTokens;
}) {
  const sel = new Date(`${value}T00:00:00`);
  const [month, setMonth] = useState(() => new Date(sel.getFullYear(), sel.getMonth(), 1));
  const { theme, msgText, msgDim, accentText } = tokens;

  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const firstDow = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const cells: (Date | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];
  const canPrev = new Date(month.getFullYear(), month.getMonth(), 1) > new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const canNext = new Date(month.getFullYear(), month.getMonth(), 1) < new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);

  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-0.5">
        <button
          type="button" disabled={!canPrev}
          onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          className="w-6 h-6 rounded-lg flex items-center justify-center cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed hover:opacity-70 transition-opacity"
          style={{ color: msgDim }}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <p className="text-xs font-semibold" style={{ color: msgText }}>
          {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </p>
        <button
          type="button" disabled={!canNext}
          onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          className="w-6 h-6 rounded-lg flex items-center justify-center cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed hover:opacity-70 transition-opacity"
          style={{ color: msgDim }}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i} className="text-[10px] font-bold text-center" style={{ color: msgDim }}>{d}</span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const iso = toIso(d);
          const disabled = d < minDate || d > maxDate || isDateClosed(iso, closedDays, closedDateRanges);
          const isSel = iso === value;
          return (
            <button
              key={i} type="button" disabled={disabled}
              onClick={() => onChange(iso)}
              className="aspect-square min-h-[36px] rounded-lg text-xs font-medium flex items-center justify-center transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-25"
              style={isSel ? { backgroundColor: theme.accentColor, color: accentText } : { color: msgText }}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export type PickerStep = "date" | "staff" | "time" | "contact";

/**
 * Snapshot of where the visitor is in the interactive booking picker. The picker owns all this
 * state internally, so without lifting a summary out the chat assistant has no idea a booking is
 * being put together when the visitor types a free-text question mid-flow ("is that booked yet?").
 * The parent turns this into a bracketed history clue — see `pickerHistoryClue` in
 * GenerativeUIWebsite.
 */
export type PickerProgress = {
  step: PickerStep;
  staffId: number | null;
  /** false only while still on the staff step — distinguishes "not picked" from "picked: any". */
  staffChosen: boolean;
  date: string;
  /** HH:mm once a slot is picked (contact step reached); null before that. */
  time: string | null;
  name: string;
  email: string;
  phone: string;
};

export function BookingPickerCard({ salon, service, staff, tokens, initialStaffId, resume, closedDateRanges: salonClosedDateRanges = [], onComplete, onCancel, onProgress }: {
  salon: Salon;
  service: ServiceItem;
  staff: StaffMember[];
  tokens: CardTokens;
  /** Pre-picked staff member (e.g. entered via "Book with {name}") — skips the staff step entirely. */
  initialStaffId?: number;
  /** Selections lifted from an earlier picker this one replaces (carry-forward). Seeds staff, date
   *  and contact fields so the visitor resumes where they were. A picked time slot isn't carried —
   *  it's re-fetched — so a picker resumed from the contact step lands back on the time step. */
  resume?: PickerProgress;
  /** One-off closure + resolved holiday ranges — dates the salon can't be booked on (server
   *  enforces this too; this keeps the calendar from offering them). */
  closedDateRanges?: ClosureRange[];
  onComplete: (fields: PendingBookingFields) => void;
  onCancel: () => void;
  /** Called whenever the visitor's in-progress selections change, so the parent can record a
   *  history clue for the chat assistant. */
  onProgress?: (progress: PickerProgress) => void;
}) {
  const { theme, msgText, msgDim, bubbleBorder, accentText } = tokens;

  const eligibleStaff = service.assignedStaffIds?.length
    ? staff.filter((m) => m.status === "ACTIVE" && service.assignedStaffIds!.includes(String(m.id)))
    : staff.filter((m) => m.status === "ACTIVE");
  const needsStaffStep = initialStaffId == null && eligibleStaff.length > 1;

  // Date comes first so "book with any or a specific stylist" can be framed as "who's actually
  // free that day" instead of an abstract staff list before a date is even picked.
  const [step, setStep] = useState<PickerStep>(
    resume ? (resume.step === "contact" ? "time" : resume.step) : "date",
  );
  const [staffId, setStaffId] = useState<number | null>(
    resume?.staffChosen ? resume.staffId : initialStaffId ?? (needsStaffStep ? null : (eligibleStaff[0]?.id ?? null)),
  );

  const today = startOfDay(new Date());
  const maxDate = new Date(today.getTime() + (salon.bookingAdvanceDays ?? 60) * 86400000);
  const salonClosedDays = closedWeekdays(salon.operatingHours);

  // Once a specific stylist is known — pre-picked via "Book with {name}", or the only one who
  // can do this service — fetch their personal days off / one-off closures too, so the calendar
  // reflects who the visitor is actually booking with instead of only salon-wide hours (a Monday
  // still shows bookable even though this stylist never works Mondays otherwise).
  const [staffSchedule, setStaffSchedule] = useState<StaffSchedule | null>(null);
  useEffect(() => {
    if (staffId == null) { setStaffSchedule(null); return; }
    apiFetch<StaffSchedule>(`${API_BASE}/api/salon/${salon.id}/staff/${staffId}/schedule`)
      .then(setStaffSchedule)
      .catch(() => setStaffSchedule(null));
  }, [staffId, salon.id]);

  const closedDays = staffSchedule
    ? new Set([...salonClosedDays, ...staffSchedule.closedWeekdays])
    : salonClosedDays;
  const closedDateRanges: ClosureRange[] = staffSchedule?.closedDates.length
    ? [...salonClosedDateRanges, ...staffSchedule.closedDates.map((d) => ({ startDate: d, endDate: d }))]
    : salonClosedDateRanges;

  // Start on the first date the salon is actually open — not a closed weekday, holiday or closure.
  const [date, setDate] = useState(() => resume?.date || firstBookableDate(today, maxDate, closedDays, closedDateRanges));
  const dateIsClosed = isDateClosed(date, closedDays, closedDateRanges);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [slot, setSlot] = useState<AvailableSlot | null>(null);

  const [name, setName] = useState(resume?.name ?? "");
  const [email, setEmail] = useState(resume?.email ?? "");
  const [phone, setPhone] = useState(resume?.phone ?? "");

  // Who actually has an open slot on the chosen date — fetched fresh each time the staff step is
  // reached (i.e. every time the visitor picks a new date) so "available stylists" is real, not a
  // static roster that includes people who are fully booked that day.
  const [dateSlots, setDateSlots] = useState<AvailableSlot[]>([]);
  const [loadingDateSlots, setLoadingDateSlots] = useState(false);

  useEffect(() => {
    if (step !== "staff") return;
    if (isDateClosed(date, closedDays, closedDateRanges)) { setDateSlots([]); return; }
    setLoadingDateSlots(true);
    apiFetch<AvailableSlot[]>(`${API_BASE}/api/salon/${salon.id}/slots?${new URLSearchParams({ serviceId: String(service.id), date })}`)
      .then((res) => setDateSlots(res.filter((s) => !s.booked && !isPastSlot(date, s.startTime))))
      .catch(() => setDateSlots([]))
      .finally(() => setLoadingDateSlots(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, date]);

  const availableStaffIds = new Set(dateSlots.map((s) => s.staffId).filter((id): id is number => id != null));
  const staffAvailableToday = eligibleStaff.filter((m) => availableStaffIds.has(m.id));

  useEffect(() => {
    if (step !== "time") return;
    if (isDateClosed(date, closedDays, closedDateRanges)) { setSlots([]); return; }
    setLoadingSlots(true);
    setSlotsError(null);
    const params = new URLSearchParams({ serviceId: String(service.id), date });
    if (staffId != null) params.set("staffId", String(staffId));
    apiFetch<AvailableSlot[]>(`${API_BASE}/api/salon/${salon.id}/slots?${params}`)
      .then((res) => setSlots(res.filter((s) => !s.booked)))
      .catch(() => setSlotsError("Couldn't load availability for this date — try another one."))
      .finally(() => setLoadingSlots(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, date, staffId]);

  // Closures/holidays (and, once a stylist is known, their personal schedule) load a beat after
  // mount; if the date we defaulted to turns out closed, nudge it forward to the next open day
  // (only while still choosing a date).
  useEffect(() => {
    if (step !== "date") return;
    if (!isDateClosed(date, closedDays, closedDateRanges)) return;
    const next = firstBookableDate(today, maxDate, closedDays, closedDateRanges);
    if (next !== date) setDate(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salonClosedDateRanges, staffSchedule]);

  // Lift a summary of the in-progress selections up to the parent (kept in a ref so a new
  // callback identity each render doesn't retrigger the effect).
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  useEffect(() => {
    onProgressRef.current?.({
      step,
      staffId,
      staffChosen: !needsStaffStep || step === "time" || step === "contact",
      date,
      time: slot ? slot.startTime.slice(0, 5) : null,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
    });
  }, [step, staffId, date, slot, name, email, phone]);

  // Several staff can share a start time — dedupe to one option per time when no specific
  // stylist was chosen; the actual staffId still comes from the picked slot. Drop slots that
  // have already passed today (booked=false from /slots, but not actually bookable).
  const timeOptions = (() => {
    const map = new Map<string, AvailableSlot>();
    for (const s of slots) {
      if (isPastSlot(date, s.startTime)) continue;
      if (!map.has(s.startTime)) map.set(s.startTime, s);
    }
    return [...map.values()].sort((a, b) => a.startTime.localeCompare(b.startTime));
  })();

  const nameTrimmed = name.trim();
  const emailTrimmed = email.trim();
  const phoneTrimmed = phone.trim();
  const hasContact = emailTrimmed.length > 0 || phoneTrimmed.length > 0;

  const nameError = nameTrimmed.length > 0 && nameTrimmed.length < NAME_MIN_LEN ? "Enter your full name" : null;
  const emailError = emailTrimmed.length > 0 && !EMAIL_PATTERN.test(emailTrimmed) ? "Enter a valid email address" : null;
  const phoneError = phoneTrimmed.length > 0 && !PHONE_PATTERN.test(phoneTrimmed) ? "Enter a valid phone number" : null;

  const canSubmitContact = nameTrimmed.length >= NAME_MIN_LEN && hasContact && !emailError && !phoneError;

  function submitContact() {
    if (!slot || !canSubmitContact) return;
    onComplete({
      serviceId: service.id,
      staffId: slot.staffId ?? staffId,
      appointmentDate: date,
      startTime: slot.startTime.slice(0, 5),
      customerName: nameTrimmed,
      customerEmail: emailTrimmed || null,
      customerPhone: phoneTrimmed || null,
      notes: null,
    });
  }

  const backTarget: Record<PickerStep, PickerStep | null> = {
    date: null,
    staff: "date",
    time: needsStaffStep ? "staff" : "date",
    contact: "time",
  };

  const inputStyle = { backgroundColor: `${msgDim}0d`, border: `1px solid ${bubbleBorder}`, color: msgText };

  return (
    <CardShell title={`Book ${service.name}`} icon={Clock} tokens={tokens}>
      {backTarget[step] && (
        <button
          type="button"
          onClick={() => setStep(backTarget[step]!)}
          className="inline-flex items-center gap-1 text-[11px] font-semibold mb-2.5 cursor-pointer"
          style={{ color: msgDim }}
        >
          <ChevronLeft className="w-3 h-3" /> Back
        </button>
      )}

      {step === "date" && (
        <div className="space-y-3">
          <MiniCalendar value={date} onChange={setDate} minDate={today} maxDate={maxDate} closedDays={closedDays} closedDateRanges={closedDateRanges} tokens={tokens} />
          <button
            type="button"
            disabled={dateIsClosed}
            onClick={() => setStep(needsStaffStep ? "staff" : "time")}
            className="w-full px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: theme.accentColor, color: accentText }}
          >
            {dateIsClosed ? "Salon closed — pick another date" : needsStaffStep ? "Choose your stylist" : "See available times"}
          </button>
        </div>
      )}

      {step === "staff" && (
        <div className="space-y-1.5">
          <p className="text-xs mb-1" style={{ color: msgDim }}>
            {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} — who would you like to book with?
          </p>
          {loadingDateSlots ? (
            <div className="flex items-center gap-2 text-xs py-2" style={{ color: msgDim }}>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking who's free…
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => { setStaffId(null); setStep("time"); }}
                className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                style={{ backgroundColor: `${theme.accentColor}10`, color: theme.accentColor, border: `1px solid ${theme.accentColor}30` }}
              >
                Any available stylist
              </button>
              {staffAvailableToday.length > 0 ? (
                staffAvailableToday.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { setStaffId(m.id); setStep("time"); }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium cursor-pointer flex items-center gap-2.5"
                    style={{ color: msgText, border: `1px solid ${bubbleBorder}` }}
                  >
                    <div className="relative w-7 h-7 shrink-0">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold"
                        style={{ backgroundColor: avatarColor(m.name), color: "#fff" }}>
                        {m.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                      {m.avatarUrl && (
                        <img src={m.avatarUrl} alt={m.name}
                          className="w-7 h-7 rounded-full object-cover absolute inset-0"
                          loading="lazy"
                          onError={(e) => { e.currentTarget.style.display = "none"; }}
                        />
                      )}
                    </div>
                    <span>
                      {m.name} <span style={{ color: msgDim }}>· {STAFF_ROLE_LABEL[m.role] ?? m.role}</span>
                    </span>
                  </button>
                ))
              ) : (
                <p className="text-xs py-1" style={{ color: msgDim }}>No one has open slots this day — try another date.</p>
              )}
            </>
          )}
        </div>
      )}

      {step === "time" && (
        <div className="space-y-3">
          <p className="text-xs font-semibold" style={{ color: msgText }}>
            {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
          </p>
          {dateIsClosed && (
            <p className="text-xs" style={{ color: msgDim }}>The salon is closed on this day — go back and pick another date.</p>
          )}
          {!dateIsClosed && loadingSlots && (
            <div className="flex items-center gap-2 text-xs py-2" style={{ color: msgDim }}>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking availability…
            </div>
          )}
          {!dateIsClosed && slotsError && <p className="text-xs" style={{ color: "#EF4444" }}>{slotsError}</p>}
          {!dateIsClosed && !loadingSlots && !slotsError && timeOptions.length === 0 && (
            <p className="text-xs" style={{ color: msgDim }}>No open times this day — try another date.</p>
          )}
          {!dateIsClosed && !loadingSlots && timeOptions.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5">
              {timeOptions.map((s) => (
                <button
                  key={s.startTime}
                  type="button"
                  onClick={() => { setSlot(s); setStep("contact"); }}
                  className="px-1 py-2 rounded-lg text-[11px] font-semibold cursor-pointer tabular-nums"
                  style={{ backgroundColor: `${theme.accentColor}10`, color: theme.accentColor, border: `1px solid ${theme.accentColor}30` }}
                >
                  {fmt12(s.startTime)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === "contact" && slot && (
        <div className="space-y-2.5">
          <p className="text-xs font-semibold" style={{ color: msgText }}>
            {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {fmt12(slot.startTime)}
          </p>
          <div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name"
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
            {nameError && <p className="text-[10px] mt-1 px-0.5" style={{ color: "#EF4444" }}>{nameError}</p>}
          </div>
          <div>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" autoComplete="email" inputMode="email"
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
            {emailError && <p className="text-[10px] mt-1 px-0.5" style={{ color: "#EF4444" }}>{emailError}</p>}
          </div>
          <div>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional if email given)" type="tel" autoComplete="tel" inputMode="tel"
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
            {phoneError && <p className="text-[10px] mt-1 px-0.5" style={{ color: "#EF4444" }}>{phoneError}</p>}
            {!hasContact && !emailError && !phoneError && (
              <p className="text-[10px] mt-1 px-0.5" style={{ color: msgDim }}>Add an email or phone number so we can reach you.</p>
            )}
          </div>
          <button
            type="button"
            disabled={!canSubmitContact}
            onClick={submitContact}
            className="w-full px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: theme.accentColor, color: accentText }}
          >
            Review booking
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={onCancel}
        className="w-full mt-2 px-3 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer"
        style={{ color: msgDim }}
      >
        Cancel
      </button>
    </CardShell>
  );
}
