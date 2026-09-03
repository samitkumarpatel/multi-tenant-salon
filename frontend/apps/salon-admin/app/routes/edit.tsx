import { useState } from "react";
import { Link, useOutletContext, useLoaderData, useSearchParams, useRevalidator } from "react-router";
import { ADMIN_API, COUNTRIES_API, apiFetch } from "~/lib/api";
import { FEATURES, FEATURE_LABEL, cloneHours } from "~/lib/constants";
import type { LayoutContext, Salon, Location, ContactInfo, Country } from "~/lib/types";
import { HoursTable, TileGrid, CountrySelect, PhoneInput, InfoBar } from "@salon/ui-shared";
import { SOCIAL_PLATFORMS } from "@salon/ui-website";

export async function clientLoader() {
  const countries = await apiFetch<Country[]>(COUNTRIES_API).catch((): Country[] => []);
  return { countries };
}

const STEPS = [
  { title: "Salon name",    hint: "Update your salon's display name." },
  { title: "Location",       hint: "Where is your salon located?" },
  { title: "Contact",        hint: "How can customers reach you?" },
  { title: "Features",       hint: "Enable or disable what your salon offers." },
  { title: "Opening hours",  hint: "Set your weekly schedule." },
] as const;

const TOTAL = STEPS.length;

const inputCls = "w-full px-4 py-3 border border-stone-200 rounded-xl text-sm outline-none focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 bg-white text-stone-900 transition-all placeholder:text-stone-300";
const labelCls = "block text-xs font-semibold text-stone-500 mb-1.5 uppercase tracking-wide";
const fieldCls = "mb-4";

export default function Edit() {
  const { salon, setSalon } = useOutletContext<LayoutContext>();
  const { countries }         = useLoaderData<typeof clientLoader>();
  const [searchParams]        = useSearchParams();
  const { revalidate }        = useRevalidator();

  const initialStep = Math.min(Math.max(0, Number(searchParams.get("step") ?? 0)), TOTAL - 1);
  const [step, setStep] = useState(initialStep);

  const [name,      setName]      = useState(salon.name);
  const [location,  setLoc]       = useState<Location>(salon.location  ? { ...salon.location }  : {});
  const [contact,   setContact]   = useState<ContactInfo>(salon.contact ? { ...salon.contact }  : {});
  const [hours,     setHours]     = useState(cloneHours(salon.operatingHours));
  const [features,  setFeatures]  = useState<string[]>([...(salon.features ?? [])]);
  const [bizRegId,  setBizRegId]  = useState(salon.businessRegistrationId ?? "");
  const [showBizId, setShowBizId] = useState(salon.showBusinessId ?? false);

  const [errors,    setErrors]    = useState<Record<string, string>>({});
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved,     setSaved]     = useState(false);

  function patchLoc(patch: Partial<Location>)     { setLoc((l) => ({ ...l, ...patch })); }
  function patchCon(patch: Partial<ContactInfo>)  { setContact((c) => ({ ...c, ...patch })); }

  function validate(s: number): Record<string, string> {
    const e: Record<string, string> = {};
    if (s === 0 && !name.trim()) e.name = "Salon name is required.";
    return e;
  }

  function goNext() {
    const e = validate(step);
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setStep((s) => s + 1);
  }

  function goBack() { setErrors({}); setStep((s) => s - 1); }

  async function handleSave() {
    if (!name.trim()) { setErrors({ name: "Salon name is required." }); setStep(0); return; }
    setSaveError(null);
    setSaving(true);
    try {
      const updated = await apiFetch<Salon>(`${ADMIN_API}/${salon.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: name.trim(),
          location: {
            address: location.address?.trim() || null,
            city:    location.city?.trim()    || null,
            state:   location.state?.trim()   || null,
            country: location.country?.trim() || null,
            zipCode: location.zipCode?.trim() || null,
          },
          contact: {
            phone:   contact.phone?.trim()   || null,
            email:   contact.email?.trim()   || null,
            website: contact.website?.trim() || null,
            ...Object.fromEntries(
              SOCIAL_PLATFORMS.flatMap((p) => [
                [p.urlKey, contact[p.urlKey]?.trim() || null],
                [p.visibleKey, contact[p.visibleKey] === true],
              ]),
            ),
          },
          operatingHours: hours,
          businessRegistrationId: bizRegId.trim() || null,
          showBusinessId: showBizId,
        }),
      });
      const withFeatures = await apiFetch<Salon>(`${ADMIN_API}/${salon.id}/features`, {
        method: "PUT",
        body: JSON.stringify(features),
      });
      setSalon({ ...updated, features: withFeatures.features ?? features });
      revalidate();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function renderStep() {
    switch (step) {
      case 0:
        return (
          <div>
            <input
              autoFocus
              className={`${inputCls} text-lg font-semibold py-4 ${errors.name ? "border-red-400 focus:border-red-400 focus:ring-red-400/10" : ""}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. The Modern Cut"
              onKeyDown={(e) => e.key === "Enter" && goNext()}
            />
            {errors.name && <p className="text-red-500 text-xs mt-2">{errors.name}</p>}
          </div>
        );

      case 1: {
        const selectedCountry  = countries.find((c) => c.name === location.country);
        const bizIdLabel       = selectedCountry?.businessIdLabel ?? salon.businessIdLabel ?? null;
        const bizIdPlaceholder = selectedCountry?.businessIdPlaceholder ?? "";
        return (
          <div>
            <div className={fieldCls}>
              <label className={labelCls}>Country / Region</label>
              <CountrySelect
                value={location.country ?? ""}
                onChange={(v) => { patchLoc({ country: v }); setBizRegId(""); setShowBizId(false); }}
                countries={countries}
              />
            </div>
            <div className={fieldCls}>
              <label className={labelCls}>Address</label>
              <input className={inputCls} value={location.address ?? ""} onChange={(e) => patchLoc({ address: e.target.value })} placeholder="123 Main St" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className={fieldCls}>
                <label className={labelCls}>Postal code</label>
                <input className={inputCls} value={location.zipCode ?? ""} onChange={(e) => patchLoc({ zipCode: e.target.value })} placeholder="94105" />
              </div>
              <div className={fieldCls}>
                <label className={labelCls}>Town</label>
                <input className={inputCls} value={location.city ?? ""} onChange={(e) => patchLoc({ city: e.target.value })} placeholder="San Francisco" />
              </div>
            </div>
            {bizIdLabel && (
              <div className={fieldCls}>
                <label className={labelCls}>
                  {bizIdLabel}{" "}
                  <span className="text-stone-300 font-normal normal-case tracking-normal">optional</span>
                </label>
                <input
                  className={inputCls}
                  value={bizRegId}
                  onChange={(e) => setBizRegId(e.target.value)}
                  placeholder={bizIdPlaceholder}
                />
                {bizRegId && (
                  <label className="flex items-center gap-2.5 mt-2.5 cursor-pointer select-none">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={showBizId}
                      onClick={() => setShowBizId((v) => !v)}
                      className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer shrink-0 ${showBizId ? "bg-matcha-600" : "bg-stone-200"}`}
                    >
                      <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${showBizId ? "translate-x-4" : "translate-x-0.5"}`} />
                    </button>
                    <span className="text-xs text-stone-500">Show on public website</span>
                  </label>
                )}
              </div>
            )}
          </div>
        );
      }

      case 2:
        return (
          <div>
            <div className={fieldCls}>
              <label className={labelCls}>Phone</label>
              <PhoneInput value={contact.phone ?? ""} onChange={(v) => patchCon({ phone: v })} countries={countries} />
            </div>
            <div className={fieldCls}>
              <label className={labelCls}>Email</label>
              <input type="email" className={inputCls} value={contact.email ?? ""} onChange={(e) => patchCon({ email: e.target.value })} placeholder="hello@yoursalon.com" />
            </div>
            <div className={fieldCls}>
              <label className={labelCls}>Website</label>
              <input className={inputCls} value={contact.website ?? ""} onChange={(e) => patchCon({ website: e.target.value })} placeholder="https://yoursalon.com" />
            </div>

            <div className="pt-3 mt-1 border-t border-stone-100">
              <label className={labelCls}>Social media</label>
              <p className="text-xs text-stone-400 mb-3 -mt-0.5">
                Turn a platform on to show its icon in your website footer. Add the link to make it clickable —
                a visible platform with no link shows as a disabled icon.
              </p>
              <div className="space-y-2.5">
                {SOCIAL_PLATFORMS.map((p) => {
                  const on = contact[p.visibleKey] === true;
                  return (
                    <div key={p.key} className="flex items-center gap-2.5">
                      <span className="flex items-center gap-1.5 w-[104px] shrink-0 text-xs font-medium text-stone-600">
                        <p.Icon className={`w-4 h-4 shrink-0 ${on ? "text-stone-500" : "text-stone-300"}`} />
                        <span className="truncate">{p.label}</span>
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        aria-label={`Show ${p.label} icon`}
                        onClick={() => patchCon({ [p.visibleKey]: !on } as Partial<ContactInfo>)}
                        className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer shrink-0 ${on ? "bg-matcha-600" : "bg-stone-200"}`}
                      >
                        <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`} />
                      </button>
                      <input
                        className={`${inputCls} ${on ? "" : "opacity-50"}`}
                        value={contact[p.urlKey] ?? ""}
                        onChange={(e) => patchCon({ [p.urlKey]: e.target.value } as Partial<ContactInfo>)}
                        placeholder={p.placeholder}
                        aria-label={`${p.label} URL`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <TileGrid
            options={FEATURES}
            labels={FEATURE_LABEL}
            selected={features}
            onChange={setFeatures}
          />
        );

      case 4:
        return (
          <HoursTable
            hours={hours}
            onChange={setHours}
          />
        );
    }
  }

  const progress = Math.round((step / (TOTAL - 1)) * 100);
  const isLast   = step === TOTAL - 1;

  return (
    <div className="max-w-lg mx-auto">
      {/* Page intro */}
      <div className="mb-6 space-y-2">
        <Link to=".." relative="path" className="inline-flex items-center gap-1 text-xs font-medium text-stone-400 hover:text-stone-600 no-underline">
          ← Overview
        </Link>
        <h1 className="text-xl font-bold text-stone-900">Edit Salon</h1>
        <InfoBar id="edit-salon">
          Update your salon's name, location, contact info, opening hours, and which features are active.
          Enabling a feature here unlocks its dedicated section in the sidebar.
        </InfoBar>
      </div>

      {/* Step header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-stone-800">{STEPS[step].title}</span>
          <span className="text-xs text-stone-400 tabular-nums">{step + 1} / {TOTAL}</span>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-stone-100 rounded-full overflow-hidden">
          <div
            className="h-1 bg-matcha-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-1.5 mt-2.5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => { if (i < step) { setErrors({}); setStep(i); } }}
              disabled={i >= step}
              aria-label={`Go to step ${i + 1}`}
              className={`rounded-full transition-all duration-300 disabled:cursor-default ${
                i === step ? "w-6 h-2 bg-matcha-600" :
                i < step   ? "w-2 h-2 bg-matcha-400 hover:bg-matcha-600 cursor-pointer" :
                             "w-2 h-2 bg-stone-200"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">

        {/* Hint strip */}
        <div className="px-6 pt-5 pb-4 border-b border-stone-100">
          <p className="text-xs text-stone-400">{STEPS[step].hint}</p>
        </div>

        {/* Step content */}
        <div key={step} className="px-6 py-5 animate-[fade-in_0.18s_ease]">
          {saveError && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {saveError}
            </div>
          )}
          {saved && (
            <div className="mb-4 px-4 py-3 bg-matcha-50 border border-matcha-200 rounded-xl text-sm text-matcha-700 font-medium">
              Changes saved!
            </div>
          )}
          {renderStep()}
        </div>

        {/* Navigation footer */}
        <div className="px-6 py-4 border-t border-stone-100 flex justify-between items-center bg-stone-50/60">
          {step > 0 ? (
            <button
              onClick={goBack}
              className="px-4 py-2 rounded-xl border border-stone-200 bg-white text-sm text-stone-600 hover:border-stone-400 hover:bg-stone-50 active:scale-[0.97] transition-all cursor-pointer"
            >
              ← Back
            </button>
          ) : <span />}

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-4 py-2 rounded-xl text-sm font-medium active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                isLast
                  ? "bg-matcha-600 text-white hover:bg-matcha-700 shadow-sm px-6"
                  : "border border-stone-200 bg-white text-stone-600 hover:border-matcha-400 hover:text-matcha-700"
              }`}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {!isLast && (
              <button
                onClick={goNext}
                className="px-6 py-2 rounded-xl bg-matcha-600 text-sm font-medium text-white hover:bg-matcha-700 active:scale-[0.97] transition-all cursor-pointer shadow-sm"
              >
                Next →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
