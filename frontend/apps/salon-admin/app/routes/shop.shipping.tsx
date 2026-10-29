import { useI18n } from "@salon/i18n";
import { useState } from "react";
import { useLoaderData, useOutletContext } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { Pencil, Plus, Trash2, Truck, X } from "lucide-react";
import { ADMIN_API, COUNTRIES_API, apiFetch, apiFetchCached, resolveSalonUUID } from "~/lib/api";
import { Toast, useToast } from "@salon/ui-shared";
import { Modal, ModalActions } from "~/components/ShopModal";
import { formatPrice } from "~/lib/constants";
import type { Country, ShippingDeliveryType, ShopShippingMethod } from "~/lib/types";
import { formatWeight, salonCurrencyCode } from "~/lib/shopWeights";
import type { ShopOutletContext } from "./shop";

const inputCls =
  "w-full px-3 py-2 border border-slate-200 rounded-md text-sm outline-none transition-[border-color,box-shadow] focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 bg-white text-slate-900";
const fieldLabel = "block text-sm font-medium text-slate-700 mb-1";
const groupTitle = "text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2";

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const sid = await resolveSalonUUID(params.salonId!);
  const [methods, countries] = await Promise.all([
    apiFetch<ShopShippingMethod[]>(`${ADMIN_API}/${sid}/shop/shipping-methods`),
    apiFetchCached<Country[]>(COUNTRIES_API).catch((): Country[] => []),
  ]);
  return { sid, methods, countries };
}

const DELIVERY_TYPES: { value: ShippingDeliveryType; label: string }[] = [
  { value: "HOME", label: "Home delivery" },
  { value: "PICKUP_POINT", label: "Pickup point" },
  { value: "BUSINESS", label: "Business address" },
];

/** Numbers stay strings while editing so an empty field means "no limit". */
interface FormFields {
  name: string;
  carrier: string;
  description: string;
  deliveryType: ShippingDeliveryType;
  price: string;
  freeOver: string;
  minOrderValue: string;
  maxOrderValue: string;
  minItems: string;
  maxItems: string;
  /** Kilograms while editing (how carriers price); stored as grams. */
  minWeightKg: string;
  maxWeightKg: string;
  currency: string;
  minDeliveryDays: string;
  maxDeliveryDays: string;
  sortOrder: string;
  active: boolean;
  countries: string[];
}

const blank = (currency: string, country?: string): FormFields => ({
  name: "", carrier: "", description: "", deliveryType: "HOME",
  price: "", freeOver: "", minOrderValue: "", maxOrderValue: "",
  minItems: "", maxItems: "", minWeightKg: "", maxWeightKg: "", currency,
  minDeliveryDays: "", maxDeliveryDays: "",
  sortOrder: "0", active: true, countries: country ? [country] : [],
});

const str = (n?: number | null) => (n == null ? "" : String(n));
const num = (s: string) => (s.trim() === "" ? null : Number(s));
const kg = (grams?: number | null) => (grams == null ? "" : String(grams / 1000));
const grams = (kgValue: string) => (kgValue.trim() === "" ? null : Math.round(Number(kgValue) * 1000));

function toForm(m: ShopShippingMethod, salonCurrency: string): FormFields {
  return {
    name: m.name, carrier: m.carrier ?? "", description: m.description ?? "", deliveryType: m.deliveryType,
    price: str(m.price), freeOver: str(m.freeOver), minOrderValue: str(m.minOrderValue), maxOrderValue: str(m.maxOrderValue),
    minItems: str(m.minItems), maxItems: str(m.maxItems),
    minWeightKg: kg(m.minWeightGrams), maxWeightKg: kg(m.maxWeightGrams), currency: m.currency ?? salonCurrency,
    minDeliveryDays: str(m.minDeliveryDays), maxDeliveryDays: str(m.maxDeliveryDays),
    sortOrder: String(m.sortOrder ?? 0), active: m.active, countries: [...m.countries].sort(),
  };
}

function toBody(f: FormFields) {
  return {
    name: f.name.trim(), carrier: f.carrier.trim() || null, description: f.description.trim() || null,
    deliveryType: f.deliveryType, price: num(f.price) ?? 0, freeOver: num(f.freeOver),
    minOrderValue: num(f.minOrderValue), maxOrderValue: num(f.maxOrderValue),
    minItems: num(f.minItems), maxItems: num(f.maxItems),
    minWeightGrams: grams(f.minWeightKg), maxWeightGrams: grams(f.maxWeightKg), currency: f.currency,
    minDeliveryDays: num(f.minDeliveryDays), maxDeliveryDays: num(f.maxDeliveryDays),
    sortOrder: num(f.sortOrder) ?? 0, active: f.active, countries: f.countries,
  };
}

/** The first problem with the form, or null — mirrors the server's checks so Save explains itself. */
function formProblem(f: FormFields): string | null {
  if (!f.name.trim()) return "Give the method a name.";
  const values = [f.price, f.freeOver, f.minOrderValue, f.maxOrderValue, f.minItems, f.maxItems,
    f.minWeightKg, f.maxWeightKg, f.minDeliveryDays, f.maxDeliveryDays];
  if (values.some((v) => v.trim() !== "" && (Number.isNaN(Number(v)) || Number(v) < 0))) return "Amounts and counts can't be negative.";
  const pairs: [string, string, string][] = [
    [f.minOrderValue, f.maxOrderValue, "order value"], [f.minItems, f.maxItems, "items"],
    [f.minWeightKg, f.maxWeightKg, "weight"], [f.minDeliveryDays, f.maxDeliveryDays, "delivery days"],
  ];
  for (const [min, max, what] of pairs) {
    if (min.trim() && max.trim() && Number(min) > Number(max)) return `The minimum ${what} is above the maximum.`;
  }
  return null;
}

export default function ShopShipping() {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const { salon } = useOutletContext<ShopOutletContext>();
  const { sid, methods: init, countries } = useLoaderData<typeof clientLoader>();
  const [methods, setMethods] = useState<ShopShippingMethod[]>(init);
  const [busy, setBusy] = useState(false);
  const { toast, notify } = useToast();
  const [target, setTarget] = useState<ShopShippingMethod | null>(null);
  const [modal, setModal] = useState<{ kind: "add" | "edit" | "del" } | null>(null);
  const salonCountry = salon.location?.country;
  // location.country holds the country's name (e.g. "Denmark").
  const salonCurrency = salonCurrencyCode(salonCountry, countries);
  const salonCountryCode = countries.find((c) => c.name === salonCountry)?.code;
  const [f, setF] = useState<FormFields>(blank(salonCurrency));
  const money = (n: number, currency?: string | null) => formatPrice(n, currency || salonCurrency, uiLocale);
  const currencyCodes = [...new Set([salonCurrency, ...countries.map((c) => c.currencyCode).filter(Boolean)])].sort();
  const countryName = (code: string) => countries.find((c) => c.code === code)?.name ?? code;
  const sortMethods = (list: ShopShippingMethod[]) =>
    [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  const close = () => setModal(null);
  const set = (k: keyof FormFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  function openAdd() {
    setF(blank(salonCurrency, salonCountryCode));
    setModal({ kind: "add" });
  }
  function openEdit(m: ShopShippingMethod) {
    setTarget(m);
    setF(toForm(m, salonCurrency));
    setModal({ kind: "edit" });
  }
  function openDel(m: ShopShippingMethod) {
    setTarget(m);
    setModal({ kind: "del" });
  }

  async function save() {
    if (formProblem(f)) return;
    setBusy(true);
    try {
      const editing = modal?.kind === "edit" && target;
      const saved = await apiFetch<ShopShippingMethod>(
        editing ? `${ADMIN_API}/${sid}/shop/shipping-methods/${target.id}` : `${ADMIN_API}/${sid}/shop/shipping-methods`,
        { method: editing ? "PUT" : "POST", body: JSON.stringify(toBody(f)) },
      );
      setMethods((p) => sortMethods(editing ? p.map((m) => (m.id === saved.id ? saved : m)) : [...p, saved]));
      close();
      notify(`"${saved.name}" ${editing ? "updated" : "added"}`);
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
      await apiFetch(`${ADMIN_API}/${sid}/shop/shipping-methods/${target.id}`, { method: "DELETE" });
      setMethods((p) => p.filter((m) => m.id !== target.id));
      close();
      notify(`"${target.name}" removed`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Error", "error");
    } finally {
      setBusy(false);
    }
  }

  /** The rules a method applies, as short chips — so the list reads like Shipmondo's rule overview. */
  function ruleChips(m: ShopShippingMethod): string[] {
    const money = (n: number) => formatPrice(n, m.currency || salonCurrency, uiLocale);
    const chips: string[] = [];
    chips.push(m.countries.length === 0 ? translateUi("All countries")
      : m.countries.length <= 3 ? m.countries.map(countryName).join(", ")
        : translateUi("{count} countries", { count: m.countries.length }));
    if (m.minOrderValue != null && m.maxOrderValue != null) chips.push(`${translateUi("Order")} ${money(m.minOrderValue)}–${money(m.maxOrderValue)}`);
    else if (m.minOrderValue != null) chips.push(`${translateUi("Order from")} ${money(m.minOrderValue)}`);
    else if (m.maxOrderValue != null) chips.push(`${translateUi("Order up to")} ${money(m.maxOrderValue)}`);
    if (m.minItems != null && m.maxItems != null) chips.push(translateUi("{min}–{max} items", { min: m.minItems, max: m.maxItems }));
    else if (m.minItems != null) chips.push(translateUi("{count}+ items", { count: m.minItems }));
    else if (m.maxItems != null) chips.push(translateUi("Up to {count} items", { count: m.maxItems }));
    if (m.minWeightGrams != null && m.maxWeightGrams != null) chips.push(`${formatWeight(m.minWeightGrams, uiLocale)}–${formatWeight(m.maxWeightGrams, uiLocale)}`);
    else if (m.minWeightGrams != null) chips.push(`${translateUi("From")} ${formatWeight(m.minWeightGrams, uiLocale)}`);
    else if (m.maxWeightGrams != null) chips.push(`${translateUi("Up to")} ${formatWeight(m.maxWeightGrams, uiLocale)}`);
    if (m.freeOver != null) chips.push(`${translateUi("Free from")} ${money(m.freeOver)}`);
    if (m.minDeliveryDays != null || m.maxDeliveryDays != null) {
      const days = m.minDeliveryDays != null && m.maxDeliveryDays != null && m.minDeliveryDays !== m.maxDeliveryDays
        ? `${m.minDeliveryDays}–${m.maxDeliveryDays}` : String(m.maxDeliveryDays ?? m.minDeliveryDays);
      chips.push(translateUi("{days} business days", { days }));
    }
    return chips;
  }

  const problem = formProblem(f);
  const availableCountries = countries.filter((c) => !f.countries.includes(c.code));

  return (
    <>
      <p className="text-sm text-slate-500 mb-4 max-w-3xl">
        {translateUi("Set up how you ship web-shop orders. At checkout, customers who choose Ship to me see every method whose rules match their address and cart (value, items and weight), cheapest first. With no methods, shipping is free. Collect in salon is always available.")}
      </p>

      {methods.length > 0 && (
        <div className="mb-4 flex justify-end">
          <button
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-matcha-600 text-white text-sm font-medium hover:bg-matcha-700 cursor-pointer"
            onClick={openAdd}
          >
            <Plus className="w-4 h-4" /> {translateUi("Add shipping method")}</button>
        </div>
      )}
      {methods.length === 0 ? (
        <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
          <div className="w-10 h-10 rounded-xl bg-matcha-50 border border-matcha-100 flex items-center justify-center mx-auto mb-3">
            <Truck className="w-5 h-5 text-matcha-600" />
          </div>
          <h2 className="text-sm font-bold text-slate-800">{translateUi("No shipping methods yet")}</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">{translateUi("Add a method such as home delivery or a parcel shop, with its price and the countries it covers.")}</p>
          <button
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-matcha-600 text-white text-sm font-medium hover:bg-matcha-700 cursor-pointer"
            onClick={openAdd}
          >
            <Plus className="w-4 h-4" /> {translateUi("Add shipping method")}</button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm divide-y divide-slate-100">
          {methods.map((m) => (
            <div key={m.id} className="flex items-start gap-4 px-4 py-3 hover:bg-slate-50 transition-colors group">
              <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                <Truck className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">{m.name}</span>
                  <span className="text-xs text-slate-500">
                    {[m.carrier, translateUi(DELIVERY_TYPES.find((d) => d.value === m.deliveryType)?.label ?? "")].filter(Boolean).join(" · ")}
                  </span>
                  {!m.active && (
                    <span className="text-[0.6rem] font-semibold px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">
                      {translateUi("Inactive ")}</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {ruleChips(m).map((chip) => (
                    <span key={chip} className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">{chip}</span>
                  ))}
                </div>
              </div>
              <span className="text-sm font-semibold text-slate-900 tabular-nums shrink-0 pt-1">
                {m.price > 0 ? money(m.price, m.currency) : translateUi("Free")}
              </span>
              <div className="shrink-0 flex items-center gap-1.5 row-actions">
                <button
                  aria-label={translateUi("Edit")}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 pointer-coarse:min-h-10 pointer-coarse:min-w-10 pointer-coarse:inline-flex pointer-coarse:items-center pointer-coarse:justify-center rounded-md border border-slate-200 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 cursor-pointer"
                  onClick={() => openEdit(m)}
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  aria-label={translateUi("Delete")}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 pointer-coarse:min-h-10 pointer-coarse:min-w-10 pointer-coarse:inline-flex pointer-coarse:items-center pointer-coarse:justify-center rounded-md border border-red-200 text-xs font-medium text-red-600 bg-white hover:bg-red-50 cursor-pointer"
                  onClick={() => openDel(m)}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}

        </div>
      )}

      {modal && modal.kind !== "del" && (
        <Modal title={modal.kind === "add" ? translateUi("Add shipping method") : translateUi("Edit shipping method")} onClose={close}>
          <p className={groupTitle}>{translateUi("Method")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div className="sm:col-span-2">
              <label className={fieldLabel} htmlFor="ship-name">{translateUi("Name ")}<span className="text-red-500">*</span></label>
              <input id="ship-name" autoFocus className={inputCls} placeholder={translateUi("e.g. PostNord parcel shop")} value={f.name} onChange={set("name")} />
            </div>
            <div>
              <label className={fieldLabel} htmlFor="ship-carrier">{translateUi("Carrier")}</label>
              <input id="ship-carrier" className={inputCls} placeholder="GLS, PostNord, DAO…" value={f.carrier} onChange={set("carrier")} />
            </div>
            <div>
              <label className={fieldLabel} htmlFor="ship-type">{translateUi("Delivery type")}</label>
              <select id="ship-type" className={inputCls} value={f.deliveryType} onChange={set("deliveryType")}>
                {DELIVERY_TYPES.map((d) => <option key={d.value} value={d.value}>{translateUi(d.label)}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={fieldLabel} htmlFor="ship-description">{translateUi("Description shown at checkout")}</label>
              <input id="ship-description" className={inputCls} value={f.description} onChange={set("description")} />
            </div>
          </div>

          <p className={`${groupTitle} mt-5`}>{translateUi("Price")}</p>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className={fieldLabel} htmlFor="ship-price">{translateUi("Price")}</label>
              <input id="ship-price" type="number" min="0" step="0.01" inputMode="decimal" className={inputCls} placeholder="0.00" value={f.price} onChange={set("price")} />
            </div>
            <div>
              <label className={fieldLabel} htmlFor="ship-free">{translateUi("Free when order is at least")}</label>
              <input id="ship-free" type="number" min="0" step="0.01" inputMode="decimal" className={inputCls} placeholder={translateUi("Never free")} value={f.freeOver} onChange={set("freeOver")} />
            </div>
            <div>
              <label className={fieldLabel} htmlFor="ship-currency">{translateUi("Currency")}</label>
              <select id="ship-currency" className={inputCls} value={f.currency} onChange={set("currency")}
                      title={translateUi("Only carts priced in this currency are offered this method.")}>
                {currencyCodes.map((c) => <option key={c} value={c}>{c}{c === salonCurrency ? ` (${translateUi("salon currency")})` : ""}</option>)}
              </select>
            </div>
          </div>

          <p className={`${groupTitle} mt-5`}>{translateUi("Offer this method when")}</p>
          <div className="mb-3">
            <label className={fieldLabel} htmlFor="ship-country">{translateUi("Destination countries")}</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {f.countries.length === 0 && <span className="text-xs text-slate-500">{translateUi("All countries")}</span>}
              {f.countries.map((code) => (
                <span key={code} className="inline-flex items-center gap-1 text-xs pl-2 pr-1 py-0.5 rounded-full bg-matcha-50 text-matcha-800 border border-matcha-200">
                  {countryName(code)}
                  <button type="button" aria-label={translateUi("Remove")} className="rounded-full p-0.5 hover:bg-matcha-100 cursor-pointer"
                          onClick={() => setF((p) => ({ ...p, countries: p.countries.filter((c) => c !== code) }))}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            {countries.length > 0 && (
              <select id="ship-country" className={inputCls} value=""
                      onChange={(e) => e.target.value && setF((p) => ({ ...p, countries: [...p.countries, e.target.value].sort() }))}>
                <option value="">{translateUi("Add a country…")}</option>
                {availableCountries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className={fieldLabel} htmlFor="ship-min-value">{translateUi("Order value from")}</label>
              <input id="ship-min-value" type="number" min="0" step="0.01" inputMode="decimal" className={inputCls} placeholder={translateUi("No minimum")} value={f.minOrderValue} onChange={set("minOrderValue")} />
            </div>
            <div>
              <label className={fieldLabel} htmlFor="ship-max-value">{translateUi("Order value up to")}</label>
              <input id="ship-max-value" type="number" min="0" step="0.01" inputMode="decimal" className={inputCls} placeholder={translateUi("No maximum")} value={f.maxOrderValue} onChange={set("maxOrderValue")} />
            </div>
            <div>
              <label className={fieldLabel} htmlFor="ship-min-items">{translateUi("Items from")}</label>
              <input id="ship-min-items" type="number" min="0" step="1" inputMode="numeric" className={inputCls} placeholder={translateUi("No minimum")} value={f.minItems} onChange={set("minItems")} />
            </div>
            <div>
              <label className={fieldLabel} htmlFor="ship-max-items">{translateUi("Items up to")}</label>
              <input id="ship-max-items" type="number" min="0" step="1" inputMode="numeric" className={inputCls} placeholder={translateUi("No maximum")} value={f.maxItems} onChange={set("maxItems")} />
            </div>
            <div>
              <label className={fieldLabel} htmlFor="ship-min-weight">{translateUi("Weight from (kg)")}</label>
              <input id="ship-min-weight" type="number" min="0" step="0.001" inputMode="decimal" className={inputCls} placeholder={translateUi("No minimum")} value={f.minWeightKg} onChange={set("minWeightKg")} />
            </div>
            <div>
              <label className={fieldLabel} htmlFor="ship-max-weight">{translateUi("Weight up to (kg)")}</label>
              <input id="ship-max-weight" type="number" min="0" step="0.001" inputMode="decimal" className={inputCls} placeholder={translateUi("No maximum")} value={f.maxWeightKg} onChange={set("maxWeightKg")} />
            </div>
          </div>

          <p className={`${groupTitle} mt-5`}>{translateUi("Delivery estimate")}</p>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className={fieldLabel} htmlFor="ship-min-days">{translateUi("From (days)")}</label>
              <input id="ship-min-days" type="number" min="0" step="1" inputMode="numeric" className={inputCls} value={f.minDeliveryDays} onChange={set("minDeliveryDays")} />
            </div>
            <div>
              <label className={fieldLabel} htmlFor="ship-max-days">{translateUi("To (days)")}</label>
              <input id="ship-max-days" type="number" min="0" step="1" inputMode="numeric" className={inputCls} value={f.maxDeliveryDays} onChange={set("maxDeliveryDays")} />
            </div>
            <div>
              <label className={fieldLabel} htmlFor="ship-sort">{translateUi("Sort order")}</label>
              <input id="ship-sort" type="number" step="1" inputMode="numeric" className={inputCls} value={f.sortOrder} onChange={set("sortOrder")} />
            </div>
          </div>

          <label className="flex items-center gap-2.5 mt-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4 h-4 accent-matcha-600 cursor-pointer"
              checked={f.active}
              onChange={(e) => setF((p) => ({ ...p, active: e.target.checked }))}
            />
            <span className="text-sm font-medium text-slate-700">{translateUi("Active — offered at checkout")}</span>
          </label>

          <ModalActions
            busy={busy}
            onCancel={close}
            onSave={save}
            disabled={problem != null}
            validationHint={problem ? translateUi(problem) : undefined}
            saveLabel={modal.kind === "add" ? "Add" : "Save changes"}
          />
        </Modal>
      )}

      {modal?.kind === "del" && (
        <Modal title={translateUi("Remove shipping method")} onClose={close} narrow>
          <p className="text-sm text-slate-600 leading-relaxed">
            {translateUi("Remove ")}<strong className="text-slate-800">{target?.name}</strong>{translateUi("? Orders already placed keep the shipping they paid for.")}</p>
          <ModalActions busy={busy} onCancel={close} onSave={submitDel} saveLabel="Remove" danger />
        </Modal>
      )}

      <Toast toast={toast} />
    </>
  );
}
