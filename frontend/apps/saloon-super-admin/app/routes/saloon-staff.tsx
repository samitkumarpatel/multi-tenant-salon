import { useState } from "react";
import { useOutletContext, useLoaderData } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { Plus, Pencil, Trash2, X, Check, Crown, ChevronDown } from "lucide-react";
import { apiFetch, ADMIN_API } from "~/lib/api";
import type { StaffMember, SaloonManageContext } from "~/lib/types";

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const staff = await apiFetch<StaffMember[]>(`${ADMIN_API}/${params.saloonId!}/staff`);
  return { staff };
}

const ROLES = ["MANAGER","STYLIST","COLORIST","MAKEUP_ARTIST","NAIL_TECHNICIAN","RECEPTIONIST","ASSISTANT"] as const;
const ROLE_LABEL: Record<string,string> = {
  MANAGER:"Manager",STYLIST:"Stylist",COLORIST:"Colorist",MAKEUP_ARTIST:"Makeup Artist",
  NAIL_TECHNICIAN:"Nail Tech",RECEPTIONIST:"Receptionist",ASSISTANT:"Assistant",
};
const STATUSES = ["ACTIVE","INACTIVE","ON_LEAVE"] as const;
const STATUS_LABEL: Record<string,string> = { ACTIVE:"Active",INACTIVE:"Inactive",ON_LEAVE:"On Leave" };
const STATUS_DOT: Record<string,string>   = { ACTIVE:"bg-emerald-500",INACTIVE:"bg-stone-400",ON_LEAVE:"bg-amber-500" };

const SPECIALIZATIONS = ["HAIR","MAKEUP","NAILS","SKIN_CARE","BEARD","MASSAGE","WAXING","OTHER"] as const;
const SPEC_LABEL: Record<string,string> = {
  HAIR:"Hair",MAKEUP:"Makeup",NAILS:"Nails",SKIN_CARE:"Skin Care",
  BEARD:"Beard",MASSAGE:"Massage",WAXING:"Waxing",OTHER:"Other",
};

const inp = "w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-stone-100 text-stone-900 outline-none focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 transition placeholder:text-stone-400";
const lbl = "block text-xs font-semibold text-stone-500 mb-1.5 uppercase tracking-wide";

const BLANK = { name:"",email:"",phone:"",role:"STYLIST",status:"ACTIVE",availableForBooking:true,specializations:[] as string[],bio:"" };

export default function SaloonStaff() {
  const { saloon } = useOutletContext<SaloonManageContext>();
  const { staff: initial } = useLoaderData<typeof clientLoader>();
  const [staff, setStaff] = useState<StaffMember[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const patch = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));
  function toggleSpec(s: string) {
    patch({ specializations: form.specializations.includes(s) ? form.specializations.filter((x) => x !== s) : [...form.specializations, s] });
  }

  function openAdd() { setForm({ ...BLANK }); setEditTarget(null); setErr(null); setShowForm(true); }
  function openEdit(m: StaffMember) {
    setEditTarget(m);
    setForm({
      name: m.name, email: m.email, phone: m.phone ?? "", role: m.role,
      status: m.status, availableForBooking: m.availableForBooking ?? true,
      specializations: m.specializations ?? [], bio: m.bio ?? "",
    });
    setErr(null);
    setShowForm(true);
  }
  function close() { setShowForm(false); setEditTarget(null); setErr(null); }

  async function handleSave() {
    if (!form.name.trim() || !form.email.trim()) { setErr("Name and email are required."); return; }
    setSaving(true); setErr(null);
    try {
      const body = {
        name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || null,
        role: form.role, status: form.status, availableForBooking: form.availableForBooking,
        specializations: form.specializations, bio: form.bio.trim() || null,
      };
      if (editTarget) {
        const updated = await apiFetch<StaffMember>(`${ADMIN_API}/${saloon.id}/staff/${editTarget.id}`, { method:"PUT", body: JSON.stringify(body) });
        setStaff((p) => p.map((m) => (m.id === updated.id ? updated : m)));
      } else {
        const created = await apiFetch<StaffMember>(`${ADMIN_API}/${saloon.id}/staff`, { method:"POST", body: JSON.stringify(body) });
        setStaff((p) => [...p, created]);
      }
      close();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed to save"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    setDeleting(id);
    try {
      await apiFetch(`${ADMIN_API}/${saloon.id}/staff/${id}`, { method: "DELETE" });
      setStaff((p) => p.filter((m) => m.id !== id));
      setConfirmDel(null);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed to delete"); }
    finally { setDeleting(null); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Staff</h1>
          <p className="text-xs text-stone-400 mt-0.5">{staff.length} team member{staff.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-matcha-600 hover:bg-matcha-500 text-white text-sm font-semibold transition-colors cursor-pointer">
          <Plus className="w-4 h-4" /> Add Staff
        </button>
      </div>

      {staff.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-stone-400 text-sm">No staff members yet.</p>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <div className="divide-y divide-stone-200">
            {staff.map((m) => (
              <div key={m.id} className="flex items-center gap-4 px-4 py-3">
                <div className="w-9 h-9 rounded-full bg-matcha-50 border border-matcha-200 flex items-center justify-center text-sm font-bold text-matcha-600 shrink-0">
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-stone-800 truncate">{m.name}</p>
                    {m.isOwner && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-stone-400">{ROLE_LABEL[m.role] ?? m.role}</span>
                    <span className="text-stone-300">·</span>
                    <span className={`inline-flex items-center gap-1 text-xs text-stone-500`}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[m.status] ?? "bg-stone-400"}`} />
                      {STATUS_LABEL[m.status] ?? m.status}
                    </span>
                  </div>
                  {m.specializations && m.specializations.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {m.specializations.map((s) => (
                        <span key={s} className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-stone-100 border border-stone-200 text-stone-500">{SPEC_LABEL[s] ?? s}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(m)} className="p-1.5 rounded-md text-stone-400 hover:text-matcha-500 hover:bg-stone-100 transition-colors cursor-pointer"><Pencil className="w-3.5 h-3.5" /></button>
                  {!m.isOwner && (
                    confirmDel === m.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDelete(m.id)} disabled={deleting === m.id} className="p-1.5 rounded-md text-red-600 hover:bg-red-100 cursor-pointer disabled:opacity-40"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setConfirmDel(null)} className="p-1.5 rounded-md text-stone-400 hover:text-stone-800 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDel(m.id)} className="p-1.5 rounded-md text-stone-400 hover:text-red-600 hover:bg-stone-100 transition-colors cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-stone-900/40 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && close()}>
          <div className="bg-white border border-stone-200 rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 shrink-0">
              <h3 className="text-sm font-bold text-stone-900">{editTarget ? "Edit Staff Member" : "Add Staff Member"}</h3>
              <button onClick={close} className="text-stone-400 hover:text-stone-800 cursor-pointer p-1"><X className="w-4 h-4" /></button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
              {err && <p className="text-red-600 text-xs px-3 py-2 bg-red-50 border border-red-200 rounded-lg">{err}</p>}
              <div>
                <label className={lbl}>Full name <span className="text-red-500">*</span></label>
                <input className={inp} value={form.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Jane Smith" />
              </div>
              <div>
                <label className={lbl}>Email <span className="text-red-500">*</span></label>
                <input type="email" className={inp} value={form.email} onChange={(e) => patch({ email: e.target.value })} placeholder="jane@saloon.com" />
              </div>
              <div>
                <label className={lbl}>Phone</label>
                <input type="tel" className={inp} value={form.phone} onChange={(e) => patch({ phone: e.target.value })} placeholder="+1 555 000 0000" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Role</label>
                  <div className="relative">
                    <select value={form.role} onChange={(e) => patch({ role: e.target.value })} className={`${inp} appearance-none pr-8`}>
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none text-stone-400" />
                  </div>
                </div>
                {editTarget && (
                  <div>
                    <label className={lbl}>Status</label>
                    <div className="relative">
                      <select value={form.status} onChange={(e) => patch({ status: e.target.value })} className={`${inp} appearance-none pr-8`}>
                        {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none text-stone-400" />
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className={lbl}>Specializations</label>
                <div className="flex flex-wrap gap-1.5">
                  {SPECIALIZATIONS.map((s) => {
                    const on = form.specializations.includes(s);
                    return (
                      <button key={s} type="button" onClick={() => toggleSpec(s)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium cursor-pointer transition-all ${on ? "bg-matcha-50 border-matcha-300 text-matcha-600" : "bg-stone-100 border-stone-200 text-stone-500 hover:border-stone-300"}`}>
                        {on && <Check className="w-3 h-3" />} {SPEC_LABEL[s]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className={lbl}>Bio</label>
                <textarea rows={2} className={`${inp} resize-none`} value={form.bio} onChange={(e) => patch({ bio: e.target.value })} placeholder="Brief bio…" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <button type="button" onClick={() => patch({ availableForBooking: !form.availableForBooking })}
                  className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${form.availableForBooking ? "bg-matcha-600" : "bg-stone-200"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.availableForBooking ? "translate-x-4" : "translate-x-0"}`} />
                </button>
                <span className="text-sm text-stone-600">Available for booking</span>
              </label>
            </div>
            <div className="px-5 py-4 border-t border-stone-200 shrink-0 flex justify-end gap-2">
              <button onClick={close} className="px-4 py-2 rounded-lg border border-stone-200 text-sm text-stone-500 hover:text-stone-800 hover:border-stone-300 transition-colors cursor-pointer">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg bg-matcha-600 hover:bg-matcha-500 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50">{saving ? "Saving…" : editTarget ? "Save" : "Add"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
