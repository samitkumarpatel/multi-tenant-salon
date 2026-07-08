import { Fragment, useState } from "react";
import { Link } from "react-router";
import {
  Scissors, ArrowLeft, ArrowRight, Check, CheckCircle2,
  Copy, ExternalLink, Globe, Lock, LayoutDashboard,
} from "lucide-react";
import { API, apiFetch } from "~/lib/api";
import { SALOON_APP_URL } from "~/lib/config";
import { DAY_SHORT, FEATURES, FEATURE_LABELS, defaultHours } from "~/lib/constants";
import type { Owner, Location, ContactInfo, OperatingHours } from "~/lib/types";
import HoursTable from "~/components/HoursTable";
import TileGrid from "~/components/TileGrid";

function previewHandle(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}
function previewUrl(name: string) {
  const slug = previewHandle(name);
  return slug ? `${slug}.saloon.app` : null;
}

const STEPS = [
  { title: "Name your saloon",  hint: "Choose a name that represents your brand. We'll generate a unique subdomain for you.", icon: "✂" },
  { title: "Owner details",     hint: "Who is the account holder for this saloon?",                                           icon: "👤" },
  { title: "Location",          hint: "Where is your saloon located? All fields are optional.",                               icon: "📍" },
  { title: "Contact details",   hint: "How can customers reach you? All fields optional.",                                    icon: "📞" },
  { title: "Features",          hint: "Select everything your saloon offers.",                                                icon: "⚡" },
  { title: "Opening hours",     hint: "Set your weekly operating schedule.",                                                  icon: "🕐" },
  { title: "Review & launch",   hint: "Everything look right? Let's go live!",                                                icon: "🚀" },
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
    features: [],
  };
}

const inputCls = "w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none transition-[border-color,box-shadow] focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 bg-white text-slate-900 font-sans";
const labelCls = "block text-sm font-semibold text-slate-700 mb-1.5";
const fieldCls = "mb-5";

// ── Review step ────────────────────────────────────────────────────────────
function ReviewStep({ form, onEdit }: { form: FormState; onEdit: (s: number) => void }) {
  const url      = previewUrl(form.name);
  const openDays = form.hours.filter((h) => !h.closed).map((h) => DAY_SHORT[h.day] ?? h.day).join(", ");
  const hasLoc   = form.location.address || form.location.city || form.location.country;
  const hasCon   = form.contact.phone   || form.contact.email  || form.contact.website;

  return (
    <div className="flex flex-col gap-3">
      <ReviewSection title="Saloon" onEdit={() => onEdit(0)}>
        <p className="font-bold text-slate-900 text-base">{form.name}</p>
        {url && <p className="text-matcha-600 text-sm mt-0.5">🌐 {url}</p>}
      </ReviewSection>

      <ReviewSection title="Owner" onEdit={() => onEdit(1)}>
        <p className="font-semibold text-slate-800">{form.owner.name}</p>
        <p className="text-slate-500 text-sm">{form.owner.email}</p>
        {form.owner.phone && <p className="text-slate-500 text-sm">{form.owner.phone}</p>}
      </ReviewSection>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ReviewSection title="Location" onEdit={() => onEdit(2)}>
          {hasLoc ? (
            <>
              {form.location.address && <p className="text-slate-700 text-sm">{form.location.address}</p>}
              <p className="text-slate-500 text-sm">{[form.location.city, form.location.state, form.location.zipCode].filter(Boolean).join(", ")}</p>
              {form.location.country && <p className="text-slate-500 text-sm">{form.location.country}</p>}
            </>
          ) : (
            <p className="text-slate-400 text-sm italic">Not specified</p>
          )}
        </ReviewSection>

        <ReviewSection title="Contact" onEdit={() => onEdit(3)}>
          {hasCon ? (
            <>
              {form.contact.phone   && <p className="text-slate-700 text-sm">{form.contact.phone}</p>}
              {form.contact.email   && <p className="text-slate-500 text-sm">{form.contact.email}</p>}
              {form.contact.website && <p className="text-slate-500 text-sm truncate">{form.contact.website}</p>}
            </>
          ) : (
            <p className="text-slate-400 text-sm italic">Not specified</p>
          )}
        </ReviewSection>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ReviewSection title="Features" onEdit={() => onEdit(4)}>
          {form.features.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {form.features.map((f) => (
                <span key={f} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-matcha-100 text-matcha-700 border border-matcha-200">
                  {FEATURE_LABELS[f] ?? f}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-sm italic">None selected</p>
          )}
        </ReviewSection>

        <ReviewSection title="Hours" onEdit={() => onEdit(5)}>
          {openDays ? (
            <>
              <p className="text-slate-700 text-sm font-medium">{form.hours.filter((h) => !h.closed).length} days / week</p>
              <p className="text-slate-400 text-xs mt-0.5">{openDays}</p>
            </>
          ) : (
            <p className="text-slate-400 text-sm italic">All days closed</p>
          )}
        </ReviewSection>
      </div>
    </div>
  );
}

function ReviewSection({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">{title}</span>
        <button onClick={onEdit} className="text-xs font-semibold text-matcha-600 hover:text-matcha-700 cursor-pointer">Edit</button>
      </div>
      {children}
    </div>
  );
}

// ── Success screen ──────────────────────────────────────────────────────────
function SuccessScreen({ id, ownerEmail, saloonName }: { id: string; ownerEmail: string; saloonName: string }) {
  const adminUrl    = `${SALOON_APP_URL}/${id}`;
  const customerUrl = previewUrl(saloonName) ? `https://${previewUrl(saloonName)}` : adminUrl;
  const [copiedAdmin, setCopiedAdmin]    = useState(false);
  const [copiedCustomer, setCopiedCustomer] = useState(false);

  function copy(text: string, which: "admin" | "customer") {
    navigator.clipboard.writeText(text).then(() => {
      if (which === "admin") {
        setCopiedAdmin(true);
        setTimeout(() => setCopiedAdmin(false), 2000);
      } else {
        setCopiedCustomer(true);
        setTimeout(() => setCopiedCustomer(false), 2000);
      }
    });
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-matcha-950 via-matcha-900 to-matcha-950 flex flex-col items-center justify-center px-5 py-12 text-white text-center">
      {/* Animated checkmark */}
      <div className="w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-400 flex items-center justify-center mb-6 animate-[scale-in_0.4s_cubic-bezier(0.175,0.885,0.32,1.275)]">
        <CheckCircle2 className="w-10 h-10 text-green-400" />
      </div>

      <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2 animate-[fade-in_0.5s_ease_0.2s_both]">
        Your Saloon is Live! 🎉
      </h1>
      <p className="text-slate-400 text-base max-w-sm mb-10 animate-[fade-in_0.5s_ease_0.3s_both]">
        <strong className="text-white">{saloonName}</strong> has been successfully registered. Here's everything you need to get started.
      </p>

      <div className="w-full max-w-md flex flex-col gap-4 text-left animate-[fade-in_0.5s_ease_0.4s_both]">
        {/* Customer URL */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-matcha-300" />
            <span className="text-xs font-bold uppercase tracking-widest text-matcha-300">Customer URL</span>
          </div>
          <p className="text-xs text-slate-400 mb-2">Share this link with your clients:</p>
          <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-3">
            <span className="text-sm text-white font-mono flex-1 truncate">{customerUrl}</span>
            <button
              onClick={() => copy(customerUrl, "customer")}
              className="shrink-0 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Copy"
            >
              {copiedCustomer ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Admin URL */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <LayoutDashboard className="w-4 h-4 text-matcha-300" />
            <span className="text-xs font-bold uppercase tracking-widest text-matcha-300">Admin Panel</span>
          </div>
          <p className="text-xs text-slate-400 mb-2">Your management dashboard:</p>
          <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-3 mb-3">
            <span className="text-sm text-white font-mono flex-1 truncate">{adminUrl}</span>
            <button
              onClick={() => copy(adminUrl, "admin")}
              className="shrink-0 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Copy"
            >
              {copiedAdmin ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          {/* Login hint */}
          <div className="flex items-start gap-2.5 bg-matcha-500/10 rounded-xl px-3.5 py-3">
            <Lock className="w-4 h-4 text-matcha-300 shrink-0 mt-0.5" />
            <div className="text-xs text-matcha-200 leading-relaxed">
              <strong className="text-white">Log in</strong> using your owner email:<br />
              <span className="font-mono text-matcha-300">{ownerEmail}</span>
            </div>
          </div>
        </div>

        {/* How to get started */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Getting Started</p>
          <div className="flex flex-col gap-3.5">
            {[
              { step: "1", text: "Visit your admin panel and log in with your owner email." },
              { step: "2", text: "Add your services — haircuts, colouring, treatments, and more." },
              { step: "3", text: "Onboard your staff members and assign them to services." },
              { step: "4", text: "Share your customer URL and start receiving bookings!" },
            ].map(({ step, text }) => (
              <div key={step} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-matcha-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {step}
                </span>
                <p className="text-sm text-slate-300 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 mt-1">
          <a
            href={adminUrl}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-matcha-600 text-sm font-bold text-white hover:bg-matcha-500 transition-colors no-underline"
          >
            <LayoutDashboard className="w-4 h-4" /> Go to Admin Panel
          </a>
          <Link
            to="/customer"
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white/10 border border-white/20 text-sm font-semibold text-white hover:bg-white/20 transition-colors no-underline"
          >
            <ExternalLink className="w-4 h-4" /> View as Customer
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Main wizard ─────────────────────────────────────────────────────────────
export default function NewSaloon() {
  const [step,      setStep]      = useState(0);
  const [form,      setForm]      = useState<FormState>(emptyForm);
  const [errors,    setErrors]    = useState<Record<string, string>>({});
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [created,   setCreated]   = useState<{ id: string } | null>(null);

  function setOwner(patch: Partial<Owner>)      { setForm((f) => ({ ...f, owner:    { ...f.owner,    ...patch } })); }
  function setLocation(patch: Partial<Location>) { setForm((f) => ({ ...f, location: { ...f.location, ...patch } })); }
  function setContact(patch: Partial<ContactInfo>) { setForm((f) => ({ ...f, contact: { ...f.contact, ...patch } })); }

  function validate(s: number): Record<string, string> {
    const e: Record<string, string> = {};
    if (s === 0 && !form.name.trim())       e.name = "Saloon name is required.";
    if (s === 1) {
      if (!form.owner.name.trim())           e.ownerName  = "Owner name is required.";
      if (!form.owner.email.trim())          e.ownerEmail = "Owner email is required.";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.owner.email))
        e.ownerEmail = "Enter a valid email address.";
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
  function goTo(s: number) { if (s < step) { setErrors({}); setStep(s); } }

  async function handleCreate() {
    setSaveError(null);
    setSaving(true);
    try {
      const result = await apiFetch<{ id: string; handler: string }>(API, {
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
      setCreated({ id: result.id });
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Failed to create saloon");
      setSaving(false);
    }
  }

  if (created) {
    return <SuccessScreen id={created.id} ownerEmail={form.owner.email} saloonName={form.name} />;
  }

  function renderStep() {
    switch (step) {
      case 0:
        return (
          <div>
            <input
              autoFocus
              className={`${inputCls} text-xl font-bold py-4 ${errors.name ? "border-red-400 ring-2 ring-red-400/10" : ""}`}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. The Modern Cut"
              onKeyDown={(e) => e.key === "Enter" && goNext()}
            />
            {errors.name
              ? <p className="text-red-500 text-sm mt-2">{errors.name}</p>
              : form.name && (
                <div className="flex items-center gap-2 mt-3 px-3.5 py-2.5 bg-matcha-50 border border-matcha-200 rounded-xl">
                  <Globe className="w-3.5 h-3.5 text-matcha-500 shrink-0" />
                  <p className="text-sm text-matcha-600">
                    Your URL: <strong>{previewUrl(form.name) ?? "…"}</strong>
                  </p>
                </div>
              )
            }
          </div>
        );

      case 1:
        return (
          <div>
            <div className={fieldCls}>
              <label className={labelCls}>Full name <span className="text-red-500">*</span></label>
              <input autoFocus className={`${inputCls} ${errors.ownerName ? "border-red-400" : ""}`} value={form.owner.name} onChange={(e) => setOwner({ name: e.target.value })} placeholder="Jane Doe" />
              {errors.ownerName && <p className="text-red-500 text-xs mt-1">{errors.ownerName}</p>}
            </div>
            <div className={fieldCls}>
              <label className={labelCls}>Email <span className="text-red-500">*</span></label>
              <input type="email" className={`${inputCls} ${errors.ownerEmail ? "border-red-400" : ""}`} value={form.owner.email} onChange={(e) => setOwner({ email: e.target.value })} placeholder="jane@example.com" />
              {errors.ownerEmail && <p className="text-red-500 text-xs mt-1">{errors.ownerEmail}</p>}
            </div>
            <div className={fieldCls}>
              <label className={labelCls}>Phone <span className="text-xs font-normal text-slate-400">(optional)</span></label>
              <input className={inputCls} value={form.owner.phone ?? ""} onChange={(e) => setOwner({ phone: e.target.value })} placeholder="+1 555 000 0000" />
            </div>
          </div>
        );

      case 2:
        return (
          <div>
            <div className={fieldCls}>
              <label className={labelCls}>Street address</label>
              <input autoFocus className={inputCls} value={form.location.address ?? ""} onChange={(e) => setLocation({ address: e.target.value })} placeholder="123 Main St" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className={fieldCls}>
                <label className={labelCls}>City</label>
                <input className={inputCls} value={form.location.city ?? ""} onChange={(e) => setLocation({ city: e.target.value })} placeholder="San Francisco" />
              </div>
              <div className={fieldCls}>
                <label className={labelCls}>State</label>
                <input className={inputCls} value={form.location.state ?? ""} onChange={(e) => setLocation({ state: e.target.value })} placeholder="CA" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className={fieldCls}>
                <label className={labelCls}>ZIP code</label>
                <input className={inputCls} value={form.location.zipCode ?? ""} onChange={(e) => setLocation({ zipCode: e.target.value })} placeholder="94105" />
              </div>
              <div className={fieldCls}>
                <label className={labelCls}>Country</label>
                <input className={inputCls} value={form.location.country ?? ""} onChange={(e) => setLocation({ country: e.target.value })} placeholder="US" />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div>
            <div className={fieldCls}>
              <label className={labelCls}>Phone</label>
              <input autoFocus className={inputCls} value={form.contact.phone ?? ""} onChange={(e) => setContact({ phone: e.target.value })} placeholder="+1 555 000 0000" />
            </div>
            <div className={fieldCls}>
              <label className={labelCls}>Email</label>
              <input type="email" className={inputCls} value={form.contact.email ?? ""} onChange={(e) => setContact({ email: e.target.value })} placeholder="hello@yoursaloon.com" />
            </div>
            <div className={fieldCls}>
              <label className={labelCls}>Website</label>
              <input className={inputCls} value={form.contact.website ?? ""} onChange={(e) => setContact({ website: e.target.value })} placeholder="https://yoursaloon.com" />
            </div>
            <p className="text-xs text-slate-400 mt-1">These details are shown publicly to your customers.</p>
          </div>
        );

      case 4:
        return (
          <TileGrid
            options={FEATURES}
            labels={FEATURE_LABELS}
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
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3.5 flex items-center gap-3">
          {step > 0 ? (
            <button
              onClick={goBack}
              className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <Link
              to="/"
              className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors no-underline shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
          )}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-matcha-600 flex items-center justify-center">
              <Scissors className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-slate-900 hidden sm:block">Create Your Saloon</span>
          </div>
          <span className="ml-auto text-xs text-slate-400 font-medium">Step {step + 1} of {TOTAL}</span>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-slate-100">
          <div
            className="h-1 bg-matcha-600 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      {/* Step indicator pills — desktop sidebar replaced by horizontal pills on mobile */}
      <div className="bg-white border-b border-slate-100 overflow-x-auto">
        <div className="flex items-center px-4 sm:px-6 py-3 gap-1 max-w-3xl mx-auto">
          {STEPS.map((s, i) => {
            const done   = i < step;
            const active = i === step;
            return (
              <Fragment key={i}>
                <button
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                    done   ? "bg-green-100 text-green-700 cursor-pointer" :
                    active ? "bg-matcha-100 text-matcha-700" :
                             "text-slate-400 cursor-not-allowed"
                  }`}
                  onClick={() => goTo(i)}
                  disabled={!done && !active}
                  aria-current={active ? "step" : undefined}
                >
                  {done
                    ? <Check className="w-3 h-3" />
                    : <span className="w-4 h-4 rounded-full bg-current/20 flex items-center justify-center text-[10px]">{i + 1}</span>
                  }
                  <span className="hidden sm:block">{s.title}</span>
                </button>
                {i < TOTAL - 1 && (
                  <div className={`flex-1 h-px min-w-[12px] max-w-[24px] ${i < step ? "bg-green-300" : "bg-slate-200"}`} />
                )}
              </Fragment>
            );
          })}
        </div>
      </div>

      {/* Wizard card */}
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4 sm:px-6 py-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col flex-1">
          {/* Card header */}
          <div className="px-5 sm:px-8 pt-6 pb-5 border-b border-slate-100">
            <div className="text-3xl mb-2">{STEPS[step].icon}</div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{STEPS[step].title}</h2>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">{STEPS[step].hint}</p>
          </div>

          {/* Card body */}
          <div className="flex-1 px-5 sm:px-8 py-6 overflow-y-auto">
            {saveError && (
              <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
                {saveError}
              </div>
            )}
            {renderStep()}
          </div>

          {/* Card footer navigation */}
          <div className="px-5 sm:px-8 py-4 border-t border-slate-100 flex justify-between items-center gap-3">
            {step > 0 ? (
              <button
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={goBack}
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            ) : <span />}

            {step < TOTAL - 1 ? (
              <button
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-matcha-600 text-sm font-bold text-white hover:bg-matcha-700 transition-colors cursor-pointer"
                onClick={goNext}
              >
                Next <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-matcha-600 text-sm font-bold text-white hover:bg-matcha-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleCreate}
                disabled={saving}
              >
                {saving ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating…</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4" /> Launch Saloon</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
