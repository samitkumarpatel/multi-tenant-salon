import React, { useEffect, useState } from "react";
import { CalendarDays, Clock, ListChecks, Loader2, MousePointerClick } from "lucide-react";
import { CardShell, MiniCalendar, fmt12, EMAIL_PATTERN, PHONE_PATTERN, type CardTokens } from "./GenerativeUICards";
import { apiFetch, API_BASE } from "./api";
import { type ClosureRange, isDateClosed, firstBookableDate, closedWeekdays } from "./bookingDates";
import type { AvailableSlot, Salon } from "./types";

// The interactive Gen-UI components the assistant can drop into a turn beyond the six data
// cards + booking picker. Each takes the model-authored `props` (UI scaffolding only — labels,
// field specs, ids; never salon data), renders against the salon's live data where relevant,
// and reports the visitor's choice back through `onAnswer` as the text of their next message —
// exactly as if they had typed it — so the round-trip and the assistant's memory stay uniform.

export type GenUIInteractiveProps = {
  props: Record<string, unknown>;
  tokens: CardTokens;
  salon: Salon;
  closedDateRanges: ClosureRange[];
  onAnswer: (value: string) => void;
};

function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function longDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}
function asNum(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

// ── date-picker ─────────────────────────────────────────────────────────────
// Lightweight "which day works" calendar — no service/staff commitment. Picking a day sends a
// natural follow-up so the assistant can respond (usually by calling showTimeSlots).

export function DatePickerCard({ props, tokens, salon, closedDateRanges, onAnswer }: GenUIInteractiveProps) {
  const { theme, accentText, msgDim } = tokens;
  const today = startOfDay(new Date());
  const maxDate = new Date(today.getTime() + (salon.bookingAdvanceDays ?? 60) * 86400000);
  const closedDays = closedWeekdays(salon.operatingHours);
  const [date, setDate] = useState(() => firstBookableDate(today, maxDate, closedDays, closedDateRanges));
  const dateClosed = isDateClosed(date, closedDays, closedDateRanges);

  return (
    <CardShell title="Pick a day" icon={CalendarDays} tokens={tokens}>
      <div className="space-y-3">
        <MiniCalendar
          value={date} onChange={setDate} minDate={today} maxDate={maxDate}
          closedDays={closedDays} closedDateRanges={closedDateRanges} tokens={tokens}
        />
        <button
          type="button"
          disabled={dateClosed}
          onClick={() => onAnswer(`What times are available on ${longDate(date)}?`)}
          className="w-full px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: theme.accentColor, color: accentText }}
        >
          {dateClosed ? "Salon closed — pick another day" : "Check this day"}
        </button>
        <p className="text-[10px] text-center" style={{ color: msgDim }}>Days the salon is closed are greyed out.</p>
      </div>
    </CardShell>
  );
}

// ── time-slot-picker ────────────────────────────────────────────────────────
// Real bookable slots for a service on a date (same /slots endpoint the wizard uses). Tapping a
// time sends it back as the visitor's message so the assistant can start/continue a booking.

export function TimeSlotPickerCard({ props, tokens, salon, onAnswer }: GenUIInteractiveProps) {
  const { theme, msgText, msgDim } = tokens;
  const serviceId = asNum(props.serviceId);
  const staffId = asNum(props.staffId);
  const date = typeof props.date === "string" ? props.date : undefined;

  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (serviceId == null || !date) {
      setError("I couldn't work out which service or date to check.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ serviceId: String(serviceId), date });
    if (staffId != null) params.set("staffId", String(staffId));
    apiFetch<AvailableSlot[]>(`${API_BASE}/api/salon/${salon.id}/slots?${params}`)
      .then((res) => setSlots(res.filter((s) => !s.booked)))
      .catch(() => setError("Couldn't load availability for this date — try another one."))
      .finally(() => setLoading(false));
  }, [salon.id, serviceId, staffId, date]);

  const times = (() => {
    const map = new Map<string, AvailableSlot>();
    for (const s of slots) if (!map.has(s.startTime)) map.set(s.startTime, s);
    return [...map.values()].sort((a, b) => a.startTime.localeCompare(b.startTime));
  })();

  return (
    <CardShell title="Available times" icon={Clock} tokens={tokens}>
      {date && <p className="text-xs font-semibold mb-2.5" style={{ color: msgText }}>{longDate(date)}</p>}
      {loading && (
        <div className="flex items-center gap-2 text-xs py-2" style={{ color: msgDim }}>
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking availability…
        </div>
      )}
      {!loading && error && <p className="text-xs" style={{ color: "#EF4444" }}>{error}</p>}
      {!loading && !error && times.length === 0 && (
        <p className="text-xs" style={{ color: msgDim }}>No open times that day — try another date.</p>
      )}
      {!loading && !error && times.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {times.map((s) => (
            <button
              key={s.startTime}
              type="button"
              onClick={() => onAnswer(`I'd like ${fmt12(s.startTime)}${date ? ` on ${longDate(date)}` : ""}`)}
              className="px-1 py-2 rounded-lg text-[11px] font-semibold cursor-pointer tabular-nums"
              style={{ backgroundColor: `${theme.accentColor}10`, color: theme.accentColor, border: `1px solid ${theme.accentColor}30` }}
            >
              {fmt12(s.startTime)}
            </button>
          ))}
        </div>
      )}
    </CardShell>
  );
}

// ── form ────────────────────────────────────────────────────────────────────

type FieldSpec = { name: string; label: string; type?: string; required?: boolean; pattern?: string };

export function FormCard({ props, tokens, onAnswer }: GenUIInteractiveProps) {
  const { theme, msgText, msgDim, bubbleBorder, accentText } = tokens;
  const title = typeof props.title === "string" ? props.title : "A few details";
  const submitLabel = typeof props.submitLabel === "string" && props.submitLabel.trim() ? props.submitLabel : "Send";
  const fields: FieldSpec[] = Array.isArray(props.fields)
    ? (props.fields as FieldSpec[]).filter((f) => f && typeof f.name === "string" && typeof f.label === "string")
    : [];

  const [values, setValues] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  function errorFor(f: FieldSpec): string | null {
    const v = (values[f.name] ?? "").trim();
    if (f.required && !v) return "Required";
    if (!v) return null;
    if (f.type === "email" && !EMAIL_PATTERN.test(v)) return "Enter a valid email";
    if (f.type === "tel" && !PHONE_PATTERN.test(v)) return "Enter a valid phone number";
    if (f.pattern) {
      try { if (!new RegExp(f.pattern).test(v)) return "Invalid format"; } catch { /* ignore bad pattern */ }
    }
    return null;
  }

  const canSubmit = fields.length > 0 && fields.every((f) => !errorFor(f)) &&
    fields.some((f) => (values[f.name] ?? "").trim());

  function submit() {
    if (!canSubmit || submitted) return;
    setSubmitted(true);
    const summary = fields
      .map((f) => [f.label, (values[f.name] ?? "").trim()])
      .filter(([, v]) => v)
      .map(([label, v]) => `${label}: ${v}`)
      .join("; ");
    onAnswer(summary);
  }

  const inputStyle = { backgroundColor: `${msgDim}0d`, border: `1px solid ${bubbleBorder}`, color: msgText };

  return (
    <CardShell title={title} icon={ListChecks} tokens={tokens}>
      <div className="space-y-2.5">
        {fields.map((f) => {
          const err = submitted || (values[f.name] ?? "") ? errorFor(f) : null;
          return (
            <div key={f.name}>
              {f.type === "textarea" ? (
                <textarea
                  value={values[f.name] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  placeholder={f.label}
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
                  style={inputStyle}
                />
              ) : (
                <input
                  value={values[f.name] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  placeholder={f.label}
                  type={f.type === "email" ? "email" : f.type === "tel" ? "tel" : "text"}
                  inputMode={f.type === "email" ? "email" : f.type === "tel" ? "tel" : undefined}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={inputStyle}
                />
              )}
              {err && <p className="text-[10px] mt-1 px-0.5" style={{ color: "#EF4444" }}>{err}</p>}
            </div>
          );
        })}
        <button
          type="button"
          disabled={!canSubmit || submitted}
          onClick={submit}
          className="w-full px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: theme.accentColor, color: accentText }}
        >
          {submitLabel}
        </button>
      </div>
    </CardShell>
  );
}

// ── button-group / radio-group / checkbox-group / option-list ────────────────

type Choice = { label: string; value: string };

export function ChoiceCard({
  props, tokens, onAnswer, variant,
}: GenUIInteractiveProps & { variant: "button-group" | "radio-group" | "checkbox-group" | "option-list" }) {
  const { theme, msgText, msgDim, bubbleBorder, accentText } = tokens;
  const prompt = typeof props.prompt === "string" ? props.prompt : undefined;
  const choices: Choice[] = Array.isArray(props.choices)
    ? (props.choices as Choice[]).filter((c) => c && typeof c.label === "string" && typeof c.value === "string")
    : [];
  const [picked, setPicked] = useState<string[]>([]);
  const [sent, setSent] = useState(false);
  if (choices.length === 0) return null;

  const multi = variant === "checkbox-group";
  const title = variant === "checkbox-group" ? "Choose any" : variant === "option-list" ? "Choose one" : "Your choice";

  function send(values: string[]) {
    if (sent || values.length === 0) return;
    setSent(true);
    onAnswer(values.join(", "));
  }

  return (
    <CardShell title={title} icon={variant === "button-group" ? MousePointerClick : ListChecks} tokens={tokens}>
      {prompt && <p className="text-xs mb-2.5" style={{ color: msgText }}>{prompt}</p>}

      {variant === "button-group" ? (
        <div className="flex flex-wrap gap-2">
          {choices.map((c) => (
            <button
              key={c.value}
              type="button"
              disabled={sent}
              onClick={() => send([c.value])}
              className="px-3.5 py-2 rounded-full text-xs font-semibold cursor-pointer transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: `${theme.accentColor}10`, color: theme.accentColor, border: `1px solid ${theme.accentColor}30` }}
            >
              {c.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {choices.map((c) => {
            const on = picked.includes(c.value);
            return (
              <button
                key={c.value}
                type="button"
                disabled={sent}
                onClick={() => {
                  if (multi) setPicked((p) => (on ? p.filter((v) => v !== c.value) : [...p, c.value]));
                  else if (variant === "option-list") send([c.value]);
                  else setPicked([c.value]);
                }}
                className="w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-xl text-xs font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={on
                  ? { backgroundColor: `${theme.accentColor}10`, color: theme.accentColor, border: `1px solid ${theme.accentColor}30` }
                  : { color: msgText, border: `1px solid ${bubbleBorder}` }}
              >
                {multi && (
                  <span
                    className="w-3.5 h-3.5 rounded shrink-0 flex items-center justify-center text-[9px] font-black"
                    style={{ border: `1.5px solid ${on ? theme.accentColor : msgDim}`, color: theme.accentColor }}
                  >
                    {on ? "✓" : ""}
                  </span>
                )}
                {!multi && variant === "radio-group" && (
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0"
                    style={{ border: `1.5px solid ${on ? theme.accentColor : msgDim}`, backgroundColor: on ? theme.accentColor : "transparent" }}
                  />
                )}
                {c.label}
              </button>
            );
          })}
          {(multi || variant === "radio-group") && (
            <button
              type="button"
              disabled={sent || picked.length === 0}
              onClick={() => send(picked)}
              className="w-full mt-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: theme.accentColor, color: accentText }}
            >
              Continue
            </button>
          )}
        </div>
      )}
    </CardShell>
  );
}
