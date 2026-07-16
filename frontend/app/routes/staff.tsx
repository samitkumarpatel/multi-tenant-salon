import { useState, useRef } from "react";
import { useLoaderData, useOutletContext } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { Pencil, Trash2, X, UserCircle, ChevronRight, Crown, CalendarOff, Clock } from "lucide-react";
import { API, apiFetch, resolveSaloonUUID } from "~/lib/api";
import {
  STAFF_ROLES, STAFF_ROLE_LABEL, STAFF_STATUSES, STAFF_STATUS_LABEL,
  CATEGORY_LABEL, SPECIALIZATION_OPTIONS,
} from "~/lib/constants";
import type { LayoutContext, StaffMember } from "~/lib/types";
import InfoBar from "~/components/InfoBar";
import TileGrid from "~/components/TileGrid";

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const sid = await resolveSaloonUUID(params.saloonId!);
  return apiFetch<StaffMember[]>(`${API}/${sid}/staff`);
}

// ── Shared styles ────────────────────────────────────────────────────────────

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-md text-sm outline-none transition-[border-color,box-shadow] focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 bg-white text-slate-900 font-sans";
const fieldLabel = "block text-sm font-medium text-slate-700 mb-1";

const STATUS_DOT: Record<string, string> = {
  ACTIVE:   "bg-green-500",
  INACTIVE: "bg-slate-300",
  ON_LEAVE: "bg-amber-500",
};

// ── Form field type ──────────────────────────────────────────────────────────

interface StaffFormFields {
  name: string;
  email: string;
  phone: string;
  role: string;
  specializations: string[];
}

// ── Schedule editor ───────────────────────────────────────────────────────────

const ALL_DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;
const DAY_LABEL: Record<string, string> = {
  MONDAY: "Mon", TUESDAY: "Tue", WEDNESDAY: "Wed",
  THURSDAY: "Thu", FRIDAY: "Fri", SATURDAY: "Sat", SUNDAY: "Sun",
};

interface ScheduleEntry {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  enabled: boolean;
}

function defaultSchedule(): ScheduleEntry[] {
  return ALL_DAYS.map((d) => ({
    dayOfWeek: d,
    startTime: "09:00",
    endTime: "18:00",
    enabled: d !== "SUNDAY",
  }));
}

function ScheduleEditor({
  schedule,
  onChange,
}: {
  schedule: ScheduleEntry[];
  onChange: (s: ScheduleEntry[]) => void;
}) {
  function update(idx: number, patch: Partial<ScheduleEntry>) {
    onChange(schedule.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }

  return (
    <div>
      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 pb-2 border-b border-slate-100 flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5" /> Calendar availability
      </div>
      <div className="space-y-1.5">
        {schedule.map((entry, idx) => (
          <div key={entry.dayOfWeek} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => update(idx, { enabled: !entry.enabled })}
              className={`w-9 h-5 rounded-full transition-colors shrink-0 relative cursor-pointer ${entry.enabled ? "bg-matcha-600" : "bg-slate-200"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${entry.enabled ? "translate-x-4" : "translate-x-0"}`} />
            </button>
            <span className={`w-8 text-xs font-semibold shrink-0 ${entry.enabled ? "text-slate-700" : "text-slate-300"}`}>
              {DAY_LABEL[entry.dayOfWeek]}
            </span>
            {entry.enabled ? (
              <>
                <input
                  type="time"
                  value={entry.startTime}
                  onChange={(e) => update(idx, { startTime: e.target.value })}
                  className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded-md outline-none focus:border-matcha-500 focus:ring-1 focus:ring-matcha-500/10 bg-white text-slate-800"
                />
                <span className="text-xs text-slate-300">–</span>
                <input
                  type="time"
                  value={entry.endTime}
                  onChange={(e) => update(idx, { endTime: e.target.value })}
                  className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded-md outline-none focus:border-matcha-500 focus:ring-1 focus:ring-matcha-500/10 bg-white text-slate-800"
                />
              </>
            ) : (
              <span className="text-xs text-slate-300 italic">Day off</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sub-component at module level so React never remounts it on re-render ────

function StaffForm({
  f, setF,
}: {
  f: StaffFormFields;
  setF: React.Dispatch<React.SetStateAction<StaffFormFields>>;
}) {
  return (
    <>
      <div className="mb-4">
        <label className={fieldLabel}>Name <span className="text-red-500">*</span></label>
        <input
          className={inputCls}
          placeholder="Full name"
          value={f.name}
          onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))}
        />
      </div>

      <div className="mb-4">
        <label className={fieldLabel}>Email <span className="text-red-500">*</span></label>
        <input
          className={inputCls}
          type="email"
          placeholder="staff@saloon.com"
          value={f.email}
          onChange={(e) => setF((p) => ({ ...p, email: e.target.value }))}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div>
          <label className={fieldLabel}>Phone</label>
          <input
            className={inputCls}
            value={f.phone}
            onChange={(e) => setF((p) => ({ ...p, phone: e.target.value }))}
          />
        </div>
        <div>
          <label className={fieldLabel}>Role</label>
          <select
            className={inputCls}
            value={f.role}
            onChange={(e) => setF((p) => ({ ...p, role: e.target.value }))}
          >
            {STAFF_ROLES.map((r) => <option key={r} value={r}>{STAFF_ROLE_LABEL[r]}</option>)}
          </select>
        </div>
      </div>

      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 pb-2 border-b border-slate-100">
        Specializations
      </div>
      <TileGrid
        options={SPECIALIZATION_OPTIONS}
        labels={CATEGORY_LABEL}
        selected={f.specializations}
        onChange={(specs) => setF((p) => ({ ...p, specializations: specs }))}
      />
    </>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function Staff() {
  const { saloon } = useOutletContext<LayoutContext>();
  const init = useLoaderData<typeof clientLoader>();
  const [staff,  setStaff]  = useState<StaffMember[]>(init);
  const [busy,   setBusy]   = useState(false);
  const [toast,  setToast]  = useState<{ msg: string; type: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [target, setTarget] = useState<StaffMember | null>(null);
  const [modal,  setModal]  = useState({ add: false, edit: false, del: false });

  const sid = saloon.id;

  const blank = (): StaffFormFields => ({ name: "", email: "", phone: "", role: "STYLIST", specializations: [] });
  const [af, setAf] = useState<StaffFormFields>(blank);
  const [addSchedule, setAddSchedule] = useState<ScheduleEntry[]>(defaultSchedule);
  const [ef, setEf] = useState<StaffFormFields & { status: string; availableForBooking: boolean }>({ ...blank(), status: "ACTIVE", availableForBooking: true });

  function notify(msg: string, type = "success") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  function closeModal(k: keyof typeof modal) { setModal((m) => ({ ...m, [k]: false })); }
  function openAdd() { setAf(blank()); setAddSchedule(defaultSchedule()); setModal((m) => ({ ...m, add: true })); }

  function openEdit(m: StaffMember) {
    setTarget(m);
    setEf({
      name: m.name, email: m.email, phone: m.phone ?? "",
      role: m.role, status: m.status,
      availableForBooking: m.availableForBooking ?? true,
      specializations: [...(m.specializations ?? [])],
    });
    setModal((p) => ({ ...p, edit: true }));
  }

  function openDel(m: StaffMember) { setTarget(m); setModal((p) => ({ ...p, del: true })); }

  async function submitAdd() {
    if (!af.name || !af.email) return;
    setBusy(true);
    try {
      const schedule = addSchedule
        .filter((e) => e.enabled)
        .map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime }));
      const member = await apiFetch<StaffMember>(`${API}/${sid}/staff`, {
        method: "POST",
        body: JSON.stringify({ name: af.name, email: af.email, phone: af.phone, role: af.role, specializations: af.specializations, schedule }),
      });
      setStaff((p) => [member, ...p]);
      closeModal("add");
      notify(`${member.name} onboarded!`);
    } catch (e) { notify(e instanceof Error ? e.message : "Error", "error"); }
    finally { setBusy(false); }
  }

  async function submitEdit() {
    if (!target) return;
    setBusy(true);
    try {
      const updated = await apiFetch<StaffMember>(`${API}/${sid}/staff/${target.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: ef.name, email: ef.email, phone: ef.phone, role: ef.role, status: ef.status, availableForBooking: ef.availableForBooking, specializations: ef.specializations }),
      });
      setStaff((p) => p.map((m) => m.id === updated.id ? updated : m));
      closeModal("edit");
      notify(`${updated.name} updated!`);
    } catch (e) { notify(e instanceof Error ? e.message : "Error", "error"); }
    finally { setBusy(false); }
  }

  async function submitDel() {
    if (!target) return;
    setBusy(true);
    try {
      await apiFetch(`${API}/${sid}/staff/${target.id}`, { method: "DELETE" });
      const name = target.name;
      setStaff((p) => p.filter((m) => m.id !== target.id));
      closeModal("del");
      notify(`${name} removed.`);
    } catch (e) { notify(e instanceof Error ? e.message : "Error", "error"); }
    finally { setBusy(false); }
  }

  return (
    <>
      <div className="mb-6 space-y-2">
        <h1 className="text-xl font-bold text-slate-900">Staff</h1>
        <InfoBar>
          Add and manage the people working at your saloon — their roles, contact details, and service specializations.
          Staff members can be assigned to specific services.
        </InfoBar>
      </div>

      {staff.length > 0 && (
        <p className="text-sm text-slate-500 font-medium mb-4">
          {staff.length} staff member{staff.length !== 1 ? "s" : ""}
        </p>
      )}

      {!staff.length ? (
        <div className="text-center py-20 px-8">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <UserCircle className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-sm font-semibold text-slate-500 mb-1">No staff yet</h3>
          <p className="text-xs text-slate-400 mb-6">Onboard the first staff member to get started.</p>
          <button
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-matcha-600 text-white text-sm font-medium hover:bg-matcha-700 transition-colors cursor-pointer"
            onClick={openAdd}
          >
            Onboard Staff
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm divide-y divide-slate-100">
          {staff.map((m) => (
            <div key={m.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors group">

              {/* Status dot */}
              <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[m.status] ?? "bg-slate-300"}`} />

              {/* Name + role + contact + specializations */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-900 truncate">{m.name}</span>
                  {m.isOwner && (
                    <span className="inline-flex items-center gap-0.5 text-[0.62rem] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wide shrink-0">
                      <Crown className="w-2.5 h-2.5" /> Owner
                    </span>
                  )}
                  <span className="text-[0.62rem] font-semibold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-800 border border-violet-200 uppercase tracking-wide shrink-0">
                    {STAFF_ROLE_LABEL[m.role] ?? m.role}
                  </span>
                  <span className="text-[0.62rem] text-slate-400 shrink-0">
                    {STAFF_STATUS_LABEL[m.status] ?? m.status}
                  </span>
                  {m.availableForBooking === false && (
                    <span className="inline-flex items-center gap-0.5 text-[0.62rem] text-slate-400 shrink-0">
                      <CalendarOff className="w-2.5 h-2.5" /> Not bookable
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-0.5 truncate">
                  {m.email}{m.phone ? ` · ${m.phone}` : ""}
                </div>
                {m.specializations?.length ? (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {m.specializations.map((s) => (
                      <span key={s} className="text-[0.6rem] font-semibold bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded-full border border-slate-200">
                        {CATEGORY_LABEL[s] ?? s}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Actions */}
              <div className="shrink-0 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => openEdit(m)}
                >
                  <Pencil className="w-3 h-3" /> Edit
                </button>
                {!m.isOwner && (
                  <button
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-red-200 text-xs font-medium text-red-600 bg-white hover:bg-red-50 transition-colors cursor-pointer"
                    onClick={() => openDel(m)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Mobile chevron hint */}
              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 sm:hidden" />
            </div>
          ))}
          <div className="flex justify-end px-4 py-3 bg-slate-50/60 border-t border-slate-100">
            <button
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-matcha-600 text-white text-sm font-medium hover:bg-matcha-700 transition-colors cursor-pointer"
              onClick={openAdd}
            >
              Onboard Staff
            </button>
          </div>
        </div>
      )}

      {/* Add / Onboard modal */}
      {modal.add && (
        <div
          className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && closeModal("add")}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto animate-[pop_0.14s_ease]">
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100">
              <span className="text-base font-bold text-slate-900">Onboard Staff</span>
              <button className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer" onClick={() => closeModal("add")}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <StaffForm f={af} setF={setAf} />
            <div className="mt-5">
              <ScheduleEditor schedule={addSchedule} onChange={setAddSchedule} />
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
              <button
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-slate-200 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => closeModal("add")}
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-matcha-600 text-white text-sm font-medium hover:bg-matcha-700 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                disabled={busy || !af.name || !af.email}
                onClick={submitAdd}
              >
                {busy ? "Saving…" : "Onboard"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {modal.edit && (
        <div
          className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && closeModal("edit")}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto animate-[pop_0.14s_ease]">
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100">
              <span className="text-base font-bold text-slate-900">Edit Staff</span>
              <button className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer" onClick={() => closeModal("edit")}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <StaffForm f={ef} setF={setEf as React.Dispatch<React.SetStateAction<StaffFormFields>>} />
            <div className="mt-4 mb-2">
              <label className={fieldLabel}>Status</label>
              <select
                className={inputCls}
                value={ef.status}
                onChange={(e) => setEf((p) => ({ ...p, status: e.target.value }))}
              >
                {STAFF_STATUSES.map((s) => <option key={s} value={s}>{STAFF_STATUS_LABEL[s]}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-3 mt-4 cursor-pointer select-none">
              <div
                className={`relative w-9 h-5 rounded-full transition-colors ${ef.availableForBooking ? "bg-matcha-600" : "bg-slate-300"}`}
                onClick={() => setEf((p) => ({ ...p, availableForBooking: !p.availableForBooking }))}
              >
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${ef.availableForBooking ? "translate-x-4" : "translate-x-0"}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Available for booking</p>
                <p className="text-xs text-slate-400">
                  {ef.availableForBooking
                    ? "Customers can book appointments with this staff member."
                    : "This staff member will not appear in the booking calendar."}
                </p>
              </div>
            </label>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
              <button
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-slate-200 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => closeModal("edit")}
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-matcha-600 text-white text-sm font-medium hover:bg-matcha-700 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                disabled={busy}
                onClick={submitEdit}
              >
                {busy ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {modal.del && (
        <div
          className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && closeModal("del")}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-slate-200 animate-[pop_0.14s_ease]">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
              <span className="text-base font-bold text-slate-900">Remove Staff</span>
              <button className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer" onClick={() => closeModal("del")}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Remove <strong className="text-slate-800">{target?.name}</strong> from this saloon?
            </p>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
              <button
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-slate-200 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => closeModal("del")}
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-red-500 text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                disabled={busy}
                onClick={submitDel}
              >
                <Trash2 className="w-3.5 h-3.5" /> {busy ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-2.5 rounded-lg text-sm font-medium text-white shadow-lg z-[1000] animate-[slide-up_0.16s_ease] ${toast.type === "error" ? "bg-red-600" : "bg-matcha-600"}`}>
          {toast.msg}
        </div>
      )}
    </>
  );
}
