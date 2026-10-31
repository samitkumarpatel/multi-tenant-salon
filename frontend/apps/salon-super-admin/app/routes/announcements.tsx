import { useEffect, useState } from "react";
import { useI18n } from "@salon/i18n";
import { apiFetch, SUPER_ADMIN_API } from "~/lib/api";
import { buttonClass, fieldClass, type Announcement } from "~/lib/users";

const severityColors: Record<string, string> = {
  INFO: "border-blue-200 bg-blue-50 text-blue-700",
  WARNING: "border-amber-200 bg-amber-50 text-amber-700",
  CRITICAL: "border-rose-200 bg-rose-50 text-rose-700",
};
const audienceLabels: Record<string, string> = { SALON_OWNERS: "Salon owners (admin app)", ALL_APPS: "Everyone (all apps)" };

type Form = { title: string; message: string; severity: string; audience: string; linkUrl: string; linkLabel: string; startsAt: string; endsAt: string; active: boolean };
const empty: Form = { title: "", message: "", severity: "INFO", audience: "SALON_OWNERS", linkUrl: "", linkLabel: "", startsAt: "", endsAt: "", active: true };

// <input type="datetime-local"> works in local time without a zone; the API wants an instant.
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const toInstant = (local: string) => (local ? new Date(local).toISOString() : null);
const when = (value: string | null) => (value ? new Date(value).toLocaleString() : "—");

function state(a: Announcement) {
  const now = Date.now();
  if (!a.active) return "OFF";
  if (new Date(a.startsAt).getTime() > now) return "SCHEDULED";
  if (a.endsAt && new Date(a.endsAt).getTime() <= now) return "ENDED";
  return "LIVE";
}
const stateColors: Record<string, string> = {
  LIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  SCHEDULED: "border-sky-200 bg-sky-50 text-sky-700",
  ENDED: "border-stone-200 bg-stone-50 text-stone-500",
  OFF: "border-stone-200 bg-stone-50 text-stone-500",
};

export default function Announcements() {
  const { t } = useI18n();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [editing, setEditing] = useState<number | "new">();
  const [form, setForm] = useState<Form>(empty);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    apiFetch<Announcement[]>(`${SUPER_ADMIN_API}/announcements`, { signal: controller.signal })
      .then((next) => { if (!controller.signal.aborted) setItems(next); })
      .catch((e) => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  function open(a?: Announcement) {
    setFormError("");
    setEditing(a ? a.id : "new");
    setForm(a ? { title: a.title, message: a.message, severity: a.severity, audience: a.audience, linkUrl: a.linkUrl ?? "", linkLabel: a.linkLabel ?? "",
      startsAt: toLocalInput(a.startsAt), endsAt: toLocalInput(a.endsAt), active: a.active } : empty);
  }
  const body = (f: Form) => JSON.stringify({ ...f, startsAt: toInstant(f.startsAt), endsAt: toInstant(f.endsAt) });

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true); setFormError("");
    try {
      await apiFetch(editing === "new" ? `${SUPER_ADMIN_API}/announcements` : `${SUPER_ADMIN_API}/announcements/${editing}`,
        { method: editing === "new" ? "POST" : "PUT", body: body(form) });
      setEditing(undefined); setRefresh((v) => v + 1);
    } catch (e) { setFormError(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }
  async function toggle(a: Announcement) {
    try {
      await apiFetch(`${SUPER_ADMIN_API}/announcements/${a.id}`, { method: "PUT", body: body({ ...{
        title: a.title, message: a.message, severity: a.severity, audience: a.audience, linkUrl: a.linkUrl ?? "", linkLabel: a.linkLabel ?? "",
        startsAt: toLocalInput(a.startsAt), endsAt: toLocalInput(a.endsAt) }, active: !a.active }) });
      setRefresh((v) => v + 1);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }
  async function remove(a: Announcement) {
    if (!window.confirm(t("Delete this announcement?"))) return;
    try { await apiFetch(`${SUPER_ADMIN_API}/announcements/${a.id}`, { method: "DELETE" }); setRefresh((v) => v + 1); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }

  const label = "block space-y-1 text-xs font-medium text-stone-600";
  return <section className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-xl font-bold text-stone-900">{t("Announcements")}</h1>
        <p className="mt-1 text-xs text-stone-500">{t("Notices shown as a banner to salon owners, or in every app.")}</p></div>
      <button type="button" className={buttonClass} onClick={() => open()}>{t("New announcement")}</button>
    </div>

    {editing !== undefined && <form onSubmit={save} className="space-y-4 rounded-xl border border-stone-200 bg-white p-4">
      <h2 className="text-sm font-bold text-stone-800">{t(editing === "new" ? "New announcement" : "Edit announcement")}</h2>
      <label className={label}>{t("Title")}<input required maxLength={140} className={`${fieldClass} w-full`} value={form.title} onChange={(e) => set("title", e.target.value)} /></label>
      <label className={label}>{t("Message")}<textarea required maxLength={2000} rows={3} className={`${fieldClass} w-full`} value={form.message} onChange={(e) => set("message", e.target.value)} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>{t("Audience")}<select className={`${fieldClass} w-full`} value={form.audience} onChange={(e) => set("audience", e.target.value)}>
          {Object.entries(audienceLabels).map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}</select></label>
        <label className={label}>{t("Severity")}<select className={`${fieldClass} w-full`} value={form.severity} onChange={(e) => set("severity", e.target.value)}>
          {["INFO", "WARNING", "CRITICAL"].map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
        <label className={label}>{t("Starts")}<input type="datetime-local" className={`${fieldClass} w-full`} value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
          <span className="font-normal text-stone-400">{t("Empty means now.")}</span></label>
        <label className={label}>{t("Ends")}<input type="datetime-local" className={`${fieldClass} w-full`} value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
          <span className="font-normal text-stone-400">{t("Empty means until switched off.")}</span></label>
        <label className={label}>{t("Link (optional)")}<input type="text" inputMode="url" placeholder="https://…" maxLength={500} className={`${fieldClass} w-full`} value={form.linkUrl} onChange={(e) => set("linkUrl", e.target.value)} /></label>
        <label className={label}>{t("Link label")}<input maxLength={60} className={`${fieldClass} w-full`} value={form.linkLabel} onChange={(e) => set("linkLabel", e.target.value)} /></label>
      </div>
      <label className="flex items-center gap-2 text-sm text-stone-700"><input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} />{t("Active")}</label>
      <p className="text-[11px] text-stone-500">{t("Critical announcements cannot be dismissed by the reader.")}</p>
      {formError && <p role="alert" className="text-sm text-red-700">{formError}</p>}
      <div className="flex gap-2"><button type="submit" disabled={saving} className={buttonClass}>{t("Save")}</button>
        <button type="button" className={buttonClass} onClick={() => setEditing(undefined)}>{t("Cancel")}</button></div>
    </form>}

    {loading ? <p role="status">{t("Loading…")}</p> : error ? <div role="alert" className="space-y-3 text-red-700"><p>{error}</p><button className={buttonClass} onClick={() => setRefresh((v) => v + 1)}>{t("Retry")}</button></div> :
      !items.length ? <p className="rounded-xl border border-stone-200 bg-white p-6 text-stone-500">{t("No announcements yet.")}</p> :
      <ul className="space-y-3">{items.map((a) => {
        const s = state(a);
        return <li key={a.id} className="space-y-2 rounded-xl border border-stone-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${stateColors[s]}`}>{s}</span>
            <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${severityColors[a.severity]}`}>{a.severity}</span>
            <span className="text-[11px] text-stone-500">{t(audienceLabels[a.audience])}</span>
          </div>
          <p className="font-semibold text-stone-800">{a.title}</p>
          <p className="whitespace-pre-line break-words text-sm text-stone-600">{a.message}</p>
          <p className="text-[11px] text-stone-500">{when(a.startsAt)} → {a.endsAt ? when(a.endsAt) : t("until switched off")}{a.createdBy ? ` · ${a.createdBy}` : ""}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonClass} onClick={() => open(a)}>{t("Edit")}</button>
            <button type="button" className={buttonClass} onClick={() => toggle(a)}>{t(a.active ? "Switch off" : "Switch on")}</button>
            <button type="button" className={`${buttonClass} text-rose-700`} onClick={() => remove(a)}>{t("Delete")}</button>
          </div>
        </li>;
      })}</ul>}
  </section>;
}
