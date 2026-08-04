import type { OperatingHours } from "@saloon/ui-website";
import { DAY_SHORT } from "@saloon/ui-website";

interface Props {
  hours: OperatingHours[];
  onChange: (hours: OperatingHours[]) => void;
}

const timeInputCls = "w-full px-3 py-2 border border-stone-200 rounded-xl text-sm outline-none focus:border-stone-400 text-stone-900 disabled:bg-stone-50 disabled:text-stone-300 disabled:border-stone-100 transition-colors";

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer select-none">
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className={`w-9 h-5 rounded-full transition-colors ${checked ? "bg-stone-400" : "bg-stone-200"}`} />
      <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : ""}`} />
    </label>
  );
}

export function HoursTable({ hours, onChange }: Props) {
  function update(idx: number, field: keyof OperatingHours, value: string | boolean) {
    onChange(hours.map((h, i) => (i === idx ? { ...h, [field]: value } : h)));
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Desktop column headers */}
      <div className="hidden sm:grid grid-cols-[72px_1fr_1fr_auto] gap-3 px-1">
        {["Day", "Open", "Close", "Closed?"].map((h) => (
          <span key={h} className="text-xs font-semibold text-stone-400 uppercase tracking-wide">{h}</span>
        ))}
      </div>

      {hours.map((h, idx) => (
        <div
          key={h.day}
          className={`rounded-xl border transition-colors ${
            h.closed ? "bg-stone-50 border-stone-100" : "bg-white border-stone-200"
          }`}
        >
          {/* Mobile layout */}
          <div className="sm:hidden p-3">
            <div className="flex items-center justify-between">
              <span className={`text-sm font-semibold ${h.closed ? "text-stone-300 line-through" : "text-stone-700"}`}>
                {DAY_SHORT[h.day] ?? h.day}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-500">Closed</span>
                <Toggle checked={h.closed} onChange={(v) => update(idx, "closed", v)} />
              </div>
            </div>

            {!h.closed && (
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div>
                  <p className="text-xs text-stone-400 mb-1 font-medium">Open</p>
                  <input
                    type="time"
                    className={timeInputCls}
                    value={h.openTime}
                    onChange={(e) => update(idx, "openTime", e.target.value)}
                  />
                </div>
                <div>
                  <p className="text-xs text-stone-400 mb-1 font-medium">Close</p>
                  <input
                    type="time"
                    className={timeInputCls}
                    value={h.closeTime}
                    onChange={(e) => update(idx, "closeTime", e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Desktop layout */}
          <div className="hidden sm:grid grid-cols-[72px_1fr_1fr_auto] gap-3 items-center p-3">
            <span className={`text-sm font-semibold ${h.closed ? "text-stone-300 line-through" : "text-stone-700"}`}>
              {DAY_SHORT[h.day] ?? h.day}
            </span>
            <input
              type="time"
              className={timeInputCls}
              value={h.openTime}
              disabled={h.closed}
              onChange={(e) => update(idx, "openTime", e.target.value)}
            />
            <input
              type="time"
              className={timeInputCls}
              value={h.closeTime}
              disabled={h.closed}
              onChange={(e) => update(idx, "closeTime", e.target.value)}
            />
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4 cursor-pointer"
                checked={h.closed}
                onChange={(e) => update(idx, "closed", e.target.checked)}
              />
              <span className="text-xs text-stone-500">Closed</span>
            </label>
          </div>
        </div>
      ))}
    </div>
  );
}
