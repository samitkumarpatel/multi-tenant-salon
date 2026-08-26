import React, { useEffect, useState } from "react";
import { Sparkles, Users, Clock, MapPin, Phone, Mail, Globe, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import { formatPrice, CATEGORY_LABEL, STAFF_ROLE_LABEL, DAY_SHORT } from "./constants";
import { apiFetch, API_BASE } from "./api";
import type { Salon, ServiceItem, StaffMember, WebsiteTheme, OperatingHours, AvailableSlot } from "./types";

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

function CardShell({ title, icon: Icon, tokens, children }: { title: string; icon: IconType; tokens: CardTokens; children: React.ReactNode }) {
  const { theme, bubbleBorder, bubbleShadow, asBubbleBg } = tokens;
  return (
    <div
      className="mt-2.5 rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${bubbleBorder}`, boxShadow: bubbleShadow, backgroundColor: asBubbleBg, maxWidth: 420 }}
    >
      <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: `1px solid ${bubbleBorder}` }}>
        <Icon className="w-3.5 h-3.5" style={{ color: theme.accentColor }} />
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: theme.accentColor }}>{title}</p>
      </div>
      <div className="px-4 py-3">{children}</div>
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

export function StaffCard({ staff, tokens, showBookPill, onBook }: {
  staff: StaffMember[]; tokens: CardTokens; showBookPill: boolean; onBook: (member: StaffMember) => void;
}) {
  const { msgText, msgDim } = tokens;
  const active = staff.filter((m) => m.status === "ACTIVE");
  if (active.length === 0) return null;

  return (
    <CardShell title="Meet the team" icon={Users} tokens={tokens}>
      <div className="space-y-3">
        {active.map((m) => (
          <div key={m.id} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 overflow-hidden" style={{ backgroundColor: avatarColor(m.name) }}>
              {m.photoUrl ? (
                <img src={m.photoUrl} alt={m.name} className="w-full h-full object-cover" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
              ) : (
                <span className="text-xs font-black text-white">{initials(m.name)}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate" style={{ color: msgText }}>{m.name}</p>
              <p className="text-[11px]" style={{ color: msgDim }}>{STAFF_ROLE_LABEL[m.role] ?? m.role}</p>
            </div>
            {showBookPill && <BookPill label="Book" tokens={tokens} onClick={() => onBook(m)} />}
          </div>
        ))}
      </div>
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
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs font-semibold no-underline"
        style={{ color: theme.accentColor }}
      >
        Open in Maps <ChevronRight className="w-3 h-3" />
      </a>
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
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+\d][\d\s().-]{6,}$/;
const NAME_MIN_LEN = 2;

function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function MiniCalendar({ value, onChange, minDate, maxDate, closedDays, tokens }: {
  value: string;
  onChange: (iso: string) => void;
  minDate: Date;
  maxDate: Date;
  closedDays: Set<string>;
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
      <div className="grid grid-cols-7 gap-1">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i} className="text-[9px] font-bold text-center" style={{ color: msgDim }}>{d}</span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const iso = toIso(d);
          const disabled = d < minDate || d > maxDate || closedDays.has(DAY_ORDER[d.getDay()]);
          const isSel = iso === value;
          return (
            <button
              key={i} type="button" disabled={disabled}
              onClick={() => onChange(iso)}
              className="aspect-square rounded-lg text-[11px] font-medium flex items-center justify-center transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-25"
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

type PickerStep = "staff" | "date" | "time" | "contact";

export function BookingPickerCard({ salon, service, staff, tokens, initialStaffId, onComplete, onCancel }: {
  salon: Salon;
  service: ServiceItem;
  staff: StaffMember[];
  tokens: CardTokens;
  /** Pre-picked staff member (e.g. entered via "Book with {name}") — skips the staff step entirely. */
  initialStaffId?: number;
  onComplete: (fields: PendingBookingFields) => void;
  onCancel: () => void;
}) {
  const { theme, msgText, msgDim, bubbleBorder, accentText } = tokens;

  const eligibleStaff = service.assignedStaffIds?.length
    ? staff.filter((m) => m.status === "ACTIVE" && service.assignedStaffIds!.includes(String(m.id)))
    : staff.filter((m) => m.status === "ACTIVE");
  const needsStaffStep = initialStaffId == null && eligibleStaff.length > 1;

  const [step, setStep] = useState<PickerStep>(needsStaffStep ? "staff" : "date");
  const [staffId, setStaffId] = useState<number | null>(initialStaffId ?? (needsStaffStep ? null : (eligibleStaff[0]?.id ?? null)));

  const today = startOfDay(new Date());
  const maxDate = new Date(today.getTime() + (salon.bookingAdvanceDays ?? 60) * 86400000);
  const closedDays = new Set((salon.operatingHours ?? []).filter((h) => h.closed).map((h) => h.day));

  const [date, setDate] = useState(() => toIso(today));
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [slot, setSlot] = useState<AvailableSlot | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (step !== "time") return;
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

  // Several staff can share a start time — dedupe to one option per time when no specific
  // stylist was chosen; the actual staffId still comes from the picked slot.
  const timeOptions = (() => {
    const map = new Map<string, AvailableSlot>();
    for (const s of slots) if (!map.has(s.startTime)) map.set(s.startTime, s);
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
    staff: null,
    date: needsStaffStep ? "staff" : null,
    time: "date",
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

      {step === "staff" && (
        <div className="space-y-1.5">
          <p className="text-xs mb-1" style={{ color: msgDim }}>Who would you like to book with?</p>
          <button
            type="button"
            onClick={() => { setStaffId(null); setStep("date"); }}
            className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer"
            style={{ backgroundColor: `${theme.accentColor}10`, color: theme.accentColor, border: `1px solid ${theme.accentColor}30` }}
          >
            Any available stylist
          </button>
          {eligibleStaff.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => { setStaffId(m.id); setStep("date"); }}
              className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium cursor-pointer"
              style={{ color: msgText, border: `1px solid ${bubbleBorder}` }}
            >
              {m.name} <span style={{ color: msgDim }}>· {STAFF_ROLE_LABEL[m.role] ?? m.role}</span>
            </button>
          ))}
        </div>
      )}

      {step === "date" && (
        <div className="space-y-3">
          <MiniCalendar value={date} onChange={setDate} minDate={today} maxDate={maxDate} closedDays={closedDays} tokens={tokens} />
          <button
            type="button"
            onClick={() => setStep("time")}
            className="w-full px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer"
            style={{ backgroundColor: theme.accentColor, color: accentText }}
          >
            See available times
          </button>
        </div>
      )}

      {step === "time" && (
        <div className="space-y-3">
          <p className="text-xs font-semibold" style={{ color: msgText }}>
            {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
          </p>
          {loadingSlots && (
            <div className="flex items-center gap-2 text-xs py-2" style={{ color: msgDim }}>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking availability…
            </div>
          )}
          {slotsError && <p className="text-xs" style={{ color: "#EF4444" }}>{slotsError}</p>}
          {!loadingSlots && !slotsError && timeOptions.length === 0 && (
            <p className="text-xs" style={{ color: msgDim }}>No open times this day — try another date.</p>
          )}
          {!loadingSlots && timeOptions.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5">
              {timeOptions.map((s) => (
                <button
                  key={s.startTime}
                  type="button"
                  onClick={() => { setSlot(s); setStep("contact"); }}
                  className="px-2 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer"
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
              className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={inputStyle} />
            {nameError && <p className="text-[10px] mt-1 px-0.5" style={{ color: "#EF4444" }}>{nameError}</p>}
          </div>
          <div>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" autoComplete="email" inputMode="email"
              className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={inputStyle} />
            {emailError && <p className="text-[10px] mt-1 px-0.5" style={{ color: "#EF4444" }}>{emailError}</p>}
          </div>
          <div>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional if email given)" type="tel" autoComplete="tel" inputMode="tel"
              className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={inputStyle} />
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
