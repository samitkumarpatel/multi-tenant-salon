import { useState } from "react";
import { useLoaderData } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { LANGUAGES, useI18n } from "@salon/i18n";
import type { Language, SalonLanguages } from "@salon/i18n";
import { CalendarDays, Globe2, LayoutDashboard } from "lucide-react";
import { ADMIN_API, apiFetch, resolveSalonUUID } from "~/lib/api";

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const salonId = await resolveSalonUUID(params.salonId!);
  const settings = await apiFetch<SalonLanguages>(`${ADMIN_API}/${salonId}/languages`);
  return { salonId, settings };
}

const APPLICATIONS = [
  { key: "website", label: "Public website", icon: Globe2 },
  { key: "booking", label: "Booking", icon: CalendarDays },
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
] as const;

export default function Languages() {
  const data = useLoaderData<typeof clientLoader>();
  return <LanguageSettings key={data.salonId} {...data} />;
}

function LanguageSettings({ salonId, settings }: Awaited<ReturnType<typeof clientLoader>>) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(settings);
  const [saved, setSaved] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  function toggle(app: keyof SalonLanguages, language: Language) {
    setMessage("");
    setDraft((current) => {
      const policy = current[app];
      const enabled = policy.enabled.includes(language)
        ? policy.enabled.filter((code) => code !== language) : [...policy.enabled, language];
      if (!enabled.length) return current;
      return { ...current, [app]: { enabled, defaultLanguage: enabled.includes(policy.defaultLanguage) ? policy.defaultLanguage : enabled[0] } };
    });
  }

  async function publish(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true); setError(""); setMessage("");
    try {
      const result = await apiFetch<SalonLanguages>(`${ADMIN_API}/${salonId}/languages`, { method: "PUT", body: JSON.stringify(draft) });
      setDraft(result); setSaved(result); setMessage("Languages published");
    } catch {
      setError("Could not publish languages. Please try again.");
    } finally { setSaving(false); }
  }

  return <form onSubmit={publish} className="max-w-5xl space-y-5">
    <div>
      <h1 className="text-xl font-bold text-slate-900">{t("Languages")}</h1>
      <p className="mt-2 text-sm text-slate-600">{t("Choose which languages customers and your team can use in each app.")}</p>
    </div>
    <div className="grid gap-4 lg:grid-cols-3">
      {APPLICATIONS.map(({ key, label, icon: Icon }) => <fieldset key={key} disabled={saving} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <legend className="sr-only">{t(label)}</legend>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-900">
            <Icon className="h-4 w-4 shrink-0 text-matcha-700" aria-hidden="true" />
            <span className="truncate">{t(label)}</span>
          </h2>
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500">
            {draft[key].enabled.length} / {LANGUAGES.length}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {LANGUAGES.map(({ code, name }) => {
            const enabled = draft[key].enabled.includes(code);
            const required = draft[key].enabled.length === 1 && enabled;
            return <label key={code} className={`flex min-h-10 min-w-0 items-center gap-2 rounded-lg border px-2 text-xs transition-colors ${enabled ? "border-matcha-200 bg-matcha-50/70 text-slate-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              <input type="checkbox" className="h-4 w-4 shrink-0 accent-matcha-700" checked={enabled} onChange={() => toggle(key, code)} disabled={required} />
              <span lang={code} className="truncate">{name}</span>
            </label>;
          })}
        </div>
        <label className="mt-4 flex flex-col gap-1.5 border-t border-slate-100 pt-3 text-xs font-medium text-slate-600">
          {t("Default language")}
          <select aria-label={`${t(label)} — ${t("Default language")}`} value={draft[key].defaultLanguage}
            className="min-h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-sm font-normal text-slate-800 focus:border-matcha-600 focus:outline-none focus:ring-2 focus:ring-matcha-100"
            onChange={(event) => { setMessage(""); setDraft({ ...draft, [key]: { ...draft[key], defaultLanguage: event.target.value as Language } }); }}>
            {LANGUAGES.filter(({ code }) => draft[key].enabled.includes(code)).map(({ code, name }) => <option key={code} value={code}>{name}</option>)}
          </select>
        </label>
      </fieldset>)}
    </div>
    <p className="text-xs leading-relaxed text-slate-500">{t("Onboarding and staff always offer all six languages.")} {t("These settings translate app controls. Salon names, descriptions, and other content you enter keep their original language.")}</p>
    {error && <p role="alert" className="text-sm text-red-700">{t(error)}</p>}
    {message && <p role="status" className="text-sm text-green-700">{t(message)}</p>}
    <button type="submit" disabled={saving || !dirty} className="min-h-11 rounded-lg bg-matcha-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
      {t(saving ? "Publishing…" : "Publish languages")}
    </button>
  </form>;
}
