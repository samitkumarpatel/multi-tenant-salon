import { useI18n } from "@salon/i18n";
import PhoneInput from "./PhoneInput";
import type { Country } from "./types";

export type ContactMethod = "email" | "phone";
export type CustomerBookingForm = { name: string; email: string; phone: string; notes: string };

const inputCls = "w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm outline-none transition bg-white text-slate-900 focus:ring-2 placeholder:text-slate-300 hover:border-slate-300";

export function CustomerDetailsFields({
  form, onChange, contactMethod, onContactMethodChange, countries, defaultCountry, accentColor = "#5f7137",
}: {
  form: CustomerBookingForm;
  onChange: (form: CustomerBookingForm) => void;
  contactMethod: ContactMethod;
  onContactMethodChange: (method: ContactMethod) => void;
  countries: Country[];
  defaultCountry?: string;
  accentColor?: string;
}) {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const ringStyle = { ["--tw-ring-color" as string]: `${accentColor}33` };
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">{translateUi("Full name ")}<span className="text-red-500">*</span></label>
        <input className={inputCls} style={ringStyle} placeholder={translateUi("Jane Smith")} autoComplete="name" value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })} />
      </div>
      <div>
        <div className="mb-3 flex gap-1 rounded-xl bg-slate-100 p-1" role="group" aria-label={translateUi("Preferred contact method")}>
          {(["email", "phone"] as const).map((method) => (
            <button key={method} type="button" aria-pressed={contactMethod === method}
              onClick={() => {
                onContactMethodChange(method);
                onChange({ ...form, email: method === "email" ? form.email : "", phone: method === "phone" ? form.phone : "" });
              }}
              className={`flex-1 rounded-lg py-1.5 text-sm font-semibold transition-all ${contactMethod === method ? "bg-white shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
              style={contactMethod === method ? { color: accentColor } : {}}>
              {method === "email" ? translateUi("Email") : translateUi("Phone")}
            </button>
          ))}
        </div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          {contactMethod === "email" ? translateUi("Email address") : translateUi("Phone number")} <span className="text-red-500">*</span>
        </label>
        {contactMethod === "email" ? (
          <input type="email" autoComplete="email" className={inputCls} style={ringStyle} placeholder={"jane@example.com"} value={form.email}
            onChange={(e) => onChange({ ...form, email: e.target.value })} />
        ) : (
          <PhoneInput value={form.phone} onChange={(phone) => onChange({ ...form, phone })} countries={countries} defaultCountry={defaultCountry} />
        )}
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">{translateUi("Notes ")}<span className="font-normal text-slate-400">{translateUi("(optional)")}</span></label>
        <textarea className={`${inputCls} resize-none`} style={ringStyle} rows={2} placeholder={translateUi("Anything we should know?")} value={form.notes}
          onChange={(e) => onChange({ ...form, notes: e.target.value })} />
      </div>
    </div>
  );
}
