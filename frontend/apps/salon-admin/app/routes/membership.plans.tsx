import { useI18n } from "@salon/i18n";
import { useState } from "react";
import { Link, useLoaderData, useOutletContext } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { Archive, ArrowDown, ArrowUp, Check, Pencil, Plus, Sparkles, Star, Ticket, Trash2, Users, X } from "lucide-react";
import { ADMIN_API, COUNTRIES_API, apiFetch, apiFetchCached, resolveSalonUUID } from "~/lib/api";
import { Toast, useToast } from "@salon/ui-shared";
import { FixWithAi } from "~/components/FixWithAi";
import { Modal, ModalActions } from "~/components/ShopModal";
import { formatPrice } from "~/lib/constants";
import { BILLING_INTERVALS, INTERVAL_LABEL, PLAN_STATUS_LABEL, PLAN_STATUS_STYLE, planPrice } from "~/lib/membership";
import type { Country, MembershipBillingInterval, MembershipPlan, MembershipPlanStatus, ServiceItem } from "~/lib/types";
import type { MembershipOutletContext } from "./membership";

const inputCls =
  "w-full px-3 py-2 border border-slate-200 rounded-md text-sm outline-none transition-[border-color,box-shadow] focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 bg-white text-slate-900";
const fieldLabel = "block text-sm font-medium text-slate-700 mb-1";
const hintCls = "text-[11px] text-slate-400 mt-1";

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const sid = await resolveSalonUUID(params.salonId!);
  const [plans, services, countries] = await Promise.all([
    apiFetch<MembershipPlan[]>(`${ADMIN_API}/${sid}/membership/plans`),
    apiFetch<ServiceItem[]>(`${ADMIN_API}/${sid}/services`),
    apiFetchCached<Country[]>(COUNTRIES_API).catch((): Country[] => []),
  ]);
  return { sid, plans, services, countries };
}

interface FormFields {
  name: string;
  description: string;
  price: string;
  currency: string;
  billingInterval: MembershipBillingInterval;
  signupFee: string;
  serviceDiscountPercent: string;
  productDiscountPercent: string;
  maxMembers: string;
  highlighted: boolean;
  status: MembershipPlanStatus;
  perks: string[];
  includedServices: { serviceId: number; quantityPerCycle: number }[];
}

const num = (v: string) => (v.trim() === "" ? null : Number(v));

function toBody(f: FormFields) {
  return {
    name: f.name.trim(),
    description: f.description.trim() || null,
    price: Number(f.price),
    currency: f.currency,
    billingInterval: f.billingInterval,
    signupFee: num(f.signupFee),
    serviceDiscountPercent: num(f.serviceDiscountPercent),
    productDiscountPercent: num(f.productDiscountPercent),
    maxMembers: num(f.maxMembers),
    highlighted: f.highlighted,
    status: f.status,
    perks: f.perks.map((p) => p.trim()).filter(Boolean),
    includedServices: f.includedServices,
  };
}

function fromPlan(p: MembershipPlan): FormFields {
  const str = (v?: number | null) => (v == null ? "" : String(v));
  return {
    name: p.name, description: p.description ?? "", price: String(p.price), currency: p.currency,
    billingInterval: p.billingInterval, signupFee: str(p.signupFee),
    serviceDiscountPercent: str(p.serviceDiscountPercent), productDiscountPercent: str(p.productDiscountPercent),
    maxMembers: str(p.maxMembers), highlighted: p.highlighted, status: p.status,
    perks: p.perks.length ? [...p.perks] : [""],
    includedServices: p.includedServices.map((s) => ({ serviceId: s.serviceId, quantityPerCycle: s.quantityPerCycle })),
  };
}

export default function MembershipPlans() {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const { salon } = useOutletContext<MembershipOutletContext>();
  const { sid, plans: init, services, countries } = useLoaderData<typeof clientLoader>();
  const [plans, setPlans] = useState<MembershipPlan[]>(init);
  const [busy, setBusy] = useState(false);
  const { toast, notify } = useToast();
  const [target, setTarget] = useState<MembershipPlan | null>(null);
  const [modal, setModal] = useState<"add" | "edit" | "del" | null>(null);
  const hasShop = salon.features?.includes("WEBSHOP") ?? false;

  const defaultCurrency = services.find((s) => s.currency)?.currency
    ?? countries.find((c) => c.name === salon.location?.country)?.currencyCode ?? "USD";
  const currencies = [...new Set([defaultCurrency, ...countries.map((c) => c.currencyCode).filter(Boolean)])].sort();
  const blank = (): FormFields => ({
    name: "", description: "", price: "", currency: defaultCurrency, billingInterval: "MONTHLY",
    signupFee: "", serviceDiscountPercent: "", productDiscountPercent: "", maxMembers: "",
    highlighted: false, status: "ACTIVE", perks: [""], includedServices: [],
  });
  const [f, setF] = useState<FormFields>(blank());

  const close = () => setModal(null);

  async function run<T>(work: () => Promise<T>, success: (result: T) => string) {
    setBusy(true);
    try {
      const result = await work();
      notify(success(result));
      return result;
    } catch (e) {
      notify(e instanceof Error ? e.message : translateUi("Something went wrong"), "error");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const body = JSON.stringify(toBody(f));
    if (modal === "add") {
      const created = await run(
        () => apiFetch<MembershipPlan>(`${ADMIN_API}/${sid}/membership/plans`, { method: "POST", body }),
        (p) => translateUi("\"{name}\" created", { name: p.name }));
      if (created) { setPlans((p) => [...p, created]); close(); }
    } else if (target) {
      const updated = await run(
        () => apiFetch<MembershipPlan>(`${ADMIN_API}/${sid}/membership/plans/${target.id}`, { method: "PUT", body }),
        (p) => translateUi("\"{name}\" saved", { name: p.name }));
      if (updated) { setPlans((p) => p.map((x) => (x.id === updated.id ? updated : x))); close(); }
    }
  }

  async function setStatus(plan: MembershipPlan, status: MembershipPlanStatus) {
    const updated = await run(
      () => apiFetch<MembershipPlan>(`${ADMIN_API}/${sid}/membership/plans/${plan.id}`, {
        method: "PUT", body: JSON.stringify(toBody({ ...fromPlan(plan), status })),
      }),
      (p) => `"${p.name}" — ${translateUi(PLAN_STATUS_LABEL[p.status])}`);
    if (updated) setPlans((p) => p.map((x) => (x.id === updated.id ? updated : x)));
  }

  async function remove() {
    if (!target) return;
    const ok = await run(
      () => apiFetch(`${ADMIN_API}/${sid}/membership/plans/${target.id}`, { method: "DELETE" }).then(() => true),
      () => translateUi("\"{name}\" deleted", { name: target.name }));
    if (ok) { setPlans((p) => p.filter((x) => x.id !== target.id)); close(); }
  }

  async function move(index: number, delta: number) {
    const next = [...plans];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    setPlans(next);
    const saved = await run(
      () => apiFetch<MembershipPlan[]>(`${ADMIN_API}/${sid}/membership/plans/order`, {
        method: "PUT", body: JSON.stringify({ planIds: next.map((p) => p.id) }),
      }),
      () => translateUi("Order saved"));
    if (saved) setPlans(saved);
  }

  const invalid = !f.name.trim() ? "Enter a plan name"
    : !(Number(f.price) > 0) ? "Enter a price above zero"
    : [f.serviceDiscountPercent, f.productDiscountPercent].some((d) => d && (Number(d) < 0 || Number(d) > 100)) ? "Discounts must be 0–100%"
    : f.maxMembers && !(Number(f.maxMembers) >= 1) ? "Member limit must be at least 1"
    : null;

  return (
    <>
      {plans.length === 0 ? (
        <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
          <div className="w-10 h-10 rounded-xl bg-matcha-50 border border-matcha-100 flex items-center justify-center mx-auto mb-3">
            <Ticket className="w-5 h-5 text-matcha-600" />
          </div>
          <h2 className="text-sm font-bold text-slate-800">{translateUi("No membership plans yet")}</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">{translateUi("Offer regulars a monthly or yearly plan with perks, discounts or included services.")}</p>
          <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-matcha-600 text-white text-sm font-medium hover:bg-matcha-700 cursor-pointer"
            onClick={() => { setF(blank()); setModal("add"); }}>
            <Plus className="w-4 h-4" /> {translateUi("Create a plan")}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((p, i) => (
            <div key={p.id} className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">{p.name}</span>
                  <span className={`text-[0.6rem] font-semibold px-1.5 py-0.5 rounded-full border ${PLAN_STATUS_STYLE[p.status]}`}>
                    {translateUi(PLAN_STATUS_LABEL[p.status])}
                  </span>
                  {p.highlighted && (
                    <span className="inline-flex items-center gap-0.5 text-[0.6rem] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                      <Star className="w-2.5 h-2.5" /> {translateUi("Most popular")}
                    </span>
                  )}
                  {p.soldOut && (
                    <span className="text-[0.6rem] font-semibold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">{translateUi("Full")}</span>
                  )}
                </div>
                <p className="text-sm text-slate-700 mt-1 tabular-nums">
                  {planPrice(p.price, p.currency, p.billingInterval, uiLocale)}
                  {p.signupFee ? <span className="text-xs text-slate-400"> · {translateUi("sign-up fee")} {formatPrice(p.signupFee, p.currency, uiLocale)}</span> : null}
                </p>
                <PlanBenefits plan={p} />
              </div>
              <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
                <Link to={`../members?planId=${p.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-matcha-700 no-underline">
                  <Users className="w-3.5 h-3.5" /> {p.activeMembers ?? 0}{p.maxMembers ? ` / ${p.maxMembers}` : ""} {translateUi("members")}
                </Link>
                <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
                  <IconButton label="Move up" disabled={busy || i === 0} onClick={() => move(i, -1)}><ArrowUp className="w-3 h-3" /></IconButton>
                  <IconButton label="Move down" disabled={busy || i === plans.length - 1} onClick={() => move(i, 1)}><ArrowDown className="w-3 h-3" /></IconButton>
                  {p.status !== "ACTIVE" ? (
                    <IconButton label="Put on sale" disabled={busy} onClick={() => setStatus(p, "ACTIVE")}><Check className="w-3 h-3" /></IconButton>
                  ) : (
                    <IconButton label="Archive — stop selling, keep members" disabled={busy} onClick={() => setStatus(p, "ARCHIVED")}><Archive className="w-3 h-3" /></IconButton>
                  )}
                  <IconButton label="Edit" onClick={() => { setTarget(p); setF(fromPlan(p)); setModal("edit"); }}><Pencil className="w-3 h-3" /></IconButton>
                  <IconButton label="Delete" danger disabled={busy} onClick={() => { setTarget(p); setModal("del"); }}><Trash2 className="w-3 h-3" /></IconButton>
                </div>
              </div>
            </div>
          ))}
          <div className="flex justify-end">
            <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-matcha-600 text-white text-sm font-medium hover:bg-matcha-700 cursor-pointer"
              onClick={() => { setF(blank()); setModal("add"); }}>
              <Plus className="w-4 h-4" /> {translateUi("Add plan")}
            </button>
          </div>
        </div>
      )}

      {(modal === "add" || modal === "edit") && (
        <Modal title={modal === "add" ? translateUi("New membership plan") : translateUi("Edit plan")} onClose={close}>
          {modal === "edit" && (target?.activeMembers ?? 0) > 0 && (
            <p className="mb-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              {translateUi("Price and billing changes apply to new members only — existing members keep what they signed up for.")}
            </p>
          )}
          <div className="mb-4">
            <label className={fieldLabel}>{translateUi("Plan name")} <span className="text-red-500">*</span></label>
            <input autoFocus className={inputCls} value={f.name} maxLength={160} placeholder={translateUi("e.g. Glow Monthly")}
              onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="mb-4">
            <label className={fieldLabel}>{translateUi("Description")}</label>
            <FixWithAi value={f.description} onApply={(text) => setF((p) => ({ ...p, description: text }))}>
              <textarea className={`${inputCls} min-h-[64px]`} value={f.description}
                onChange={(e) => setF((p) => ({ ...p, description: e.target.value }))} />
            </FixWithAi>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className={fieldLabel}>{translateUi("Price")} <span className="text-red-500">*</span></label>
              <input type="number" min="0" step="0.01" inputMode="decimal" className={inputCls} value={f.price}
                onChange={(e) => setF((p) => ({ ...p, price: e.target.value }))} />
            </div>
            <div>
              <label className={fieldLabel}>{translateUi("Currency")}</label>
              <select className={inputCls} value={f.currency} onChange={(e) => setF((p) => ({ ...p, currency: e.target.value }))}>
                {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={fieldLabel}>{translateUi("Billed")}</label>
              <select className={inputCls} value={f.billingInterval}
                onChange={(e) => setF((p) => ({ ...p, billingInterval: e.target.value as MembershipBillingInterval }))}>
                {BILLING_INTERVALS.map((i) => <option key={i} value={i}>{translateUi(INTERVAL_LABEL[i])}</option>)}
              </select>
            </div>
            <div>
              <label className={fieldLabel}>{translateUi("Sign-up fee")}</label>
              <input type="number" min="0" step="0.01" inputMode="decimal" className={inputCls} value={f.signupFee} placeholder={translateUi("None")}
                onChange={(e) => setF((p) => ({ ...p, signupFee: e.target.value }))} />
            </div>
            <div>
              <label className={fieldLabel}>{translateUi("Discount on services")}</label>
              <div className="relative">
                <input type="number" min="0" max="100" className={`${inputCls} pr-7`} value={f.serviceDiscountPercent} placeholder="0"
                  onChange={(e) => setF((p) => ({ ...p, serviceDiscountPercent: e.target.value }))} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
              </div>
            </div>
            {hasShop && (
              <div>
                <label className={fieldLabel}>{translateUi("Discount on products")}</label>
                <div className="relative">
                  <input type="number" min="0" max="100" className={`${inputCls} pr-7`} value={f.productDiscountPercent} placeholder="0"
                    onChange={(e) => setF((p) => ({ ...p, productDiscountPercent: e.target.value }))} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                </div>
              </div>
            )}
            <div>
              <label className={fieldLabel}>{translateUi("Member limit")}</label>
              <input type="number" min="1" className={inputCls} value={f.maxMembers} placeholder={translateUi("Unlimited")}
                onChange={(e) => setF((p) => ({ ...p, maxMembers: e.target.value }))} />
            </div>
            <div>
              <label className={fieldLabel}>{translateUi("Status")}</label>
              <select className={inputCls} value={f.status} onChange={(e) => setF((p) => ({ ...p, status: e.target.value as MembershipPlanStatus }))}>
                {(["ACTIVE", "DRAFT", "ARCHIVED"] as const).map((s) => <option key={s} value={s}>{translateUi(PLAN_STATUS_LABEL[s])}</option>)}
              </select>
            </div>
          </div>
          <p className={`${hintCls} -mt-2 mb-4`}>{translateUi("Discounts are shown to customers as plan benefits; apply them at the till for now.")}</p>

          <div className="mb-4">
            <label className={fieldLabel}>{translateUi("Included every period")}</label>
            {f.includedServices.map((inc, idx) => (
              <div key={idx} className="flex items-center gap-2 mb-2">
                <select className={inputCls} value={inc.serviceId}
                  onChange={(e) => setF((p) => ({ ...p, includedServices: p.includedServices.map((x, j) => j === idx ? { ...x, serviceId: Number(e.target.value) } : x) }))}>
                  {services.map((s) => <option key={s.id} value={s.id}>{s.name} — {formatPrice(s.price, s.currency, uiLocale)}</option>)}
                </select>
                <input type="number" min="1" aria-label={translateUi("Times per period")} className={`${inputCls} w-20`} value={inc.quantityPerCycle}
                  onChange={(e) => setF((p) => ({ ...p, includedServices: p.includedServices.map((x, j) => j === idx ? { ...x, quantityPerCycle: Math.max(1, Number(e.target.value) || 1) } : x) }))} />
                <span className="text-xs text-slate-400 shrink-0">×</span>
                <button type="button" aria-label={translateUi("Remove")} className="text-slate-400 hover:text-red-600 cursor-pointer"
                  onClick={() => setF((p) => ({ ...p, includedServices: p.includedServices.filter((_, j) => j !== idx) }))}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {services.length > 0 ? (
              <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-matcha-700 hover:text-matcha-800 cursor-pointer"
                onClick={() => setF((p) => ({ ...p, includedServices: [...p.includedServices, { serviceId: services[0].id, quantityPerCycle: 1 }] }))}>
                <Plus className="w-3.5 h-3.5" /> {translateUi("Include a service")}
              </button>
            ) : (
              <p className={hintCls}>{translateUi("Add services first to include them in a plan.")}</p>
            )}
          </div>

          <div className="mb-4">
            <label className={fieldLabel}>{translateUi("Perks")}</label>
            {f.perks.map((perk, idx) => (
              <div key={idx} className="flex items-center gap-2 mb-2">
                <input className={inputCls} value={perk} maxLength={300} placeholder={translateUi("e.g. Priority booking")}
                  onChange={(e) => setF((p) => ({ ...p, perks: p.perks.map((x, j) => j === idx ? e.target.value : x) }))} />
                <button type="button" aria-label={translateUi("Remove")} className="text-slate-400 hover:text-red-600 cursor-pointer"
                  onClick={() => setF((p) => ({ ...p, perks: p.perks.filter((_, j) => j !== idx) }))}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-matcha-700 hover:text-matcha-800 cursor-pointer"
              onClick={() => setF((p) => ({ ...p, perks: [...p.perks, ""] }))}>
              <Plus className="w-3.5 h-3.5" /> {translateUi("Add a perk")}
            </button>
          </div>

          <label className="flex items-center gap-2.5 mb-4 cursor-pointer select-none">
            <input type="checkbox" className="w-4 h-4 accent-matcha-600 cursor-pointer" checked={f.highlighted}
              onChange={(e) => setF((p) => ({ ...p, highlighted: e.target.checked }))} />
            <span className="text-sm font-medium text-slate-700">{translateUi("Highlight as “Most popular”")}</span>
          </label>

          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> {translateUi("Preview")}
            </p>
            <p className="text-sm font-bold text-slate-900">{f.name || translateUi("Plan name")}</p>
            <p className="text-lg font-bold text-slate-900 tabular-nums">
              {Number(f.price) > 0 ? planPrice(Number(f.price), f.currency, f.billingInterval, uiLocale) : "—"}
            </p>
            {f.description && <p className="text-xs text-slate-500 mt-1">{f.description}</p>}
            <PlanBenefits plan={{
              perks: f.perks.filter((p) => p.trim()),
              serviceDiscountPercent: num(f.serviceDiscountPercent),
              productDiscountPercent: num(f.productDiscountPercent),
              includedServices: f.includedServices.map((inc) => {
                const s = services.find((x) => x.id === inc.serviceId);
                return { serviceId: inc.serviceId, name: s?.name ?? "", quantityPerCycle: inc.quantityPerCycle };
              }),
            }} />
          </div>

          <ModalActions busy={busy} onCancel={close} onSave={save} disabled={!!invalid} validationHint={invalid ? translateUi(invalid) : undefined}
            saveLabel={modal === "add" ? translateUi("Create plan") : translateUi("Save changes")} />
        </Modal>
      )}

      {modal === "del" && target && (
        <Modal title={translateUi("Delete plan")} onClose={close} narrow>
          {(target.activeMembers ?? 0) > 0 ? (
            <>
              <p className="text-sm text-slate-600 leading-relaxed">
                {translateUi("“{name}” has members, so it can't be deleted. Archive it instead — it disappears from your website and existing members keep their membership.", { name: target.name })}
              </p>
              <ModalActions busy={busy} onCancel={close} saveLabel={translateUi("Archive plan")}
                onSave={async () => { await setStatus(target, "ARCHIVED"); close(); }} />
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600 leading-relaxed">
                {translateUi("Delete “{name}”? This can't be undone.", { name: target.name })}
              </p>
              <ModalActions busy={busy} onCancel={close} onSave={remove} saveLabel={translateUi("Delete")} danger />
            </>
          )}
        </Modal>
      )}

      <Toast toast={toast} />
    </>
  );
}

/** Included services, discounts and perks as a compact list — shared by the plan rows and the editor preview. */
function PlanBenefits({ plan }: {
  plan: Pick<MembershipPlan, "perks" | "serviceDiscountPercent" | "productDiscountPercent"> & {
    includedServices: { serviceId: number; name: string; quantityPerCycle: number }[];
  };
}) {
  const { t: translateUi } = useI18n();
  const lines = [
    ...plan.includedServices.filter((s) => s.name).map((s) => `${s.quantityPerCycle}× ${s.name}`),
    ...(plan.serviceDiscountPercent ? [translateUi("{percent}% off services", { percent: plan.serviceDiscountPercent })] : []),
    ...(plan.productDiscountPercent ? [translateUi("{percent}% off products", { percent: plan.productDiscountPercent })] : []),
    ...plan.perks,
  ];
  if (!lines.length) return null;
  return (
    <ul className="mt-2 space-y-0.5">
      {lines.map((line, i) => (
        <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
          <Check className="w-3.5 h-3.5 text-matcha-600 shrink-0 mt-px" /> {line}
        </li>
      ))}
    </ul>
  );
}

function IconButton({ label, onClick, disabled, danger, children }: {
  label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode;
}) {
  const { t: translateUi } = useI18n();
  return (
    <button type="button" title={translateUi(label)} aria-label={translateUi(label)} disabled={disabled} onClick={onClick}
      className={`inline-flex items-center px-2.5 py-1.5 rounded-md border text-xs font-medium bg-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
        danger ? "border-red-200 text-red-600 hover:bg-red-50" : "border-slate-200 text-slate-600 hover:bg-slate-50"
      }`}>
      {children}
    </button>
  );
}
