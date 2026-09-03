import { useEffect, useState } from "react";
import { useLoaderData, useOutletContext } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { ImagePlus, LayoutGrid, List, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { ADMIN_API, COUNTRIES_API, apiFetch, resolveSalonUUID, uploadToPresignedUrl } from "~/lib/api";
import { formatPrice } from "~/lib/constants";
import { Toast, useToast } from "@salon/ui-shared";
import { Modal, ModalActions } from "~/components/ShopModal";
import type { Country, ShopBrand, ShopCategory, ShopProduct } from "~/lib/types";
import type { ShopOutletContext } from "./shop";

const inputCls =
  "w-full px-3 py-2 border border-slate-200 rounded-md text-sm outline-none transition-[border-color,box-shadow] focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 bg-white text-slate-900";
const fieldLabel = "block text-sm font-medium text-slate-700 mb-1";

const UNITS = ["", "ml", "L", "g", "kg", "oz", "fl oz", "lb", "pcs", "pack", "set", "pair", "unit", "tablet", "capsule", "sachet"];

interface PresignedUpload {
  presignedUrl: string;
  publicUrl: string;
}

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const sid = await resolveSalonUUID(params.salonId!);
  const [products, brands, categories, countries] = await Promise.all([
    apiFetch<ShopProduct[]>(`${ADMIN_API}/${sid}/shop/products`),
    apiFetch<ShopBrand[]>(`${ADMIN_API}/${sid}/shop/brands`).catch((): ShopBrand[] => []),
    apiFetch<ShopCategory[]>(`${ADMIN_API}/${sid}/shop/categories`).catch((): ShopCategory[] => []),
    apiFetch<Country[]>(COUNTRIES_API).catch((): Country[] => []),
  ]);
  return { sid, products, brands, categories, countries };
}

interface VariantRow {
  id?: number;
  labelValue: string;
  labelUnit: string;
  skuManual: boolean;
  sku: string;
  price: string;
  compareAtPrice: string;
  currency: string;
  quantityOnHand: string;
  reorderLevel: string;
  active: boolean;
}

interface ProductForm {
  name: string;
  description: string;
  brandId: string;
  categoryId: string;
  imageUrl: string;
  active: boolean;
  variants: VariantRow[];
}

function splitLabel(label: string): { labelValue: string; labelUnit: string } {
  if (!label) return { labelValue: "", labelUnit: "" };
  const unitPat = UNITS.filter(Boolean).map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const m = label.trim().match(new RegExp(`^(.+?)\\s+(${unitPat})$`, "i"));
  if (m) return { labelValue: m[1].trim(), labelUnit: m[2].toLowerCase() };
  return { labelValue: label, labelUnit: "" };
}

function genSku(name: string, brandName: string, categoryName: string, labelValue: string): string {
  const slug = (s: string) => s.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
  const parts = [brandName, categoryName, name].map(slug).filter(Boolean);
  const digits = labelValue.replace(/[^0-9]/g, "").slice(0, 4);
  if (digits) parts.push(digits);
  return parts.join("-");
}

const blankVariant = (currency = "USD"): VariantRow => ({
  labelValue: "", labelUnit: "", sku: "", skuManual: false,
  price: "", compareAtPrice: "", currency, quantityOnHand: "0", reorderLevel: "2", active: true,
});

const blankForm = (currency = "USD"): ProductForm => ({
  name: "", description: "", brandId: "", categoryId: "", imageUrl: "", active: true,
  variants: [blankVariant(currency)],
});

function priceRange(p: ShopProduct): string {
  const prices = p.variants.map((v) => v.price).filter((n) => typeof n === "number");
  if (prices.length === 0) return "—";
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const currency = p.variants[0]?.currency ?? "USD";
  return min === max ? formatPrice(min, currency) : `${formatPrice(min, currency)} – ${formatPrice(max, currency)}`;
}

function toRows(p: ShopProduct): VariantRow[] {
  if (p.variants.length === 0) return [blankVariant()];
  return p.variants.map((v) => {
    const { labelValue, labelUnit } = splitLabel(v.label ?? "");
    return {
      id: v.id,
      labelValue,
      labelUnit,
      sku: v.sku ?? "",
      skuManual: !!(v.sku),
      price: v.price != null ? String(v.price) : "",
      compareAtPrice: v.compareAtPrice != null ? String(v.compareAtPrice) : "",
      currency: v.currency ?? "USD",
      quantityOnHand: String(v.quantityOnHand ?? 0),
      reorderLevel: String(v.reorderLevel ?? 2),
      active: v.active,
    };
  });
}

function buildPayload(f: ProductForm) {
  return {
    name: f.name.trim(),
    description: f.description || null,
    brandId: f.brandId ? Number(f.brandId) : null,
    categoryId: f.categoryId ? Number(f.categoryId) : null,
    imageUrl: f.imageUrl || null,
    active: f.active,
    variants: f.variants.map((v) => {
      const labelParts = [v.labelValue.trim(), v.labelUnit.trim()].filter(Boolean);
      return {
        id: v.id ?? null,
        label: labelParts.join(" ") || null,
        sku: v.sku || null,
        price: v.price ? parseFloat(v.price) : 0,
        compareAtPrice: v.compareAtPrice ? parseFloat(v.compareAtPrice) : null,
        currency: (v.currency || "USD").toUpperCase(),
        quantityOnHand: v.quantityOnHand ? parseInt(v.quantityOnHand, 10) : 0,
        reorderLevel: v.reorderLevel ? parseInt(v.reorderLevel, 10) : 2,
        active: v.active,
      };
    }),
  };
}

export default function ShopProducts() {
  const { salon } = useOutletContext<ShopOutletContext>();
  const { sid, products: init, brands: initBrands, categories: initCategories, countries } =
    useLoaderData<typeof clientLoader>();

  const salonCurrency = (() => {
    const cc = salon.location?.country;
    if (!cc || !countries.length) return "USD";
    return countries.find((c) => c.code === cc)?.currencyCode ?? "USD";
  })();

  const [products, setProducts] = useState<ShopProduct[]>(init);
  const [brands, setBrands] = useState<ShopBrand[]>(initBrands);
  const [categories, setCategories] = useState<ShopCategory[]>(initCategories);
  const [view, setView] = useState<"list" | "card">("list");
  const [busy, setBusy] = useState(false);
  const { toast, notify } = useToast();
  const [target, setTarget] = useState<ShopProduct | null>(null);
  const [modal, setModal] = useState<{ kind: "add" | "edit" | "del" } | null>(null);
  const [f, setF] = useState<ProductForm>(blankForm(salonCurrency));
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Inline brand/category creation state
  const [newBrandName, setNewBrandName] = useState("");
  const [showNewBrand, setShowNewBrand] = useState(false);
  const [creatingBrand, setCreatingBrand] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);
  const [creatingCat, setCreatingCat] = useState(false);

  const brandName = (id?: number | null) => brands.find((b) => b.id === id)?.name ?? "";
  const categoryName = (id?: number | null) => categories.find((c) => c.id === id)?.name ?? "";

  // Auto-regenerate SKU for variants that haven't been manually edited
  useEffect(() => {
    const bName = brandName(f.brandId ? Number(f.brandId) : null);
    const cName = categoryName(f.categoryId ? Number(f.categoryId) : null);
    setF((prev) => ({
      ...prev,
      variants: prev.variants.map((v) =>
        v.skuManual ? v : { ...v, sku: genSku(prev.name, bName, cName, v.labelValue) }
      ),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.name, f.brandId, f.categoryId]);

  const close = () => {
    setModal(null);
    setImageFile(null);
    setShowNewBrand(false);
    setNewBrandName("");
    setShowNewCat(false);
    setNewCatName("");
  };

  function openAdd() {
    setF(blankForm(salonCurrency));
    setImageFile(null);
    setShowNewBrand(false);
    setNewBrandName("");
    setShowNewCat(false);
    setNewCatName("");
    setModal({ kind: "add" });
  }
  function openEdit(p: ShopProduct) {
    setTarget(p);
    setF({
      name: p.name,
      description: p.description ?? "",
      brandId: p.brandId != null ? String(p.brandId) : "",
      categoryId: p.categoryId != null ? String(p.categoryId) : "",
      imageUrl: p.imageUrl ?? "",
      active: p.active,
      variants: toRows(p),
    });
    setImageFile(null);
    setShowNewBrand(false);
    setNewBrandName("");
    setShowNewCat(false);
    setNewCatName("");
    setModal({ kind: "edit" });
  }
  function openDel(p: ShopProduct) {
    setTarget(p);
    setModal({ kind: "del" });
  }

  function setVariant(i: number, patch: Partial<VariantRow>) {
    setF((prev) => ({
      ...prev,
      variants: prev.variants.map((v, idx) => {
        if (idx !== i) return v;
        const updated = { ...v, ...patch };
        // If labelValue changed and SKU not manually set, regenerate SKU
        if ("labelValue" in patch && !updated.skuManual) {
          const bName = brandName(prev.brandId ? Number(prev.brandId) : null);
          const cName = categoryName(prev.categoryId ? Number(prev.categoryId) : null);
          updated.sku = genSku(prev.name, bName, cName, updated.labelValue);
        }
        return updated;
      }),
    }));
  }

  function addVariant() {
    setF((prev) => ({
      ...prev,
      variants: [...prev.variants, blankVariant(prev.variants[0]?.currency ?? salonCurrency)],
    }));
  }

  function removeVariant(i: number) {
    setF((prev) => ({
      ...prev,
      variants: prev.variants.length > 1 ? prev.variants.filter((_, idx) => idx !== i) : prev.variants,
    }));
  }

  async function createBrandInline() {
    if (!newBrandName.trim()) return;
    setCreatingBrand(true);
    try {
      const created = await apiFetch<ShopBrand>(`${ADMIN_API}/${sid}/shop/brands`, {
        method: "POST",
        body: JSON.stringify({ name: newBrandName.trim(), description: null }),
      });
      setBrands((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setF((prev) => ({ ...prev, brandId: String(created.id) }));
      setShowNewBrand(false);
      setNewBrandName("");
      notify(`Brand "${created.name}" created`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Error creating brand", "error");
    } finally {
      setCreatingBrand(false);
    }
  }

  async function createCategoryInline() {
    if (!newCatName.trim()) return;
    setCreatingCat(true);
    try {
      const created = await apiFetch<ShopCategory>(`${ADMIN_API}/${sid}/shop/categories`, {
        method: "POST",
        body: JSON.stringify({ name: newCatName.trim(), description: null }),
      });
      setCategories((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setF((prev) => ({ ...prev, categoryId: String(created.id) }));
      setShowNewCat(false);
      setNewCatName("");
      notify(`Category "${created.name}" created`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Error creating category", "error");
    } finally {
      setCreatingCat(false);
    }
  }

  const canSubmit = f.name.trim() !== "" && f.variants.length > 0 && f.variants.every((v) => v.price !== "");

  async function uploadImageFor(productId: number): Promise<string | null> {
    if (!imageFile) return null;
    const upload = await apiFetch<PresignedUpload>(`${ADMIN_API}/${sid}/shop/products/${productId}/image-upload-url`, {
      method: "POST",
      body: JSON.stringify({ contentType: imageFile.type }),
    });
    await uploadToPresignedUrl(upload.presignedUrl, imageFile);
    return upload.publicUrl;
  }

  async function submitAdd() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      let created = await apiFetch<ShopProduct>(`${ADMIN_API}/${sid}/shop/products`, {
        method: "POST",
        body: JSON.stringify(buildPayload(f)),
      });
      const publicUrl = await uploadImageFor(created.id).catch(() => null);
      if (publicUrl) {
        created = await apiFetch<ShopProduct>(`${ADMIN_API}/${sid}/shop/products/${created.id}`, {
          method: "PUT",
          body: JSON.stringify({ ...buildPayload({ ...f, variants: toRows(created) }), imageUrl: publicUrl }),
        });
      }
      setProducts((p) => [created, ...p]);
      close();
      notify(`"${created.name}" added`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Error", "error");
    } finally {
      setBusy(false);
    }
  }

  async function submitEdit() {
    if (!target || !canSubmit) return;
    setBusy(true);
    try {
      let imageUrl = f.imageUrl || null;
      const publicUrl = await uploadImageFor(target.id).catch(() => null);
      if (publicUrl) imageUrl = publicUrl;
      const updated = await apiFetch<ShopProduct>(`${ADMIN_API}/${sid}/shop/products/${target.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...buildPayload(f), imageUrl }),
      });
      setProducts((p) => p.map((x) => (x.id === updated.id ? updated : x)));
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
      await apiFetch(`${ADMIN_API}/${sid}/shop/products/${target.id}`, { method: "DELETE" });
      const name = target.name;
      setProducts((p) => p.filter((x) => x.id !== target.id));
      close();
      notify(`"${name}" removed`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Error", "error");
    } finally {
      setBusy(false);
    }
  }

  // Unique currencies from countries list (sorted), falling back to a short list
  const currencyOptions = (() => {
    const seen = new Set<string>();
    const out: { code: string; label: string }[] = [];
    for (const c of countries) {
      if (c.currencyCode && !seen.has(c.currencyCode)) {
        seen.add(c.currencyCode);
        out.push({ code: c.currencyCode, label: c.currencyName ? `${c.currencyCode} – ${c.currencyName}` : c.currencyCode });
      }
    }
    if (!out.length) {
      return [
        { code: "USD", label: "USD – US Dollar" },
        { code: "EUR", label: "EUR – Euro" },
        { code: "GBP", label: "GBP – British Pound" },
        { code: "INR", label: "INR – Indian Rupee" },
        { code: "AUD", label: "AUD – Australian Dollar" },
        { code: "CAD", label: "CAD – Canadian Dollar" },
        { code: "SGD", label: "SGD – Singapore Dollar" },
        { code: "JPY", label: "JPY – Japanese Yen" },
        { code: "AED", label: "AED – UAE Dirham" },
      ];
    }
    return out.sort((a, b) => a.code.localeCompare(b.code));
  })();

  return (
    <>
      {products.length === 0 ? (
        <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
          <div className="w-10 h-10 rounded-xl bg-matcha-50 border border-matcha-100 flex items-center justify-center mx-auto mb-3">
            <Package className="w-5 h-5 text-matcha-600" />
          </div>
          <h2 className="text-sm font-bold text-slate-800">No products yet</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">Add your first product — with one or more variants and stock.</p>
          <button
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-matcha-600 text-white text-sm font-medium hover:bg-matcha-700 cursor-pointer"
            onClick={openAdd}
          >
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 border border-slate-200">
              <button
                onClick={() => setView("list")}
                title="List view"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  view === "list"
                    ? "bg-white text-slate-800 shadow-sm border border-slate-200"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">List</span>
              </button>
              <button
                onClick={() => setView("card")}
                title="Card view"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  view === "card"
                    ? "bg-white text-slate-800 shadow-sm border border-slate-200"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 hidden sm:inline">
                {products.length} product{products.length !== 1 ? "s" : ""}
              </span>
              <button
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-matcha-600 text-white text-sm font-medium hover:bg-matcha-700 cursor-pointer"
                onClick={openAdd}
              >
                <Plus className="w-4 h-4" /> Add Product
              </button>
            </div>
          </div>

          {/* List view */}
          {view === "list" && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm divide-y divide-slate-100">
              {products.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group">
                  {/* Thumbnail */}
                  <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-4 h-4 text-slate-300" />
                    )}
                  </div>

                  {/* Name + meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900 truncate">{p.name}</span>
                      {!p.active && (
                        <span className="text-[0.6rem] font-semibold px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200 shrink-0">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[0.67rem] text-slate-400 mt-0.5 flex-wrap">
                      {brandName(p.brandId) && <span className="font-medium text-slate-500">{brandName(p.brandId)}</span>}
                      {categoryName(p.categoryId) && <span>· {categoryName(p.categoryId)}</span>}
                      <span>· {p.variants.length} variant{p.variants.length !== 1 ? "s" : ""}</span>
                    </div>
                  </div>

                  {/* Price */}
                  <span className="text-sm font-extrabold text-matcha-600 shrink-0 hidden sm:block">{priceRange(p)}</span>

                  {/* Actions */}
                  <div className="shrink-0 flex items-center gap-1.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 cursor-pointer"
                      onClick={() => openEdit(p)}
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    <button
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-red-200 text-xs font-medium text-red-600 bg-white hover:bg-red-50 cursor-pointer"
                      onClick={() => openDel(p)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Card view */}
          {view === "card" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((p) => (
                <div key={p.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col group">
                  <div className="aspect-[4/3] bg-slate-100 flex items-center justify-center overflow-hidden">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-8 h-8 text-slate-300" />
                    )}
                  </div>
                  <div className="p-3.5 flex flex-col gap-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 truncate flex-1">{p.name}</span>
                      {!p.active && (
                        <span className="text-[0.6rem] font-semibold px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[0.67rem] text-slate-500 flex-wrap">
                      {brandName(p.brandId) && <span className="font-semibold">{brandName(p.brandId)}</span>}
                      {categoryName(p.categoryId) && <span>· {categoryName(p.categoryId)}</span>}
                      <span>· {p.variants.length} variant{p.variants.length !== 1 ? "s" : ""}</span>
                    </div>
                    <span className="text-sm font-extrabold text-matcha-600 mt-0.5">{priceRange(p)}</span>
                    <div className="mt-auto pt-2 flex items-center gap-1.5">
                      <button
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 cursor-pointer"
                        onClick={() => openEdit(p)}
                      >
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                      <button
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-red-200 text-xs font-medium text-red-600 bg-white hover:bg-red-50 cursor-pointer"
                        onClick={() => openDel(p)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {modal && modal.kind !== "del" && (
        <Modal title={modal.kind === "add" ? "Add Product" : "Edit Product"} onClose={close}>
          {/* Name & Description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="sm:col-span-2">
              <label className={fieldLabel}>
                Name <span className="text-red-500">*</span>
              </label>
              <input
                autoFocus
                className={inputCls}
                value={f.name}
                onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={fieldLabel}>Description</label>
              <input
                className={inputCls}
                value={f.description}
                onChange={(e) => setF((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
          </div>

          {/* Brand */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className={fieldLabel}>Brand</label>
              {showNewBrand ? (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    className={inputCls}
                    placeholder="Brand name"
                    value={newBrandName}
                    onChange={(e) => setNewBrandName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createBrandInline()}
                  />
                  <button
                    type="button"
                    disabled={creatingBrand || !newBrandName.trim()}
                    className="px-3 py-2 rounded-md bg-matcha-600 text-white text-sm font-medium hover:bg-matcha-700 disabled:opacity-40 cursor-pointer shrink-0"
                    onClick={createBrandInline}
                  >
                    {creatingBrand ? "…" : "Create"}
                  </button>
                </div>
              ) : (
                <select
                  className={inputCls}
                  value={f.brandId}
                  onChange={(e) => setF((p) => ({ ...p, brandId: e.target.value }))}
                >
                  <option value="">— None —</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              )}
              <button
                type="button"
                className="mt-1 text-[11px] text-matcha-700 hover:text-matcha-900 cursor-pointer"
                onClick={() => {
                  setShowNewBrand((v) => !v);
                  setNewBrandName("");
                }}
              >
                {showNewBrand ? "← Pick existing" : "+ New brand"}
              </button>
            </div>

            {/* Category */}
            <div>
              <label className={fieldLabel}>Category</label>
              {showNewCat ? (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    className={inputCls}
                    placeholder="Category name"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createCategoryInline()}
                  />
                  <button
                    type="button"
                    disabled={creatingCat || !newCatName.trim()}
                    className="px-3 py-2 rounded-md bg-matcha-600 text-white text-sm font-medium hover:bg-matcha-700 disabled:opacity-40 cursor-pointer shrink-0"
                    onClick={createCategoryInline}
                  >
                    {creatingCat ? "…" : "Create"}
                  </button>
                </div>
              ) : (
                <select
                  className={inputCls}
                  value={f.categoryId}
                  onChange={(e) => setF((p) => ({ ...p, categoryId: e.target.value }))}
                >
                  <option value="">— None —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
              <button
                type="button"
                className="mt-1 text-[11px] text-matcha-700 hover:text-matcha-900 cursor-pointer"
                onClick={() => {
                  setShowNewCat((v) => !v);
                  setNewCatName("");
                }}
              >
                {showNewCat ? "← Pick existing" : "+ New category"}
              </button>
            </div>
          </div>

          {/* Image */}
          <div className="mb-4">
            <label className={fieldLabel}>Image</label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                {imageFile ? (
                  <img src={URL.createObjectURL(imageFile)} alt="" className="w-full h-full object-cover" />
                ) : f.imageUrl ? (
                  <img src={f.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImagePlus className="w-5 h-5 text-slate-400" />
                )}
              </div>
              <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-slate-200 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 cursor-pointer">
                <ImagePlus className="w-3.5 h-3.5" />
                {imageFile || f.imageUrl ? "Change image" : "Upload image"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {(imageFile || f.imageUrl) && (
                <button
                  type="button"
                  className="text-xs text-slate-400 hover:text-red-500 cursor-pointer"
                  onClick={() => {
                    setImageFile(null);
                    setF((p) => ({ ...p, imageUrl: "" }));
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          {/* Variants */}
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-4 mb-2 pb-2 border-b border-slate-100">
            Variants
          </div>
          <div className="flex flex-col gap-3">
            {f.variants.map((v, i) => (
              <div key={i} className="rounded-lg border border-slate-200 p-3 bg-slate-50/50">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {/* Label = value + unit */}
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-medium text-slate-500">Label</label>
                    <div className="flex gap-2">
                      <input
                        className={inputCls}
                        placeholder="e.g. 250"
                        value={v.labelValue}
                        onChange={(e) => setVariant(i, { labelValue: e.target.value })}
                      />
                      <select
                        className={`${inputCls} w-auto min-w-[90px]`}
                        value={v.labelUnit}
                        onChange={(e) => setVariant(i, { labelUnit: e.target.value })}
                      >
                        {UNITS.map((u) => (
                          <option key={u} value={u}>{u || "— unit —"}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* SKU: auto-generated, editable */}
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                      SKU
                      {!v.skuManual && v.sku && (
                        <span className="text-[9px] text-matcha-600 font-bold uppercase tracking-wide">auto</span>
                      )}
                    </label>
                    <input
                      className={inputCls}
                      placeholder="Auto"
                      value={v.sku}
                      onChange={(e) => setVariant(i, { sku: e.target.value.toUpperCase(), skuManual: e.target.value !== "" })}
                      onBlur={(e) => {
                        if (!e.target.value.trim()) {
                          const bName = brandName(f.brandId ? Number(f.brandId) : null);
                          const cName = categoryName(f.categoryId ? Number(f.categoryId) : null);
                          setVariant(i, { sku: genSku(f.name, bName, cName, v.labelValue), skuManual: false });
                        }
                      }}
                    />
                  </div>

                  {/* Price */}
                  <div>
                    <label className="text-[11px] font-medium text-slate-500">
                      Price <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className={inputCls}
                      value={v.price}
                      onChange={(e) => setVariant(i, { price: e.target.value })}
                    />
                  </div>

                  {/* Compare-at (was) price */}
                  <div>
                    <label className="text-[11px] font-medium text-slate-500">Was price (optional)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className={inputCls}
                      placeholder="Original price"
                      value={v.compareAtPrice}
                      onChange={(e) => setVariant(i, { compareAtPrice: e.target.value })}
                    />
                  </div>

                  {/* Currency */}
                  <div>
                    <label className="text-[11px] font-medium text-slate-500">Currency</label>
                    <select
                      className={inputCls}
                      value={v.currency}
                      onChange={(e) => setVariant(i, { currency: e.target.value })}
                    >
                      {currencyOptions.map((c) => (
                        <option key={c.code} value={c.code}>{c.label}</option>
                      ))}
                      {/* Ensure current value is always present even if not in list */}
                      {v.currency && !currencyOptions.find((c) => c.code === v.currency) && (
                        <option value={v.currency}>{v.currency}</option>
                      )}
                    </select>
                  </div>

                  {/* In stock */}
                  <div>
                    <label className="text-[11px] font-medium text-slate-500">In stock</label>
                    <input
                      type="number"
                      min="0"
                      className={inputCls}
                      value={v.quantityOnHand}
                      onChange={(e) => setVariant(i, { quantityOnHand: e.target.value })}
                    />
                  </div>

                  {/* Reorder at */}
                  <div>
                    <label className="text-[11px] font-medium text-slate-500">Reorder at</label>
                    <input
                      type="number"
                      min="0"
                      className={inputCls}
                      value={v.reorderLevel}
                      onChange={(e) => setVariant(i, { reorderLevel: e.target.value })}
                    />
                  </div>
                </div>
                {f.variants.length > 1 && (
                  <div className="flex justify-end mt-2">
                    <button
                      type="button"
                      className="text-[11px] text-slate-400 hover:text-red-500 inline-flex items-center gap-1 cursor-pointer"
                      onClick={() => removeVariant(i)}
                    >
                      <Trash2 className="w-3 h-3" /> Remove variant
                    </button>
                  </div>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addVariant}
              className="self-start inline-flex items-center gap-1.5 text-xs font-medium text-matcha-700 hover:text-matcha-800 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add another variant
            </button>
          </div>

          {modal.kind === "edit" && (
            <label className="flex items-center gap-2.5 mt-4 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4 accent-matcha-600 cursor-pointer"
                checked={f.active}
                onChange={(e) => setF((p) => ({ ...p, active: e.target.checked }))}
              />
              <span className="text-sm font-medium text-slate-700">Active (visible in the shop)</span>
            </label>
          )}

          <ModalActions
            busy={busy}
            onCancel={close}
            onSave={modal.kind === "add" ? submitAdd : submitEdit}
            saveLabel={modal.kind === "add" ? "Add product" : "Save changes"}
            disabled={!canSubmit}
            validationHint={
              !f.name.trim()
                ? "Product name is required."
                : f.variants.length === 0
                  ? "Add at least one variant."
                  : !f.variants.every((v) => v.price !== "")
                    ? "All variants need a price."
                    : undefined
            }
          />
        </Modal>
      )}

      {modal?.kind === "del" && (
        <Modal title="Remove Product" onClose={close} narrow>
          <p className="text-sm text-slate-600 leading-relaxed">
            Remove <strong className="text-slate-800">{target?.name}</strong> and its variants? Past orders keep their
            line details.
          </p>
          <ModalActions busy={busy} onCancel={close} onSave={submitDel} saveLabel="Remove" danger />
        </Modal>
      )}

      <Toast toast={toast} />
    </>
  );
}
