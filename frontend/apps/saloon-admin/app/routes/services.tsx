import { useState, useRef } from "react";
import { useLoaderData, useOutletContext } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { Pencil, Trash2, X, Users, Scissors, Clock, Tag, ChevronRight, Plus, ChevronDown } from "lucide-react";
import { ADMIN_API, COUNTRIES_API, apiFetch, resolveSaloonUUID } from "~/lib/api";
import { SERVICE_CATEGORIES, CATEGORY_LABEL, formatPrice, toggleList } from "~/lib/constants";
import type { LayoutContext, StaffMember, ServiceItem, Country } from "~/lib/types";
import { InfoBar } from "@saloon/ui-shared";

interface CurrencyOption { code: string; name: string; symbol: string; }

function currenciesFromCountries(countries: Country[]): CurrencyOption[] {
  const seen = new Set<string>();
  return countries
    .filter((c) => c.currencyCode && c.currencyName && c.currencySymbol && !seen.has(c.currencyCode) && seen.add(c.currencyCode))
    .map((c) => ({ code: c.currencyCode, name: c.currencyName!, symbol: c.currencySymbol! }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const sid = await resolveSaloonUUID(params.saloonId!);
  const [services, staff, countries] = await Promise.all([
    apiFetch<ServiceItem[]>(`${ADMIN_API}/${sid}/services`),
    apiFetch<StaffMember[]>(`${ADMIN_API}/${sid}/staff`),
    apiFetch<Country[]>(COUNTRIES_API).catch((): Country[] => []),
  ]);
  return { services, staff, countries };
}

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-md text-sm outline-none transition-[border-color,box-shadow] focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 bg-white text-slate-900 font-sans";
const fieldLabel = "block text-sm font-medium text-slate-700 mb-1";

// ── Onboarding constants ──────────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<string, string> = {
  HAIR: "✂️", MAKEUP: "💄", NAILS: "💅", SKIN_CARE: "🌿",
  BEARD: "🪒", MASSAGE: "🫴", WAXING: "🍯", OTHER: "✨",
};

const DURATION_PRESETS = [15, 30, 45, 60, 90];

const CATEGORY_NAME_HINT: Record<string, string> = {
  HAIR: "Haircut", MAKEUP: "Full Makeup", NAILS: "Manicure",
  SKIN_CARE: "Facial", BEARD: "Beard Trim", MASSAGE: "Relaxing Massage",
  WAXING: "Waxing Session", OTHER: "My Service",
};

// ── Form field type ───────────────────────────────────────────────────────────

interface ServiceFormFields {
  name: string;
  description: string;
  price: string;
  currency: string;
  durationMinutes: string;
  category: string;
  assignedStaffIds: string[];
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function StaffToggle({ staff, ids, onChange }: {
  staff: StaffMember[];
  ids: string[];
  onChange: (ids: string[]) => void;
}) {
  if (!staff.length) return null;
  return (
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
  );
}

function CurrencySelect({ currencies, value, onChange }: {
  currencies: CurrencyOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
      {currencies.map((c) => (
        <option key={c.code} value={c.code}>
          {c.code} — {c.name} ({c.symbol})
        </option>
      ))}
      {!currencies.length && <option value={value}>{value}</option>}
    </select>
  );
}

// ── Add / onboarding flow ─────────────────────────────────────────────────────

function AddServiceFlow({
  staff,
  currencies,
  defaultCurrency,
  onSubmit,
  busy,
}: {
  staff: StaffMember[];
  currencies: CurrencyOption[];
  defaultCurrency: string;
  onSubmit: (f: ServiceFormFields) => void;
  busy: boolean;
}) {
  const [step, setStep] = useState<0 | 1>(0);
  const [showExtra, setShowExtra] = useState(false);
  const [f, setF] = useState<ServiceFormFields>({
    name: "", description: "", price: "", currency: defaultCurrency,
    durationMinutes: "30", category: "", assignedStaffIds: [],
  });

  function pickCategory(cat: string) {
    setF((p) => ({ ...p, category: cat, name: p.name || CATEGORY_NAME_HINT[cat] || "" }));
    setStep(1);
  }

  const isCustomDuration = f.durationMinutes !== "" && !DURATION_PRESETS.includes(Number(f.durationMinutes));
  const canSubmit = Boolean(f.name.trim() && f.price);

  if (step === 0) {
    return (
      <div>
        <p className="text-sm text-slate-500 mb-4">Pick a category to get started.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {SERVICE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => pickCategory(cat)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 bg-white hover:border-matcha-400 hover:bg-matcha-50 transition-all cursor-pointer group"
            >
              <span className="text-2xl leading-none">{CATEGORY_EMOJI[cat]}</span>
              <span className="text-xs font-semibold text-slate-600 group-hover:text-matcha-700 text-center leading-snug">
                {CATEGORY_LABEL[cat]}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <button
          type="button"
          onClick={() => setStep(0)}
          className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
        >
          ← Change
        </button>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-matcha-50 border border-matcha-200 text-xs font-semibold text-matcha-700">
          {CATEGORY_EMOJI[f.category]} {CATEGORY_LABEL[f.category]}
        </span>
      </div>

      <div className="mb-4">
        <label className={fieldLabel}>Service name <span className="text-red-500">*</span></label>
        <input
          autoFocus
          className={inputCls}
          placeholder={CATEGORY_NAME_HINT[f.category] || "e.g. Haircut"}
          value={f.name}
          onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))}
        />
      </div>

      <div className="mb-4">
        <label className={fieldLabel}>Duration</label>
        <div className="flex flex-wrap gap-2 items-center">
          {DURATION_PRESETS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setF((p) => ({ ...p, durationMinutes: String(d) }))}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                f.durationMinutes === String(d) && !isCustomDuration
                  ? "bg-matcha-600 text-white border-matcha-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-matcha-400 hover:text-matcha-700"
              }`}
            >
              {d} min
            </button>
          ))}
          <input
            type="number"
            min="5"
            step="5"
            placeholder="Custom"
            value={isCustomDuration ? f.durationMinutes : ""}
            onChange={(e) => setF((p) => ({ ...p, durationMinutes: e.target.value }))}
            className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 text-xs outline-none focus:border-matcha-500 text-slate-700 placeholder:text-slate-300"
          />
          <span className="text-xs text-slate-400">min</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className={fieldLabel}>Price <span className="text-red-500">*</span></label>
          <input
            className={inputCls}
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={f.price}
            onChange={(e) => setF((p) => ({ ...p, price: e.target.value }))}
          />
        </div>
        <div>
          <label className={fieldLabel}>Currency</label>
          <CurrencySelect currencies={currencies} value={f.currency} onChange={(v) => setF((p) => ({ ...p, currency: v }))} />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowExtra(!showExtra)}
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-matcha-600 cursor-pointer transition-colors mb-3"
      >
        {showExtra ? <ChevronDown className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
        {showExtra ? "Hide options" : "Description & staff assignment"}
      </button>
      {showExtra && (
        <div className="mb-4 space-y-3">
          <div>
            <label className={fieldLabel}>Description</label>
            <textarea
              className={`${inputCls} resize-none`}
              rows={2}
              placeholder="Brief description shown to customers"
              value={f.description}
              onChange={(e) => setF((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
          <StaffToggle
            staff={staff}
            ids={f.assignedStaffIds}
            onChange={(ids) => setF((p) => ({ ...p, assignedStaffIds: ids }))}
          />
        </div>
      )}

      <button
        type="button"
        disabled={!canSubmit || busy}
        onClick={() => onSubmit(f)}
        className="w-full py-2.5 rounded-xl bg-matcha-600 text-white text-sm font-semibold hover:bg-matcha-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer mt-1"
      >
        {busy ? "Adding…" : "Add Service →"}
      </button>
    </div>
  );
}

// ── Edit form (all fields, used in edit modal) ────────────────────────────────

function ServiceForm({ f, setF, staff, currencies }: {
  f: ServiceFormFields;
  setF: React.Dispatch<React.SetStateAction<ServiceFormFields>>;
  staff: StaffMember[];
  currencies: CurrencyOption[];
}) {
  return (
    <>
      <div className="mb-4">
        <label className={fieldLabel}>Name <span className="text-red-500">*</span></label>
        <input
          className={inputCls}
          placeholder="e.g. Haircut, Colour, Facial…"
          value={f.name}
          onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))}
        />
      </div>
      <div className="mb-4">
        <label className={fieldLabel}>Description</label>
        <textarea
          className={`${inputCls} resize-none`}
          rows={3}
          placeholder="Brief description shown to customers"
          value={f.description}
          onChange={(e) => setF((p) => ({ ...p, description: e.target.value }))}
        />
      </div>
      <div className="mb-4">
        <label className={fieldLabel}>Category</label>
        <select className={inputCls} value={f.category} onChange={(e) => setF((p) => ({ ...p, category: e.target.value }))}>
          {SERVICE_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div>
          <label className={fieldLabel}>Price <span className="text-red-500">*</span></label>
          <input
            className={inputCls}
            type="number" min="0" step="0.01"
            placeholder="0.00"
            value={f.price}
            onChange={(e) => setF((p) => ({ ...p, price: e.target.value }))}
          />
        </div>
        <div>
          <label className={fieldLabel}>Currency</label>
          <CurrencySelect currencies={currencies} value={f.currency} onChange={(v) => setF((p) => ({ ...p, currency: v }))} />
        </div>
        <div>
          <label className={fieldLabel}>Duration (min)</label>
          <input
            className={inputCls}
            type="number" min="5" step="5"
            value={f.durationMinutes}
            onChange={(e) => setF((p) => ({ ...p, durationMinutes: e.target.value }))}
          />
        </div>
      </div>
      <StaffToggle staff={staff} ids={f.assignedStaffIds} onChange={(ids) => setF((p) => ({ ...p, assignedStaffIds: ids }))} />
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function defaultCurrencyCode(saloonCountry: string | undefined, countries: Country[]): string {
  if (!saloonCountry || !countries.length) return "USD";
  const country = countries.find((c) => c.name === saloonCountry);
  return country?.currencyCode ?? "USD";
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Services() {
  const { saloon } = useOutletContext<LayoutContext>();
  const { services: init, staff, countries } = useLoaderData<typeof clientLoader>();
  const currencies = currenciesFromCountries(countries);
  const [services, setServices] = useState<ServiceItem[]>(init);
  const [busy,     setBusy]     = useState(false);
  const [toast,    setToast]    = useState<{ msg: string; type: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [target, setTarget] = useState<ServiceItem | null>(null);
  const [modal,  setModal]  = useState({ add: false, edit: false, del: false });

  const detectedCurrency = defaultCurrencyCode(saloon.location?.country, countries);
  const hasBooking = saloon.features?.includes("BOOKING") ?? false;
  const [alertDismissed, setAlertDismissed] = useState(
    () => Boolean(localStorage.getItem(`setup-alert-dismissed:services:${saloon.id}`))
  );

  const blankEditFields = (): ServiceFormFields => ({
    name: "", description: "", price: "", currency: detectedCurrency,
    durationMinutes: "30", category: "HAIR", assignedStaffIds: [],
  });
  const [ef, setEf] = useState<ServiceFormFields & { active: boolean }>({
    ...blankEditFields(), active: true,
  });

  const sid = saloon.id;

  function notify(msg: string, type = "success") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  function closeModal(k: keyof typeof modal) { setModal((m) => ({ ...m, [k]: false })); }
  function openAdd() { setModal((m) => ({ ...m, add: true })); }

  function openEdit(item: ServiceItem) {
    setTarget(item);
    setEf({
      name: item.name, description: item.description ?? "",
      price: String(item.price), currency: item.currency ?? detectedCurrency,
      durationMinutes: String(item.durationMinutes), category: item.category,
      active: item.active, assignedStaffIds: [...(item.assignedStaffIds ?? [])],
    });
    setModal((m) => ({ ...m, edit: true }));
  }

  function openDel(item: ServiceItem) { setTarget(item); setModal((m) => ({ ...m, del: true })); }

  async function submitAdd(fields: ServiceFormFields) {
    if (!fields.name || !fields.price) return;
    setBusy(true);
    try {
      const item = await apiFetch<ServiceItem>(`${ADMIN_API}/${sid}/services`, {
        method: "POST",
        body: JSON.stringify({
          name: fields.name, description: fields.description,
          price: parseFloat(fields.price), currency: fields.currency,
          durationMinutes: parseInt(fields.durationMinutes) || 30, category: fields.category,
          assignedStaffIds: fields.assignedStaffIds,
        }),
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
      const updated = await apiFetch<ServiceItem>(`${ADMIN_API}/${sid}/services/${target.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: ef.name, description: ef.description,
          price: parseFloat(ef.price), currency: ef.currency,
          durationMinutes: parseInt(ef.durationMinutes) || 30, category: ef.category,
          active: ef.active, assignedStaffIds: ef.assignedStaffIds,
        }),
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
      await apiFetch(`${ADMIN_API}/${sid}/services/${target.id}`, { method: "DELETE" });
      const name = target.name;
      setServices((p) => p.filter((s) => s.id !== target.id));
      closeModal("del");
      notify(`"${name}" removed.`);
    } catch (e) { notify(e instanceof Error ? e.message : "Error", "error"); }
    finally { setBusy(false); }
  }

  function staffName(id: string) { return staff.find((m) => m.id.toString() === id)?.name ?? id; }

  return (
    <>
      <div className="mb-6 space-y-2">
        <h1 className="text-xl font-bold text-slate-900">Services</h1>
        <InfoBar>
          Define everything your saloon offers — name, price, duration, category, and assigned staff.
          Customers see these on your public website.
        </InfoBar>
      </div>

      {/* ── Setup alert (booking enabled, no services yet, not dismissed) ─ */}
      {!services.length && hasBooking && !alertDismissed && (
        <div className="max-w-xl mx-auto mb-4 flex items-center gap-2.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
          <span className="flex-1 leading-snug">Online booking won't work until you add at least one service.</span>
          <button
            type="button"
            onClick={() => {
              localStorage.setItem(`setup-alert-dismissed:services:${saloon.id}`, "1");
              setAlertDismissed(true);
            }}
            className="shrink-0 text-amber-400 hover:text-amber-700 transition-colors cursor-pointer"
            title="Ignore"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Empty state: inline onboarding ──────────────────────────────── */}
      {!services.length ? (
        <div className="max-w-xl mx-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-matcha-50 border border-matcha-100 flex items-center justify-center shrink-0">
                <Scissors className="w-5 h-5 text-matcha-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">What services do you offer?</h2>
                <p className="text-xs text-slate-500 mt-0.5">Pick a category to add your first service.</p>
              </div>
            </div>
            <div className="px-6 py-5">
              <AddServiceFlow
                staff={staff}
                currencies={currencies}
                defaultCurrency={detectedCurrency}
                onSubmit={submitAdd}
                busy={busy}
              />
            </div>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-500 font-medium mb-4">
            {services.length} service{services.length !== 1 ? "s" : ""}
          </p>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm divide-y divide-slate-100">
            {services.map((sv) => (
              <div key={sv.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-900 truncate">{sv.name}</span>
                    {!sv.active && (
                      <span className="text-[0.6rem] font-semibold px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200 shrink-0">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[0.67rem] font-semibold text-slate-500">
                      <Tag className="w-2.5 h-2.5" />
                      {CATEGORY_LABEL[sv.category] ?? sv.category}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[0.67rem] text-slate-400">
                      <Clock className="w-2.5 h-2.5" />
                      {sv.durationMinutes} min
                    </span>
                    {sv.assignedStaffIds?.length ? (
                      <span className="inline-flex items-center gap-1 text-[0.67rem] text-slate-400">
                        <Users className="w-2.5 h-2.5" />
                        {sv.assignedStaffIds.map(staffName).join(", ")}
                      </span>
                    ) : null}
                  </div>
                  {sv.description && (
                    <p className="text-xs text-slate-400 mt-0.5 truncate max-w-sm">{sv.description}</p>
                  )}
                </div>
                <div className="shrink-0 text-right hidden sm:block">
                  <span className="text-base font-extrabold text-matcha-600 tracking-tight">
                    {formatPrice(sv.price, sv.currency)}
                  </span>
                </div>
                <div className="shrink-0 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => openEdit(sv)}
                  >
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                  <button
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-red-200 text-xs font-medium text-red-600 bg-white hover:bg-red-50 transition-colors cursor-pointer"
                    onClick={() => openDel(sv)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 sm:hidden" />
              </div>
            ))}
            <div className="flex justify-end px-4 py-3 bg-slate-50/60 border-t border-slate-100">
              <button
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-matcha-600 text-white text-sm font-medium hover:bg-matcha-700 transition-colors cursor-pointer"
                onClick={openAdd}
              >
                Add Service
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Add modal (same flow) ────────────────────────────────────────── */}
      {modal.add && (
        <div
          className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && closeModal("add")}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto animate-[pop_0.14s_ease]">
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100">
              <span className="text-base font-bold text-slate-900">Add Service</span>
              <button className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer" onClick={() => closeModal("add")}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <AddServiceFlow
              staff={staff}
              currencies={currencies}
              defaultCurrency={detectedCurrency}
              onSubmit={submitAdd}
              busy={busy}
            />
          </div>
        </div>
      )}

      {/* ── Edit modal ───────────────────────────────────────────────────── */}
      {modal.edit && (
        <div
          className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && closeModal("edit")}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto animate-[pop_0.14s_ease]">
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100">
              <span className="text-base font-bold text-slate-900">Edit Service</span>
              <button className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer" onClick={() => closeModal("edit")}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <ServiceForm f={ef} setF={setEf as React.Dispatch<React.SetStateAction<ServiceFormFields>>} staff={staff} currencies={currencies} />
            <label className="flex items-center gap-2.5 mt-4 mb-4 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4 accent-matcha-600 cursor-pointer"
                checked={ef.active}
                onChange={(e) => setEf((p) => ({ ...p, active: e.target.checked }))}
              />
              <span className="text-sm font-medium text-slate-700">Active</span>
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

      {/* ── Delete modal ─────────────────────────────────────────────────── */}
      {modal.del && (
        <div
          className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && closeModal("del")}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-slate-200 animate-[pop_0.14s_ease]">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
              <span className="text-base font-bold text-slate-900">Remove Service</span>
              <button className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer" onClick={() => closeModal("del")}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Remove <strong className="text-slate-800">{target?.name}</strong> from the catalog?
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
