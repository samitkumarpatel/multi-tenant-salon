import { useState, useRef } from "react";
import { useLoaderData, useOutletContext } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { Plus, Pencil, Trash2, X, UserCircle } from "lucide-react";
import { API, apiFetch } from "~/lib/api";
import {
  STAFF_ROLES, STAFF_ROLE_LABEL, STAFF_STATUSES, STAFF_STATUS_LABEL,
  CATEGORY_LABEL, SPECIALIZATION_OPTIONS,
} from "~/lib/constants";
import type { LayoutContext, StaffMember } from "~/lib/types";
import TileGrid from "~/components/TileGrid";

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  return apiFetch<StaffMember[]>(`${API}/${params.saloonId}/staff`);
}

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-md text-sm outline-none transition-[border-color,box-shadow] focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 bg-white text-slate-900 font-sans";
const fieldLabel = "block text-sm font-medium text-slate-700 mb-1";

const STATUS_DOT: Record<string, string> = {
  ACTIVE:   "bg-green-500",
  INACTIVE: "bg-slate-300",
  ON_LEAVE: "bg-amber-500",
};

export default function Staff() {
  const { saloon } = useOutletContext<LayoutContext>();
  const init = useLoaderData<typeof clientLoader>();
  const [staff,  setStaff]  = useState<StaffMember[]>(init);
  const [busy,   setBusy]   = useState(false);
  const [toast,  setToast]  = useState<{ msg: string; type: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [target, setTarget] = useState<StaffMember | null>(null);
  const [modal,  setModal]  = useState({ onboard: false, edit: false, del: false });

  const sid = saloon.id;

  const blankOnboard = () => ({ name: "", email: "", phone: "", role: "STYLIST", specializations: [] as string[] });
  const [af, setAf] = useState(blankOnboard);
  const [ef, setEf] = useState({ name: "", email: "", phone: "", role: "STYLIST", status: "ACTIVE", specializations: [] as string[] });

  function notify(msg: string, type = "success") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  function closeModal(k: keyof typeof modal) { setModal((m) => ({ ...m, [k]: false })); }
  function openOnboard() { setAf(blankOnboard()); setModal((m) => ({ ...m, onboard: true })); }

  function openEdit(m: StaffMember) {
    setTarget(m);
    setEf({ name: m.name, email: m.email, phone: m.phone ?? "", role: m.role, status: m.status, specializations: [...(m.specializations ?? [])] });
    setModal((prev) => ({ ...prev, edit: true }));
  }

  function openDel(m: StaffMember) { setTarget(m); setModal((p) => ({ ...p, del: true })); }

  async function submitOnboard() {
    if (!af.name || !af.email) return;
    setBusy(true);
    try {
      const member = await apiFetch<StaffMember>(`${API}/${sid}/staff`, {
        method: "POST",
        body: JSON.stringify({ name: af.name, email: af.email, phone: af.phone, role: af.role, specializations: af.specializations }),
      });
      setStaff((p) => [member, ...p]);
      closeModal("onboard");
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
        body: JSON.stringify({ name: ef.name, email: ef.email, phone: ef.phone, role: ef.role, status: ef.status, specializations: ef.specializations }),
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
      <div className="flex items-center justify-between mb-6">
        <span className="text-sm text-slate-500 font-medium">
          {staff.length} staff member{staff.length !== 1 ? "s" : ""}
        </span>
        <button
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-matcha-600 text-white text-sm font-medium hover:bg-matcha-700 transition-colors cursor-pointer"
          onClick={openOnboard}
        >
          <Plus className="w-4 h-4" /> Onboard Staff
        </button>
      </div>

      {!staff.length ? (
        <div className="text-center py-20 px-8">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <UserCircle className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-sm font-semibold text-slate-500 mb-1">No staff yet</h3>
          <p className="text-xs text-slate-400">Onboard the first staff member.</p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
          {staff.map((m) => (
            <div key={m.id} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col hover:shadow-md transition-shadow">
              <div className="font-bold text-sm text-slate-900">{m.name}</div>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-[0.62rem] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 border border-violet-200 uppercase tracking-wide">
                  {STAFF_ROLE_LABEL[m.role] ?? m.role}
                </span>
                <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[m.status] ?? "bg-slate-300"}`} />
                  {STAFF_STATUS_LABEL[m.status] ?? m.status}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-2 leading-relaxed">
                {m.email}{m.phone ? <><br />{m.phone}</> : null}
              </div>
              {m.specializations?.length ? (
                <div className="flex flex-wrap gap-1 mt-2">
                  {m.specializations.map((s) => (
                    <span key={s} className="text-[0.62rem] font-semibold bg-slate-50 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                      {CATEGORY_LABEL[s] ?? s}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="flex gap-2 mt-auto pt-3 border-t border-slate-100">
                <button
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => openEdit(m)}
                >
                  <Pencil className="w-3 h-3" /> Edit
                </button>
                <button
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-red-200 text-xs font-medium text-red-600 bg-white hover:bg-red-50 transition-colors cursor-pointer ml-auto"
                  onClick={() => openDel(m)}
                >
                  <Trash2 className="w-3 h-3" /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Onboard modal */}
      {modal.onboard && (
        <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && closeModal("onboard")}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto animate-[pop_0.14s_ease]">
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100">
              <span className="text-base font-bold text-slate-900">Onboard Staff</span>
              <button className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer" onClick={() => closeModal("onboard")}><X className="w-5 h-5" /></button>
            </div>
            <div className="mb-4"><label className={fieldLabel}>Name <span className="text-red-500">*</span></label><input className={inputCls} value={af.name} placeholder="Full name" onChange={(e) => setAf((p) => ({ ...p, name: e.target.value }))} /></div>
            <div className="mb-4"><label className={fieldLabel}>Email <span className="text-red-500">*</span></label><input className={inputCls} type="email" value={af.email} placeholder="staff@saloon.com" onChange={(e) => setAf((p) => ({ ...p, email: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="mb-4"><label className={fieldLabel}>Phone</label><input className={inputCls} value={af.phone} onChange={(e) => setAf((p) => ({ ...p, phone: e.target.value }))} /></div>
              <div className="mb-4"><label className={fieldLabel}>Role</label>
                <select className={inputCls} value={af.role} onChange={(e) => setAf((p) => ({ ...p, role: e.target.value }))}>
                  {STAFF_ROLES.map((r) => <option key={r} value={r}>{STAFF_ROLE_LABEL[r]}</option>)}
                </select>
              </div>
            </div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 pb-2 border-b border-slate-100">Specializations</div>
            <TileGrid options={[...SPECIALIZATION_OPTIONS]} labels={CATEGORY_LABEL} selected={af.specializations} onChange={(specs) => setAf((p) => ({ ...p, specializations: specs }))} />
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
              <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-slate-200 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => closeModal("onboard")}>Cancel</button>
              <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-matcha-600 text-white text-sm font-medium hover:bg-matcha-700 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed" disabled={busy || !af.name || !af.email} onClick={submitOnboard}>
                {busy ? "Saving…" : "Onboard"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {modal.edit && (
        <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && closeModal("edit")}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto animate-[pop_0.14s_ease]">
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100">
              <span className="text-base font-bold text-slate-900">Edit Staff</span>
              <button className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer" onClick={() => closeModal("edit")}><X className="w-5 h-5" /></button>
            </div>
            <div className="mb-4"><label className={fieldLabel}>Name</label><input className={inputCls} value={ef.name} onChange={(e) => setEf((p) => ({ ...p, name: e.target.value }))} /></div>
            <div className="mb-4"><label className={fieldLabel}>Email</label><input className={inputCls} type="email" value={ef.email} onChange={(e) => setEf((p) => ({ ...p, email: e.target.value }))} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="mb-4"><label className={fieldLabel}>Phone</label><input className={inputCls} value={ef.phone} onChange={(e) => setEf((p) => ({ ...p, phone: e.target.value }))} /></div>
              <div className="mb-4"><label className={fieldLabel}>Role</label>
                <select className={inputCls} value={ef.role} onChange={(e) => setEf((p) => ({ ...p, role: e.target.value }))}>
                  {STAFF_ROLES.map((r) => <option key={r} value={r}>{STAFF_ROLE_LABEL[r]}</option>)}
                </select>
              </div>
              <div className="mb-4"><label className={fieldLabel}>Status</label>
                <select className={inputCls} value={ef.status} onChange={(e) => setEf((p) => ({ ...p, status: e.target.value }))}>
                  {STAFF_STATUSES.map((s) => <option key={s} value={s}>{STAFF_STATUS_LABEL[s]}</option>)}
                </select>
              </div>
            </div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 pb-2 border-b border-slate-100">Specializations</div>
            <TileGrid options={[...SPECIALIZATION_OPTIONS]} labels={CATEGORY_LABEL} selected={ef.specializations} onChange={(specs) => setEf((p) => ({ ...p, specializations: specs }))} />
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
              <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-slate-200 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => closeModal("edit")}>Cancel</button>
              <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-matcha-600 text-white text-sm font-medium hover:bg-matcha-700 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed" disabled={busy} onClick={submitEdit}>
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {modal.del && (
        <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && closeModal("del")}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-slate-200 animate-[pop_0.14s_ease]">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
              <span className="text-base font-bold text-slate-900">Remove Staff</span>
              <button className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer" onClick={() => closeModal("del")}><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">Remove <strong className="text-slate-800">{target?.name}</strong> from this saloon?</p>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
              <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-slate-200 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => closeModal("del")}>Cancel</button>
              <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-red-500 text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed" disabled={busy} onClick={submitDel}>
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
