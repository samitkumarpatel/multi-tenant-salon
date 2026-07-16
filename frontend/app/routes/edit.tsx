import { useState } from "react";
import { useOutletContext, useLoaderData, useSearchParams } from "react-router";
import { API, COUNTRIES_API, apiFetch } from "~/lib/api";
import { FEATURES, FEATURE_LABEL, cloneHours } from "~/lib/constants";
import type { LayoutContext, Saloon, Location, ContactInfo, Country } from "~/lib/types";
import HoursTable from "~/components/HoursTable";
import TileGrid from "~/components/TileGrid";
import CountrySelect from "~/components/CountrySelect";
import PhoneInput from "~/components/PhoneInput";
import InfoBar from "~/components/InfoBar";

export async function clientLoader() {
  const countries = await apiFetch<Country[]>(COUNTRIES_API).catch((): Country[] => []);
  return { countries };
}

const STEPS = [
  { title: "Saloon name",    hint: "Update your saloon's display name." },
  { title: "Location",       hint: "Where is your saloon located?" },
  { title: "Contact",        hint: "How can customers reach you?" },
  { title: "Features",       hint: "Enable or disable what your saloon offers." },
  { title: "Opening hours",  hint: "Set your weekly schedule." },
] as const;

const TOTAL = STEPS.length;

const inputCls = "w-full px-4 py-3 border border-stone-200 rounded-xl text-sm outline-none focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 bg-white text-stone-900 transition-all placeholder:text-stone-300";
const labelCls = "block text-xs font-semibold text-stone-500 mb-1.5 uppercase tracking-wide";
const fieldCls = "mb-4";

export default function Edit() {
  const { saloon, setSaloon } = useOutletContext<LayoutContext>();
  const { countries }         = useLoaderData<typeof clientLoader>();
  const [searchParams]        = useSearchParams();

  const initialStep = Math.min(Math.max(0, Number(searchParams.get("step") ?? 0)), TOTAL - 1);
  const [step, setStep] = useState(initialStep);

  const [name,     setName]     = useState(saloon.name);
  const [location, setLoc]      = useState<Location>(saloon.location  ? { ...saloon.location }  : {});
  const [contact,  setContact]  = useState<ContactInfo>(saloon.contact ? { ...saloon.contact }  : {});
  const [hours,    setHours]    = useState(cloneHours(saloon.operatingHours));
  const [features, setFeatures] = useState<string[]>([...(saloon.features ?? [])]);

  const [errors,    setErrors]    = useState<Record<string, string>>({});
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved,     setSaved]     = useState(false);

  function patchLoc(patch: Partial<Location>)     { setLoc((l) => ({ ...l, ...patch })); }
  function patchCon(patch: Partial<ContactInfo>)  { setContact((c) => ({ ...c, ...patch })); }

  function validate(s: number): Record<string, string> {
    const e: Record<string, string> = {};
    if (s === 0 && !name.trim()) e.name = "Saloon name is required.";
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
    setSaveError(null);
    setSaving(true);
    try {
      const updated = await apiFetch<Saloon>(`${API}/${saloon.id}`, {
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
          },
          operatingHours: hours,
        }),
      });
      const withFeatures = await apiFetch<Saloon>(`${API}/${saloon.id}/features`, {
        method: "PUT",
        body: JSON.stringify(features),
      });
      setSaloon({ ...updated, features: withFeatures.features ?? features });
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

      case 1:
        return (
          <div>
            <div className={fieldCls}>
              <label className={labelCls}>Country / Region</label>
              <CountrySelect value={location.country ?? ""} onChange={(v) => patchLoc({ country: v })} countries={countries} />
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
          </div>
        );

      case 2:
        return (
          <div>
            <div className={fieldCls}>
              <label className={labelCls}>Phone</label>
              <PhoneInput value={contact.phone ?? ""} onChange={(v) => patchCon({ phone: v })} countries={countries} />
            </div>
            <div className={fieldCls}>
              <label className={labelCls}>Email</label>
              <input type="email" className={inputCls} value={contact.email ?? ""} onChange={(e) => patchCon({ email: e.target.value })} placeholder="hello@yoursaloon.com" />
            </div>
            <div className={fieldCls}>
              <label className={labelCls}>Website</label>
              <input className={inputCls} value={contact.website ?? ""} onChange={(e) => patchCon({ website: e.target.value })} placeholder="https://yoursaloon.com" />
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
        <h1 className="text-xl font-bold text-stone-900">Edit Saloon</h1>
        <InfoBar>
          Update your saloon's name, location, contact info, opening hours, and which features are active.
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
