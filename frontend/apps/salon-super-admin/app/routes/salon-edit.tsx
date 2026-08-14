import { useState } from "react";
import { useOutletContext, useRevalidator } from "react-router";
import { useLoaderData } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { Check } from "lucide-react";
import { apiFetch, ADMIN_API, SUPER_ADMIN_API, COUNTRIES_API } from "~/lib/api";
import type { Salon, Owner, Location, ContactInfo, OperatingHours, Country, SalonFeature, SalonManageContext } from "~/lib/types";

export async function clientLoader(_: ClientLoaderFunctionArgs) {
  const countries = await apiFetch<Country[]>(COUNTRIES_API).catch((): Country[] => []);
  return { countries };
}

const ALL_FEATURES: SalonFeature[] = ["STATIC_WEBSITE", "BOOKING", "MEMBERSHIP", "WEBSHOP", "ANALYTICS", "LOYALTY_PROGRAM"];
const FEATURE_LABEL: Record<string, string> = {
  STATIC_WEBSITE: "Website", BOOKING: "Booking", MEMBERSHIP: "Membership",
  WEBSHOP: "Web Shop", ANALYTICS: "Analytics", LOYALTY_PROGRAM: "Loyalty Program",
};
const DAYS = ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"];
const DAY_SHORT: Record<string,string> = {
  MONDAY:"Mon",TUESDAY:"Tue",WEDNESDAY:"Wed",THURSDAY:"Thu",
  FRIDAY:"Fri",SATURDAY:"Sat",SUNDAY:"Sun",
};

function defaultHours(): OperatingHours[] {
  return DAYS.map((day) => ({ day, openTime: "09:00", closeTime: "18:00", closed: day === "SUNDAY" }));
}
function cloneHours(src?: OperatingHours[]): OperatingHours[] {
  if (!src?.length) return defaultHours();
  return DAYS.map((day) => {
    const h = src.find((x) => x.day === day);
    return h ? { ...h } : { day, openTime: "09:00", closeTime: "18:00", closed: true };
  });
}

const inp = "w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-stone-100 text-stone-900 outline-none focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 transition placeholder:text-stone-400";
const lbl = "block text-xs font-semibold text-stone-500 mb-1.5 uppercase tracking-wide";

const STEPS = [
  { title: "Salon name",   hint: "Update the salon's display name." },
  { title: "Ownership",     hint: "Change who owns and manages this salon." },
  { title: "Location",      hint: "Where is the salon located?" },
  { title: "Contact info",  hint: "How can customers reach the salon?" },
  { title: "Features",      hint: "Enable or disable features for this salon." },
  { title: "Opening hours", hint: "Set the weekly operating schedule." },
] as const;

function HoursEditor({ hours, onChange }: { hours: OperatingHours[]; onChange: (h: OperatingHours[]) => void }) {
  const ensured = DAYS.map((day) => hours.find((h) => h.day === day) ?? { day, openTime: "09:00", closeTime: "18:00", closed: false });
  function update(idx: number, patch: Partial<OperatingHours>) {
    onChange(ensured.map((h, i) => (i === idx ? { ...h, ...patch } : h)));
  }
  return (
    <div className="space-y-2">
      {ensured.map((h, idx) => (
        <div key={h.day} className="flex items-center gap-3">
          <span className="w-8 text-xs font-medium text-stone-500 shrink-0">{DAY_SHORT[h.day]}</span>
          <button
            type="button"
            onClick={() => update(idx, { closed: !h.closed })}
            className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer shrink-0 ${h.closed ? "bg-stone-200" : "bg-matcha-600"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${h.closed ? "translate-x-0" : "translate-x-4"}`} />
          </button>
          {!h.closed ? (
            <>
              <input type="time" value={h.openTime ?? "09:00"} onChange={(e) => update(idx, { openTime: e.target.value })}
                className="flex-1 px-2 py-1 text-xs border border-stone-200 rounded-md bg-stone-100 text-stone-800 outline-none focus:border-matcha-500" />
              <span className="text-stone-400 text-xs">–</span>
              <input type="time" value={h.closeTime ?? "18:00"} onChange={(e) => update(idx, { closeTime: e.target.value })}
                className="flex-1 px-2 py-1 text-xs border border-stone-200 rounded-md bg-stone-100 text-stone-800 outline-none focus:border-matcha-500" />
            </>
          ) : (
            <span className="text-xs text-stone-400 italic">Closed</span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function SalonEdit() {
  const { salon, setSalon } = useOutletContext<SalonManageContext>();
  const { countries } = useLoaderData<typeof clientLoader>();
  const { revalidate } = useRevalidator();

  const [step, setStep] = useState(0);
  const [name, setName] = useState(salon.name);
  const [owner, setOwner] = useState<Owner>(salon.owner ? { ...salon.owner } : { name: "", email: "", phone: "" });
  const [location, setLoc] = useState<Location>(salon.location ? { ...salon.location } : {});
  const [contact, setContact] = useState<ContactInfo>(salon.contact ? { ...salon.contact } : {});
  const [hours, setHours] = useState(cloneHours(salon.operatingHours));
  const [features, setFeatures] = useState<SalonFeature[]>([...(salon.features ?? [])]);
  const [bizRegId, setBizRegId] = useState(salon.businessRegistrationId ?? "");
  const [showBizId, setShowBizId] = useState(salon.showBusinessId ?? false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const patchOwner = (p: Partial<Owner>) => setOwner((o) => ({ ...o, ...p }));
  const patchLoc = (p: Partial<Location>) => setLoc((l) => ({ ...l, ...p }));
  const patchCon = (p: Partial<ContactInfo>) => setContact((c) => ({ ...c, ...p }));

  function toggleFeature(f: SalonFeature) {
    setFeatures((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);
  }

  function validate(s: number) {
    const e: Record<string, string> = {};
    if (s === 0 && !name.trim()) e.name = "Salon name is required.";
    if (s === 1) {
      if (!owner.name.trim()) e.ownerName = "Owner name is required.";
      if (!owner.email.trim()) e.ownerEmail = "Owner email is required.";
    }
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
    setSaveErr(null);
    setSaving(true);
    try {
      // Owner change goes to the super-admin-only endpoint
      const ownerChanged =
        owner.name.trim()  !== (salon.owner?.name  ?? "") ||
        owner.email.trim() !== (salon.owner?.email ?? "") ||
        (owner.phone?.trim() || null) !== (salon.owner?.phone ?? null);
      if (ownerChanged) {
        await apiFetch<Salon>(`${SUPER_ADMIN_API}/salons/${salon.id}/owner`, {
          method: "PUT",
          body: JSON.stringify({
            name:  owner.name.trim(),
            email: owner.email.trim(),
            phone: owner.phone?.trim() || null,
          }),
        });
      }

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
      setSaveErr(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const selectedCountry = countries.find((c) => c.name === location.country);
  const bizIdLabel      = selectedCountry?.businessIdLabel ?? null;

  function renderStep() {
    switch (step) {
      case 0:
        return (
          <div>
            <input
              autoFocus
              className={`${inp} text-base font-semibold ${errors.name ? "border-red-500" : ""}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. The Modern Cut"
              onKeyDown={(e) => e.key === "Enter" && goNext()}
            />
            {errors.name && <p className="text-red-600 text-xs mt-1.5">{errors.name}</p>}
          </div>
        );
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <label className={lbl}>Full name <span className="text-red-500">*</span></label>
              <input className={`${inp} ${errors.ownerName ? "border-red-500" : ""}`}
                value={owner.name} onChange={(e) => patchOwner({ name: e.target.value })}
                placeholder="Jane Smith" />
              {errors.ownerName && <p className="text-red-600 text-xs mt-1">{errors.ownerName}</p>}
            </div>
            <div>
              <label className={lbl}>Email <span className="text-red-500">*</span></label>
              <input type="email" className={`${inp} ${errors.ownerEmail ? "border-red-500" : ""}`}
                value={owner.email} onChange={(e) => patchOwner({ email: e.target.value })}
                placeholder="owner@salon.com" />
              {errors.ownerEmail && <p className="text-red-600 text-xs mt-1">{errors.ownerEmail}</p>}
              <p className="text-xs text-stone-400 mt-1.5">This email is used for owner login — changing it affects access.</p>
            </div>
            <div>
              <label className={lbl}>Phone</label>
              <input type="tel" className={inp}
                value={owner.phone ?? ""} onChange={(e) => patchOwner({ phone: e.target.value })}
                placeholder="+1 555 000 0000" />
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <div>
              <label className={lbl}>Country</label>
              <select
                value={location.country ?? ""}
                onChange={(e) => { patchLoc({ country: e.target.value }); setBizRegId(""); setShowBizId(false); }}
                className={`${inp} appearance-none`}
              >
                <option value="">Select country…</option>
                {countries.map((c) => <option key={c.code} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Address</label>
              <input className={inp} value={location.address ?? ""} onChange={(e) => patchLoc({ address: e.target.value })} placeholder="123 Main St" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Postal code</label>
                <input className={inp} value={location.zipCode ?? ""} onChange={(e) => patchLoc({ zipCode: e.target.value })} placeholder="94105" />
              </div>
              <div>
                <label className={lbl}>City</label>
                <input className={inp} value={location.city ?? ""} onChange={(e) => patchLoc({ city: e.target.value })} placeholder="San Francisco" />
              </div>
            </div>
            {bizIdLabel && (
              <div>
                <label className={lbl}>{bizIdLabel} <span className="text-stone-400 font-normal normal-case">optional</span></label>
                <input className={inp} value={bizRegId} onChange={(e) => setBizRegId(e.target.value)} placeholder={selectedCountry?.businessIdPlaceholder ?? ""} />
                {bizRegId && (
                  <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                    <button
                      type="button"
                      onClick={() => setShowBizId((v) => !v)}
                      className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer ${showBizId ? "bg-matcha-600" : "bg-stone-200"}`}
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
      case 3:
        return (
          <div className="space-y-4">
            <div>
              <label className={lbl}>Phone</label>
              <input type="tel" className={inp} value={contact.phone ?? ""} onChange={(e) => patchCon({ phone: e.target.value })} placeholder="+1 555 000 0000" />
            </div>
            <div>
              <label className={lbl}>Email</label>
              <input type="email" className={inp} value={contact.email ?? ""} onChange={(e) => patchCon({ email: e.target.value })} placeholder="hello@salon.com" />
            </div>
            <div>
              <label className={lbl}>Website</label>
              <input className={inp} value={contact.website ?? ""} onChange={(e) => patchCon({ website: e.target.value })} placeholder="https://salon.com" />
            </div>
          </div>
        );
      case 4:
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ALL_FEATURES.map((f) => {
              const on = features.includes(f);
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => toggleFeature(f)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    on ? "bg-matcha-50 border-matcha-300 text-matcha-700" : "bg-stone-50 border-stone-200 text-stone-500 hover:border-stone-300"
                  }`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? "bg-matcha-600 border-matcha-500" : "border-stone-300"}`}>
                    {on && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <span className="text-sm font-medium">{FEATURE_LABEL[f]}</span>
                </button>
              );
            })}
          </div>
        );
      case 5:
        return <HoursEditor hours={hours} onChange={setHours} />;
    }
  }

  const isLast = step === STEPS.length - 1;
  const progress = Math.round((step / (STEPS.length - 1)) * 100);

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-bold text-stone-900 mb-6">Edit Salon</h1>

      {/* Step header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-stone-800">{STEPS[step].title}</span>
          <span className="text-xs text-stone-400 tabular-nums">{step + 1} / {STEPS.length}</span>
        </div>
        <div className="h-1 bg-stone-100 rounded-full overflow-hidden">
          <div className="h-1 bg-matcha-600 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center justify-center gap-1.5 mt-2.5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => { if (i < step) { setErrors({}); setStep(i); } }}
              disabled={i >= step}
              className={`rounded-full transition-all duration-300 disabled:cursor-default ${
                i === step ? "w-6 h-2 bg-matcha-500" :
                i < step   ? "w-2 h-2 bg-indigo-700 hover:bg-matcha-500 cursor-pointer" :
                             "w-2 h-2 bg-stone-200"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Card */}
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-stone-200">
          <p className="text-xs text-stone-400">{STEPS[step].hint}</p>
        </div>
        <div key={step} className="px-5 py-5">
          {saveErr && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{saveErr}</div>
          )}
          {saved && (
            <div className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 font-medium flex items-center gap-2">
              <Check className="w-4 h-4" /> Changes saved!
            </div>
          )}
          {renderStep()}
        </div>
        <div className="px-5 py-4 border-t border-stone-200 flex justify-between items-center bg-stone-50">
          {step > 0 ? (
            <button onClick={goBack} className="px-4 py-2 rounded-lg border border-stone-200 text-sm text-stone-500 hover:text-stone-800 hover:border-stone-300 transition-all cursor-pointer">
              ← Back
            </button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer disabled:opacity-50 ${
                isLast
                  ? "bg-matcha-600 text-white hover:bg-matcha-500 px-6"
                  : "border border-stone-200 text-stone-500 hover:border-matcha-500 hover:text-matcha-600"
              }`}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {!isLast && (
              <button onClick={goNext} className="px-5 py-2 rounded-lg bg-matcha-600 text-sm font-medium text-white hover:bg-matcha-500 transition-all cursor-pointer">
                Next →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
