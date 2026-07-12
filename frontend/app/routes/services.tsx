import { useState, useRef } from "react";
import { useLoaderData, useOutletContext } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { Plus, Pencil, Trash2, X, Users, Scissors } from "lucide-react";
import { API, apiFetch } from "~/lib/api";
import {
  SERVICE_CATEGORIES, CATEGORY_LABEL, formatPrice, toggleList,
} from "~/lib/constants";
import type { LayoutContext, StaffMember, ServiceItem } from "~/lib/types";
import TileGrid from "~/components/TileGrid";
import InfoBar from "~/components/InfoBar";

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const sid = params.saloonId!;
  const [services, staff] = await Promise.all([
    apiFetch<ServiceItem[]>(`${API}/${sid}/services`),
    apiFetch<StaffMember[]>(`${API}/${sid}/staff`),
  ]);
  return { services, staff };
}

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-md text-sm outline-none transition-[border-color,box-shadow] focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 bg-white text-slate-900 font-sans";
const fieldLabel = "block text-sm font-medium text-slate-700 mb-1";

export default function Services() {
  const { saloon } = useOutletContext<LayoutContext>();
  const { services: init, staff } = useLoaderData<typeof clientLoader>();
  const [services, setServices] = useState<ServiceItem[]>(init);
  const [busy,     setBusy]     = useState(false);
  const [toast,    setToast]    = useState<{ msg: string; type: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [target, setTarget] = useState<ServiceItem | null>(null);
  const [modal,  setModal]  = useState({ add: false, edit: false, del: false });

  const blankSvc = () => ({ name: "", description: "", price: "", currency: "USD", durationMinutes: 30, category: "HAIR", assignedStaffIds: [] as string[] });
  const [af, setAf] = useState(blankSvc());
  const [ef, setEf] = useState({ name: "", description: "", price: "", currency: "USD", durationMinutes: 30, category: "HAIR", active: true, assignedStaffIds: [] as string[] });

  const sid = saloon.id;

  function notify(msg: string, type = "success") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  function closeModal(k: keyof typeof modal) { setModal((m) => ({ ...m, [k]: false })); }
  function openAdd() { setAf(blankSvc()); setModal((m) => ({ ...m, add: true })); }

  function openEdit(item: ServiceItem) {
    setTarget(item);
    setEf({ name: item.name, description: item.description ?? "", price: String(item.price), currency: item.currency ?? "USD", durationMinutes: item.durationMinutes, category: item.category, active: item.active, assignedStaffIds: [...(item.assignedStaffIds ?? [])] });
    setModal((m) => ({ ...m, edit: true }));
  }

  function openDel(item: ServiceItem) { setTarget(item); setModal((m) => ({ ...m, del: true })); }

  async function submitAdd() {
    if (!af.name || !af.price) return;
    setBusy(true);
    try {
      const item = await apiFetch<ServiceItem>(`${API}/${sid}/services`, {
        method: "POST",
        body: JSON.stringify({ name: af.name, description: af.description, price: parseFloat(af.price), currency: af.currency, durationMinutes: af.durationMinutes, category: af.category, assignedStaffIds: af.assignedStaffIds }),
      });
      setServices((p) => [item, ...p]);
      closeModal("add");
      notify(`"${item.name}" added!`);
    } catch (e) { notify(e instanceof Error ? e.message : "Error", "error"); }
    finally { setBusy(false); }
  }

  async function submitEdit() {
    if (!target) return;
    setBusy(true);
    try {
      const updated = await apiFetch<ServiceItem>(`${API}/${sid}/services/${target.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: ef.name, description: ef.description, price: parseFloat(ef.price), currency: ef.currency, durationMinutes: ef.durationMinutes, category: ef.category, active: ef.active, assignedStaffIds: ef.assignedStaffIds }),
      });
      setServices((p) => p.map((s) => s.id === updated.id ? updated : s));
      closeModal("edit");
      notify(`"${updated.name}" updated!`);
    } catch (e) { notify(e instanceof Error ? e.message : "Error", "error"); }
    finally { setBusy(false); }
  }

  async function submitDel() {
    if (!target) return;
    setBusy(true);
    try {
      await apiFetch(`${API}/${sid}/services/${target.id}`, { method: "DELETE" });
      const name = target.name;
      setServices((p) => p.filter((s) => s.id !== target.id));
      closeModal("del");
      notify(`"${name}" removed.`);
    } catch (e) { notify(e instanceof Error ? e.message : "Error", "error"); }
    finally { setBusy(false); }
  }

  function staffName(id: string) { return staff.find((m) => m.id.toString() === id)?.name ?? id; }

  const StaffToggle = ({ ids, onChange }: { ids: string[]; onChange: (ids: string[]) => void }) =>
    staff.length > 0 ? (
      <>
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-4 mb-2 pb-2 border-b border-slate-100">
          Assign Staff
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-1.5 max-h-[150px] overflow-y-auto">
          {staff.map((m) => {
            const on = ids.includes(m.id.toString());
            return (
              <div
                key={m.id}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border cursor-pointer transition-colors select-none ${on ? "border-matcha-400 bg-matcha-50" : "border-slate-200 bg-white hover:border-matcha-300 hover:bg-matcha-50/50"}`}
                onClick={() => onChange(toggleList(ids, m.id.toString()))}
              >
                <div className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 transition-colors ${on ? "bg-matcha-600 border-matcha-600" : "border border-slate-300"}`}>
                  {on && <span className="text-white text-[8px] font-bold">✓</span>}
                </div>
                <span className="text-xs font-medium text-slate-700 truncate">{m.name}</span>
              </div>
            );
          })}
        </div>
      </>
    ) : null;

  return (
    <>
      <div className="mb-6 space-y-2">
        <h1 className="text-xl font-bold text-slate-900">Services</h1>
        <InfoBar>
          Define everything your saloon offers — set the name, price, duration, category, and which staff member performs each service. Customers see these on your public website.
        </InfoBar>
      </div>

      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-slate-500 font-medium">
          {services.length} service{services.length !== 1 ? "s" : ""}
        </span>
        <button
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-matcha-600 text-white text-sm font-medium hover:bg-matcha-700 transition-colors cursor-pointer"
          onClick={openAdd}
        >
          <Plus className="w-4 h-4" /> Add Service
        </button>
      </div>

      {!services.length ? (
        <div className="text-center py-20 px-8">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Scissors className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-sm font-semibold text-slate-500 mb-1">No services yet</h3>
          <p className="text-xs text-slate-400">Add services like haircut, makeup, and more.</p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
          {services.map((sv) => (
            <div key={sv.id} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col hover:shadow-md transition-shadow">
              <div className="flex items-start gap-2 flex-wrap">
                <span className="text-sm font-bold text-slate-900">{sv.name}</span>
                {!sv.active && (
                  <span className="text-[0.6rem] font-semibold px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">Inactive</span>
                )}
              </div>
              <span className="inline-block mt-1.5 text-[0.62rem] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wide self-start">
                {CATEGORY_LABEL[sv.category] ?? sv.category}
              </span>
              <div className="text-2xl font-extrabold text-matcha-600 mt-3 tracking-tight">{formatPrice(sv.price, sv.currency)}</div>
              <div className="text-xs text-slate-400 mt-0.5">{sv.durationMinutes} min</div>
              {sv.description && <div className="text-xs text-slate-500 mt-2 leading-relaxed">{sv.description}</div>}
              {sv.assignedStaffIds?.length ? (
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-2">
                  <Users className="w-3 h-3" />
                  {sv.assignedStaffIds.map(staffName).join(", ")}
                </div>
              ) : null}
              <div className="flex gap-2 mt-auto pt-3 border-t border-slate-100">
                <button
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => openEdit(sv)}
                >
                  <Pencil className="w-3 h-3" /> Edit
                </button>
                <button
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-red-200 text-xs font-medium text-red-600 bg-white hover:bg-red-50 transition-colors cursor-pointer ml-auto"
                  onClick={() => openDel(sv)}
                >
                  <Trash2 className="w-3 h-3" /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add modal */}
      {modal.add && (
        <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && closeModal("add")}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto animate-[pop_0.14s_ease]">
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100">
              <span className="text-base font-bold text-slate-900">Add Service</span>
              <button className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer" onClick={() => closeModal("add")}><X className="w-5 h-5" /></button>
            </div>
            <div className="mb-4"><label className={fieldLabel}>Name <span className="text-red-500">*</span></label><input className={inputCls} value={af.name} onChange={(e) => setAf((p) => ({ ...p, name: e.target.value }))} /></div>
            <div className="mb-4"><label className={fieldLabel}>Description</label><input className={inputCls} value={af.description} onChange={(e) => setAf((p) => ({ ...p, description: e.target.value }))} /></div>
            <div className="mb-4"><label className={fieldLabel}>Category</label>
              <select className={inputCls} value={af.category} onChange={(e) => setAf((p) => ({ ...p, category: e.target.value }))}>
                {SERVICE_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="mb-4"><label className={fieldLabel}>Price <span className="text-red-500">*</span></label><input className={inputCls} type="number" min="0" step="0.01" value={af.price} onChange={(e) => setAf((p) => ({ ...p, price: e.target.value }))} /></div>
              <div className="mb-4"><label className={fieldLabel}>Currency</label><input className={inputCls} value={af.currency} maxLength={3} onChange={(e) => setAf((p) => ({ ...p, currency: e.target.value }))} /></div>
              <div className="mb-4"><label className={fieldLabel}>Duration (min)</label><input className={inputCls} type="number" min="5" step="5" value={af.durationMinutes} onChange={(e) => setAf((p) => ({ ...p, durationMinutes: parseInt(e.target.value) || 30 }))} /></div>
            </div>
            <StaffToggle ids={af.assignedStaffIds} onChange={(ids) => setAf((p) => ({ ...p, assignedStaffIds: ids }))} />
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
              <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-slate-200 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => closeModal("add")}>Cancel</button>
              <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-matcha-600 text-white text-sm font-medium hover:bg-matcha-700 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed" disabled={busy || !af.name || !af.price} onClick={submitAdd}>
                {busy ? "Saving…" : <><Plus className="w-3.5 h-3.5" /> Add Service</>}
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
              <span className="text-base font-bold text-slate-900">Edit Service</span>
              <button className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer" onClick={() => closeModal("edit")}><X className="w-5 h-5" /></button>
            </div>
            <div className="mb-4"><label className={fieldLabel}>Name</label><input className={inputCls} value={ef.name} onChange={(e) => setEf((p) => ({ ...p, name: e.target.value }))} /></div>
            <div className="mb-4"><label className={fieldLabel}>Description</label><input className={inputCls} value={ef.description} onChange={(e) => setEf((p) => ({ ...p, description: e.target.value }))} /></div>
            <div className="mb-4"><label className={fieldLabel}>Category</label>
              <select className={inputCls} value={ef.category} onChange={(e) => setEf((p) => ({ ...p, category: e.target.value }))}>
                {SERVICE_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="mb-4"><label className={fieldLabel}>Price</label><input className={inputCls} type="number" min="0" step="0.01" value={ef.price} onChange={(e) => setEf((p) => ({ ...p, price: e.target.value }))} /></div>
              <div className="mb-4"><label className={fieldLabel}>Currency</label><input className={inputCls} value={ef.currency} maxLength={3} onChange={(e) => setEf((p) => ({ ...p, currency: e.target.value }))} /></div>
              <div className="mb-4"><label className={fieldLabel}>Duration (min)</label><input className={inputCls} type="number" min="5" step="5" value={ef.durationMinutes} onChange={(e) => setEf((p) => ({ ...p, durationMinutes: parseInt(e.target.value) || 30 }))} /></div>
            </div>
            <label className="flex items-center gap-2.5 mb-4 cursor-pointer select-none group">
              <input type="checkbox" className="w-4 h-4 accent-matcha-600 cursor-pointer" checked={ef.active} onChange={(e) => setEf((p) => ({ ...p, active: e.target.checked }))} />
              <span className="text-sm font-medium text-slate-700">Active</span>
            </label>
            <StaffToggle ids={ef.assignedStaffIds} onChange={(ids) => setEf((p) => ({ ...p, assignedStaffIds: ids }))} />
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
              <span className="text-base font-bold text-slate-900">Remove Service</span>
              <button className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer" onClick={() => closeModal("del")}><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">Remove <strong className="text-slate-800">{target?.name}</strong> from the catalog?</p>
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
