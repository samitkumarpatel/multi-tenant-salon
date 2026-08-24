import { useState, useEffect } from "react";
import { useOutletContext } from "react-router";
import { CalendarDays, Plus, Trash2, X, AlertCircle } from "lucide-react";
import { ADMIN_API, apiFetch } from "~/lib/api";
import type { LayoutContext, SalonHoliday } from "~/lib/types";
import InfoBar from "~/components/InfoBar";
import { Tooltip } from "~/components/Tooltip";
import { Toast, useToast } from "@salon/ui-shared";

const inputCls =
  "w-full px-3 py-2 border border-slate-200 rounded-md text-sm outline-none transition focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 bg-white text-slate-900";
const fieldLabel = "block text-sm font-medium text-slate-700 mb-1";

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"] as const;

function fmtHoliday(h: SalonHoliday): string {
  const startMon = MONTH_NAMES[h.month - 1] ?? h.month;
  const isRange = h.endMonth != null && h.endDay != null && (h.endMonth !== h.month || h.endDay !== h.day);
  const endMon = isRange ? (MONTH_NAMES[(h.endMonth ?? 1) - 1] ?? h.endMonth) : null;
  const dateStr = isRange ? `${startMon} ${h.day} – ${endMon} ${h.endDay}` : `${startMon} ${h.day}`;
  return h.year == null ? `Every year · ${dateStr}` : `${h.year} · ${dateStr}`;
}

const BLANK_FORM = {
  name: "",
  isRange: false,
  startDate: "",
  endDate: "",
  recurring: true,
};

export default function HolidayPage() {
  const { salon } = useOutletContext<LayoutContext>();
  const salonId = String(salon.id);

  const [holidays, setHolidays] = useState<SalonHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [formErr, setFormErr] = useState("");
  const { toast, notify } = useToast();

  useEffect(() => {
    apiFetch<SalonHoliday[]>(`${ADMIN_API}/${salonId}/holidays`)
      .then(setHolidays)
      .catch((e) => notify(e instanceof Error ? e.message : "Failed to load holidays", "error"))
      .finally(() => setLoading(false));
  }, [salonId]); // eslint-disable-line react-hooks/exhaustive-deps

  function validate() {
    if (!form.name.trim()) return "Holiday name is required.";
    if (!form.startDate) return "Select a start date.";
    if (form.isRange && !form.endDate) return "Select an end date.";
    return "";
  }

  function parseDateParts(iso: string) {
    const [y, m, d] = iso.split("-").map(Number);
    return { year: y, month: m, day: d };
  }

  async function addHoliday() {
    const err = validate();
    if (err) { setFormErr(err); return; }
    setSaving(true);
    try {
      const start = parseDateParts(form.startDate);
      const end   = form.isRange && form.endDate ? parseDateParts(form.endDate) : null;
      const body = {
        name: form.name.trim(),
        month: start.month,
        day:   start.day,
        endMonth: end ? end.month : null,
        endDay:   end ? end.day   : null,
        year: form.recurring ? null : start.year,
      };
      const saved = await apiFetch<SalonHoliday>(`${ADMIN_API}/${salonId}/holidays`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setHolidays((p) => [...p, saved].sort((a, b) => a.month - b.month || a.day - b.day));
      setShowAdd(false);
      setForm(BLANK_FORM);
      setFormErr("");
      notify("Holiday added.");
    } catch (e) { notify(e instanceof Error ? e.message : "Error", "error"); }
    finally { setSaving(false); }
  }

  async function removeHoliday(id: number) {
    try {
      await apiFetch(`${ADMIN_API}/${salonId}/holidays/${id}`, { method: "DELETE" });
      setHolidays((p) => p.filter((h) => h.id !== id));
      notify("Holiday removed.");
    } catch (e) { notify(e instanceof Error ? e.message : "Error", "error"); }
  }

  const recurring  = holidays.filter((h) => h.year == null);
  const oneTime    = holidays.filter((h) => h.year != null);
  const thisYear   = new Date().getFullYear();
  const upcomingOT = oneTime.filter((h) => (h.year ?? 0) >= thisYear);
  const pastOT     = oneTime.filter((h) => (h.year ?? 0) <  thisYear);

  return (
    <>
      <div className="mb-6 space-y-2">
        <h1 className="text-xl font-bold text-slate-900">Holidays</h1>
        <InfoBar id="holidays">
          Define public or private holidays that block the booking calendar. <strong>Recurring</strong> holidays (e.g. Christmas) apply every year automatically. <strong>One-time</strong> holidays apply to a specific year only. You can set a single day or a <strong>date range</strong> (e.g. Christmas break Dec 24 – Jan 2).
        </InfoBar>
      </div>

      <div className="max-w-lg space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Holidays</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Recurring holidays apply every year; one-time holidays apply to a specific year.
              </p>
            </div>
            <Tooltip content="Add a holiday that blocks the booking calendar" side="left">
              <button onClick={() => { setShowAdd(true); setFormErr(""); setForm(BLANK_FORM); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer shrink-0">
                <Plus className="w-3 h-3" /> Add Holiday
              </button>
            </Tooltip>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-400">
              <div className="w-3.5 h-3.5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
              Loading…
            </div>
          ) : recurring.length === 0 && oneTime.length === 0 ? (
            <p className="text-xs text-slate-400 px-5 py-6 text-center">
              No holidays yet. Add recurring holidays (e.g. Christmas) or one-time closures for a specific year.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {recurring.length > 0 && (
                <>
                  <p className="px-5 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400 bg-slate-50/70">
                    Recurring — every year
                  </p>
                  {recurring.map((h) => (
                    <div key={h.id} className="flex items-center justify-between px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                          <CalendarDays className="w-3.5 h-3.5 text-violet-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{h.name}</p>
                          <p className="text-xs text-slate-400">{fmtHoliday(h)}</p>
                        </div>
                      </div>
                      <Tooltip content="Remove this holiday" side="left">
                        <button onClick={() => removeHoliday(h.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors cursor-pointer ml-4">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </Tooltip>
                    </div>
                  ))}
                </>
              )}
              {upcomingOT.length > 0 && (
                <>
                  <p className="px-5 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400 bg-slate-50/70">
                    One-time — upcoming
                  </p>
                  {upcomingOT.map((h) => (
                    <div key={h.id} className="flex items-center justify-between px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                          <CalendarDays className="w-3.5 h-3.5 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{h.name}</p>
                          <p className="text-xs text-slate-400">{fmtHoliday(h)}</p>
                        </div>
                      </div>
                      <Tooltip content="Remove this holiday" side="left">
                        <button onClick={() => removeHoliday(h.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors cursor-pointer ml-4">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </Tooltip>
                    </div>
                  ))}
                </>
              )}
              {pastOT.length > 0 && (
                <>
                  <p className="px-5 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400 bg-slate-50/70">
                    One-time — past
                  </p>
                  {pastOT.map((h) => (
                    <div key={h.id} className="flex items-center justify-between px-5 py-3 opacity-50">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                          <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700">{h.name}</p>
                          <p className="text-xs text-slate-400">{fmtHoliday(h)}</p>
                        </div>
                      </div>
                      <Tooltip content="Remove this holiday" side="left">
                        <button onClick={() => removeHoliday(h.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors cursor-pointer ml-4">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </Tooltip>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center">
                  <CalendarDays className="w-3.5 h-3.5 text-violet-600" />
                </div>
                <span className="text-base font-bold text-slate-900">Add holiday</span>
              </div>
              <button className="text-slate-400 hover:text-slate-600 cursor-pointer" onClick={() => setShowAdd(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className={fieldLabel}>Holiday name <span className="text-red-500">*</span></label>
                <input className={inputCls} placeholder="e.g. Christmas Break, New Year's Day"
                  value={form.name}
                  onChange={(e) => { setFormErr(""); setForm((p) => ({ ...p, name: e.target.value })); }} />
              </div>

              {/* Date */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  {!form.isRange && (
                    <label className="text-sm font-medium text-slate-700">
                      Date <span className="text-red-500">*</span>
                    </label>
                  )}
                  <div className={`flex rounded-md border border-slate-200 bg-slate-50 p-0.5 gap-0.5 ${form.isRange ? "ml-auto" : ""}`}>
                    {([false, true] as const).map((r) => (
                      <button key={String(r)} type="button"
                        onClick={() => setForm((p) => ({ ...p, isRange: r, endDate: "" }))}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer transition-colors ${form.isRange === r ? "bg-white shadow-sm text-violet-700 border border-slate-200" : "text-slate-500 hover:text-slate-700"}`}>
                        {r ? "Date range" : "Single day"}
                      </button>
                    ))}
                  </div>
                </div>
                {form.isRange ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={fieldLabel}>Start <span className="text-red-500">*</span></label>
                      <input type="date" className={inputCls} value={form.startDate}
                        onChange={(e) => { setFormErr(""); setForm((p) => ({ ...p, startDate: e.target.value, endDate: p.endDate < e.target.value ? e.target.value : p.endDate })); }} />
                    </div>
                    <div>
                      <label className={fieldLabel}>End <span className="text-red-500">*</span></label>
                      <input type="date" className={inputCls} min={form.startDate} value={form.endDate}
                        onChange={(e) => { setFormErr(""); setForm((p) => ({ ...p, endDate: e.target.value })); }} />
                    </div>
                  </div>
                ) : (
                  <input type="date" className={inputCls} value={form.startDate}
                    onChange={(e) => { setFormErr(""); setForm((p) => ({ ...p, startDate: e.target.value })); }} />
                )}
                {form.recurring && (
                  <p className="text-[11px] text-slate-400 mt-1">Year is ignored — this holiday repeats every year.</p>
                )}
              </div>

              {/* Repeats */}
              <div>
                <label className={fieldLabel}>Repeats</label>
                <div className="flex gap-2">
                  {([true, false] as const).map((r) => (
                    <button key={String(r)} type="button"
                      onClick={() => setForm((p) => ({ ...p, recurring: r }))}
                      className={`flex-1 py-2 rounded-md border text-xs font-medium cursor-pointer transition-colors ${form.recurring === r ? "bg-violet-600 border-violet-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                      {r ? "Every year" : "Specific year"}
                    </button>
                  ))}
                </div>
              </div>

              {formErr && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-red-600">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {formErr}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
              <button onClick={() => setShowAdd(false)}
                className="px-4 py-2 rounded-md border border-slate-200 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 cursor-pointer">
                Cancel
              </button>
              <button onClick={addHoliday} disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 cursor-pointer disabled:opacity-50">
                <CalendarDays className="w-3.5 h-3.5" />
                {saving ? "Saving…" : "Add holiday"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </>
  );
}
