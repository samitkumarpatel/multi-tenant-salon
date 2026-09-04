import { useState } from "react";
import { useLoaderData, useOutletContext } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { ADMIN_API, apiFetch, resolveSalonUUID } from "~/lib/api";
import { Toast, useToast } from "@salon/ui-shared";
import { Modal, ModalActions } from "~/components/ShopModal";
import type { ShopCategory } from "~/lib/types";
import type { ShopOutletContext } from "./shop";

const inputCls =
  "w-full px-3 py-2 border border-slate-200 rounded-md text-sm outline-none transition-[border-color,box-shadow] focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 bg-white text-slate-900";
const fieldLabel = "block text-sm font-medium text-slate-700 mb-1";

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const sid = await resolveSalonUUID(params.salonId!);
  const categories = await apiFetch<ShopCategory[]>(`${ADMIN_API}/${sid}/shop/categories`);
  return { sid, categories };
}

interface FormFields {
  name: string;
  description: string;
  active: boolean;
}
const blank = (): FormFields => ({ name: "", description: "", active: true });

export default function ShopCategories() {
  useOutletContext<ShopOutletContext>();
  const { sid, categories: init } = useLoaderData<typeof clientLoader>();
  const [categories, setCategories] = useState<ShopCategory[]>(init);
  const [busy, setBusy] = useState(false);
  const { toast, notify } = useToast();
  const [target, setTarget] = useState<ShopCategory | null>(null);
  const [modal, setModal] = useState<{ kind: "add" | "edit" | "del" } | null>(null);
  const [f, setF] = useState<FormFields>(blank());

  const close = () => setModal(null);
  function openAdd() {
    setF(blank());
    setModal({ kind: "add" });
  }
  function openEdit(c: ShopCategory) {
    setTarget(c);
    setF({ name: c.name, description: c.description ?? "", active: c.active });
    setModal({ kind: "edit" });
  }
  function openDel(c: ShopCategory) {
    setTarget(c);
    setModal({ kind: "del" });
  }

  async function submitAdd() {
    if (!f.name.trim()) return;
    setBusy(true);
    try {
      const created = await apiFetch<ShopCategory>(`${ADMIN_API}/${sid}/shop/categories`, {
        method: "POST",
        body: JSON.stringify({ name: f.name.trim(), description: f.description || null }),
      });
      setCategories((p) => [...p, created].sort((a, b) => a.name.localeCompare(b.name)));
      close();
      notify(`"${created.name}" added`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Error", "error");
    } finally {
      setBusy(false);
    }
  }

  async function submitEdit() {
    if (!target || !f.name.trim()) return;
    setBusy(true);
    try {
      const updated = await apiFetch<ShopCategory>(`${ADMIN_API}/${sid}/shop/categories/${target.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: f.name.trim(), description: f.description || null, active: f.active }),
      });
      setCategories((p) => p.map((c) => (c.id === updated.id ? updated : c)));
      close();
      notify(`"${updated.name}" updated`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Error", "error");
    } finally {
      setBusy(false);
    }
  }

  async function submitDel() {
    if (!target) return;
    setBusy(true);
    try {
      await apiFetch(`${ADMIN_API}/${sid}/shop/categories/${target.id}`, { method: "DELETE" });
      const name = target.name;
      setCategories((p) => p.filter((c) => c.id !== target.id));
      close();
      notify(`"${name}" removed`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Error", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {categories.length === 0 ? (
        <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
          <div className="w-10 h-10 rounded-xl bg-matcha-50 border border-matcha-100 flex items-center justify-center mx-auto mb-3">
            <Layers className="w-5 h-5 text-matcha-600" />
          </div>
          <h2 className="text-sm font-bold text-slate-800">No categories yet</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">Organise the shop so customers can browse by type.</p>
          <button
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-matcha-600 text-white text-sm font-medium hover:bg-matcha-700 cursor-pointer"
            onClick={openAdd}
          >
            <Plus className="w-4 h-4" /> Add Category
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm divide-y divide-slate-100">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors group">
              <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900 truncate">{c.name}</span>
                  {!c.active && (
                    <span className="text-[0.6rem] font-semibold px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">
                      Inactive
                    </span>
                  )}
                </div>
                {c.description && <p className="text-xs text-slate-400 truncate max-w-md">{c.description}</p>}
              </div>
              <div className="shrink-0 flex items-center gap-1.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 cursor-pointer"
                  onClick={() => openEdit(c)}
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-red-200 text-xs font-medium text-red-600 bg-white hover:bg-red-50 cursor-pointer"
                  onClick={() => openDel(c)}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
          <div className="flex justify-end px-4 py-3 bg-slate-50/60 border-t border-slate-100">
            <button
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-matcha-600 text-white text-sm font-medium hover:bg-matcha-700 cursor-pointer"
              onClick={openAdd}
            >
              <Plus className="w-4 h-4" /> Add Category
            </button>
          </div>
        </div>
      )}

      {modal && modal.kind !== "del" && (
        <Modal title={modal.kind === "add" ? "Add Category" : "Edit Category"} onClose={close}>
          <div className="mb-4">
            <label className={fieldLabel}>
              Name <span className="text-red-500">*</span>
            </label>
            <input autoFocus className={inputCls} value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="mb-4">
            <label className={fieldLabel}>Description</label>
            <input
              className={inputCls}
              value={f.description}
              onChange={(e) => setF((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
          {modal.kind === "edit" && (
            <label className="flex items-center gap-2.5 mb-4 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4 accent-matcha-600 cursor-pointer"
                checked={f.active}
                onChange={(e) => setF((p) => ({ ...p, active: e.target.checked }))}
              />
              <span className="text-sm font-medium text-slate-700">Active</span>
            </label>
          )}
          <ModalActions
            busy={busy}
            onCancel={close}
            onSave={modal.kind === "add" ? submitAdd : submitEdit}
            saveLabel={modal.kind === "add" ? "Add" : "Save changes"}
          />
        </Modal>
      )}

      {modal?.kind === "del" && (
        <Modal title="Remove Category" onClose={close} narrow>
          <p className="text-sm text-slate-600 leading-relaxed">
            Remove <strong className="text-slate-800">{target?.name}</strong>? Products keep their other details; their
            category is simply cleared.
          </p>
          <ModalActions busy={busy} onCancel={close} onSave={submitDel} saveLabel="Remove" danger />
        </Modal>
      )}

      <Toast toast={toast} />
    </>
  );
}
