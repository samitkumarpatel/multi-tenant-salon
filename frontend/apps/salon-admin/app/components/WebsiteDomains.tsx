import { useEffect, useRef, useState } from "react";
import { Globe, Copy, Check, LoaderCircle, ExternalLink } from "lucide-react";
import { ADMIN_API, apiFetch } from "~/lib/api";

export interface DomainSettings {
  available: boolean;
  websiteEnabled: boolean;
  domain: null | {
    hostname: string;
    status: "PENDING_DNS" | "PROVISIONING" | "ACTIVE" | "ERROR" | "DELETING";
    message: string | null;
    checkedAt: string | null;
    records: { type: string; name: string; value: string; host?: string | null; zone?: string | null }[];
  };
}

export function connectedHostname(settings: DomainSettings | null): string | undefined {
  return settings?.available && settings.websiteEnabled && settings.domain?.status === "ACTIVE" ? settings.domain.hostname : undefined;
}

const labels = { PENDING_DNS: "Waiting for DNS", PROVISIONING: "Preparing HTTPS", ACTIVE: "Connected", ERROR: "Needs attention", DELETING: "Disconnecting" };

export function WebsiteDomains({ salonId, includedUrl, settings, onChange }: {
  salonId: string; includedUrl: string; settings: DomainSettings | null; onChange: (settings: DomainSettings) => void;
}) {
  const [hostname, setHostname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const requestId = useRef(0);
  useEffect(() => () => { requestId.current++; }, []);
  const endpoint = `${ADMIN_API}/${salonId}/website/domains`;
  const domain = settings?.domain;

  useEffect(() => {
    if (!domain || busy) return;
    let cancelled = false;
    const timer = window.setInterval(() => {
      apiFetch<DomainSettings>(endpoint).then((next) => { if (!cancelled) onChange(next); }).catch(() => {});
    }, 30000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [endpoint, domain?.hostname, busy, onChange]);

  async function act(method: string, suffix = "", body?: object) {
    const id = ++requestId.current;
    setBusy(true); setError("");
    try {
      const next = await apiFetch<DomainSettings>(endpoint + suffix, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
      if (id !== requestId.current) return;
      onChange(next);
      setConfirmDisconnect(false);
      setHostname("");
    } catch (e) { if (id === requestId.current) setError(e instanceof Error ? e.message : "Could not update this domain. Please try again."); }
    finally { if (id === requestId.current) setBusy(false); }
  }

  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setCopied(value); }
    catch { setError("Could not copy. Select the DNS value and copy it manually."); }
  }

  return <section aria-labelledby="website-domains-title" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 mt-6 space-y-5">
    <div>
      <h2 id="website-domains-title" className="flex items-center gap-2 text-base font-bold text-slate-900"><Globe className="h-5 w-5 text-matcha-600" /> Domains</h2>
      <p className="mt-1 text-sm text-slate-500">Choose the address customers use to visit your website.</p>
    </div>
    <div className="rounded-lg bg-slate-50 p-3 text-sm">
      <p className="text-xs font-semibold text-slate-500 mb-1">Your included address</p>
      <a href={includedUrl} target="_blank" rel="noopener noreferrer" className="break-all text-matcha-700 hover:underline">{includedUrl}</a>
      <p className="text-xs text-slate-500 mt-1">This address stays available when you connect your own domain.</p>
    </div>
    {!settings ? <div className="text-sm text-slate-600">Domain settings could not be loaded. <button type="button" disabled={busy} onClick={() => act("GET")} className="underline">Try again</button></div>
      : <>
        {!settings.available && <p className="text-sm text-slate-600">Custom domain connections are not available yet. Please contact support.</p>}
        {!settings.websiteEnabled && <p className="text-sm text-amber-700">Enable your salon's website feature to connect and serve a custom domain.</p>}
        {domain ? <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="font-semibold text-slate-800 break-all">{domain.hostname}</p>
            <span role="status" className={`rounded-full px-2.5 py-1 text-xs font-semibold ${domain.status === "ACTIVE" && settings.websiteEnabled ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-800"}`}>
              {!settings.websiteEnabled ? "Website disabled" : labels[domain.status]}
            </span>
          </div>
          {domain.message && <p className="text-sm text-slate-600">{domain.message}</p>}
          {domain.status !== "DELETING" && <>
            <p className="text-sm text-slate-600">Add these records at your current DNS provider. Keep both records in place. Your domain and nameservers stay with your provider.</p>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">Type</th><th className="p-3">Name / Host</th><th className="p-3">Value / Target</th></tr></thead>
                <tbody>{domain.records.map((record) => {
                  // Providers such as Azure DNS or GoDaddy append the zone to the Name field, so show the
                  // zone-relative host to type, with the full name below for providers that want it.
                  const typed = record.host ?? record.name;
                  return <tr key={record.type} className="border-t border-slate-100 align-top">
                    <td className="p-3 font-semibold">{record.type}</td>
                    {[typed, record.value].map((value, i) => <td key={i} className="p-3">
                      <div className="flex items-start gap-2"><code className="break-all select-all">{value}</code><button type="button" className="shrink-0 p-1 text-slate-500 hover:text-matcha-700" aria-label={`Copy ${record.type} ${i === 0 ? "name" : "value"}`} onClick={() => copy(value)}>{copied === value ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</button></div>
                      {i === 0 && record.host && <p className="mt-1 text-[11px] text-slate-400 break-all">Full name: {record.name}</p>}
                    </td>)}
                  </tr>;
                })}</tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">{domain.records.some((r) => r.zone)
              ? <>Enter the Name exactly as shown — your DNS provider adds <code>.{domain.records.find((r) => r.zone)?.zone}</code> automatically (Azure DNS, GoDaddy, Cloudflare and most others do). Only if your provider asks for the fully qualified name, use the full name instead.</>
              : <>Some providers append your domain automatically; enter only the part before your domain in that case.</>}
              {" "}Use DNS-only mode for the CNAME. DNS changes can take time to appear. HTTPS is prepared automatically.</p>
          </>}
          <div className="flex flex-wrap gap-3 items-center">
            <button type="button" disabled={busy || !settings.available} onClick={() => act("POST", "/check")} className="rounded-lg bg-matcha-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Checking…" : "Check connection"}</button>
            {connectedHostname(settings) && <a href={`https://${domain.hostname}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-matcha-700">Visit website <ExternalLink className="h-3.5 w-3.5" /></a>}
            {domain.status !== "DELETING" && <button type="button" disabled={busy} onClick={() => setConfirmDisconnect(true)} className="text-sm text-red-600 disabled:opacity-50">Disconnect</button>}
          </div>
          {confirmDisconnect && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <p>Disconnect {domain.hostname}? It will stop serving your website. Your included address will keep working. Remove the DNS records from your provider afterwards.</p>
            <div className="mt-3 flex gap-4"><button type="button" disabled={busy} onClick={() => act("DELETE")} className="font-semibold">Disconnect domain</button><button type="button" disabled={busy} onClick={() => setConfirmDisconnect(false)}>Cancel</button></div>
          </div>}
          {domain.checkedAt && <p className="text-xs text-slate-400">Last checked: {new Date(domain.checkedAt).toLocaleString()}</p>}
        </div> : settings.available && settings.websiteEnabled && <form onSubmit={(event) => { event.preventDefault(); void act("POST", "", { hostname: hostname.trim() }); }} className="space-y-3">
          <label htmlFor="custom-hostname" className="block text-sm font-semibold text-slate-700">Connect your own domain</label>
          <p id="custom-hostname-help" className="text-sm text-slate-500">Use a hostname such as www.mysalon.dk. This setup requires a CNAME record; bare domains such as mysalon.dk are not supported in this release.</p>
          <div className="flex gap-2 flex-wrap"><input id="custom-hostname" aria-describedby="custom-hostname-help" value={hostname} onChange={(event) => setHostname(event.target.value)} placeholder="www.mysalon.dk" required maxLength={253} autoCapitalize="none" autoCorrect="off" spellCheck={false} disabled={busy} className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500" /><button disabled={busy || !hostname.trim()} className="rounded-lg bg-matcha-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Connect domain</button></div>
        </form>}
      </>}
    {busy && <p role="status" className="flex items-center gap-2 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Updating domain settings…</p>}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {copied && <span role="status" className="sr-only">DNS record copied</span>}
  </section>;
}
