import { useState } from "react";
import { useOutletContext, useLoaderData } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { Plus, Pencil, Trash2, X, Check, ChevronDown, Clock, Tag } from "lucide-react";
import { apiFetch, ADMIN_API, COUNTRIES_API } from "~/lib/api";
import type { ServiceItem, StaffMember, Country, SaloonManageContext } from "~/lib/types";

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const id = params.saloonId!;
  const [services, staff, countries] = await Promise.all([
    apiFetch<ServiceItem[]>(`${ADMIN_API}/${id}/services`),
    apiFetch<StaffMember[]>(`${ADMIN_API}/${id}/staff`).catch((): StaffMember[] => []),
    apiFetch<Country[]>(COUNTRIES_API).catch((): Country[] => []),
  ]);
  return { services, staff, countries };
}

const CATEGORIES = ["HAIR","MAKEUP","NAILS","SKIN_CARE","BEARD","MASSAGE","WAXING","OTHER"] as const;
const CAT_LABEL: Record<string,string> = {
  HAIR:"Hair",MAKEUP:"Makeup",NAILS:"Nails",SKIN_CARE:"Skin Care",
  BEARD:"Beard",MASSAGE:"Massage",WAXING:"Waxing",OTHER:"Other",
};
const CAT_EMOJI: Record<string,string> = {
  HAIR:"✂️",MAKEUP:"💄",NAILS:"💅",SKIN_CARE:"🌿",BEARD:"🪒",MASSAGE:"💆",WAXING:"🕯️",OTHER:"✨",
};

interface CurrencyOption { code: string; name: string; symbol: string; }
function currenciesFromCountries(countries: Country[]): CurrencyOption[] {
  const seen = new Set<string>();
  return countries
    .filter((c) => c.currencyCode && c.currencyName && c.currencySymbol && !seen.has(c.currencyCode) && seen.add(c.currencyCode))
    .map((c) => ({ code: c.currencyCode, name: c.currencyName!, symbol: c.currencySymbol! }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

function formatPrice(price: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(price);
  } catch {
    return `${currency} ${price}`;
  }
}

const inp = "w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-stone-100 text-stone-900 outline-none focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 transition placeholder:text-stone-400";
const lbl = "block text-xs font-semibold text-stone-500 mb-1.5 uppercase tracking-wide";

type Mode = "view" | "add-step1" | "add-step2" | "edit";
const BLANK = { name:"", description:"", price:"", currency:"USD", durationMinutes:"60", category:"HAIR", active:true, assignedStaffIds:[] as string[] };

export default function SaloonServices() {
  const { saloon } = useOutletContext<SaloonManageContext>();
  const { services: initial, staff, countries } = useLoaderData<typeof clientLoader>();
  const [services, setServices] = useState<ServiceItem[]>(initial);
  const [mode, setMode] = useState<Mode>("view");
  const [editTarget, setEditTarget] = useState<ServiceItem | null>(null);
  const [category, setCategory] = useState("HAIR");
  const [form, setForm] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);

  const currencies = currenciesFromCountries(countries);

  function openAdd() { setForm({ ...BLANK }); setCategory("HAIR"); setErr(null); setMode("add-step1"); }
  function openEdit(s: ServiceItem) {
    setEditTarget(s);
    setForm({
      name: s.name, description: s.description ?? "", price: String(s.price), currency: s.currency,
      durationMinutes: String(s.durationMinutes), category: s.category, active: s.active,
      assignedStaffIds: s.assignedStaffIds ?? [],
    });
    setErr(null);
    setMode("edit");
  }
  function closeModal() { setMode("view"); setEditTarget(null); setErr(null); }

  function patchForm(patch: Partial<typeof form>) { setForm((f) => ({ ...f, ...patch })); }
  function toggleStaff(id: string) {
    patchForm({ assignedStaffIds: form.assignedStaffIds.includes(id) ? form.assignedStaffIds.filter((x) => x !== id) : [...form.assignedStaffIds, id] });
  }

  async function handleCreate() {
    if (!form.name.trim()) { setErr("Service name is required."); return; }
    setSaving(true); setErr(null);
    try {
      const created = await apiFetch<ServiceItem>(`${ADMIN_API}/${saloon.id}/services`, {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(), description: form.description.trim() || null,
          price: parseFloat(form.price) || 0, currency: form.currency,
          durationMinutes: parseInt(form.durationMinutes) || 60,
          category: form.category, active: true,
          assignedStaffIds: form.assignedStaffIds,
        }),
      });
      setServices((p) => [...p, created]);
      closeModal();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed to create"); }
    finally { setSaving(false); }
  }

  async function handleUpdate() {
    if (!editTarget || !form.name.trim()) { setErr("Service name is required."); return; }
    setSaving(true); setErr(null);
    try {
      const updated = await apiFetch<ServiceItem>(`${ADMIN_API}/${saloon.id}/services/${editTarget.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: form.name.trim(), description: form.description.trim() || null,
          price: parseFloat(form.price) || 0, currency: form.currency,
          durationMinutes: parseInt(form.durationMinutes) || 60,
          category: form.category, active: form.active,
          assignedStaffIds: form.assignedStaffIds,
        }),
      });
      setServices((p) => p.map((s) => (s.id === updated.id ? updated : s)));
      closeModal();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed to update"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    setDeleting(id); setErr(null);
    try {
      await apiFetch(`${ADMIN_API}/${saloon.id}/services/${id}`, { method: "DELETE" });
      setServices((p) => p.filter((s) => s.id !== id));
      setConfirmDel(null);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed to delete"); }
    finally { setDeleting(null); }
  }

  const grouped = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = services.filter((s) => s.category === cat);
    return acc;
  }, {} as Record<string, ServiceItem[]>);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Services</h1>
          <p className="text-xs text-stone-400 mt-0.5">{services.length} service{services.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-matcha-600 hover:bg-matcha-500 text-white text-sm font-semibold transition-colors cursor-pointer">
          <Plus className="w-4 h-4" /> Add Service
        </button>
      </div>

      {services.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <p className="text-stone-400 text-sm">No services yet. Add the first one.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {CATEGORIES.filter((cat) => grouped[cat].length > 0).map((cat) => (
            <div key={cat} className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-stone-200 bg-stone-100 flex items-center gap-2">
                <span className="text-base">{CAT_EMOJI[cat]}</span>
                <span className="text-xs font-bold uppercase tracking-widest text-stone-500">{CAT_LABEL[cat]}</span>
                <span className="ml-auto text-xs text-stone-400">{grouped[cat].length}</span>
              </div>
              <div className="divide-y divide-stone-200">
                {grouped[cat].map((s) => (
                  <div key={s.id} className={`flex items-center gap-4 px-4 py-3 ${!s.active ? "opacity-50" : ""}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-stone-800 truncate">{s.name}</p>
                      {s.description && <p className="text-xs text-stone-400 truncate mt-0.5">{s.description}</p>}
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-xs text-stone-500"><Clock className="w-3 h-3" />{s.durationMinutes}m</span>
                        <span className="flex items-center gap-1 text-xs text-matcha-500 font-semibold"><Tag className="w-3 h-3" />{formatPrice(s.price, s.currency)}</span>
                        {!s.active && <span className="text-[10px] text-stone-400 font-semibold uppercase tracking-wide">Inactive</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openEdit(s)} className="p-1.5 rounded-md text-stone-400 hover:text-matcha-500 hover:bg-stone-100 transition-colors cursor-pointer"><Pencil className="w-3.5 h-3.5" /></button>
                      {confirmDel === s.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(s.id)} disabled={deleting === s.id} className="p-1.5 rounded-md text-red-600 hover:bg-red-100 transition-colors cursor-pointer disabled:opacity-40"><Check className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setConfirmDel(null)} className="p-1.5 rounded-md text-stone-400 hover:text-stone-800 transition-colors cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDel(s.id)} className="p-1.5 rounded-md text-stone-400 hover:text-red-600 hover:bg-stone-100 transition-colors cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add step 1 – category picker */}
      {mode === "add-step1" && (
        <Modal title="Add Service — Choose category" onClose={closeModal}>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map((cat) => (
              <button key={cat} type="button" onClick={() => { setCategory(cat); patchForm({ category: cat }); setMode("add-step2"); }}
                className="flex items-center gap-2.5 px-4 py-3 rounded-lg border border-stone-200 bg-stone-100 hover:border-matcha-500 hover:bg-matcha-50 text-left transition-all cursor-pointer">
                <span className="text-xl">{CAT_EMOJI[cat]}</span>
                <span className="text-sm font-medium text-stone-800">{CAT_LABEL[cat]}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Add step 2 – details */}
      {mode === "add-step2" && (
        <Modal title={`Add Service — ${CAT_LABEL[category]}`} onClose={closeModal} footer={
          <ModalFooter onCancel={() => setMode("add-step1")} onConfirm={handleCreate} saving={saving} confirmLabel="Create" />
        }>
          <ServiceForm form={form} patchForm={patchForm} currencies={currencies} staff={staff} toggleStaff={toggleStaff} err={err} />
        </Modal>
      )}

      {/* Edit */}
      {mode === "edit" && (
        <Modal title="Edit Service" onClose={closeModal} footer={
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <button type="button" onClick={() => patchForm({ active: !form.active })}
                className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${form.active ? "bg-matcha-600" : "bg-stone-200"}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.active ? "translate-x-4" : "translate-x-0"}`} />
              </button>
              <span className="text-xs text-stone-500">{form.active ? "Active" : "Inactive"}</span>
            </label>
            <ModalFooter onCancel={closeModal} onConfirm={handleUpdate} saving={saving} confirmLabel="Save" />
          </div>
        }>
          <ServiceForm form={form} patchForm={patchForm} currencies={currencies} staff={staff} toggleStaff={toggleStaff} err={err} />
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose, footer }: { title: string; children: React.ReactNode; onClose: () => void; footer?: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-stone-900/40 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white border border-stone-200 rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 shrink-0">
          <h3 className="text-sm font-bold text-stone-900">{title}</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-800 cursor-pointer p-1"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-stone-200 shrink-0">{footer}</div>}
      </div>
    </div>
  );
}

function ModalFooter({ onCancel, onConfirm, saving, confirmLabel }: { onCancel: () => void; onConfirm: () => void; saving: boolean; confirmLabel: string }) {
  return (
    <div className="flex justify-end gap-2">
      <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-stone-200 text-sm text-stone-500 hover:text-stone-800 hover:border-stone-300 transition-colors cursor-pointer">Cancel</button>
      <button onClick={onConfirm} disabled={saving} className="px-4 py-2 rounded-lg bg-matcha-600 hover:bg-matcha-500 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50">{saving ? "Saving…" : confirmLabel}</button>
    </div>
  );
}

function ServiceForm({ form, patchForm, currencies, staff, toggleStaff, err }: {
  form: { name:string; description:string; price:string; currency:string; durationMinutes:string; assignedStaffIds:string[] };
  patchForm: (p: object) => void; currencies: CurrencyOption[]; staff: StaffMember[];
  toggleStaff: (id: string) => void; err: string | null;
}) {
  const inp = "w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-stone-100 text-stone-900 outline-none focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 transition placeholder:text-stone-400";
  const lbl = "block text-xs font-semibold text-stone-500 mb-1.5 uppercase tracking-wide";
  return (
    <>
      {err && <p className="text-red-600 text-xs px-3 py-2 bg-red-50 border border-red-200 rounded-lg">{err}</p>}
      <div>
        <label className={lbl}>Name <span className="text-red-500">*</span></label>
        <input className={inp} value={form.name} onChange={(e) => patchForm({ name: e.target.value })} placeholder="e.g. Men's Haircut" />
      </div>
      <div>
        <label className={lbl}>Description</label>
        <textarea rows={2} className={`${inp} resize-none`} value={form.description} onChange={(e) => patchForm({ description: e.target.value })} placeholder="Brief description…" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Price</label>
          <input type="number" min="0" step="0.01" className={inp} value={form.price} onChange={(e) => patchForm({ price: e.target.value })} placeholder="0.00" />
        </div>
        <div>
          <label className={lbl}>Currency</label>
          <div className="relative">
            <select value={form.currency} onChange={(e) => patchForm({ currency: e.target.value })} className={`${inp} appearance-none pr-8`}>
              {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} – {c.name}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none text-stone-400" />
          </div>
        </div>
      </div>
      <div>
        <label className={lbl}>Duration (minutes)</label>
        <input type="number" min="5" step="5" className={inp} value={form.durationMinutes} onChange={(e) => patchForm({ durationMinutes: e.target.value })} />
      </div>
      {staff.length > 0 && (
        <div>
          <label className={lbl}>Assigned staff</label>
          <div className="space-y-1.5">
            {staff.map((m) => {
              const sid = String(m.id);
              const on  = form.assignedStaffIds.includes(sid);
              return (
                <button key={m.id} type="button" onClick={() => toggleStaff(sid)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-all cursor-pointer ${on ? "bg-matcha-50 border-matcha-300" : "bg-stone-50 border-stone-200 hover:border-stone-300"}`}>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? "bg-matcha-600 border-indigo-500" : "border-stone-300"}`}>
                    {on && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <span className="text-sm text-stone-800">{m.name}</span>
                  <span className="text-xs text-stone-400 ml-auto">{m.role}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
