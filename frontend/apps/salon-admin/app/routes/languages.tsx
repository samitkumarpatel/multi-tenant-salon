import { useState } from "react";
import { useLoaderData } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { LANGUAGES, useI18n } from "@salon/i18n";
import type { Language, SalonLanguages } from "@salon/i18n";
import { ADMIN_API, apiFetch, resolveSalonUUID } from "~/lib/api";

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const salonId = await resolveSalonUUID(params.salonId!);
  const settings = await apiFetch<SalonLanguages>(`${ADMIN_API}/${salonId}/languages`);
  return { salonId, settings };
}

const APPLICATIONS = [
  { key: "website", label: "Public website" },
  { key: "booking", label: "Booking" },
  { key: "dashboard", label: "Dashboard" },
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

  return <form onSubmit={publish} className="max-w-3xl space-y-6">
    <div>
      <h1 className="text-xl font-bold text-slate-900">{t("Languages")}</h1>
      <p className="mt-2 text-sm text-slate-600">{t("Choose which languages customers and your team can use in each app.")}</p>
      <p className="mt-2 text-sm text-slate-500">{t("Onboarding and staff always offer all six languages.")}</p>
    </div>
    {APPLICATIONS.map(({ key, label }) => <fieldset key={key} disabled={saving} className="rounded-xl border border-slate-200 bg-white p-5">
      <legend className="px-2 font-semibold text-slate-900">{t(label)}</legend>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {LANGUAGES.map(({ code, name }) => <label key={code} className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={draft[key].enabled.includes(code)} onChange={() => toggle(key, code)}
            disabled={draft[key].enabled.length === 1 && draft[key].enabled.includes(code)} />
          <span lang={code}>{name}</span>
        </label>)}
      </div>
      <label className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-700">
        {t("Default language")}
        <select aria-label={t("Default language")} value={draft[key].defaultLanguage} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3"
          onChange={(event) => { setMessage(""); setDraft({ ...draft, [key]: { ...draft[key], defaultLanguage: event.target.value as Language } }); }}>
          {LANGUAGES.filter(({ code }) => draft[key].enabled.includes(code)).map(({ code, name }) => <option key={code} value={code}>{name}</option>)}
        </select>
      </label>
    </fieldset>)}
    <p className="text-sm text-slate-500">{t("These settings translate app controls. Salon names, descriptions, and other content you enter keep their original language.")}</p>
    {error && <p role="alert" className="text-sm text-red-700">{t(error)}</p>}
    {message && <p role="status" className="text-sm text-green-700">{t(message)}</p>}
    <button type="submit" disabled={saving || !dirty} className="min-h-11 rounded-lg bg-matcha-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
      {t(saving ? "Publishing…" : "Publish languages")}
    </button>
  </form>;
}
