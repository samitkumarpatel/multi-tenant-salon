import type { OperatingHours } from "~/lib/types";
import { DAY_SHORT } from "~/lib/constants";

interface Props {
  hours: OperatingHours[];
  onChange: (hours: OperatingHours[]) => void;
}

const timeInputCls = "w-full px-3 py-2 border border-stone-200 rounded-xl text-sm outline-none focus:border-stone-400 text-stone-900 disabled:bg-stone-50 disabled:text-stone-300 disabled:border-stone-100 transition-colors";

export default function HoursTable({ hours, onChange }: Props) {
  function update(idx: number, field: keyof OperatingHours, value: string | boolean) {
    onChange(hours.map((h, i) => (i === idx ? { ...h, [field]: value } : h)));
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Header — desktop only */}
      <div className="hidden sm:grid grid-cols-[72px_1fr_1fr_auto] gap-3 px-1">
        {["Day", "Open", "Close", "Closed?"].map((h) => (
          <span key={h} className="text-xs font-semibold text-stone-400 uppercase tracking-wide">{h}</span>
        ))}
      </div>

      {hours.map((h, idx) => (
        <div
          key={h.day}
          className={`grid grid-cols-2 sm:grid-cols-[72px_1fr_1fr_auto] gap-2 sm:gap-3 items-center p-3 rounded-xl border transition-colors ${
            h.closed ? "bg-stone-50 border-stone-100" : "bg-white border-stone-200"
          }`}
        >
          {/* Day label */}
          <span className={`text-sm font-semibold ${h.closed ? "text-stone-300 line-through" : "text-stone-700"}`}>
            {DAY_SHORT[h.day] ?? h.day}
          </span>

          {/* Closed toggle — mobile top-right */}
          <label className="flex items-center justify-end gap-2 sm:hidden cursor-pointer select-none">
            <span className="text-xs text-stone-500">Closed</span>
            <input
              type="checkbox"
              className="w-4 h-4 cursor-pointer"
              checked={h.closed}
              onChange={(e) => update(idx, "closed", e.target.checked)}
            />
          </label>

          {/* Open time */}
          <input
            type="time"
            className={timeInputCls}
            value={h.openTime}
            disabled={h.closed}
            onChange={(e) => update(idx, "openTime", e.target.value)}
          />

          {/* Close time */}
          <input
            type="time"
            className={timeInputCls}
            value={h.closeTime}
            disabled={h.closed}
            onChange={(e) => update(idx, "closeTime", e.target.value)}
          />

          {/* Closed toggle — desktop */}
          <label className="hidden sm:flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4 h-4 cursor-pointer"
              checked={h.closed}
              onChange={(e) => update(idx, "closed", e.target.checked)}
            />
            <span className="text-xs text-stone-500">Closed</span>
          </label>
        </div>
      ))}
    </div>
  );
}
