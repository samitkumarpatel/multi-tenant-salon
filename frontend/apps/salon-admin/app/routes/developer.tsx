import { useCallback, useEffect, useState } from "react";
import { KeyRound, Terminal } from "lucide-react";
import { useOutletContext } from "react-router";
import { useI18n } from "@salon/i18n";
import { apiFetch, ADMIN_API } from "~/lib/api";
import { TOKEN_URL } from "~/lib/auth";
import { API_URL, developerDocsUrl } from "~/lib/config";
import type { LayoutContext } from "~/lib/types";

type Scope = { scope: string; description: string; personalData: boolean };
type ApiClient = { clientId: string; name: string; scopes: string[]; createdBy: string; createdAt: string; secretRotatedAt: string | null };
type Created = { client: ApiClient; clientSecret: string };

const input = "min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-matcha-500 focus:outline-none";
const primary = "rounded-lg bg-matcha-600 px-4 py-2 text-sm font-semibold text-white hover:bg-matcha-700 disabled:opacity-50";
const ghost = "rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50";
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function DeveloperPage() {
  const { t, locale } = useI18n();
  const { salon } = useOutletContext<LayoutContext>();
  const base = `${ADMIN_API}/${salon.id}/developer`;
  const [clients, setClients] = useState<ApiClient[] | null>(null);
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [error, setError] = useState("");
  const [revealed, setRevealed] = useState<Created | null>(null);
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = useCallback(() => apiFetch<ApiClient[]>(`${base}/clients`).then(setClients).catch((e) => { setClients([]); setError(message(e)); }), [base]);
  useEffect(() => { load(); apiFetch<Scope[]>(`${base}/scopes`).then(setScopes).catch(() => setScopes([])); }, [load, base]);
  // A secret must not linger on screen after the owner leaves this salon's page.
  useEffect(() => () => setRevealed(null), [salon.id]);

  async function create() {
    setBusy(true); setError("");
    try {
      const created = await apiFetch<Created>(`${base}/clients`, { method: "POST", body: JSON.stringify({ name, scopes: picked }) });
      setRevealed(created); setName(""); setPicked([]); load();
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  async function rotate(c: ApiClient) {
    setBusy(true); setError("");
    try { setRevealed(await apiFetch<Created>(`${base}/clients/${c.clientId}/rotate`, { method: "POST" })); setConfirming(null); load(); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  async function revoke(c: ApiClient) {
    setBusy(true); setError("");
    try { await apiFetch<void>(`${base}/clients/${c.clientId}`, { method: "DELETE" }); setConfirming(null); if (revealed?.client.clientId === c.clientId) setRevealed(null); load(); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  const toggle = (scope: string) => setPicked((s) => (s.includes(scope) ? s.filter((x) => x !== scope) : [...s, scope]));

  return <section className="mx-auto max-w-4xl space-y-6">
    <div className="flex items-center gap-3"><Terminal className="size-6 text-matcha-600" />
      <div><h1 className="text-xl font-bold text-slate-900">{t("Developer")}</h1>
        <p className="mt-0.5 text-sm text-slate-500">{t("Let your own software read this salon's data. Each client can only see this salon, and only what you allow.")}</p></div></div>

    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
      <p className="font-semibold text-slate-800">{t("How to connect")}</p>
      <p>{t("Exchange the client id and secret for a short-lived token (15 minutes), then call the API with it.")}</p>
      <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">{`curl -u CLIENT_ID:CLIENT_SECRET \\
  -d grant_type=client_credentials -d scope=services:read \\
  ${TOKEN_URL}

curl -H "Authorization: Bearer ACCESS_TOKEN" \\
  ${API_URL}/api/salon-admin/${salon.id}/services`}</pre>
      <a href={developerDocsUrl(locale)} target="_blank" rel="noopener noreferrer" className="font-semibold text-matcha-700 hover:underline">{t("Open the API reference")}</a>
    </div>

    {error && <p role="alert" className="rounded-xl border border-red-200 bg-white p-4 text-sm text-red-700">{error}</p>}

    {revealed && <div role="status" className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
      <p className="font-semibold text-amber-900">{t("Copy the secret now — it will not be shown again.")}</p>
      <Secret label={t("Client id")} value={revealed.client.clientId} />
      <Secret label={t("Client secret")} value={revealed.clientSecret} />
      <button className={ghost} onClick={() => setRevealed(null)}>{t("I have saved it")}</button>
    </div>}

    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <p className="font-semibold text-slate-800">{t("New API client")}</p>
      <input className={`${input} w-full`} aria-label={t("Name")} placeholder={t("What is it for? e.g. Accounting sync")} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
      <fieldset className="space-y-1"><legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("Can read")}</legend>
        {scopes.map((s) => <label key={s.scope} className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" className="mt-1" checked={picked.includes(s.scope)} onChange={() => toggle(s.scope)} />
          <span><span className="font-mono text-xs">{s.scope}</span> — {t(s.description)}{s.personalData && <span className="ml-2 rounded border border-amber-300 px-1 text-[10px] uppercase text-amber-700">{t("Personal data")}</span>}</span></label>)}
      </fieldset>
      <button className={primary} disabled={busy || !name.trim() || picked.length === 0} onClick={create}>{busy ? t("Saving…") : t("Create client")}</button>
    </div>

    <div className="space-y-2">
      <p className="font-semibold text-slate-800">{t("Your API clients")}</p>
      {clients === null ? <p role="status" className="text-sm text-slate-500">{t("Loading…")}</p> : clients.length === 0 ?
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">{t("No API clients yet.")}</p> :
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">{clients.map((c) =>
          <div key={c.clientId} className="space-y-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 font-semibold text-slate-800"><KeyRound className="size-4 text-slate-400" />{c.name}</p>
              {confirming === c.clientId
                ? <span className="flex flex-wrap items-center gap-2 text-xs text-slate-600">{t("Rotating gives a new secret and stops the old one. Revoking deletes the client.")}
                    <button className={ghost} disabled={busy} onClick={() => rotate(c)}>{t("Rotate secret")}</button>
                    <button className={`${ghost} text-red-700`} disabled={busy} onClick={() => revoke(c)}>{t("Revoke")}</button>
                    <button className={ghost} onClick={() => setConfirming(null)}>{t("Cancel")}</button></span>
                : <button className={ghost} onClick={() => setConfirming(c.clientId)}>{t("Manage")}</button>}
            </div>
            <p className="font-mono text-xs text-slate-500">{c.clientId}</p>
            <p className="flex flex-wrap gap-1">{c.scopes.map((s) => <span key={s} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">{s}</span>)}</p>
            <p className="text-xs text-slate-500">{t("Created by")} {c.createdBy} · {new Date(c.createdAt).toLocaleDateString()}{c.secretRotatedAt ? ` · ${t("secret rotated")} ${new Date(c.secretRotatedAt).toLocaleDateString()}` : ""}</p>
          </div>)}</div>}
      <p className="text-xs text-slate-500">{t("Up to 5 clients per salon. A revoked client cannot get new tokens; a token it already has stops working within 15 minutes.")}</p>
    </div>
  </section>;
}

function Secret({ label, value }: { label: string; value: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* the value is selectable below */ }
  }
  return <div className="flex flex-wrap items-center gap-2"><span className="w-24 text-xs text-amber-900">{label}</span>
    <code className="min-w-0 flex-1 break-all rounded bg-white px-2 py-1 text-xs text-slate-800">{value}</code>
    <button className={ghost} onClick={copy}>{copied ? t("Copied") : t("Copy")}</button></div>;
}
