import type { OperatingHours } from "~/lib/types";
import { DAY_SHORT } from "~/lib/constants";

export function OpeningHours({ hours, onChange }: { hours: OperatingHours[]; onChange: (hours: OperatingHours[]) => void }) {
  const monday = hours.find((day) => day.day === "MONDAY");
  function update(index: number, patch: Partial<OperatingHours>) {
    onChange(hours.map((day, i) => i === index ? { ...day, ...patch } : day));
  }
  return (
    <fieldset id="hours" tabIndex={-1} className="min-w-0 space-y-3">
      <legend className="sr-only">Weekly opening hours</legend>
      <button type="button" disabled={!monday || monday.closed} onClick={() => {
        if (monday) onChange(hours.map((day) => day.closed ? day : { ...day, openTime: monday.openTime, closeTime: monday.closeTime }));
      }} className="min-h-11 rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-matcha-700 hover:bg-matcha-50 disabled:opacity-50">
        Copy Monday’s times to other open days
      </button>
      <p className="text-xs text-stone-500">Uncheck the days you’re closed. You can change these hours later.</p>
      {hours.map((day, index) => (
        <div key={day.day} className="flex flex-wrap items-center gap-3 rounded-xl border border-stone-200 p-3">
          <label className="flex min-h-11 w-full items-center gap-2 text-sm font-medium text-stone-700 sm:w-20">
            <input type="checkbox" checked={!day.closed} onChange={(e) => update(index, { closed: !e.target.checked })} aria-label={`${DAY_SHORT[day.day]} open`} className="h-5 w-5 accent-matcha-600" />
            {DAY_SHORT[day.day]}
          </label>
          {day.closed ? <span className="text-sm text-stone-500">Closed</span> : (
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-3">
              {([['openTime', 'Opens'], ['closeTime', 'Closes']] as const).map(([key, label]) => (
                <label key={key} className="min-w-0 text-xs text-stone-600">
                  {label}
                  <input type="time" value={day[key]} aria-label={`${DAY_SHORT[day.day]} ${label.toLowerCase()}`} onChange={(e) => update(index, { [key]: e.target.value })} className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-stone-200 bg-white px-2 text-sm text-stone-900" />
                </label>
              ))}
            </div>
          )}
        </div>
      ))}
    </fieldset>
  );
}
