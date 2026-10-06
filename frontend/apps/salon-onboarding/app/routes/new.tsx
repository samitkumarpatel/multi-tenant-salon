import { useI18n } from "@salon/i18n";
import React, { useState, useEffect, useRef } from "react";
import { Link, useLoaderData, useRevalidator } from "react-router";
import { Check, Copy, Scissors, Loader2, AlertCircle, Mail, Globe, Users, CalendarCheck, LayoutDashboard, ChevronDown, Gauge, RefreshCw } from "lucide-react";
import { SOCIAL_PLATFORMS } from "@salon/ui-website";
import { ONBOARDING_API, COUNTRIES_API, apiFetch } from "~/lib/api";
import { SALON_DOMAIN, ADMIN_APP_URL, STAFF_APP_URL, websiteUrl, bookingUrl, dashboardUrl } from "~/lib/config";
import { SiteFooter } from "~/components/SiteFooter";
import { DAY_SHORT, FEATURES, FEATURE_LABEL, FEATURE_DESCRIPTION, defaultHours } from "~/lib/constants";
import { TERMS_TEXT, PRIVACY_TEXT } from "~/lib/legal";
import type { Country, Owner, Location, ContactInfo, OperatingHours } from "~/lib/types";
import { CountrySelect, PhoneInput, TileGrid } from "@salon/ui-shared";
import { OpeningHours } from "~/components/OpeningHours";

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
  { title: "Salon name", hint: "Start with the name your customers know." },
  { title: "Your account", hint: "Use an email you can access. You’ll use it to sign in and manage your salon." },
  { title: "Location", hint: "Select your country. The other address details are optional." },
  { title: "Customer contact", hint: "Choose the details customers can use to reach you. You can leave these blank and add them later." },
  { title: "Salon tools", hint: "Choose what you need to start. You can change your choices in the admin screen later." },
  { title: "Opening hours", hint: "Check the suggested times and mark the days you’re closed." },
  { title: "Review", hint: "Check your details before creating your salon. Nothing is submitted until you select Create salon." },
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
const labelCls = "block text-sm font-medium text-stone-700 mb-2";
const fieldCls = "mb-4";

// ── Field error ─────────────────────────────────────────────────────────────
function FieldError({ msg, id }: { msg: string; id?: string }) {
  const { t } = useI18n();
  return (
    <div id={id} className="flex items-center gap-2 mt-2 px-3 py-2 bg-red-50 border border-red-100 rounded-lg">
      <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
      <span className="text-xs font-medium text-red-600">{t(msg)}</span>
    </div>
  );
}

// ── Review step ─────────────────────────────────────────────────────────────
function ReviewSection({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  const { t: translateUi, locale: uiLocale } = useI18n();
  return (
    <div className="min-w-0 break-words bg-stone-50 border border-stone-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-stone-400 uppercase tracking-wide">{title}</span>
        <button
          type="button"
          aria-label={`Edit ${title.toLowerCase()}`}
          onClick={onEdit}
          className="min-h-11 px-3 text-sm text-matcha-600 hover:text-matcha-700 cursor-pointer font-medium rounded-lg hover:bg-matcha-50 transition-colors"
        >
          {translateUi("Edit ")}</button>
      </div>
      {children}
    </div>
  );
}

function ReviewStep({ form, onEdit, onTermsChange, termsError }: { form: FormState; onEdit: (s: number) => void; onTermsChange: (v: boolean) => void; termsError?: string }) {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const url      = previewUrl(form.name);
  const openDays = form.hours.filter((h) => !h.closed);
  const hasLoc   = form.location.address || form.location.city || form.location.country;
  const hasCon   = form.contact.phone   || form.contact.email  || form.contact.website;
  const [expanded, setExpanded] = useState<"terms" | "privacy" | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <ReviewSection title={translateUi("Salon")} onEdit={() => onEdit(0)}>
        <p className="font-semibold text-stone-900">{form.name}</p>
        {url && form.features.includes("STATIC_WEBSITE") && <p className="text-matcha-600 text-xs mt-0.5">{translateUi("Suggested web address: ")}{url}</p>}
      </ReviewSection>

      <ReviewSection title={translateUi("Owner")} onEdit={() => onEdit(1)}>
        <p className="font-medium text-stone-900 text-sm">{form.owner.name}</p>
        <p className="text-stone-500 text-xs">{form.owner.email}</p>
        {form.owner.phone && <p className="text-stone-500 text-xs">{form.owner.phone}</p>}
      </ReviewSection>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ReviewSection title={translateUi("Location")} onEdit={() => onEdit(2)}>
          {hasLoc ? (
            <div className="text-sm text-stone-600 space-y-0.5">
              {form.location.country && <p>{form.location.country}</p>}
              {form.location.address && <p>{form.location.address}</p>}
              <p>{[form.location.zipCode, form.location.city].filter(Boolean).join(" ")}</p>
              {form.businessRegistrationId && (
                <p className="text-xs text-stone-400 mt-1">
                  {translateUi("Reg. ")}{form.businessRegistrationId}
                  {form.showBusinessId && <span className="ml-1 text-matcha-600">{translateUi("· shown publicly")}</span>}
                </p>
              )}
            </div>
          ) : (
            <p className="text-stone-400 text-sm">{translateUi("Not specified")}</p>
          )}
        </ReviewSection>

        <ReviewSection title={translateUi("Contact")} onEdit={() => onEdit(3)}>
          {hasCon ? (
            <div className="text-sm text-stone-600 space-y-0.5">
              {form.contact.phone   && <p>{form.contact.phone}</p>}
              {form.contact.email   && <p>{form.contact.email}</p>}
              {form.contact.website && <p className="truncate">{form.contact.website}</p>}
            </div>
          ) : (
            <p className="text-stone-400 text-sm">{translateUi("Not specified")}</p>
          )}
        </ReviewSection>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ReviewSection title={translateUi("Features")} onEdit={() => onEdit(4)}>
          {form.features.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {form.features.map((f) => (
                <span key={f} className="text-xs px-2.5 py-0.5 rounded-full bg-stone-200 text-stone-700">
                  {translateUi(FEATURE_LABEL[f] ?? f)}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-stone-400 text-sm">{translateUi("None selected")}</p>
          )}
        </ReviewSection>

        <ReviewSection title={translateUi("Hours")} onEdit={() => onEdit(5)}>
          {openDays.length ? (
            <ul className="space-y-1 text-sm text-stone-600">
              {openDays.map((day) => <li key={day.day}>{translateUi(DAY_SHORT[day.day])}: {day.openTime}–{day.closeTime}</li>)}
            </ul>
          ) : (
            <p className="text-stone-400 text-sm">{translateUi("All days closed")}</p>
          )}
        </ReviewSection>
      </div>

      <div className="border border-stone-200 rounded-xl overflow-hidden bg-stone-50">
        <div className="flex items-start gap-3 px-4 py-3.5 hover:bg-stone-100 transition-colors">
          <input
            id="termsAccepted"
            type="checkbox"
            aria-describedby={termsError ? "termsAccepted-error" : undefined}
            aria-invalid={Boolean(termsError)}
            checked={form.termsAccepted}
            onChange={(e) => onTermsChange(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-matcha-600 shrink-0 cursor-pointer"
          />
          <div className="text-sm text-stone-600 leading-relaxed">
            <span>
            {translateUi("I have read and agree to the")}{" "}
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); setExpanded(expanded === "terms" ? null : "terms"); }}
              className="text-matcha-600 underline hover:text-matcha-700 font-medium cursor-pointer"
            >
              {translateUi("Terms and Conditions ")}{expanded === "terms" ? "▲" : "▼"}
            </button>{" "}
            {translateUi("and")}{" "}
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); setExpanded(expanded === "privacy" ? null : "privacy"); }}
              className="text-matcha-600 underline hover:text-matcha-700 font-medium cursor-pointer"
            >
              {translateUi("Privacy Policy ")}{expanded === "privacy" ? "▲" : "▼"}
            </button>
            .
            </span>
          </div>
        </div>

        {termsError && <div className="px-4 pb-3"><FieldError id="termsAccepted-error" msg={termsError} /></div>}

        {expanded && (
          <div className="border-t border-stone-200 bg-white px-4 py-3 max-h-52 overflow-y-auto">
            <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide mb-2">
              {expanded === "terms" ? translateUi("Terms and Conditions") : translateUi("Privacy Policy")}
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

type CopyKey = "admin" | "staff" | "website" | "booking" | "dashboard";

function SuccessScreen({ salonId, salonHandler, emailId, salonName, features }: { salonId: string; salonHandler: string; emailId: string; salonName: string; features: string[] }) {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const [copied, setCopied]                 = useState<CopyKey | null>(null);
  const [copyError, setCopyError] = useState("");

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 2500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy(text: string, key: CopyKey) {
    setCopyError("");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
    } catch {
      setCopied(null);
      setCopyError("Couldn’t copy the link. Select the link text to copy it manually.");
    }
  }

  function LinkRow({ icon, label, hint, url, copyKey, copied: c, onCopy }: {
    icon: React.ReactNode; label: string; hint: string;
    url: string; copyKey: CopyKey; copied: CopyKey | null;
    onCopy: (text: string, key: CopyKey) => void;
  }) {
  const { t: translateUi, locale: uiLocale } = useI18n();
    return (
      <div className="flex items-start gap-3 px-4 py-3 border-t border-stone-100 first:border-t-0">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide mb-0.5">{translateUi(label)}</p>
          <a href={url} className="break-all text-sm text-matcha-700 hover:underline">{url}</a>
          <p className="text-[10px] text-stone-400 mt-0.5">{hint}</p>
        </div>
        <button
          onClick={() => onCopy(url, copyKey)}
          className="flex min-h-11 shrink-0 items-center gap-1 px-2 text-sm text-matcha-700 hover:bg-matcha-50 rounded-lg cursor-pointer"
          aria-label={`Copy ${label.toLowerCase()} link`}
        >
          {c === copyKey
            ? <Check className="w-4 h-4 text-matcha-600" />
            : <Copy className="w-4 h-4" />}
          {c === copyKey ? translateUi("Copied") : translateUi("Copy")}
        </button>
      </div>
    );
  }

  const hasWebsite      = features.includes("STATIC_WEBSITE");
  const hasBooking      = features.includes("BOOKING");
  const hasDashboard    = features.includes("DASHBOARD");
  const salonWebsiteUrl = websiteUrl(salonHandler);
  const salonBookingUrl = bookingUrl(salonHandler);
  const salonDashboardUrl = dashboardUrl(salonId);

  // ── Done phase ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] bg-cream flex flex-col">
      <div className="flex-1 overflow-y-auto px-5 py-10 flex flex-col items-center">
      <div className="w-full max-w-sm my-auto animate-[fade-in_0.4s_ease_both]">

        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-full bg-matcha-100 border-2 border-matcha-400 flex items-center justify-center mb-4">
            <Check className="w-7 h-7 text-matcha-600" />
          </div>
          <h1 className="text-xl font-bold text-stone-900 text-center">{translateUi("Your salon is created!")}</h1>
          <p className="text-stone-500 text-sm text-center mt-1.5 leading-relaxed">
            {translateUi("Sign in to finish setting up ")}<strong className="text-stone-700">{salonName}</strong>{translateUi(", add your services, and invite your team. ")}</p>
        </div>

        <div className="flex flex-col gap-3">
          <a href={ADMIN_APP_URL} className="block rounded-xl bg-matcha-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-matcha-700">{translateUi("Continue to salon admin →")}</a>
          <p role="status" className={copyError ? "text-sm text-red-700" : "sr-only"}>{copyError || (copied ? "Link copied." : "")}</p>
          {/* Email sent hint */}
          <div className="flex items-start gap-3 px-4 py-3 bg-matcha-50 border border-matcha-100 rounded-2xl">
            <Mail className="w-4 h-4 text-matcha-600 mt-0.5 shrink-0" />
            <p className="text-xs text-matcha-800 leading-relaxed">
              {translateUi("We've sent a welcome email to ")}<span className="font-semibold">{emailId}</span> {translateUi("with your login link and a setup guide to get you started. ")}</p>
          </div>

          {/* Links section */}
          <details className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-stone-700">{translateUi("Your salon and team links")}</summary>

            {/* Admin panel */}
            <LinkRow
              icon={<LayoutDashboard className="w-3.5 h-3.5 text-stone-400" />}
              label={translateUi("Admin panel")}
              hint={`Sign in with ${emailId}`}
              url={ADMIN_APP_URL}
              copyKey="admin"
              copied={copied}
              onCopy={copy}
            />

            {/* Staff portal */}
            <LinkRow
              icon={<Users className="w-3.5 h-3.5 text-stone-400" />}
              label={translateUi("Staff portal")}
              hint={translateUi("Share with your team members")}
              url={STAFF_APP_URL}
              copyKey="staff"
              copied={copied}
              onCopy={copy}
            />

            {/* Booking link — only when BOOKING feature selected */}
            {hasBooking && (
              <LinkRow
                icon={<CalendarCheck className="w-3.5 h-3.5 text-stone-400" />}
                label={translateUi("Booking link")}
                hint={translateUi("Share with customers to accept appointments")}
                url={salonBookingUrl}
                copyKey="booking"
                copied={copied}
                onCopy={copy}
              />
            )}

            {hasDashboard && (
              <LinkRow
                icon={<Gauge className="w-3.5 h-3.5 text-stone-400" />}
                label={translateUi("Operations Dashboard")}
                hint={translateUi("Appointments and in-salon checkout")}
                url={salonDashboardUrl}
                copyKey="dashboard"
                copied={copied}
                onCopy={copy}
              />
            )}

            {/* Public website — only when STATIC_WEBSITE feature selected */}
            {hasWebsite && (
              <LinkRow
                icon={<Globe className="w-3.5 h-3.5 text-stone-400" />}
                label={translateUi("Public website")}
                hint={translateUi("Your customer-facing page — share it freely")}
                url={salonWebsiteUrl}
                copyKey="website"
                copied={copied}
                onCopy={copy}
              />
            )}
          </details>

          <a
            href="/new"
            className="block text-center py-2.5 rounded-xl border border-stone-200 bg-white text-stone-600 text-sm font-medium hover:border-stone-300 hover:bg-stone-50 active:scale-[0.97] transition-all no-underline"
          >
            {translateUi("Register another salon → ")}</a>
        </div>
      </div>
      </div>
      <SiteFooter />
    </div>
  );
}

// ── Main wizard ──────────────────────────────────────────────────────────────
export default function NewSalon() {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const { countries, countriesError } = useLoaderData<typeof clientLoader>();
  const [step,      setStep]      = useState(0);
  const [form,      setForm]      = useState<FormState>(emptyForm);
  const [errors,    setErrors]    = useState<Record<string, string>>({});
  const [saving,   setSaving]   = useState(false);
  const [created,  setCreated]  = useState<{ salonId: string; salonHandler: string; emailId: string } | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [editingReview, setEditingReview] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const submittingRef = useRef(false);
  const revalidator = useRevalidator();
  const [socialOpen,         setSocialOpen]         = useState(false);

  function setOwner(patch: Partial<Owner>)         { setForm((f) => ({ ...f, owner:    { ...f.owner,    ...patch } })); }
  function setLocation(patch: Partial<Location>)   { setForm((f) => ({ ...f, location: { ...f.location, ...patch } })); }
  function setContact(patch: Partial<ContactInfo>) { setForm((f) => ({ ...f, contact:  { ...f.contact,  ...patch } })); }

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [step]);

  useEffect(() => {
    const firstError = Object.keys(errors)[0];
    if (firstError) document.getElementById(firstError)?.focus();
  }, [errors]);

  function fieldProps(id: string) {
    return { id, "aria-invalid": Boolean(errors[id]), "aria-describedby": errors[id] ? `${id}-error` : undefined };
  }

  function validate(s: number): Record<string, string> {
    const e: Record<string, string> = {};
    if (s === 0 && !form.name.trim()) e.name = "Salon name is required.";
    if (s === 1) {
      if (!form.owner.name.trim())  e.ownerName  = "Owner name is required.";
      if (!form.owner.email.trim()) e.ownerEmail = "Owner email is required.";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.owner.email.trim()))
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
      if (form.contact.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact.email.trim()))
        e.contactEmail = "Enter a valid email address.";
      if (form.contact.website) {
        try {
          const url = new URL(form.contact.website.trim());
          if (!["http:", "https:"].includes(url.protocol)) throw new Error();
        } catch { e.contactWebsite = "Enter a website address starting with https:// (for example, https://yoursalon.com)."; }
      }
    }
    if (s === 5 && form.hours.some((day) => !day.closed && (!day.openTime || !day.closeTime || day.openTime >= day.closeTime))) {
      e.hours = "Each open day needs a closing time later than its opening time.";
    }
    return e;
  }

  function goNext() {
    if (saving) return;
    const e = validate(step);
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setStep((s) => editingReview ? TOTAL - 1 : Math.min(s + 1, TOTAL - 1));
    setEditingReview(false);
  }

  function goBack() { if (!saving) { setErrors({}); setEditingReview(false); setStep((s) => Math.max(0, s - 1)); } }
  function goTo(s: number) {
    if (!saving && s < step) {
      setErrors({});
      setEditingReview(step === TOTAL - 1);
      setStep(s);
    }
  }

  async function handleCreate() {
    if (submittingRef.current) return;
    if (!form.termsAccepted) {
      setErrors({ termsAccepted: "Please read and accept the terms and privacy policy to continue." });
      return;
    }
    for (let s = 0; s < TOTAL - 1; s++) {
      const issues = validate(s);
      if (Object.keys(issues).length) {
        setStep(s);
        setEditingReview(true);
        setErrors(issues);
        return;
      }
    }
    submittingRef.current = true;
    setSaving(true);
    setSubmitError("");
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
      setSubmitError(e instanceof Error ? e.message : "We couldn’t create your salon. Please try again.");
    } finally {
      submittingRef.current = false;
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
            <label htmlFor="name" className={labelCls}>{translateUi("Salon name ")}<span className="normal-case">{translateUi("(required)")}</span></label>
            <input
              {...fieldProps("name")}
              autoComplete="organization"
              className={`${inputCls} text-lg font-semibold py-4 ${errors.name ? "border-red-400 bg-red-50/40 focus:border-red-400 focus:ring-red-400/10" : ""}`}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={translateUi("e.g. The Modern Cut")}
            />
            {errors.name
              ? <FieldError id="name-error" msg={errors.name} />
              : form.name && (
                <p className="text-stone-400 text-xs mt-2">
                  {translateUi("Suggested web address: ")}<span className="break-all text-matcha-600 font-medium">{previewUrl(form.name) ?? "…"}</span>
                </p>
              )
            }
          </div>
        );

      case 1:
        return (
          <div>
            <div className={fieldCls}>
              <label htmlFor="ownerName" className={labelCls}>{translateUi("Full name (required)")}</label>
              <input {...fieldProps("ownerName")} autoComplete="name" className={`${inputCls} ${errors.ownerName ? "border-red-400 bg-red-50/40 focus:border-red-400 focus:ring-red-400/10" : ""}`} value={form.owner.name} onChange={(e) => setOwner({ name: e.target.value })} placeholder={translateUi("Jane Doe")} />
              {errors.ownerName && <FieldError id="ownerName-error" msg={errors.ownerName} />}
            </div>
            <div className={fieldCls}>
              <label htmlFor="ownerEmail" className={labelCls}>{translateUi("Sign-in email (required)")}</label>
              <input {...fieldProps("ownerEmail")} autoComplete="email" type="email" className={`${inputCls} ${errors.ownerEmail ? "border-red-400 bg-red-50/40 focus:border-red-400 focus:ring-red-400/10" : ""}`} value={form.owner.email} onChange={(e) => setOwner({ email: e.target.value })} placeholder={"jane@example.com"} />
              {errors.ownerEmail && <FieldError id="ownerEmail-error" msg={errors.ownerEmail} />}
            </div>
            <div className={fieldCls}>
              <label htmlFor="ownerPhone" className={labelCls}>{translateUi("Phone (optional)")}</label>
              <PhoneInput
                {...fieldProps("ownerPhone")}
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
              {errors.ownerPhone && <FieldError id="ownerPhone-error" msg={errors.ownerPhone} />}
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
              <label htmlFor="locationCountry" className={labelCls}>{translateUi("Country or region (required)")}</label>
              <CountrySelect
                {...fieldProps("locationCountry")}
                value={form.location.country ?? ""}
                onChange={(v) => {
                  setErrors((prev) => { const { locationCountry: _error, ...rest } = prev; return rest; });
                  setLocation({ country: v });
                  setForm((f) => ({ ...f, businessRegistrationId: "", showBusinessId: false }));
                }}
                countries={countries}
                className={errors.locationCountry ? "border-red-400 focus:border-red-400" : ""}
              />
              {errors.locationCountry && <FieldError id="locationCountry-error" msg={errors.locationCountry} />}
            </div>
            <div className={fieldCls}>
              <label htmlFor="locationAddress" className={labelCls}>{translateUi("Street address (optional)")}</label>
              <input id="locationAddress" autoComplete="street-address" className={inputCls} value={form.location.address ?? ""} onChange={(e) => setLocation({ address: e.target.value })} placeholder={translateUi("123 Main St")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className={fieldCls}>
                <label htmlFor="locationZip" className={labelCls}>{translateUi("Postal code (optional)")}</label>
                <input id="locationZip" autoComplete="postal-code" className={inputCls} value={form.location.zipCode ?? ""} onChange={(e) => setLocation({ zipCode: e.target.value })} placeholder={"94105"} />
              </div>
              <div className={fieldCls}>
                <label htmlFor="locationCity" className={labelCls}>{translateUi("City (optional)")}</label>
                <input id="locationCity" autoComplete="address-level2" className={inputCls} value={form.location.city ?? ""} onChange={(e) => setLocation({ city: e.target.value })} placeholder={translateUi("San Francisco")} />
              </div>
            </div>
            {bizIdLabel && (
              <div className={fieldCls}>
                <label className={labelCls}>
                  {bizIdLabel}{" "}
                  <span className="text-stone-300 font-normal normal-case tracking-normal">{translateUi("optional")}</span>
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
                    <span className="text-xs text-stone-500">{translateUi("Show on public website")}</span>
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
            <p className="mb-5 rounded-xl bg-matcha-50 p-4 text-sm leading-relaxed text-matcha-900">{translateUi("These details are shown to customers on your salon page. We’ve left them blank so you can choose what to share.")}</p>
            <div className={fieldCls}>
              <label htmlFor="contactPhone" className={labelCls}>{translateUi("Customer-facing phone (optional)")}</label>
              <PhoneInput
                {...fieldProps("contactPhone")}
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
              {errors.contactPhone && <FieldError id="contactPhone-error" msg={errors.contactPhone} />}
            </div>
            <div className={fieldCls}>
              <label htmlFor="contactEmail" className={labelCls}>{translateUi("Customer-facing email (optional)")}</label>
              <input {...fieldProps("contactEmail")} autoComplete="organization" type="email" className={`${inputCls} ${errors.contactEmail ? "border-red-400 bg-red-50/40 focus:border-red-400 focus:ring-red-400/10" : ""}`} value={form.contact.email ?? ""} onChange={(e) => setContact({ email: e.target.value })} placeholder={"hello@yoursalon.com"} />
              {errors.contactEmail && <FieldError id="contactEmail-error" msg={errors.contactEmail} />}
            </div>
            <div className={fieldCls}>
              <label htmlFor="contactWebsite" className={labelCls}>{translateUi("Website (optional)")}</label>
              <input {...fieldProps("contactWebsite")} autoComplete="url" type="url" className={`${inputCls} ${errors.contactWebsite ? "border-red-400 bg-red-50/40 focus:border-red-400 focus:ring-red-400/10" : ""}`} value={form.contact.website ?? ""} onChange={(e) => setContact({ website: e.target.value })} placeholder={"https://yoursalon.com"} />
              {errors.contactWebsite && <FieldError id="contactWebsite-error" msg={errors.contactWebsite} />}
            </div>

            <div className="border-t border-stone-100 pt-3">
              <button
                type="button"
                onClick={() => setSocialOpen((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-700 cursor-pointer"
                aria-expanded={socialOpen}
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${socialOpen ? "" : "-rotate-90"}`} />
                {translateUi("Add social links (optional) ")}</button>
              {socialOpen && (
                <div className="mt-3 space-y-2.5">
                  <p className="text-xs text-stone-400 -mt-0.5">
                    {translateUi("Turn a platform on to show its icon in your website footer. Add the link to make it clickable. ")}</p>
                  {SOCIAL_PLATFORMS.map((p) => {
                    const on = form.contact[p.visibleKey] === true;
                    return (
                      <div key={p.key} className="flex flex-wrap items-center gap-2.5">
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
                          className={`${inputCls} min-w-[140px] flex-1 ${on ? "" : "opacity-50"}`}
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
            descriptions={FEATURE_DESCRIPTION}
            selected={form.features}
            onChange={(features) => setForm((f) => ({ ...f, features }))}
          />
        );

      case 5:
        return (
          <div>
            <OpeningHours hours={form.hours} onChange={(hours) => setForm((f) => ({ ...f, hours }))} />
            {errors.hours && <FieldError id="hours-error" msg={errors.hours} />}
          </div>
        );

      case 6:
        return <ReviewStep form={form} onEdit={goTo} termsError={errors.termsAccepted} onTermsChange={(v) => {
          setForm((f) => ({ ...f, termsAccepted: v }));
          if (v) setErrors((prev) => { const { termsAccepted: _error, ...rest } = prev; return rest; });
        }} />;
    }
  }

  const progress = Math.round(((step + 1) / TOTAL) * 100);

  return (
    <div className="min-h-[100dvh] bg-cream flex flex-col">
      {/* Sticky header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          {step > 0 ? (
            <button type="button" disabled={saving} onClick={goBack} aria-label={translateUi("Go back one step")} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-stone-500 hover:text-stone-900 cursor-pointer text-lg shrink-0 transition-colors disabled:opacity-50">←</button>
          ) : (
            <Link to="/" aria-label={translateUi("Back to home")} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-stone-500 hover:text-stone-900 no-underline text-lg shrink-0 transition-colors">←</Link>
          )}
          <span className="text-xs font-medium text-stone-400 flex-1 uppercase tracking-wide">{translateUi(STEPS[step].title)}</span>
          <span className="text-xs text-stone-400 shrink-0 tabular-nums">{step + 1} / {TOTAL}</span>
        </div>

        <div className="flex items-center gap-3 px-4 pb-2">
        {/* Progress bar reflects current position and remains visible to assistive technology. */}
        <div role="progressbar" aria-label={translateUi("Signup progress")} aria-valuemin={0} aria-valuemax={TOTAL} aria-valuenow={step + 1} aria-valuetext={`Step ${step + 1} of ${TOTAL}: ${STEPS[step].title}`} className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100">
          <div
            className="h-full rounded-full bg-matcha-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="shrink-0 text-xs tabular-nums text-stone-600">{translateUi("Step ")}{step + 1} {translateUi("of ")}{TOTAL}</span>
        </div>
        <nav aria-label={translateUi("Completed signup steps")} className="flex justify-center gap-2 pb-3">
          {STEPS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              disabled={i >= step || saving}
              aria-label={`Return to ${STEPS[i].title}`}
              aria-current={i === step ? "step" : undefined}
              title={translateUi(STEPS[i].title)}
              className={`min-h-8 min-w-8 rounded-full disabled:cursor-default ${
                i === step ? "bg-matcha-100 ring-2 ring-matcha-500" :
                i < step   ? "bg-matcha-400 hover:bg-matcha-600" :
                             "bg-stone-200"
              }`}
            />
          ))}
        </nav>
      </header>

      {/* Content area */}
      <main className="flex-1 flex items-start justify-center px-4 pt-6 sm:pt-12 pb-8">
        <div className="w-full max-w-lg">
          <form onSubmit={(e) => { e.preventDefault(); if (step === TOTAL - 1) void handleCreate(); else goNext(); }} className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">

            {/* Card header */}
            <div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-4 sm:pb-5 border-b border-stone-100">
              <h1 ref={headingRef} tabIndex={-1} className="text-lg font-bold text-stone-900 mb-1 focus:outline-none">{translateUi(STEPS[step].title)}</h1>
              <p className="text-sm text-stone-500 leading-relaxed">{translateUi(STEPS[step].hint)}</p>
            </div>

            {submitError && (
              <div role="alert" className="mx-4 mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 sm:mx-6">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <p className="min-w-0 flex-1 text-sm text-red-800">{submitError}</p>
                <button type="button" onClick={() => void handleCreate()} disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-3 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"><RefreshCw className="h-4 w-4" /> {translateUi("Try again")}</button>
              </div>
            )}

            {/* Country/phone fields need the country list; Retry reruns the loader. */}
            {(countriesError || countries.length === 0) && (
              <div className="px-4 sm:px-6 pt-4">
                <div role="alert" className="flex flex-wrap items-center gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <p className="min-w-0 flex-1 text-sm text-red-700">{translateUi("We couldn’t load the country list. Try again to choose your salon’s country.")}</p>
                  <button type="button" onClick={() => revalidator.revalidate()} disabled={revalidator.state !== "idle"} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg bg-white px-3 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${revalidator.state !== "idle" ? "animate-spin" : ""}`} /> {translateUi("Retry")}</button>
                </div>
              </div>
            )}

            {/* Step content — keyed so it fades in on each transition */}
            <div key={step} className="px-4 sm:px-6 py-4 sm:py-5 motion-safe:animate-[fade-in_0.18s_ease]">
              {renderStep()}
            </div>

            {/* Navigation footer */}
            <div className="px-4 sm:px-6 py-4 border-t border-stone-100 flex justify-between items-center bg-stone-50/60">
              {step > 0 ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={goBack}
                  className="min-h-11 px-4 rounded-xl border border-stone-200 bg-white text-sm text-stone-600 hover:border-stone-400 hover:bg-stone-50 transition-all cursor-pointer disabled:opacity-50"
                >
                  {translateUi("← Back ")}</button>
              ) : <span />}

              {step < TOTAL - 1 ? (
                <button
                  type="submit"
                  disabled={saving || Boolean(countriesError) || countries.length === 0}
                  className="min-h-11 px-6 rounded-xl bg-matcha-600 text-sm font-medium text-white hover:bg-matcha-700 transition-all cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingReview ? translateUi("Save & return to review →") : translateUi("Continue →")}
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex min-h-11 items-center gap-2 px-6 rounded-xl bg-matcha-600 text-sm font-medium text-white hover:bg-matcha-700 transition-all cursor-pointer shadow-sm disabled:opacity-70 disabled:cursor-wait"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {saving ? translateUi("Creating salon…") : translateUi("Create salon")}
                </button>
              )}
            </div>
          </form>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
