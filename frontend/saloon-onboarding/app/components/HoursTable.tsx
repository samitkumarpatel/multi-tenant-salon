import type { OperatingHours } from "~/lib/types";
import { DAY_SHORT } from "~/lib/constants";

interface Props {
  hours: OperatingHours[];
  onChange: (hours: OperatingHours[]) => void;
}

const timeInputCls = "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-sans outline-none focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 text-slate-900 disabled:bg-slate-50 disabled:text-slate-300 disabled:border-slate-100 transition-[border-color]";

export default function HoursTable({ hours, onChange }: Props) {
  function update(idx: number, field: keyof OperatingHours, value: string | boolean) {
    onChange(hours.map((h, i) => i === idx ? { ...h, [field]: value } : h));
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Header */}
      <div className="hidden sm:grid grid-cols-[64px_1fr_1fr_auto] gap-3 px-1">
        {["Day", "Open", "Close", "Closed?"].map((h) => (
          <span key={h} className="text-[0.6rem] font-bold uppercase tracking-widest text-slate-400">{h}</span>
        ))}
      </div>

      {hours.map((h, idx) => (
        <div
          key={h.day}
          className={`grid grid-cols-2 sm:grid-cols-[64px_1fr_1fr_auto] gap-2 sm:gap-3 items-center p-3 rounded-xl border transition-colors ${
            h.closed ? "bg-slate-50 border-slate-100" : "bg-white border-slate-200"
          }`}
        >
          {/* Day label */}
          <span className={`text-sm font-bold col-span-1 sm:col-span-1 ${h.closed ? "text-slate-400 line-through" : "text-slate-700"}`}>
            {DAY_SHORT[h.day] ?? h.day}
          </span>

          {/* Closed toggle — shown on mobile in top-right */}
          <label className="flex items-center justify-end gap-2 sm:hidden cursor-pointer select-none">
            <span className="text-xs text-slate-500">Closed</span>
            <input
              type="checkbox"
              className="w-4 h-4 accent-matcha-600 cursor-pointer"
              checked={h.closed}
              onChange={(e) => update(idx, "closed", e.target.checked)}
            />
          </label>

          {/* Open time */}
          <input
            className={timeInputCls}
            type="time"
            value={h.openTime}
            disabled={h.closed}
            onChange={(e) => update(idx, "openTime", e.target.value)}
          />

          {/* Close time */}
          <input
            className={timeInputCls}
            type="time"
            value={h.closeTime}
            disabled={h.closed}
            onChange={(e) => update(idx, "closeTime", e.target.value)}
          />

          {/* Closed toggle — desktop */}
          <label className="hidden sm:flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4 h-4 accent-matcha-600 cursor-pointer"
              checked={h.closed}
              onChange={(e) => update(idx, "closed", e.target.checked)}
            />
            <span className="text-xs text-slate-500">Closed</span>
          </label>
        </div>
      ))}
    </div>
  );
}
