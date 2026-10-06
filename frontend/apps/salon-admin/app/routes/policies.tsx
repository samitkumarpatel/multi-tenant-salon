import { useState } from "react";
import { useLoaderData } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { AlertCircle, Check, FileText, Globe2, Upload } from "lucide-react";
import { ADMIN_API, apiFetch, resolveSalonUUID } from "~/lib/api";

type Policy = {
  key: string;
  title: string;
  enabled: boolean;
  website: boolean;
  booking: boolean;
  source: "DEFAULT" | "CUSTOM";
  defaultLanguage: string;
  translations: Record<string, string>;
};

const LANGUAGES = [
  ["en", "English"], ["da", "Dansk"], ["sv", "Svenska"],
  ["nb", "Norsk bokmål"], ["fr", "Français"], ["de", "Deutsch"],
] as const;

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const salonId = await resolveSalonUUID(params.salonId!);
  const policies = await apiFetch<Policy[]>(`${ADMIN_API}/${salonId}/policies`);
  return { salonId, policies };
}

export default function LegalPolicies() {
  const data = useLoaderData<typeof clientLoader>();
  return <PolicyEditor key={data.salonId} {...data} />;
}

function PolicyEditor({ salonId, policies: initial }: Awaited<ReturnType<typeof clientLoader>>) {
  const [policies, setPolicies] = useState(initial);
  const [selectedKey, setSelectedKey] = useState(initial[0]?.key ?? "");
  const [language, setLanguage] = useState("en");
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const selected = policies.find(({ key }) => key === selectedKey);
  const dirty = JSON.stringify(policies) !== JSON.stringify(saved);

  function updateSelected(update: Partial<Policy>) {
    setMessage("");
    setPolicies((current) => current.map((policy) => policy.key === selectedKey ? { ...policy, ...update } : policy));
  }

  function updateText(text: string) {
    if (!selected) return;
    updateSelected({ source: "CUSTOM", translations: { ...selected.translations, [language]: text } });
  }

  function addCustomPolicy() {
    const key = `custom-${crypto.randomUUID()}`;
    const policy: Policy = { key, title: "Custom policy", enabled: false, website: false, booking: false, source: "CUSTOM", defaultLanguage: "en", translations: { en: "" } };
    setPolicies((current) => [...current, policy]);
    setSelectedKey(key);
    setLanguage("en");
    setMessage(""); setError("");
  }

  async function saveDraft(): Promise<Policy[]> {
    return apiFetch<Policy[]>(`${ADMIN_API}/${salonId}/policies`, { method: "PUT", body: JSON.stringify(policies) });
  }

  async function save(publish: boolean) {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await saveDraft();
      if (publish) await apiFetch<Policy[]>(`${ADMIN_API}/${salonId}/policies/publish`, { method: "POST" });
      setPolicies(result); setSaved(result);
      setMessage(publish ? "Policies published to the selected customer pages." : "Draft saved. It is not visible to customers until published.");
    } catch {
      setError(publish ? "Could not publish these policies. Please try again." : "Could not save the policy draft. Please try again.");
    } finally { setBusy(false); }
  }

  async function loadFile(file?: File) {
    if (!file) return;
    if (file.size > 100_000) { setError("Choose a text file smaller than 100 KB."); return; }
    try { updateText(await file.text()); setError(""); setMessage(`${file.name} loaded. Save the draft when you're ready.`); }
    catch { setError("Could not read that file. Choose a .txt or .md file."); }
  }

  return <main className="max-w-6xl space-y-5">
    <header>
      <div className="flex items-center gap-2"><FileText className="h-5 w-5 text-matcha-700" /><h1 className="text-xl font-bold text-slate-900">Legal policies</h1></div>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">All standard policy links start enabled on your website and booking page. Turn off either placement for a policy whenever you like, edit the suggested text, then publish your changes.</p>
    </header>

    <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between gap-2 px-2 pb-2"><h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Policy library</h2><button type="button" onClick={addCustomPolicy} className="text-xs font-semibold text-matcha-800 hover:underline">Add policy</button></div>
        <div className="space-y-1">{policies.map((policy) => <button key={policy.key} type="button" onClick={() => setSelectedKey(policy.key)} className={`flex min-h-10 w-full items-center justify-between rounded-lg px-3 text-left text-sm ${policy.key === selectedKey ? "bg-matcha-50 font-semibold text-matcha-900" : "text-slate-700 hover:bg-slate-50"}`}>
          <span>{policy.title}</span>{policy.enabled && <Check className="h-4 w-4 text-matcha-700" />}
        </button>)}</div>
        <p className="mt-4 border-t border-slate-100 px-2 pt-3 text-xs leading-5 text-slate-500">Templates are starting points. Review and adapt them for your salon before publishing.</p>
      </aside>

      {selected ? <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{selected.source === "DEFAULT" ? "Default template" : "Salon text"}</p><h2 className="mt-1 text-lg font-semibold text-slate-900">{selected.title}</h2></div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${selected.website || selected.booking ? "bg-matcha-50 text-matcha-900" : "bg-slate-100 text-slate-600"}`}>
            {selected.website && selected.booking ? "Selected for both pages" : selected.website ? "Website selected" : selected.booking ? "Booking selected" : "Hidden from customers"}
          </span>
        </div>

        <fieldset className="border-b border-slate-100 py-4">
          <legend className="text-sm font-semibold text-slate-800">Where should this policy appear?</legend>
          <p className="mt-1 text-sm text-slate-500">Select one or both customer pages. Clear both to hide this policy.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className={`flex min-h-[76px] cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${selected.website ? "border-matcha-300 bg-matcha-50/60" : "border-slate-200 hover:bg-slate-50"}`}>
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-matcha-700" checked={selected.website} onChange={(e) => updateSelected({ website: e.target.checked, enabled: e.target.checked || selected.booking })} />
              <Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              <span><span className="block text-sm font-medium text-slate-800">Public website</span><span className="mt-0.5 block text-xs leading-5 text-slate-500">Show a policy link on your salon website.</span></span>
            </label>
            <label className={`flex min-h-[76px] cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${selected.booking ? "border-matcha-300 bg-matcha-50/60" : "border-slate-200 hover:bg-slate-50"}`}>
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-matcha-700" checked={selected.booking} onChange={(e) => updateSelected({ booking: e.target.checked, enabled: e.target.checked || selected.website })} />
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              <span><span className="block text-sm font-medium text-slate-800">Booking page</span><span className="mt-0.5 block text-xs leading-5 text-slate-500">Show a policy link during online booking.</span></span>
            </label>
          </div>
        </fieldset>

        <label className="block text-sm font-medium text-slate-700">Policy title
          <input value={selected.title} maxLength={120} onChange={(e) => updateSelected({ title: e.target.value })} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal focus:border-matcha-600 focus:outline-none focus:ring-2 focus:ring-matcha-100" />
        </label>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
          <label className="text-sm font-medium text-slate-700">Default text language
            <select value={selected.defaultLanguage} onChange={(e) => updateSelected({ defaultLanguage: e.target.value })} className="mt-1.5 block min-h-10 rounded-lg border border-slate-300 bg-white px-3 font-normal">
              {LANGUAGES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">Text language
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className="mt-1.5 block min-h-10 rounded-lg border border-slate-300 bg-white px-3 font-normal">
              {LANGUAGES.map(([code, name]) => <option key={code} value={code}>{name}{code === selected.defaultLanguage ? " (default)" : ""}</option>)}
            </select>
          </label>
          <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Upload className="h-4 w-4" /> Upload .txt or .md
            <input type="file" accept=".txt,.md,text/plain,text/markdown" className="sr-only" onChange={(e) => { void loadFile(e.target.files?.[0]); e.currentTarget.value = ""; }} />
          </label>
        </div>
        <textarea value={selected.translations[language] ?? ""} maxLength={30000} onChange={(e) => updateText(e.target.value)} rows={14} placeholder={`Add ${LANGUAGES.find(([code]) => code === language)?.[1]} policy text…`} className="mt-3 w-full resize-y rounded-lg border border-slate-300 p-3 text-sm leading-6 text-slate-800 focus:border-matcha-600 focus:outline-none focus:ring-2 focus:ring-matcha-100" />
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500"><span>{(selected.translations[language] ?? "").length.toLocaleString()} / 30,000 characters</span><span>Visitors see their selected language when provided, otherwise the default language.</span></div>

        {error && <p role="alert" className="mt-4 flex items-center gap-2 text-sm text-red-700"><AlertCircle className="h-4 w-4" />{error}</p>}
        {message && <p role="status" className="mt-4 text-sm text-green-700">{message}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" disabled={busy || !dirty} onClick={() => void save(false)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 disabled:opacity-50">{busy ? "Saving…" : "Save draft"}</button>
          <button type="button" disabled={busy} onClick={() => void save(true)} className="min-h-11 rounded-lg bg-matcha-700 px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Publishing…" : dirty ? "Save and publish" : "Publish saved draft"}</button>
        </div>
      </section> : <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">No policies found.</div>}
    </div>
  </main>;
}
