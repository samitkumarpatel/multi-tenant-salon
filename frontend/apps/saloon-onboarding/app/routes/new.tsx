import { useState, useEffect } from "react";
import { Link, useLoaderData } from "react-router";
import { Check, Copy, Scissors, Loader2, AlertCircle } from "lucide-react";
import { ONBOARDING_API, COUNTRIES_API, apiFetch } from "~/lib/api";
import { SALOON_DOMAIN, ADMIN_APP_URL } from "~/lib/config";
import { DAY_SHORT, FEATURES, FEATURE_LABEL, defaultHours } from "~/lib/constants";
import type { Country, Owner, Location, ContactInfo, OperatingHours } from "~/lib/types";
import { HoursTable, TileGrid, CountrySelect, PhoneInput, Toast, useToast } from "@saloon/ui-shared";

export async function clientLoader() {
  let countries: Country[] = [];
  let countriesError: string | null = null;
  try {
    countries = await apiFetch<Country[]>(COUNTRIES_API);
  } catch (e: unknown) {
    countriesError = e instanceof Error ? e.message : "Could not load country/phone-code data";
  }
  return { countries, countriesError };
}

function previewUrl(name: string) {
  const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  return slug ? `${slug}.${SALOON_DOMAIN}` : null;
}

const STEPS = [
  { title: "Saloon name",     hint: "Choose a name that represents your brand." },
  { title: "Owner details",   hint: "Who is the account holder?" },
  { title: "Location",        hint: "Where is your saloon? Country is required." },
  { title: "Contact",         hint: "How can customers reach you? All optional." },
  { title: "Features",        hint: "Select everything your saloon offers." },
  { title: "Opening hours",   hint: "Set your weekly schedule." },
  { title: "Review & launch", hint: "Everything look right? Go live!" },
] as const;

const TOTAL = STEPS.length;

interface FormState {
  name: string;
  owner: Owner;
  location: Location;
  contact: ContactInfo;
  hours: OperatingHours[];
  features: string[];
}

function emptyForm(): FormState {
  return {
    name: "",
    owner:    { name: "", email: "", phone: "" },
    location: { address: "", city: "", state: "", country: "", zipCode: "" },
    contact:  { phone: "", email: "", website: "" },
    hours:    defaultHours(),
    features: ["STATIC_WEBSITE"],
  };
}

const inputCls = "w-full px-4 py-3 border border-stone-200 rounded-xl text-sm outline-none focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 bg-white text-stone-900 transition-all placeholder:text-stone-300";
const labelCls = "block text-xs font-semibold text-stone-500 mb-1.5 uppercase tracking-wide";
const fieldCls = "mb-4";

// ── Field error ─────────────────────────────────────────────────────────────
function FieldError({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-red-50 border border-red-100 rounded-lg animate-[fade-in_0.15s_ease]">
      <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
      <span className="text-xs font-medium text-red-600">{msg}</span>
    </div>
  );
}

// ── Review step ─────────────────────────────────────────────────────────────
function ReviewSection({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="bg-stone-50 border border-stone-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-stone-400 uppercase tracking-wide">{title}</span>
        <button
          onClick={onEdit}
          className="text-xs text-matcha-600 hover:text-matcha-700 cursor-pointer font-medium px-2 py-0.5 rounded-lg hover:bg-matcha-50 transition-colors"
        >
          Edit
        </button>
      </div>
      {children}
    </div>
  );
}

function ReviewStep({ form, onEdit }: { form: FormState; onEdit: (s: number) => void }) {
  const url      = previewUrl(form.name);
  const openDays = form.hours.filter((h) => !h.closed).map((h) => DAY_SHORT[h.day] ?? h.day).join(", ");
  const hasLoc   = form.location.address || form.location.city || form.location.country;
  const hasCon   = form.contact.phone   || form.contact.email  || form.contact.website;

  return (
    <div className="flex flex-col gap-3">
      <ReviewSection title="Saloon" onEdit={() => onEdit(0)}>
        <p className="font-semibold text-stone-900">{form.name}</p>
        {url && <p className="text-matcha-600 text-xs mt-0.5">{url}</p>}
      </ReviewSection>

      <ReviewSection title="Owner" onEdit={() => onEdit(1)}>
        <p className="font-medium text-stone-900 text-sm">{form.owner.name}</p>
        <p className="text-stone-500 text-xs">{form.owner.email}</p>
        {form.owner.phone && <p className="text-stone-500 text-xs">{form.owner.phone}</p>}
      </ReviewSection>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ReviewSection title="Location" onEdit={() => onEdit(2)}>
          {hasLoc ? (
            <div className="text-sm text-stone-600 space-y-0.5">
              {form.location.country && <p>{form.location.country}</p>}
              {form.location.address && <p>{form.location.address}</p>}
              <p>{[form.location.zipCode, form.location.city].filter(Boolean).join(" ")}</p>
            </div>
          ) : (
            <p className="text-stone-400 text-sm">Not specified</p>
          )}
        </ReviewSection>

        <ReviewSection title="Contact" onEdit={() => onEdit(3)}>
          {hasCon ? (
            <div className="text-sm text-stone-600 space-y-0.5">
              {form.contact.phone   && <p>{form.contact.phone}</p>}
              {form.contact.email   && <p>{form.contact.email}</p>}
              {form.contact.website && <p className="truncate">{form.contact.website}</p>}
            </div>
          ) : (
            <p className="text-stone-400 text-sm">Not specified</p>
          )}
        </ReviewSection>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ReviewSection title="Features" onEdit={() => onEdit(4)}>
          {form.features.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {form.features.map((f) => (
                <span key={f} className="text-xs px-2.5 py-0.5 rounded-full bg-stone-200 text-stone-700">
                  {FEATURE_LABEL[f] ?? f}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-stone-400 text-sm">None selected</p>
          )}
        </ReviewSection>

        <ReviewSection title="Hours" onEdit={() => onEdit(5)}>
          {openDays ? (
            <>
              <p className="text-stone-700 text-sm font-medium">{form.hours.filter((h) => !h.closed).length} days / week</p>
              <p className="text-stone-400 text-xs mt-0.5">{openDays}</p>
            </>
          ) : (
            <p className="text-stone-400 text-sm">All days closed</p>
          )}
        </ReviewSection>
      </div>
    </div>
  );
}

// ── Success screen ───────────────────────────────────────────────────────────

const PROCESSING_STEPS = [
  "Creating your saloon profile",
  "Registering account with identity provider",
  "Configuring your workspace",
  "Sending welcome email",
];

const STEP_DURATION = 900; // ms per step

type CopyKey = "adminId" | "adminHandler";

function SuccessScreen({ id, handler, ownerEmail, saloonName }: { id: string; handler: string; ownerEmail: string; saloonName: string }) {
  const [completedSteps, setCompletedSteps] = useState(0);
  const [ready, setReady]                   = useState(false);
  const [copied, setCopied]                 = useState<CopyKey | null>(null);

  useEffect(() => {
    const timers = PROCESSING_STEPS.map((_, i) =>
      setTimeout(() => setCompletedSteps(i + 1), (i + 1) * STEP_DURATION)
    );
    const done = setTimeout(() => setReady(true), PROCESSING_STEPS.length * STEP_DURATION + 400);
    return () => { timers.forEach(clearTimeout); clearTimeout(done); };
  }, []);

  function copy(text: string, key: CopyKey) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  function CopyBtn({ text, copyKey }: { text: string; copyKey: CopyKey }) {
    return (
      <button
        onClick={() => copy(text, copyKey)}
        className="shrink-0 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer active:scale-90"
        title="Copy"
      >
        {copied === copyKey
          ? <Check className="w-4 h-4 text-matcha-600" />
          : <Copy className="w-4 h-4" />}
      </button>
    );
  }

  const adminHandlerUrl = `${ADMIN_APP_URL}/${handler}`;
  const adminIdUrl      = `${ADMIN_APP_URL}/${id}`;
  const progress        = Math.round((completedSteps / PROCESSING_STEPS.length) * 100);

  // ── Processing phase ────────────────────────────────────────────────────────
  if (!ready) {
    return (
      <div className="min-h-[100dvh] bg-cream flex flex-col items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="flex justify-center mb-7">
            <div className="w-16 h-16 rounded-full bg-matcha-100 border-2 border-matcha-300 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-matcha-600 animate-spin" />
            </div>
          </div>

          <h1 className="text-lg font-bold text-stone-900 text-center mb-1">
            Setting up <span className="text-matcha-700">{saloonName}</span>
          </h1>
          <p className="text-stone-400 text-sm text-center mb-7">This will only take a moment…</p>

          {/* Progress bar */}
          <div className="mb-6">
            <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
              <div
                className="h-1.5 bg-matcha-500 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-right text-[10px] text-stone-400 mt-1 tabular-nums">{progress}%</p>
          </div>

          {/* Step list */}
          <div className="flex flex-col gap-3">
            {PROCESSING_STEPS.map((label, i) => {
              const done    = i < completedSteps;
              const active  = i === completedSteps;
              return (
                <div
                  key={label}
                  className={`flex items-center gap-3 transition-opacity duration-300 ${done || active ? "opacity-100" : "opacity-25"}`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors duration-500 ${done ? "bg-matcha-500" : "bg-stone-200"}`}>
                    {done
                      ? <Check className="w-3 h-3 text-white" />
                      : active
                        ? <Loader2 className="w-3 h-3 text-stone-400 animate-spin" />
                        : <span className="w-1.5 h-1.5 rounded-full bg-stone-300 block" />}
                  </div>
                  <span className={`text-sm transition-colors duration-300 ${done ? "text-stone-700" : active ? "text-stone-500" : "text-stone-300"}`}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Done phase ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] bg-cream flex flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm animate-[fade-in_0.4s_ease_both]">

        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-full bg-matcha-100 border-2 border-matcha-400 flex items-center justify-center mb-4">
            <Check className="w-7 h-7 text-matcha-600" />
          </div>
          <h1 className="text-xl font-bold text-stone-900 text-center">You're all set!</h1>
          <p className="text-stone-500 text-sm text-center mt-1.5 leading-relaxed">
            <strong className="text-stone-700">{saloonName}</strong> is ready.<br />
            Sign in to your admin panel to start managing it.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {/* Admin URLs */}
          <div className="bg-white border border-stone-200 rounded-2xl p-4">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">Your admin panel</p>
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-[10px] text-stone-400 mb-0.5 uppercase tracking-wide">By name</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-stone-700 flex-1 truncate font-mono">{adminHandlerUrl}</span>
                  <CopyBtn text={adminHandlerUrl} copyKey="adminHandler" />
                </div>
              </div>
              <div className="border-t border-stone-100 pt-2">
                <p className="text-[10px] text-stone-400 mb-0.5 uppercase tracking-wide">By ID</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-stone-700 flex-1 truncate font-mono">{adminIdUrl}</span>
                  <CopyBtn text={adminIdUrl} copyKey="adminId" />
                </div>
              </div>
            </div>
            <p className="text-xs text-stone-400 mt-3 pt-2 border-t border-stone-100">
              Sign in with <span className="font-mono text-stone-600">{ownerEmail}</span>
            </p>
          </div>

          {/* CTA */}
          <a
            href={`${ADMIN_APP_URL}/${id}`}
            className="block text-center py-3 rounded-xl bg-matcha-600 text-white text-sm font-semibold hover:bg-matcha-700 active:scale-[0.97] transition-all no-underline"
          >
            Go to admin panel &amp; sign in →
          </a>

          <p className="text-center text-xs text-stone-400">
            Bookmark both URLs — either one takes you to your dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main wizard ──────────────────────────────────────────────────────────────
export default function NewSaloon() {
  const { countries, countriesError } = useLoaderData<typeof clientLoader>();
  const [step,      setStep]      = useState(0);
  const [form,      setForm]      = useState<FormState>(emptyForm);
  const [errors,    setErrors]    = useState<Record<string, string>>({});
  const [saving,   setSaving]   = useState(false);
  const [created,  setCreated]  = useState<{ id: string; handler: string } | null>(null);
  const { toast, notify }       = useToast();

  const [reuseOwnerContact,  setReuseOwnerContact]  = useState<boolean | null>(null);
  const [formShaking,        setFormShaking]        = useState(false);

  function setOwner(patch: Partial<Owner>)         { setForm((f) => ({ ...f, owner:    { ...f.owner,    ...patch } })); }
  function setLocation(patch: Partial<Location>)   { setForm((f) => ({ ...f, location: { ...f.location, ...patch } })); }
  function setContact(patch: Partial<ContactInfo>) { setForm((f) => ({ ...f, contact:  { ...f.contact,  ...patch } })); }

  function handleReuseToggle(reuse: boolean) {
    setReuseOwnerContact(reuse);
    setContact(reuse
      ? { phone: form.owner.phone ?? "", email: form.owner.email }
      : { phone: "", email: "" }
    );
  }

  function validate(s: number): Record<string, string> {
    const e: Record<string, string> = {};
    if (s === 0 && !form.name.trim()) e.name = "Saloon name is required.";
    if (s === 1) {
      if (!form.owner.name.trim())  e.ownerName  = "Owner name is required.";
      if (!form.owner.email.trim()) e.ownerEmail = "Owner email is required.";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.owner.email))
        e.ownerEmail = "Enter a valid email address.";
      if (form.owner.phone) {
        if (!form.owner.phone.startsWith("+"))
          e.ownerPhone = "Select a country code for the phone number.";
        else if (!/^\+[\d\s\-()+]{5,20}$/.test(form.owner.phone))
          e.ownerPhone = "Phone number must contain only digits.";
      }
    }
    if (s === 2) {
      if (!form.location.country?.trim()) e.locationCountry = "Country is required.";
    }
    if (s === 3) {
      if (form.contact.phone) {
        if (!form.contact.phone.startsWith("+"))
          e.contactPhone = "Select a country code for the phone number.";
        else if (!/^\+[\d\s\-()+]{5,20}$/.test(form.contact.phone))
          e.contactPhone = "Phone number must contain only digits.";
      }
      if (form.contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact.email))
        e.contactEmail = "Enter a valid email address.";
      if (form.contact.website) {
        try { new URL(form.contact.website); } catch { e.contactWebsite = "Enter a valid URL (e.g. https://yoursaloon.com)."; }
      }
    }
    return e;
  }

  function triggerShake() {
    setFormShaking(true);
    setTimeout(() => setFormShaking(false), 450);
  }

  function goNext() {
    const e = validate(step);
    if (Object.keys(e).length) { setErrors(e); triggerShake(); return; }
    setErrors({});
    if (step === 2 && !form.contact.website) {
      const url = previewUrl(form.name);
      if (url) setContact({ website: `https://${url}` });
    }
    setStep((s) => s + 1);
  }

  function goBack() { setErrors({}); setStep((s) => s - 1); }
  function goTo(s: number) { if (s < step) { setErrors({}); setStep(s); } }

  async function handleCreate() {
    setSaving(true);
    try {
      const result = await apiFetch<{ id: string; handler: string }>(ONBOARDING_API, {
        method: "POST",
        body: JSON.stringify({
          name:       form.name.trim(),
          ownerName:  form.owner.name.trim(),
          ownerEmail: form.owner.email.trim(),
          ownerPhone: form.owner.phone?.trim() || null,
          location: {
            address: form.location.address?.trim() || null,
            city:    form.location.city?.trim()    || null,
            state:   form.location.state?.trim()   || null,
            country: form.location.country?.trim() || null,
            zipCode: form.location.zipCode?.trim() || null,
          },
          contact: {
            phone:   form.contact.phone?.trim()   || null,
            email:   form.contact.email?.trim()   || null,
            website: form.contact.website?.trim() || null,
          },
          operatingHours: form.hours,
          features:       form.features,
        }),
      });
      setCreated({ id: result.id, handler: result.handler });
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Failed to create saloon", "error");
      setSaving(false);
    }
  }

  if (created) {
    return <SuccessScreen id={created.id} handler={created.handler} ownerEmail={form.owner.email} saloonName={form.name} />;
  }

  function renderStep() {
    switch (step) {
      case 0:
        return (
          <div>
            <input
              autoFocus
              className={`${inputCls} text-lg font-semibold py-4 ${errors.name ? "border-red-400 bg-red-50/40 focus:border-red-400 focus:ring-red-400/10" : ""}`}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. The Modern Cut"
              onKeyDown={(e) => e.key === "Enter" && goNext()}
            />
            {errors.name
              ? <FieldError msg={errors.name} />
              : form.name && (
                <p className="text-stone-400 text-xs mt-2">
                  Your URL: <span className="text-matcha-600 font-medium">{previewUrl(form.name) ?? "…"}</span>
                </p>
              )
            }
          </div>
        );

      case 1:
        return (
          <div>
            <div className={fieldCls}>
              <label className={labelCls}>Full name <span className="text-red-400">*</span></label>
              <input autoFocus className={`${inputCls} ${errors.ownerName ? "border-red-400 bg-red-50/40 focus:border-red-400 focus:ring-red-400/10" : ""}`} value={form.owner.name} onChange={(e) => setOwner({ name: e.target.value })} placeholder="Jane Doe" />
              {errors.ownerName && <FieldError msg={errors.ownerName} />}
            </div>
            <div className={fieldCls}>
              <label className={labelCls}>Email <span className="text-red-400">*</span></label>
              <input type="email" className={`${inputCls} ${errors.ownerEmail ? "border-red-400 bg-red-50/40 focus:border-red-400 focus:ring-red-400/10" : ""}`} value={form.owner.email} onChange={(e) => setOwner({ email: e.target.value })} placeholder="jane@example.com" />
              {errors.ownerEmail && <FieldError msg={errors.ownerEmail} />}
            </div>
            <div className={fieldCls}>
              <label className={labelCls}>Phone <span className="text-stone-300 font-normal normal-case tracking-normal">optional</span></label>
              <PhoneInput
                value={form.owner.phone ?? ""}
                onChange={(v) => {
                  setOwner({ phone: v });
                  if (!form.location.country) {
                    const dc = v.startsWith("+") ? v.slice(0, v.indexOf(" ") > 0 ? v.indexOf(" ") : v.length) : null;
                    if (dc) {
                      const match = countries.find((c) => c.dialCode === dc);
                      if (match) setLocation({ country: match.name });
                    }
                  }
                }}
                countries={countries}
              />
              {errors.ownerPhone && <FieldError msg={errors.ownerPhone} />}
            </div>
          </div>
        );

      case 2:
        return (
          <div>
            <div className={fieldCls}>
              <label className={labelCls}>Country / Region <span className="text-red-400">*</span></label>
              <CountrySelect
                value={form.location.country ?? ""}
                onChange={(v) => setLocation({ country: v })}
                countries={countries}
                className={errors.locationCountry ? "border-red-400 focus:border-red-400" : ""}
              />
              {errors.locationCountry && <FieldError msg={errors.locationCountry} />}
            </div>
            <div className={fieldCls}>
              <label className={labelCls}>Address</label>
              <input className={inputCls} value={form.location.address ?? ""} onChange={(e) => setLocation({ address: e.target.value })} placeholder="123 Main St" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className={fieldCls}>
                <label className={labelCls}>Postal code</label>
                <input className={inputCls} value={form.location.zipCode ?? ""} onChange={(e) => setLocation({ zipCode: e.target.value })} placeholder="94105" />
              </div>
              <div className={fieldCls}>
                <label className={labelCls}>City</label>
                <input className={inputCls} value={form.location.city ?? ""} onChange={(e) => setLocation({ city: e.target.value })} placeholder="San Francisco" />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div>
            {/* Reuse owner details prompt */}
            <div className="mb-5 p-4 bg-stone-50 border border-stone-100 rounded-xl">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">
                Same phone & email as the owner?
              </p>
              <div className="flex gap-2">
                {([true, false] as const).map((opt) => (
                  <button
                    key={String(opt)}
                    type="button"
                    onClick={() => handleReuseToggle(opt)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all cursor-pointer ${
                      reuseOwnerContact === opt
                        ? "bg-matcha-600 text-white border-matcha-600"
                        : "bg-white text-stone-600 border-stone-200 hover:border-stone-400"
                    }`}
                  >
                    {opt ? "Yes, use owner's" : "No, enter new"}
                  </button>
                ))}
              </div>
            </div>

            <div className={fieldCls}>
              <label className={labelCls}>Phone</label>
              <PhoneInput
                key={`contact-phone-${reuseOwnerContact}`}
                autoFocus
                value={form.contact.phone ?? ""}
                defaultCountry={form.location.country || undefined}
                onChange={(v) => {
                  setContact({ phone: v });
                  if (!form.location.country) {
                    const dc = v.startsWith("+") ? v.slice(0, v.indexOf(" ") > 0 ? v.indexOf(" ") : v.length) : null;
                    if (dc) {
                      const match = countries.find((c) => c.dialCode === dc);
                      if (match) setLocation({ country: match.name });
                    }
                  }
                }}
                countries={countries}
              />
              {errors.contactPhone && <FieldError msg={errors.contactPhone} />}
            </div>
            <div className={fieldCls}>
              <label className={labelCls}>Email</label>
              <input type="email" className={`${inputCls} ${errors.contactEmail ? "border-red-400 bg-red-50/40 focus:border-red-400 focus:ring-red-400/10" : ""}`} value={form.contact.email ?? ""} onChange={(e) => setContact({ email: e.target.value })} placeholder="hello@yoursaloon.com" />
              {errors.contactEmail && <FieldError msg={errors.contactEmail} />}
            </div>
            <div className={fieldCls}>
              <label className={labelCls}>Website</label>
              <input className={`${inputCls} ${errors.contactWebsite ? "border-red-400 bg-red-50/40 focus:border-red-400 focus:ring-red-400/10" : ""}`} value={form.contact.website ?? ""} onChange={(e) => setContact({ website: e.target.value })} placeholder="https://yoursaloon.com" />
              {errors.contactWebsite && <FieldError msg={errors.contactWebsite} />}
            </div>
          </div>
        );

      case 4:
        return (
          <TileGrid
            options={FEATURES}
            labels={FEATURE_LABEL}
            selected={form.features}
            onChange={(features) => setForm((f) => ({ ...f, features }))}
          />
        );

      case 5:
        return (
          <HoursTable
            hours={form.hours}
            onChange={(hours) => setForm((f) => ({ ...f, hours }))}
          />
        );

      case 6:
        return <ReviewStep form={form} onEdit={goTo} />;
    }
  }

  const progress = Math.round((step / (TOTAL - 1)) * 100);

  return (
    <div className="min-h-[100dvh] bg-cream flex flex-col">
      {/* Sticky header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          {step > 0 ? (
            <button onClick={goBack} className="text-stone-400 hover:text-stone-700 cursor-pointer text-sm shrink-0 transition-colors">←</button>
          ) : (
            <Link to="/" className="text-stone-400 hover:text-stone-700 no-underline text-sm shrink-0 transition-colors">←</Link>
          )}
          <span className="text-sm font-semibold text-stone-800 flex-1">{STEPS[step].title}</span>
          <span className="text-xs text-stone-400 shrink-0 tabular-nums">{step + 1} / {TOTAL}</span>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-stone-100">
          <div
            className="h-0.5 bg-matcha-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-1.5 py-2.5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
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
      </header>

      {/* Content area — pt-12 controls gap from header to card; adjust as needed */}
      <main className="flex-1 flex items-start justify-center px-4 pt-12 pb-8">
        <div className="w-full max-w-lg">
          <div className={`bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm transition-transform ${formShaking ? "animate-[shake_0.45s_ease]" : ""}`}>

            {/* Hint strip */}
            <div className="px-6 pt-5 pb-4 border-b border-stone-100">
              <p className="text-xs text-stone-400">{STEPS[step].hint}</p>
            </div>

            {/* Sticky error banner — outside keyed div so it doesn't re-animate on step change */}
            {countriesError && (
              <div className="px-6 pt-4">
                <div className="flex items-center gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <p className="text-sm text-red-700">We are experiencing an error — please try again later.</p>
                </div>
              </div>
            )}

            {/* Step content — keyed so it fades in on each transition */}
            <div key={step} className="px-6 py-5 animate-[fade-in_0.18s_ease]">
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

              {step < TOTAL - 1 ? (
                <button
                  onClick={goNext}
                  className="px-6 py-2 rounded-xl bg-matcha-600 text-sm font-medium text-white hover:bg-matcha-700 active:scale-[0.97] transition-all cursor-pointer shadow-sm"
                >
                  Next →
                </button>
              ) : (
                <button
                  onClick={handleCreate}
                  disabled={saving}
                  className="px-6 py-2 rounded-xl bg-matcha-600 text-sm font-medium text-white hover:bg-matcha-700 active:scale-[0.97] transition-all cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Launching…" : "Launch saloon"}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      <Toast toast={toast} />
    </div>
  );
}
