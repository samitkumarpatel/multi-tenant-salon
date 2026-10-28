import { useI18n } from "@salon/i18n";
import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { ADMIN_API, apiFetch } from "~/lib/api";

type Notify = (message: string, kind?: "success" | "error") => void;
type Entry = { id: number; customerName: string; phone: string | null; serviceName: string | null; staffName: string | null; note: string | null; createdAt: string };

const inputCls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10";

/** Who is waiting without an appointment, in arrival order. Seat someone when it is their turn, or remove them if they left. */
export function WalkInQueue({ sid, services, staff, notify }: {
  sid: string; services: { id: number; name: string }[]; staff: { id: number; name: string }[]; notify: Notify;
}) {
  const { t } = useI18n();
  const base = `${ADMIN_API}/${sid}/dashboard/walk-ins`;
  const [entries, setEntries] = useState<Entry[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ customerName: "", phone: "", serviceId: "", staffId: "" });
  const [now, setNow] = useState(() => Date.now());

  const load = () => apiFetch<Entry[]>(base).then(setEntries).catch(() => undefined);
  useEffect(() => {
    void load();
    // Waiting times tick, and other tablets add people: refresh every 30s.
    const timer = setInterval(() => { setNow(Date.now()); void load(); }, 30_000);
    return () => clearInterval(timer);
  }, [sid]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customerName.trim()) return;
    try {
      await apiFetch<Entry>(base, { method: "POST", body: JSON.stringify({
        customerName: form.customerName.trim(), phone: form.phone.trim() || null,
        serviceId: form.serviceId ? Number(form.serviceId) : null, staffId: form.staffId ? Number(form.staffId) : null }) });
      setForm({ customerName: "", phone: "", serviceId: "", staffId: "" }); setAdding(false);
      await load();
    } catch (err) { notify(err instanceof Error ? err.message : t("Could not add to the queue."), "error"); }
  }
  async function resolve(entry: Entry, action: "seat" | "leave") {
    try { await apiFetch<void>(`${base}/${entry.id}/${action}`, { method: "POST" }); await load(); }
    catch { notify(t("That person is no longer in the queue."), "error"); await load(); }
  }

  const waited = (createdAt: string) => Math.max(0, Math.round((now - new Date(createdAt).getTime()) / 60_000));
  return <section className="rounded-xl border border-slate-200 bg-white">
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
      <h2 className="text-sm font-semibold text-slate-800">{t("Walk-in queue")} <span className="font-normal text-slate-400">({entries.length})</span></h2>
      <button type="button" onClick={() => setAdding((open) => !open)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
        <UserPlus className="size-3.5" />{t("Add walk-in")}</button>
    </div>
    {adding && <form onSubmit={add} className="grid gap-2 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <input className={inputCls} aria-label={t("Name")} placeholder={t("Name")} required value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
      <input className={inputCls} type="tel" aria-label={t("Phone (optional)")} placeholder={t("Phone (optional)")} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      <select className={inputCls} aria-label={t("Service")} value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })}>
        <option value="">{t("Any service")}</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select>
      <select className={inputCls} aria-label={t("Stylist")} value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })}>
        <option value="">{t("Anyone")}</option>{staff.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select>
      <button type="submit" className="rounded-lg bg-matcha-600 px-4 py-2 text-sm font-semibold text-white hover:bg-matcha-700 sm:col-span-2 lg:col-span-4 lg:justify-self-start">{t("Add to queue")}</button>
    </form>}
    {!entries.length ? <p className="px-4 py-6 text-center text-sm text-slate-400">{t("No one is waiting.")}</p>
      : <ul className="divide-y divide-slate-100">{entries.map((entry, index) => <li key={entry.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{index + 1}</span>
        <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-slate-800">{entry.customerName}{entry.phone ? ` · ${entry.phone}` : ""}</span>
          <span className="block truncate text-xs text-slate-500">{[entry.serviceName, entry.staffName].filter(Boolean).join(" · ") || t("Any service")}</span></span>
        <span className="text-xs text-slate-500">{waited(entry.createdAt)} {t("min")}</span>
        <button type="button" onClick={() => resolve(entry, "seat")} className="rounded-lg bg-matcha-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-matcha-700">{t("Seat")}</button>
        <button type="button" onClick={() => resolve(entry, "leave")} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">{t("Left")}</button>
      </li>)}</ul>}
  </section>;
}
