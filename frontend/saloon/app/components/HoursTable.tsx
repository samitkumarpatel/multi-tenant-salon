import { DAY_SHORT } from "~/lib/constants";
import type { OperatingHours } from "~/lib/types";

interface Props {
  hours: OperatingHours[];
  onChange: (hours: OperatingHours[]) => void;
}

const timeInputCls = "w-24 px-2 py-1.5 border border-slate-200 rounded-md text-xs font-sans outline-none focus:border-matcha-500 focus:ring-1 focus:ring-matcha-500/20 text-slate-900 disabled:bg-slate-50 disabled:text-slate-300 disabled:border-slate-100 transition-[border-color]";

export default function HoursTable({ hours, onChange }: Props) {
  function update(idx: number, field: keyof OperatingHours, value: string | boolean) {
    onChange(hours.map((h, i) => i === idx ? { ...h, [field]: value } : h));
  }

  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr>
          {["Day", "Open", "Close", "Closed"].map((h) => (
            <th key={h} className="text-left text-[0.6rem] font-bold uppercase tracking-widest text-slate-400 pb-2">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {hours.map((h, idx) => (
          <tr key={h.day}>
            <td className="py-1 pr-3 font-semibold text-xs text-slate-700 w-10">{DAY_SHORT[h.day] ?? h.day}</td>
            <td className="py-1 pr-2">
              <input
                className={timeInputCls}
                type="time"
                value={h.openTime}
                disabled={h.closed}
                onChange={(e) => update(idx, "openTime", e.target.value)}
              />
            </td>
            <td className="py-1 pr-2">
              <input
                className={timeInputCls}
                type="time"
                value={h.closeTime}
                disabled={h.closed}
                onChange={(e) => update(idx, "closeTime", e.target.value)}
              />
            </td>
            <td className="py-1">
              <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-3.5 h-3.5 accent-matcha-600 cursor-pointer"
                  checked={h.closed}
                  onChange={(e) => update(idx, "closed", e.target.checked)}
                />
                Closed
              </label>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
