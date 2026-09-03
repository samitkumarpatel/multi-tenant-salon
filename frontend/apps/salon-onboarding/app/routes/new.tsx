import React, { useState, useEffect } from "react";
import { Link, useLoaderData } from "react-router";
import { Check, Copy, Scissors, Loader2, AlertCircle, Mail, Globe, Users, CalendarCheck, LayoutDashboard, ChevronDown } from "lucide-react";
import { SOCIAL_PLATFORMS } from "@salon/ui-website";
import { ONBOARDING_API, COUNTRIES_API, apiFetch } from "~/lib/api";
import { SALON_DOMAIN, ADMIN_APP_URL, STAFF_APP_URL, websiteUrl, bookingUrl } from "~/lib/config";
import { SiteFooter } from "~/components/SiteFooter";
import { DAY_SHORT, FEATURES, FEATURE_LABEL, defaultHours } from "~/lib/constants";
import type { Country, Owner, Location, ContactInfo, OperatingHours } from "~/lib/types";
import { HoursTable, TileGrid, CountrySelect, PhoneInput, Toast, useToast } from "@salon/ui-shared";

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
  return slug ? `${slug}.${SALON_DOMAIN}` : null;
}

const STEPS = [
  { title: "Salon name",     hint: "Choose a name that represents your brand." },
  { title: "Owner details",   hint: "Who is the account holder?" },
  { title: "Location",        hint: "Where is your salon? Country is required." },
  { title: "Contact",         hint: "How can customers reach you? All optional." },
  { title: "Features",        hint: "Select everything your salon offers." },
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
  businessRegistrationId: string;
  showBusinessId: boolean;
  termsAccepted: boolean;
}

function emptyForm(): FormState {
  return {
    name: "",
    owner:    { name: "", email: "", phone: "" },
    location: { address: "", city: "", state: "", country: "", zipCode: "" },
    contact:  { phone: "", email: "", website: "" },
    hours:    defaultHours(),
    features: ["STATIC_WEBSITE"],
    businessRegistrationId: "",
    showBusinessId: false,
    termsAccepted: false,
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

const TERMS_TEXT = `1. Introduction
By registering a salon on this platform you enter into a legally binding agreement with Salon SaaS ("we", "us", "our"). Please read these terms carefully before proceeding.

2. Account Responsibilities
You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorised use.

3. Acceptable Use
You may not use this platform for any unlawful purpose or in any way that could damage, disable, or impair the service. You agree not to attempt to gain unauthorised access to any part of the platform.

4. Data and Privacy
We collect and process personal data in accordance with our Privacy Policy. By using this service you consent to such processing and warrant that all data provided by you is accurate.

5. Subscription and Billing
Access to premium features is subject to the applicable subscription plan. Fees are billed in advance and are non-refundable except as required by applicable law.

6. Termination
We reserve the right to suspend or terminate your account if you breach these terms. You may close your account at any time by contacting support.

7. Limitation of Liability
To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, or consequential damages arising from your use of the platform.

8. Changes to Terms
We may update these terms from time to time. Continued use of the platform after changes constitutes your acceptance of the updated terms.

9. Governing Law
These terms are governed by the laws of the jurisdiction in which we operate. Any disputes shall be resolved in the courts of that jurisdiction.`;

const PRIVACY_TEXT = `1. What We Collect
We collect information you provide when registering: salon name, owner name, email address, phone number, location, and business details. We also collect usage data and technical information such as IP addresses and browser type.

2. How We Use It
We use your data to provide and improve the platform, send transactional and account-related communications, and comply with legal obligations. We do not sell your personal data to third parties.

3. Data Sharing
We may share data with trusted service providers (e.g. cloud hosting, email delivery) strictly to operate the platform. All providers are bound by data processing agreements.

4. Data Retention
We retain your data for as long as your account is active and for a reasonable period thereafter to comply with legal obligations.

5. Your Rights
You have the right to access, correct, or delete your personal data. To exercise these rights please contact us at privacy@salonsaas.org.

6. Cookies
We use essential cookies to operate the platform. No advertising or tracking cookies are used.

7. Security
We implement industry-standard security measures to protect your data, including encryption in transit and at rest.

8. Contact
For privacy-related queries contact: privacy@salonsaas.org`;

function ReviewStep({ form, onEdit, onTermsChange }: { form: FormState; onEdit: (s: number) => void; onTermsChange: (v: boolean) => void }) {
  const url      = previewUrl(form.name);
  const openDays = form.hours.filter((h) => !h.closed).map((h) => DAY_SHORT[h.day] ?? h.day).join(", ");
  const hasLoc   = form.location.address || form.location.city || form.location.country;
  const hasCon   = form.contact.phone   || form.contact.email  || form.contact.website;
  const [expanded, setExpanded] = useState<"terms" | "privacy" | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <ReviewSection title="Salon" onEdit={() => onEdit(0)}>
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
              {form.businessRegistrationId && (
                <p className="text-xs text-stone-400 mt-1">
                  Reg. {form.businessRegistrationId}
                  {form.showBusinessId && <span className="ml-1 text-matcha-600">· shown publicly</span>}
                </p>
              )}
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

      <div className="border border-stone-200 rounded-xl overflow-hidden bg-stone-50">
        <label className="flex items-start gap-3 px-4 py-3.5 cursor-pointer select-none hover:bg-stone-100 transition-colors">
          <input
            type="checkbox"
            checked={form.termsAccepted}
            onChange={(e) => onTermsChange(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-matcha-600 shrink-0 cursor-pointer"
          />
          <span className="text-sm text-stone-600 leading-relaxed">
            I have read and agree to the{" "}
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); setExpanded(expanded === "terms" ? null : "terms"); }}
              className="text-matcha-600 underline hover:text-matcha-700 font-medium cursor-pointer"
            >
              Terms and Conditions {expanded === "terms" ? "▲" : "▼"}
            </button>{" "}
            and{" "}
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); setExpanded(expanded === "privacy" ? null : "privacy"); }}
              className="text-matcha-600 underline hover:text-matcha-700 font-medium cursor-pointer"
            >
              Privacy Policy {expanded === "privacy" ? "▲" : "▼"}
            </button>
            .
          </span>
        </label>

        {expanded && (
          <div className="border-t border-stone-200 bg-white px-4 py-3 max-h-52 overflow-y-auto">
            <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide mb-2">
              {expanded === "terms" ? "Terms and Conditions" : "Privacy Policy"}
            </p>
            <pre className="text-xs text-stone-600 leading-relaxed whitespace-pre-wrap font-sans">
              {expanded === "terms" ? TERMS_TEXT : PRIVACY_TEXT}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Success screen ───────────────────────────────────────────────────────────

const PROCESSING_STEPS = [
  "Creating your salon profile",
  "Registering account with identity provider",
  "Configuring your workspace",
  "Sending welcome email",
];

const STEP_DURATION = 900; // ms per step

type CopyKey = "admin" | "staff" | "website" | "booking";

function SuccessScreen({ salonId, salonHandler, emailId, salonName, features }: { salonId: string; salonHandler: string; emailId: string; salonName: string; features: string[] }) {
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

  function LinkRow({ icon, label, hint, url, copyKey, copied: c, onCopy }: {
    icon: React.ReactNode; label: string; hint: string;
    url: string; copyKey: CopyKey; copied: CopyKey | null;
    onCopy: (text: string, key: CopyKey) => void;
  }) {
    return (
      <div className="flex items-start gap-3 px-4 py-3 border-t border-stone-100 first:border-t-0">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide mb-0.5">{label}</p>
          <p className="text-xs font-mono text-stone-700 truncate">{url}</p>
          <p className="text-[10px] text-stone-400 mt-0.5">{hint}</p>
        </div>
        <button
          onClick={() => onCopy(url, copyKey)}
          className="shrink-0 p-2 -m-2 mt-[-3px] text-stone-400 hover:text-stone-700 transition-colors cursor-pointer active:scale-90"
          title="Copy"
        >
          {c === copyKey
            ? <Check className="w-4 h-4 text-matcha-600" />
            : <Copy className="w-4 h-4" />}
        </button>
      </div>
    );
  }

  const hasWebsite      = features.includes("STATIC_WEBSITE");
  const hasBooking      = features.includes("BOOKING");
  const salonWebsiteUrl = websiteUrl(salonHandler);
  const salonBookingUrl = bookingUrl(salonHandler);
  const progress        = Math.round((completedSteps / PROCESSING_STEPS.length) * 100);

  // ── Processing phase ────────────────────────────────────────────────────────
  if (!ready) {
    return (
      <div className="min-h-[100dvh] bg-cream flex flex-col">
        <div className="flex-1 overflow-y-auto px-5 py-10 flex flex-col items-center">
        <div className="w-full max-w-sm my-auto">
          <div className="flex justify-center mb-7">
            <div className="w-16 h-16 rounded-full bg-matcha-100 border-2 border-matcha-300 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-matcha-600 animate-spin" />
            </div>
          </div>

          <h1 className="text-lg font-bold text-stone-900 text-center mb-1">
            Setting up <span className="text-matcha-700">{salonName}</span>
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
        <SiteFooter />
      </div>
    );
  }

  // ── Done phase ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] bg-cream flex flex-col">
      <div className="flex-1 overflow-y-auto px-5 py-10 flex flex-col items-center">
      <div className="w-full max-w-sm my-auto animate-[fade-in_0.4s_ease_both]">

        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-full bg-matcha-100 border-2 border-matcha-400 flex items-center justify-center mb-4">
            <Check className="w-7 h-7 text-matcha-600" />
          </div>
          <h1 className="text-xl font-bold text-stone-900 text-center">You're all set!</h1>
          <p className="text-stone-500 text-sm text-center mt-1.5 leading-relaxed">
            <strong className="text-stone-700">{salonName}</strong> is ready.<br />
            Sign in to your admin panel to start managing it.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {/* Email sent hint */}
          <div className="flex items-start gap-3 px-4 py-3 bg-matcha-50 border border-matcha-100 rounded-2xl">
            <Mail className="w-4 h-4 text-matcha-600 mt-0.5 shrink-0" />
            <p className="text-xs text-matcha-800 leading-relaxed">
              We've sent a welcome email to <span className="font-semibold">{emailId}</span> with your login link and a setup guide to get you started.
            </p>
          </div>

          {/* Links section */}
          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 px-4 pt-3.5 pb-2">Your links</p>

            {/* Admin panel */}
            <LinkRow
              icon={<LayoutDashboard className="w-3.5 h-3.5 text-stone-400" />}
              label="Admin panel"
              hint={`Sign in with ${emailId}`}
              url={ADMIN_APP_URL}
              copyKey="admin"
              copied={copied}
              onCopy={copy}
            />

            {/* Staff portal */}
            <LinkRow
              icon={<Users className="w-3.5 h-3.5 text-stone-400" />}
              label="Staff portal"
              hint="Share with your team members"
              url={STAFF_APP_URL}
              copyKey="staff"
              copied={copied}
              onCopy={copy}
            />

            {/* Booking link — only when BOOKING feature selected */}
            {hasBooking && (
              <LinkRow
                icon={<CalendarCheck className="w-3.5 h-3.5 text-stone-400" />}
                label="Booking link"
                hint="Share with customers to accept appointments"
                url={salonBookingUrl}
                copyKey="booking"
                copied={copied}
                onCopy={copy}
              />
            )}

            {/* Public website — only when STATIC_WEBSITE feature selected */}
            {hasWebsite && (
              <LinkRow
                icon={<Globe className="w-3.5 h-3.5 text-stone-400" />}
                label="Public website"
                hint="Your customer-facing page — share it freely"
                url={salonWebsiteUrl}
                copyKey="website"
                copied={copied}
                onCopy={copy}
              />
            )}
          </div>

          {/* CTA */}
          <a
            href={ADMIN_APP_URL}
            className="block text-center py-3 rounded-xl bg-matcha-600 text-white text-sm font-semibold hover:bg-matcha-700 active:scale-[0.97] transition-all no-underline"
          >
            Go to admin panel &amp; sign in →
          </a>

          <a
            href="/new"
            className="block text-center py-2.5 rounded-xl border border-stone-200 bg-white text-stone-600 text-sm font-medium hover:border-stone-300 hover:bg-stone-50 active:scale-[0.97] transition-all no-underline"
          >
            Register another salon →
          </a>
        </div>
      </div>
      </div>
      <SiteFooter />
    </div>
  );
}

// ── Main wizard ──────────────────────────────────────────────────────────────
export default function NewSalon() {
  const { countries, countriesError } = useLoaderData<typeof clientLoader>();
  const [step,      setStep]      = useState(0);
  const [form,      setForm]      = useState<FormState>(emptyForm);
  const [errors,    setErrors]    = useState<Record<string, string>>({});
  const [saving,   setSaving]   = useState(false);
  const [created,  setCreated]  = useState<{ salonId: string; salonHandler: string; emailId: string } | null>(null);
  const { toast, notify }       = useToast();

  const [reuseOwnerContact,  setReuseOwnerContact]  = useState(true);
  const [formShaking,        setFormShaking]        = useState(false);
  const [socialOpen,         setSocialOpen]         = useState(false);

  function setOwner(patch: Partial<Owner>)         { setForm((f) => ({ ...f, owner:    { ...f.owner,    ...patch } })); }
  function setLocation(patch: Partial<Location>)   { setForm((f) => ({ ...f, location: { ...f.location, ...patch } })); }
  function setContact(patch: Partial<ContactInfo>) { setForm((f) => ({ ...f, contact:  { ...f.contact,  ...patch } })); }

  // Auto-fill contact from owner details when entering step 3 with reuse enabled
  useEffect(() => {
    if (step === 3 && reuseOwnerContact) {
      setForm((f) => ({ ...f, contact: { ...f.contact, phone: f.owner.phone ?? "", email: f.owner.email } }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function handleReuseToggle(reuse: boolean) {
    setReuseOwnerContact(reuse);
    setContact(reuse
      ? { phone: form.owner.phone ?? "", email: form.owner.email }
      : { phone: "", email: "" }
    );
  }

  function validate(s: number): Record<string, string> {
    const e: Record<string, string> = {};
    if (s === 0 && !form.name.trim()) e.name = "Salon name is required.";
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
        try { new URL(form.contact.website); } catch { e.contactWebsite = "Enter a valid URL (e.g. https://yoursalon.com)."; }
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
      const result = await apiFetch<{ salonId: string; salonHandler: string; emailId: string; message: string }>(ONBOARDING_API, {
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
            ...Object.fromEntries(
              SOCIAL_PLATFORMS.flatMap((p) => [
                [p.urlKey, form.contact[p.urlKey]?.trim() || null],
                [p.visibleKey, form.contact[p.visibleKey] === true],
              ]),
            ),
          },
          operatingHours: form.hours,
          features:       form.features,
          businessRegistrationId: form.businessRegistrationId?.trim() || null,
          showBusinessId: form.showBusinessId,
          termsAccepted:  form.termsAccepted,
        }),
      });
      setCreated({ salonId: result.salonId, salonHandler: result.salonHandler, emailId: result.emailId });
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Failed to create salon", "error");
      setSaving(false);
    }
  }

  if (created) {
    return <SuccessScreen salonId={created.salonId} salonHandler={created.salonHandler} emailId={created.emailId} salonName={form.name} features={form.features} />;
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

      case 2: {
        const selectedCountry = countries.find((c) => c.name === form.location.country);
        const bizIdLabel       = selectedCountry?.businessIdLabel;
        const bizIdPlaceholder = selectedCountry?.businessIdPlaceholder ?? "";
        return (
          <div>
            <div className={fieldCls}>
              <label className={labelCls}>Country / Region <span className="text-red-400">*</span></label>
              <CountrySelect
                value={form.location.country ?? ""}
                onChange={(v) => {
                  setLocation({ country: v });
                  setForm((f) => ({ ...f, businessRegistrationId: "", showBusinessId: false }));
                }}
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
            {bizIdLabel && (
              <div className={fieldCls}>
                <label className={labelCls}>
                  {bizIdLabel}{" "}
                  <span className="text-stone-300 font-normal normal-case tracking-normal">optional</span>
                </label>
                <input
                  className={inputCls}
                  value={form.businessRegistrationId}
                  onChange={(e) => setForm((f) => ({ ...f, businessRegistrationId: e.target.value }))}
                  placeholder={bizIdPlaceholder}
                />
                {form.businessRegistrationId && (
                  <label className="flex items-center gap-2.5 mt-2.5 cursor-pointer select-none">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.showBusinessId}
                      onClick={() => setForm((f) => ({ ...f, showBusinessId: !f.showBusinessId }))}
                      className={`relative inline-flex w-9 h-5 rounded-full shrink-0 cursor-pointer transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-matcha-500 focus-visible:ring-offset-2 ${form.showBusinessId ? "bg-matcha-600" : "bg-stone-200"}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ease-in-out ${form.showBusinessId ? "translate-x-4" : "translate-x-0"}`} />
                    </button>
                    <span className="text-xs text-stone-500">Show on public website</span>
                  </label>
                )}
              </div>
            )}
          </div>
        );
      }

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
                key={`contact-phone-${reuseOwnerContact}-${form.location.country}`}
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
              <input type="email" className={`${inputCls} ${errors.contactEmail ? "border-red-400 bg-red-50/40 focus:border-red-400 focus:ring-red-400/10" : ""}`} value={form.contact.email ?? ""} onChange={(e) => setContact({ email: e.target.value })} placeholder="hello@yoursalon.com" />
              {errors.contactEmail && <FieldError msg={errors.contactEmail} />}
            </div>
            <div className={fieldCls}>
              <label className={labelCls}>Website</label>
              <input className={`${inputCls} ${errors.contactWebsite ? "border-red-400 bg-red-50/40 focus:border-red-400 focus:ring-red-400/10" : ""}`} value={form.contact.website ?? ""} onChange={(e) => setContact({ website: e.target.value })} placeholder="https://yoursalon.com" />
              {errors.contactWebsite && <FieldError msg={errors.contactWebsite} />}
            </div>

            <div className="border-t border-stone-100 pt-3">
              <button
                type="button"
                onClick={() => setSocialOpen((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-700 cursor-pointer"
                aria-expanded={socialOpen}
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${socialOpen ? "" : "-rotate-90"}`} />
                Add social links (optional)
              </button>
              {socialOpen && (
                <div className="mt-3 space-y-2.5">
                  <p className="text-xs text-stone-400 -mt-0.5">
                    Turn a platform on to show its icon in your website footer. Add the link to make it clickable.
                  </p>
                  {SOCIAL_PLATFORMS.map((p) => {
                    const on = form.contact[p.visibleKey] === true;
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
                          onClick={() => setContact({ [p.visibleKey]: !on } as Partial<ContactInfo>)}
                          className={`relative inline-flex w-9 h-5 rounded-full shrink-0 cursor-pointer transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-matcha-500 focus-visible:ring-offset-2 ${on ? "bg-matcha-600" : "bg-stone-200"}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ease-in-out ${on ? "translate-x-4" : "translate-x-0"}`} />
                        </button>
                        <input
                          className={`${inputCls} ${on ? "" : "opacity-50"}`}
                          value={form.contact[p.urlKey] ?? ""}
                          onChange={(e) => setContact({ [p.urlKey]: e.target.value } as Partial<ContactInfo>)}
                          placeholder={p.placeholder}
                          aria-label={`${p.label} URL`}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
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
        return <ReviewStep form={form} onEdit={goTo} onTermsChange={(v) => setForm((f) => ({ ...f, termsAccepted: v }))} />;
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
          <span className="text-xs font-medium text-stone-400 flex-1 uppercase tracking-wide">{STEPS[step].title}</span>
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

      {/* Content area */}
      <main className="flex-1 flex items-start justify-center px-4 pt-6 sm:pt-12 pb-8">
        <div className="w-full max-w-lg">
          <div className={`bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm transition-transform ${formShaking ? "animate-[shake_0.45s_ease]" : ""}`}>

            {/* Card header */}
            <div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-4 sm:pb-5 border-b border-stone-100">
              <h2 className="text-lg font-bold text-stone-900 mb-1">{STEPS[step].title}</h2>
              <p className="text-sm text-stone-500 leading-relaxed">{STEPS[step].hint}</p>
            </div>

            {/* Sticky error banner — outside keyed div so it doesn't re-animate on step change */}
            {countriesError && (
              <div className="px-4 sm:px-6 pt-4">
                <div className="flex items-center gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <p className="text-sm text-red-700">We are experiencing an error — please try again later.</p>
                </div>
              </div>
            )}

            {/* Step content — keyed so it fades in on each transition */}
            <div key={step} className="px-4 sm:px-6 py-4 sm:py-5 animate-[fade-in_0.18s_ease]">
              {renderStep()}
            </div>

            {/* Navigation footer */}
            <div className="px-4 sm:px-6 py-4 border-t border-stone-100 flex justify-between items-center bg-stone-50/60">
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
                  disabled={saving || !form.termsAccepted}
                  className="px-6 py-2 rounded-xl bg-matcha-600 text-sm font-medium text-white hover:bg-matcha-700 active:scale-[0.97] transition-all cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  title={!form.termsAccepted ? "Please accept the terms and conditions" : undefined}
                >
                  {saving ? "Launching…" : "Launch salon"}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
      <Toast toast={toast} />
    </div>
  );
}
