import { useState, useEffect } from "react";
import { useOutletContext } from "react-router";
import { Plus, Trash2, X, CalendarDays, AlertCircle } from "lucide-react";
import { apiFetch, ADMIN_API } from "~/lib/api";
import type { SalonHoliday, SalonManageContext } from "~/lib/types";

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"] as const;

function fmtHoliday(h: SalonHoliday) {
  const startMon = MONTH_NAMES[h.month - 1] ?? h.month;
  const isRange = h.endMonth != null && h.endDay != null && (h.endMonth !== h.month || h.endDay !== h.day);
  const endMon = isRange ? (MONTH_NAMES[(h.endMonth ?? 1) - 1] ?? h.endMonth) : null;
  const dateStr = isRange ? `${startMon} ${h.day} – ${endMon} ${h.endDay}` : `${startMon} ${h.day}`;
  return h.year == null ? `Every year · ${dateStr}` : `${h.year} · ${dateStr}`;
}

const inp = "w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-stone-100 text-stone-900 outline-none focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 transition placeholder:text-stone-400";
const lbl = "block text-xs font-semibold text-stone-500 mb-1.5 uppercase tracking-wide";

const BLANK = { name:"", isRange:false, startDate:"", endDate:"", recurring:true };

export default function SalonHolidays() {
  const { salon } = useOutletContext<SalonManageContext>();
  const sid = String(salon.id);

  const [holidays, setHolidays] = useState<SalonHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...BLANK });
  const [formErr, setFormErr] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);

  useEffect(() => {
    apiFetch<SalonHoliday[]>(`${ADMIN_API}/${sid}/holidays`)
      .then(setHolidays).catch((e) => setErr(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [sid]);

  const pf = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));

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
    const e = validate(); if (e) { setFormErr(e); return; }
    setSaving(true);
    try {
      const start = parseDateParts(form.startDate);
      const end   = form.isRange && form.endDate ? parseDateParts(form.endDate) : null;
      const saved = await apiFetch<SalonHoliday>(`${ADMIN_API}/${sid}/holidays`, {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(), month: start.month, day: start.day,
          endMonth: end?.month ?? null, endDay: end?.day ?? null,
          year: form.recurring ? null : start.year,
        }),
      });
      setHolidays((p) => [...p, saved].sort((a, b) => a.month - b.month || a.day - b.day));
      setShowAdd(false); setForm({ ...BLANK }); setFormErr("");
    } catch (e) { setFormErr(e instanceof Error ? e.message : "Error saving"); }
    finally { setSaving(false); }
  }

  async function removeHoliday(id: number) {
    try {
      await apiFetch(`${ADMIN_API}/${sid}/holidays/${id}`, { method: "DELETE" });
      setHolidays((p) => p.filter((h) => h.id !== id));
      setConfirmDel(null);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed to delete"); }
  }

  const recurring   = holidays.filter((h) => h.year == null);
  const oneTime     = holidays.filter((h) => h.year != null);
  const thisYear    = new Date().getFullYear();
  const upcomingOT  = oneTime.filter((h) => (h.year ?? 0) >= thisYear);
  const pastOT      = oneTime.filter((h) => (h.year ?? 0) <  thisYear);

  function HolidayRow({ h }: { h: SalonHoliday }) {
    return (
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <CalendarDays className="w-4 h-4 text-matcha-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-stone-800">{h.name}</p>
            <p className="text-xs text-stone-400">{fmtHoliday(h)}</p>
          </div>
        </div>
        {confirmDel === h.id ? (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => removeHoliday(h.id)} className="text-xs text-red-600 hover:text-red-500 px-2 py-1 cursor-pointer">Confirm</button>
            <button onClick={() => setConfirmDel(null)} className="text-stone-400 hover:text-stone-800 cursor-pointer p-1"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <button onClick={() => setConfirmDel(h.id)} className="text-stone-400 hover:text-red-600 transition-colors cursor-pointer ml-4 shrink-0"><Trash2 className="w-4 h-4" /></button>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Holidays</h1>
          <p className="text-xs text-stone-400 mt-0.5">Days that block the booking calendar</p>
        </div>
        <button onClick={() => { setShowAdd(true); setFormErr(""); setForm({ ...BLANK }); }}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-matcha-600 hover:bg-matcha-500 text-white text-sm font-semibold transition-colors cursor-pointer">
          <Plus className="w-4 h-4" /> Add Holiday
        </button>
      </div>

      {err && <p className="text-red-600 text-xs mb-4">{err}</p>}

      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden max-w-lg">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-xs text-stone-400">
            <div className="w-4 h-4 border-2 border-stone-200 border-t-matcha-500 rounded-full animate-spin" /> Loading…
          </div>
        ) : recurring.length === 0 && oneTime.length === 0 ? (
          <p className="text-xs text-stone-400 px-5 py-8 text-center">No holidays configured yet.</p>
        ) : (
          <div className="divide-y divide-stone-200">
            {recurring.length > 0 && (
              <>
                <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-stone-400 bg-stone-100">Recurring — every year</p>
                {recurring.map((h) => <HolidayRow key={h.id} h={h} />)}
              </>
            )}
            {upcomingOT.length > 0 && (
              <>
                <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-stone-400 bg-stone-100">One-time — upcoming</p>
                {upcomingOT.map((h) => <HolidayRow key={h.id} h={h} />)}
              </>
            )}
            {pastOT.length > 0 && (
              <>
                <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-stone-400 bg-stone-100">One-time — past</p>
                <div className="opacity-50">{pastOT.map((h) => <HolidayRow key={h.id} h={h} />)}</div>
              </>
            )}
          </div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-stone-900/40 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="bg-white border border-stone-200 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200">
              <h3 className="text-sm font-bold text-stone-900">Add Holiday</h3>
              <button onClick={() => setShowAdd(false)} className="text-stone-400 hover:text-stone-800 cursor-pointer p-1"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className={lbl}>Name <span className="text-red-500">*</span></label>
                <input className={inp} placeholder="e.g. Christmas Break, New Year's Day"
                  value={form.name} onChange={(e) => { setFormErr(""); pf({ name: e.target.value }); }} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={lbl}>Date{form.isRange ? "s" : ""} <span className="text-red-500">*</span></label>
                  <div className="flex rounded-lg border border-stone-200 bg-stone-100 p-0.5 gap-0.5">
                    {([false, true] as const).map((r) => (
                      <button key={String(r)} type="button" onClick={() => pf({ isRange: r, endDate: "" })}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium cursor-pointer transition-colors ${form.isRange === r ? "bg-matcha-600 text-white" : "text-stone-500 hover:text-stone-800"}`}>
                        {r ? "Range" : "Single day"}
                      </button>
                    ))}
                  </div>
                </div>
                {form.isRange ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={`${lbl} mb-1`}>Start</label>
                      <input type="date" className={inp} value={form.startDate}
                        onChange={(e) => { setFormErr(""); pf({ startDate: e.target.value }); }} />
                    </div>
                    <div>
                      <label className={`${lbl} mb-1`}>End</label>
                      <input type="date" className={inp} min={form.startDate} value={form.endDate}
                        onChange={(e) => { setFormErr(""); pf({ endDate: e.target.value }); }} />
                    </div>
                  </div>
                ) : (
                  <input type="date" className={inp} value={form.startDate}
                    onChange={(e) => { setFormErr(""); pf({ startDate: e.target.value }); }} />
                )}
                {form.recurring && <p className="text-[11px] text-stone-400 mt-1">Year is ignored for recurring holidays.</p>}
              </div>
              <div>
                <label className={lbl}>Repeats</label>
                <div className="flex gap-2">
                  {([true, false] as const).map((r) => (
                    <button key={String(r)} type="button" onClick={() => pf({ recurring: r })}
                      className={`flex-1 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${form.recurring === r ? "bg-matcha-600 border-matcha-600 text-white" : "border-stone-200 text-stone-500 hover:border-stone-300"}`}>
                      {r ? "Every year" : "Specific year"}
                    </button>
                  ))}
                </div>
              </div>
              {formErr && (
                <p className="flex items-center gap-1.5 text-xs text-red-600"><AlertCircle className="w-3.5 h-3.5 shrink-0" />{formErr}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-stone-200">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg border border-stone-200 text-sm text-stone-500 hover:text-stone-800 hover:border-stone-300 transition-colors cursor-pointer">Cancel</button>
              <button onClick={addHoliday} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-matcha-600 hover:bg-matcha-500 text-white text-sm font-semibold cursor-pointer disabled:opacity-50">
                <CalendarDays className="w-3.5 h-3.5" /> {saving ? "Saving…" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
