import type { OperatingHours } from "@saloon/ui-website";
import { DAY_SHORT } from "@saloon/ui-website";
import { ChevronDown } from "lucide-react";

interface Props {
  hours: OperatingHours[];
  onChange: (hours: OperatingHours[]) => void;
}

// 06:00–23:30 in 30-min increments
const TIME_OPTIONS: { value: string; label: string }[] = [];
for (let h = 6; h < 24; h++) {
  for (const m of [0, 30]) {
    const hh = String(h).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    const hour12 = h === 12 ? 12 : h > 12 ? h - 12 : h;
    const ampm = h < 12 ? "AM" : "PM";
    TIME_OPTIONS.push({ value: `${hh}:${mm}`, label: `${hour12}:${mm} ${ampm}` });
  }
}

function TimeSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full pl-3 pr-8 py-2.5 border rounded-xl text-sm outline-none transition-colors appearance-none
          ${disabled
            ? "border-stone-100 bg-stone-50 text-stone-300 cursor-default"
            : "bg-white border-stone-200 text-stone-800 focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 cursor-pointer"
          }`}
      >
        {TIME_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <ChevronDown
        className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none ${
          disabled ? "text-stone-200" : "text-stone-400"
        }`}
      />
    </div>
  );
}

function Toggle({ isOpen, onChange }: { isOpen: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer select-none">
      <input
        type="checkbox"
        className="sr-only"
        checked={isOpen}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className={`w-9 h-5 rounded-full transition-colors ${isOpen ? "bg-matcha-500" : "bg-stone-200"}`} />
      <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isOpen ? "translate-x-4" : ""}`} />
    </label>
  );
}

export function HoursTable({ hours, onChange }: Props) {
  function update(idx: number, field: keyof OperatingHours, value: string | boolean) {
    onChange(hours.map((h, i) => (i === idx ? { ...h, [field]: value } : h)));
  }

  return (
    <div className="flex flex-col gap-2.5">
      {/* Desktop column headers */}
      <div className="hidden sm:grid grid-cols-[72px_1fr_1fr_120px] gap-3 px-1">
        {["Day", "Open", "Close", "Status"].map((label) => (
          <span key={label} className="text-xs font-semibold text-stone-400 uppercase tracking-wide">{label}</span>
        ))}
      </div>

      {hours.map((h, idx) => {
        const isOpen = !h.closed;
        return (
          <div
            key={h.day}
            className={`rounded-2xl border transition-all duration-200 ${
              isOpen ? "bg-white border-stone-200 shadow-sm" : "bg-stone-50 border-stone-100"
            }`}
          >
            {/* Mobile */}
            <div className="sm:hidden">
              <div className="flex items-center justify-between px-4 pt-3.5 pb-3">
                <span className={`text-sm font-bold ${isOpen ? "text-stone-800" : "text-stone-300"}`}>
                  {DAY_SHORT[h.day] ?? h.day}
                </span>
                <div className="flex items-center gap-2.5">
                  <span className={`text-xs font-semibold ${isOpen ? "text-matcha-600" : "text-stone-400"}`}>
                    {isOpen ? "Open" : "Closed"}
                  </span>
                  <Toggle isOpen={isOpen} onChange={(v) => update(idx, "closed", !v)} />
                </div>
              </div>

              {isOpen && (
                <div className="grid grid-cols-2 gap-3 px-4 pb-4">
                  <div>
                    <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1.5">Open</p>
                    <TimeSelect value={h.openTime} onChange={(v) => update(idx, "openTime", v)} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1.5">Close</p>
                    <TimeSelect value={h.closeTime} onChange={(v) => update(idx, "closeTime", v)} />
                  </div>
                </div>
              )}
            </div>

            {/* Desktop */}
            <div className="hidden sm:grid grid-cols-[72px_1fr_1fr_120px] gap-3 items-center px-4 py-3">
              <span className={`text-sm font-semibold ${isOpen ? "text-stone-700" : "text-stone-300 line-through"}`}>
                {DAY_SHORT[h.day] ?? h.day}
              </span>
              <TimeSelect value={h.openTime} onChange={(v) => update(idx, "openTime", v)} disabled={!isOpen} />
              <TimeSelect value={h.closeTime} onChange={(v) => update(idx, "closeTime", v)} disabled={!isOpen} />
              <div className="flex items-center gap-2">
                <Toggle isOpen={isOpen} onChange={(v) => update(idx, "closed", !v)} />
                <span className={`text-xs font-semibold ${isOpen ? "text-matcha-600" : "text-stone-400"}`}>
                  {isOpen ? "Open" : "Closed"}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
