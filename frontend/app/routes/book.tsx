/**
 * Customer-facing booking wizard.
 * Route: /:saloonId/book  (no auth required)
 *
 * Steps:
 *  1 – Pick a service
 *  2 – Pick a date (+ optional beautician)
 *  3 – Pick an available time slot
 *  4 – Enter contact details
 *  5 – Confirmation
 */

import { useState, useEffect } from "react";
import { Link, useLoaderData } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import {
  Scissors, ArrowLeft, ArrowRight, CalendarCheck,
  Users, Clock, Check,
} from "lucide-react";
import { API, HANDLER_API, apiFetch } from "~/lib/api";
import { CATEGORY_LABEL, STAFF_ROLE_LABEL, formatPrice } from "~/lib/constants";
import type { Saloon, ServiceItem, StaffMember, AvailableSlot, Booking } from "~/lib/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const { saloonId } = params;
  const saloonUrl = UUID_RE.test(saloonId!) ? `${API}/${saloonId}` : `${HANDLER_API}/${saloonId}`;
  const [saloon, services, staff] = await Promise.all([
    apiFetch<Saloon>(saloonUrl),
    apiFetch<ServiceItem[]>(`${API}/${saloonId}/services`),
    apiFetch<StaffMember[]>(`${API}/${saloonId}/staff`),
  ]);
  return { saloon, services: services.filter((s) => s.active), staff };
}

// ── shared styles ─────────────────────────────────────────────────────────────

const inputCls =
  "w-full px-3 py-2 border border-stone-200 rounded-lg text-sm outline-none transition focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 bg-white text-stone-900";

// ── Step indicator ────────────────────────────────────────────────────────────

function StepBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1 justify-center mb-8">
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
        <div key={n} className="flex items-center gap-1">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
            n < current ? "bg-matcha-600 text-white" :
            n === current ? "bg-matcha-100 text-matcha-700 ring-2 ring-matcha-600" :
            "bg-stone-100 text-stone-400"
          }`}>
            {n < current ? <Check className="w-3.5 h-3.5" /> : n}
          </div>
          {n < total && <div className={`h-0.5 w-6 ${n < current ? "bg-matcha-500" : "bg-stone-200"}`} />}
        </div>
      ))}
    </div>
  );
}

// ── Step 1: Service selection ─────────────────────────────────────────────────

function StepService({
  services, selected, onSelect, onNext,
}: {
  services: ServiceItem[];
  selected: ServiceItem | null;
  onSelect: (s: ServiceItem) => void;
  onNext: () => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-bold text-stone-900 mb-1">Choose a service</h2>
      <p className="text-sm text-stone-500 mb-5">Select the service you'd like to book.</p>

      {services.length === 0 ? (
        <p className="text-sm text-stone-400 text-center py-10">No services available yet.</p>
      ) : (
        <div className="space-y-2 mb-6 max-h-[420px] overflow-y-auto pr-1">
          {services.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelect(s)}
              className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${
                selected?.id === s.id
                  ? "border-matcha-500 bg-matcha-50 ring-2 ring-matcha-500/20"
                  : "border-stone-200 bg-white hover:border-stone-300"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-stone-900 text-sm">{s.name}</p>
                  {s.description && <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{s.description}</p>}
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-stone-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {s.durationMinutes} min
                    </span>
                    <span className="text-[0.65rem] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-stone-100 text-stone-500">
                      {CATEGORY_LABEL[s.category] ?? s.category}
                    </span>
                  </div>
                </div>
                <p className="font-bold text-matcha-700 text-sm shrink-0">
                  {formatPrice(s.price, s.currency)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      <button
        onClick={onNext}
        disabled={!selected}
        className="w-full py-2.5 rounded-xl bg-matcha-600 text-white text-sm font-semibold hover:bg-matcha-700 transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        Next <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Step 2: Date + staff selection ────────────────────────────────────────────

function StepDate({
  staff, date, setDate, staffId, setStaffId, onBack, onNext,
}: {
  staff: StaffMember[];
  date: string;
  setDate: (d: string) => void;
  staffId: number | null;
  setStaffId: (id: number | null) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const today = new Date().toISOString().split("T")[0];

  return (
    <div>
      <h2 className="text-lg font-bold text-stone-900 mb-1">Pick a date</h2>
      <p className="text-sm text-stone-500 mb-5">Choose when you'd like your appointment.</p>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">Date <span className="text-red-500">*</span></label>
          <input
            type="date"
            min={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputCls}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">
            Preferred beautician <span className="text-stone-400 font-normal">(optional)</span>
          </label>
          <div className="space-y-2">
            <button
              onClick={() => setStaffId(null)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                staffId === null
                  ? "border-matcha-500 bg-matcha-50 ring-2 ring-matcha-500/20"
                  : "border-stone-200 bg-white hover:border-stone-300"
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-stone-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-stone-800">Any available beautician</p>
                <p className="text-xs text-stone-400">We'll assign the first available staff member</p>
              </div>
              {staffId === null && <Check className="w-4 h-4 text-matcha-600 ml-auto shrink-0" />}
            </button>

            {staff.filter((s) => s.status === "ACTIVE").map((s) => (
              <button
                key={s.id}
                onClick={() => setStaffId(s.id)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                  staffId === s.id
                    ? "border-matcha-500 bg-matcha-50 ring-2 ring-matcha-500/20"
                    : "border-stone-200 bg-white hover:border-stone-300"
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-matcha-100 flex items-center justify-center text-xs font-bold text-matcha-700 shrink-0">
                  {s.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-800">{s.name}</p>
                  <p className="text-xs text-stone-400">{STAFF_ROLE_LABEL[s.role] ?? s.role}</p>
                </div>
                {staffId === s.id && <Check className="w-4 h-4 text-matcha-600 ml-auto shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button onClick={onNext} disabled={!date}
          className="flex-1 py-2.5 rounded-xl bg-matcha-600 text-white text-sm font-semibold hover:bg-matcha-700 transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2">
          Check availability <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Slot selection ────────────────────────────────────────────────────

function StepSlots({
  saloonId, serviceId, date, staffId, staffMap, selectedSlot, onSelect, onBack, onNext,
}: {
  saloonId: string;
  serviceId: number;
  date: string;
  staffId: number | null;
  staffMap: Map<number, StaffMember>;
  selectedSlot: AvailableSlot | null;
  onSelect: (s: AvailableSlot) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [slots, setSlots] = useState<AvailableSlot[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setSlots(null);
    const params = new URLSearchParams({ serviceId: String(serviceId), date });
    if (staffId) params.set("staffId", String(staffId));
    apiFetch<AvailableSlot[]>(`${API}/${saloonId}/slots?${params}`)
      .then(setSlots)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load slots"))
      .finally(() => setLoading(false));
  }, [saloonId, serviceId, date, staffId]);

  function fmt12(t: string) {
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
  }

  return (
    <div>
      <h2 className="text-lg font-bold text-stone-900 mb-1">Choose a time</h2>
      <p className="text-sm text-stone-500 mb-5">
        Available slots for <strong>{date}</strong>
        {staffId && staffMap.get(staffId) ? ` with ${staffMap.get(staffId)!.name}` : ""}
      </p>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-matcha-200 border-t-matcha-600 rounded-full animate-spin" />
        </div>
      )}

      {error && <p className="text-sm text-red-500 text-center py-8">{error}</p>}

      {!loading && !error && slots !== null && (
        slots.length === 0 ? (
          <div className="text-center py-10">
            <CalendarCheck className="w-10 h-10 mx-auto mb-3 text-stone-300" />
            <p className="text-sm text-stone-500">No available slots for this date and service.</p>
            <p className="text-xs text-stone-400 mt-1">Try a different date or staff member.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6 max-h-[360px] overflow-y-auto pr-1">
            {slots.map((s, i) => {
              const member = staffMap.get(s.staffId);
              const isSelected = selectedSlot?.startTime === s.startTime && selectedSlot?.staffId === s.staffId;
              return (
                <button
                  key={i}
                  onClick={() => onSelect(s)}
                  className={`flex flex-col items-center p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? "border-matcha-500 bg-matcha-50 ring-2 ring-matcha-500/20"
                      : "border-stone-200 bg-white hover:border-stone-300"
                  }`}
                >
                  <span className="text-sm font-bold text-stone-900">{fmt12(s.startTime)}</span>
                  <span className="text-xs text-stone-400 mt-0.5">{fmt12(s.endTime)}</span>
                  {!staffId && member && (
                    <span className="text-[0.6rem] font-semibold text-matcha-700 mt-1 bg-matcha-50 px-1.5 py-0.5 rounded-full border border-matcha-200">
                      {member.name.split(" ")[0]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )
      )}

      <div className="flex gap-3 mt-4">
        <button onClick={onBack}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button onClick={onNext} disabled={!selectedSlot}
          className="flex-1 py-2.5 rounded-xl bg-matcha-600 text-white text-sm font-semibold hover:bg-matcha-700 transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2">
          Continue <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Step 4: Customer details ──────────────────────────────────────────────────

function StepDetails({
  form, setForm, onBack, onSubmit, busy,
}: {
  form: { name: string; email: string; phone: string; notes: string };
  setForm: (f: typeof form) => void;
  onBack: () => void;
  onSubmit: () => void;
  busy: boolean;
}) {
  const valid = form.name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());

  return (
    <div>
      <h2 className="text-lg font-bold text-stone-900 mb-1">Your details</h2>
      <p className="text-sm text-stone-500 mb-5">We'll use this to confirm your appointment.</p>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">Full name <span className="text-red-500">*</span></label>
          <input className={inputCls} placeholder="Jane Smith" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">Email address <span className="text-red-500">*</span></label>
          <input type="email" className={inputCls} placeholder="jane@example.com" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">Phone <span className="text-stone-400 font-normal">(optional)</span></label>
          <input type="tel" className={inputCls} placeholder="+1 555 000 0000" value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">Notes <span className="text-stone-400 font-normal">(optional)</span></label>
          <textarea className={`${inputCls} resize-none`} rows={2} placeholder="Anything we should know?" value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button onClick={onSubmit} disabled={!valid || busy}
          className="flex-1 py-2.5 rounded-xl bg-matcha-600 text-white text-sm font-semibold hover:bg-matcha-700 transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2">
          {busy ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Booking…</>
          ) : (
            <>Confirm booking <Check className="w-4 h-4" /></>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Step 5: Confirmation ──────────────────────────────────────────────────────

function StepConfirm({
  booking, service, staff, saloon,
}: {
  booking: Booking;
  service: ServiceItem;
  staff: StaffMember | undefined;
  saloon: Saloon;
}) {
  function fmt12(t: string) {
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
  }

  return (
    <div className="text-center">
      <div className="w-16 h-16 rounded-full bg-matcha-100 flex items-center justify-center mx-auto mb-5">
        <Check className="w-8 h-8 text-matcha-700" />
      </div>
      <h2 className="text-xl font-bold text-stone-900 mb-1">You're booked!</h2>
      <p className="text-sm text-stone-500 mb-6">
        A confirmation has been sent to <strong>{booking.customerEmail}</strong>.
      </p>

      <div className="bg-stone-50 rounded-xl border border-stone-200 p-4 text-left space-y-2.5 mb-8">
        <Row label="Saloon" value={saloon.name} />
        <Row label="Service" value={`${service.name} (${service.durationMinutes} min)`} />
        <Row label="Date" value={booking.appointmentDate} />
        <Row label="Time" value={`${fmt12(booking.startTime)} – ${fmt12(booking.endTime)}`} />
        {staff && <Row label="Beautician" value={staff.name} />}
        <Row label="Booking #" value={String(booking.id)} />
        <Row label="Status" value="Pending confirmation" />
      </div>

      <Link
        to="/customer"
        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors no-underline"
      >
        ← Back to saloons
      </Link>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-semibold text-stone-400 w-24 shrink-0">{label}</span>
      <span className="text-sm text-stone-800 font-medium">{value}</span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BookWizard() {
  const { saloon, services, staff } = useLoaderData<typeof clientLoader>();
  const [step, setStep] = useState(1);
  const [service, setService] = useState<ServiceItem | null>(null);
  const [date, setDate] = useState("");
  const [staffId, setStaffId] = useState<number | null>(null);
  const [slot, setSlot] = useState<AvailableSlot | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);

  const staffMap = new Map(staff.map((s) => [s.id, s]));

  async function submitBooking() {
    if (!service || !slot) return;
    setBusy(true);
    setError(null);
    try {
      const booking = await apiFetch<Booking>(`${API}/${saloon.id}/bookings`, {
        method: "POST",
        body: JSON.stringify({
          serviceId: service.id,
          staffId: slot.staffId,
          customerName: form.name,
          customerEmail: form.email,
          customerPhone: form.phone || null,
          appointmentDate: date,
          startTime: slot.startTime,
          notes: form.notes || null,
        }),
      });
      setConfirmed(booking);
      setStep(5);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-cream flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-30">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/customer" className="text-stone-400 hover:text-stone-700 no-underline shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <Scissors className="w-4 h-4 text-matcha-600 shrink-0" />
            <span className="text-sm font-semibold text-stone-700 truncate">{saloon.name}</span>
          </div>
          <span className="ml-auto text-xs text-stone-400 shrink-0">Book appointment</span>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          {step < 5 && <StepBar current={step} total={4} />}

          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-sm text-red-700">
              {error}
            </div>
          )}

          {step === 1 && (
            <StepService
              services={services}
              selected={service}
              onSelect={(s) => { setService(s); setSlot(null); }}
              onNext={() => setStep(2)}
            />
          )}

          {step === 2 && (
            <StepDate
              staff={staff}
              date={date}
              setDate={(d) => { setDate(d); setSlot(null); }}
              staffId={staffId}
              setStaffId={(id) => { setStaffId(id); setSlot(null); }}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}

          {step === 3 && service && (
            <StepSlots
              saloonId={String(saloon.id)}
              serviceId={service.id}
              date={date}
              staffId={staffId}
              staffMap={staffMap}
              selectedSlot={slot}
              onSelect={setSlot}
              onBack={() => setStep(2)}
              onNext={() => setStep(4)}
            />
          )}

          {step === 4 && (
            <StepDetails
              form={form}
              setForm={setForm}
              onBack={() => setStep(3)}
              onSubmit={submitBooking}
              busy={busy}
            />
          )}

          {step === 5 && confirmed && service && (
            <StepConfirm
              booking={confirmed}
              service={service}
              staff={staffMap.get(confirmed.staffId)}
              saloon={saloon}
            />
          )}
        </div>
      </main>
    </div>
  );
}
