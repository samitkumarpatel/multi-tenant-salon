import { useEffect, useState } from "react";
import { CalendarDays, Plus, Trash2, X, AlertCircle } from "lucide-react";
import { STAFF_PORTAL_API, apiFetch } from "~/lib/api";
import { getStaffSession } from "~/routes/login";
import { InfoBar, Toast, useToast } from "@salon/ui-shared";
import type { StaffHoliday } from "~/lib/types";

const inputCls =
  "w-full px-3 py-2 border border-slate-200 rounded-md text-sm outline-none transition focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 bg-white text-slate-900";
const fieldLabel = "block text-sm font-medium text-slate-700 mb-1";

const BLANK_FORM = { isRange: false, startDate: "", endDate: "", reason: "" };

function fmtDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function getDatesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

export default function Holidays() {
  const session = getStaffSession()!;
  const [holidays, setHolidays] = useState<StaffHoliday[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showAdd, setShowAdd]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState(BLANK_FORM);
  const [formErr, setFormErr]   = useState("");
  const { toast, notify }       = useToast();

  useEffect(() => {
    apiFetch<StaffHoliday[]>(`${STAFF_PORTAL_API}/${session.staffId}/holidays`)
      .then(setHolidays)
      .catch((e) => notify(e instanceof Error ? e.message : "Failed to load holidays", "error"))
      .finally(() => setLoading(false));
  }, [session.staffId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function addHoliday() {
    if (!form.startDate) { setFormErr("Select a date."); return; }
    if (form.isRange && !form.endDate) { setFormErr("Select an end date."); return; }
    if (form.isRange && form.endDate < form.startDate) { setFormErr("End date must be after start date."); return; }

    setSaving(true);
    try {
      const dates = form.isRange
        ? getDatesInRange(form.startDate, form.endDate)
        : [form.startDate];

      const saved: StaffHoliday[] = [];
      for (const date of dates) {
        const result = await apiFetch<StaffHoliday>(`${STAFF_PORTAL_API}/${session.staffId}/holidays`, {
          method: "POST",
          body: JSON.stringify({ overrideDate: date, reason: form.reason || null }),
        });
        saved.push(result);
      }

      setHolidays((p) =>
        [...p, ...saved].sort((a, b) => a.overrideDate.localeCompare(b.overrideDate))
      );
      setShowAdd(false);
      setForm(BLANK_FORM);
      setFormErr("");
      notify(saved.length > 1 ? `${saved.length} days off booked.` : "Day off booked.");
    } catch (e) { notify(e instanceof Error ? e.message : "Error", "error"); }
    finally { setSaving(false); }
  }

  async function removeHoliday(id: number) {
    try {
      await apiFetch(`${STAFF_PORTAL_API}/${session.staffId}/holidays/${id}`, { method: "DELETE" });
      setHolidays((p) => p.filter((h) => h.id !== id));
      notify("Day off removed.");
    } catch (e) { notify(e instanceof Error ? e.message : "Error", "error"); }
  }

  const today    = new Date().toISOString().slice(0, 10);
  const upcoming = holidays.filter((h) => h.overrideDate >= today);
  const past     = holidays.filter((h) => h.overrideDate <  today);

  return (
    <>
      <div className="mb-6 space-y-2">
        <h1 className="text-xl font-bold text-slate-900">My Holidays</h1>
        <InfoBar>
          Book personal days off to block your calendar. You can select a <strong>single day</strong> or a <strong>date range</strong> (e.g. a week's leave).
          Existing appointments are not automatically cancelled — contact your manager to reschedule any affected bookings.
        </InfoBar>
      </div>

      <div className="max-w-lg space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">

          <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">My days off</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Days you've blocked from the booking calendar.
              </p>
            </div>
            <button
              onClick={() => { setShowAdd(true); setFormErr(""); setForm(BLANK_FORM); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-3 h-3" /> Book day off
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-400">
              <div className="w-3.5 h-3.5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
              Loading…
            </div>
          ) : holidays.length === 0 ? (
            <p className="text-xs text-slate-400 px-5 py-6 text-center">
              No days off booked yet. Add recurring holidays (e.g. annual leave) or one-time days off.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {upcoming.length > 0 && (
                <>
                  <p className="px-5 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400 bg-slate-50/70">
                    Upcoming
                  </p>
                  {upcoming.map((h) => (
                    <div key={h.id} className="flex items-center justify-between px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                          <CalendarDays className="w-3.5 h-3.5 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{fmtDate(h.overrideDate)}</p>
                          {h.reason && <p className="text-xs text-slate-400">{h.reason}</p>}
                        </div>
                      </div>
                      <button
                        onClick={() => removeHoliday(h.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors cursor-pointer ml-4"
                        title="Remove this day off"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </>
              )}
              {past.length > 0 && (
                <>
                  <p className="px-5 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400 bg-slate-50/70">
                    Past
                  </p>
                  {past.map((h) => (
                    <div key={h.id} className="flex items-center justify-between px-5 py-3 opacity-50">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                          <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700">{fmtDate(h.overrideDate)}</p>
                          {h.reason && <p className="text-xs text-slate-400">{h.reason}</p>}
                        </div>
                      </div>
                      <button
                        onClick={() => removeHoliday(h.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors cursor-pointer ml-4"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Add modal ── */}
      {showAdd && (
        <div
          className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && !saving && setShowAdd(false)}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center">
                  <CalendarDays className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <span className="text-base font-bold text-slate-900">Book a day off</span>
              </div>
              <button
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
                onClick={() => setShowAdd(false)}
                disabled={saving}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Date with single/range toggle */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  {!form.isRange && (
                    <label className="text-sm font-medium text-slate-700">
                      Date <span className="text-red-500">*</span>
                    </label>
                  )}
                  <div className={`flex rounded-md border border-slate-200 bg-slate-50 p-0.5 gap-0.5 ${form.isRange ? "ml-auto" : ""}`}>
                    {([false, true] as const).map((r) => (
                      <button
                        key={String(r)}
                        type="button"
                        onClick={() => { setFormErr(""); setForm((p) => ({ ...p, isRange: r, endDate: "" })); }}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                          form.isRange === r
                            ? "bg-white shadow-sm text-matcha-700 border border-slate-200"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        {r ? "Date range" : "Single day"}
                      </button>
                    ))}
                  </div>
                </div>

                {form.isRange ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={fieldLabel}>Start <span className="text-red-500">*</span></label>
                      <input
                        type="date"
                        className={inputCls}
                        min={today}
                        value={form.startDate}
                        onChange={(e) => {
                          setFormErr("");
                          setForm((p) => ({
                            ...p,
                            startDate: e.target.value,
                            endDate: p.endDate && p.endDate < e.target.value ? e.target.value : p.endDate,
                          }));
                        }}
                      />
                    </div>
                    <div>
                      <label className={fieldLabel}>End <span className="text-red-500">*</span></label>
                      <input
                        type="date"
                        className={inputCls}
                        min={form.startDate || today}
                        value={form.endDate}
                        onChange={(e) => { setFormErr(""); setForm((p) => ({ ...p, endDate: e.target.value })); }}
                      />
                    </div>
                  </div>
                ) : (
                  <input
                    type="date"
                    className={inputCls}
                    min={today}
                    value={form.startDate}
                    onChange={(e) => { setFormErr(""); setForm((p) => ({ ...p, startDate: e.target.value })); }}
                  />
                )}

                {form.isRange && form.startDate && form.endDate && form.endDate >= form.startDate && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    {getDatesInRange(form.startDate, form.endDate).length} day{getDatesInRange(form.startDate, form.endDate).length !== 1 ? "s" : ""} will be booked off.
                  </p>
                )}
              </div>

              {/* Reason */}
              <div>
                <label className={fieldLabel}>Reason <span className="text-slate-400 font-normal">(optional)</span></label>
                <input
                  className={inputCls}
                  placeholder="e.g. Annual leave, Personal day"
                  value={form.reason}
                  onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                />
              </div>

              {formErr && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-red-600">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {formErr}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
              <button
                onClick={() => setShowAdd(false)}
                disabled={saving}
                className="px-4 py-2 rounded-md border border-slate-200 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={addHoliday}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-matcha-600 text-white text-sm font-medium hover:bg-matcha-700 cursor-pointer disabled:opacity-50"
              >
                <CalendarDays className="w-3.5 h-3.5" />
                {saving ? "Saving…" : "Book day off"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </>
  );
}
