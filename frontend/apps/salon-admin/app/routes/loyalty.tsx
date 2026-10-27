import { useCallback, useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { useOutletContext } from "react-router";
import { useI18n } from "@salon/i18n";
import { apiFetch, ADMIN_API } from "~/lib/api";
import type { LayoutContext } from "~/lib/types";

type Program = { enabled: boolean; pointsPerUnit: number; earnOnBookings: boolean; earnOnOrders: boolean; expiryMonths: number | null };
type Reward = { id: number; name: string; description: string | null; pointsCost: number; type: string; value: number | null; active: boolean };
type Overview = { program: Program; rewards: Reward[]; members: number; outstandingPoints: number; pendingRedemptions: number };
type Member = { email: string; balance: number; earned: number; lastActivity: string | null };
type Entry = { id: number; delta: number; reason: string; note: string | null; createdAt: string };
type Redemption = { id: number; email: string; rewardName: string; points: number; code: string; status: "ISSUED" | "USED" | "CANCELLED"; createdAt: string; usedAt: string | null; usedBy: string | null };
type MemberDetail = { email: string; balance: number; history: Entry[]; redemptions: Redemption[] };

const REWARD_TYPES = ["DISCOUNT_AMOUNT", "FREE_SERVICE", "FREE_PRODUCT", "CUSTOM"] as const;
const typeLabel: Record<string, string> = { DISCOUNT_AMOUNT: "Amount off", FREE_SERVICE: "Free service", FREE_PRODUCT: "Free product", CUSTOM: "Other" };
const input = "min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-matcha-500 focus:outline-none";
const primary = "rounded-lg bg-matcha-600 px-4 py-2 text-sm font-semibold text-white hover:bg-matcha-700 disabled:opacity-50";
const ghost = "rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50";
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

type Tab = "settings" | "rewards" | "members" | "redemptions";

export default function LoyaltyPage() {
  const { t } = useI18n();
  const { salon } = useOutletContext<LayoutContext>();
  const base = `${ADMIN_API}/${salon.id}/loyalty`;
  const [tab, setTab] = useState<Tab>("settings");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const reload = useCallback(() => apiFetch<Overview>(base).then(setOverview).catch((e) => setError(message(e))), [base]);
  useEffect(() => { reload(); }, [reload]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "settings", label: t("Programme") }, { key: "rewards", label: t("Rewards") },
    { key: "members", label: t("Members") }, { key: "redemptions", label: t("Redemptions") },
  ];
  return <section className="mx-auto max-w-5xl space-y-5">
    <div className="flex items-center gap-3"><Gift className="size-6 text-matcha-600" />
      <div><h1 className="text-xl font-bold text-slate-900">{t("Loyalty Program")}</h1>
        <p className="mt-0.5 text-sm text-slate-500">{t("Customers earn points on completed appointments and paid shop orders, and redeem them for rewards you define.")}</p></div></div>
    {overview && <div className="grid grid-cols-3 gap-3 sm:max-w-xl">
      {[[overview.members, t("Members")], [overview.outstandingPoints, t("Points outstanding")], [overview.pendingRedemptions, t("Codes waiting")]].map(([n, label]) =>
        <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-2xl font-bold text-slate-900">{n}</p><p className="text-xs text-slate-500">{label}</p></div>)}
    </div>}
    <div role="tablist" className="flex gap-1 border-b border-slate-200">
      {tabs.map((x) => <button key={x.key} role="tab" aria-selected={tab === x.key} onClick={() => setTab(x.key)}
        className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${tab === x.key ? "border-matcha-600 text-matcha-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{x.label}</button>)}
    </div>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-white p-4 text-sm text-red-700">{error}</p>}
    {!overview && !error ? <p className="py-10 text-center text-sm text-slate-500" role="status">{t("Loading…")}</p> : overview && <>
      {tab === "settings" && <Settings base={base} program={overview.program} onSaved={reload} />}
      {tab === "rewards" && <Rewards base={base} rewards={overview.rewards} onChanged={reload} />}
      {tab === "members" && <Members base={base} onChanged={reload} />}
      {tab === "redemptions" && <Redemptions base={base} onChanged={reload} />}
    </>}
  </section>;
}

function Settings({ base, program, onSaved }: { base: string; program: Program; onSaved: () => void }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(program);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  async function save() {
    setBusy(true); setStatus("");
    try { await apiFetch<Program>(`${base}/program`, { method: "PUT", body: JSON.stringify(draft) }); setStatus(t("Saved")); onSaved(); }
    catch (e) { setStatus(message(e)); } finally { setBusy(false); }
  }
  const check = (key: "enabled" | "earnOnBookings" | "earnOnOrders", label: string) =>
    <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.checked })} />{label}</label>;
  return <div className="max-w-xl space-y-4 rounded-xl border border-slate-200 bg-white p-5">
    {check("enabled", t("Programme is running (customers earn and redeem points)"))}
    <label className="block text-sm text-slate-700">{t("Points earned per 1 spent")}
      <input className={`${input} mt-1 block w-32`} type="number" min={0} max={1000} step="0.1" value={draft.pointsPerUnit}
        onChange={(e) => setDraft({ ...draft, pointsPerUnit: Number(e.target.value) })} /></label>
    {check("earnOnBookings", t("Earn on completed appointments"))}
    {check("earnOnOrders", t("Earn on paid shop orders (excluding shipping)"))}
    <label className="block text-sm text-slate-700">{t("Points expire after (months, empty = never)")}
      <input className={`${input} mt-1 block w-32`} type="number" min={1} max={120} value={draft.expiryMonths ?? ""}
        onChange={(e) => setDraft({ ...draft, expiryMonths: e.target.value === "" ? null : Number(e.target.value) })} /></label>
    <div className="flex items-center gap-3"><button className={primary} disabled={busy} onClick={save}>{busy ? t("Saving…") : t("Save")}</button>
      {status && <span role="status" className="text-sm text-slate-600">{status}</span>}</div>
    <p className="text-xs text-slate-500">{t("Points are only awarded for visits and orders completed while the programme is running.")}</p>
  </div>;
}

function Rewards({ base, rewards, onChanged }: { base: string; rewards: Reward[]; onChanged: () => void }) {
  const { t } = useI18n();
  const blank = { name: "", description: "", pointsCost: 100, type: "CUSTOM", value: null as number | null, active: true };
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState(blank);
  const [error, setError] = useState("");
  function edit(r: Reward | null) { setEditing(r ? r.id : "new"); setDraft(r ? { name: r.name, description: r.description ?? "", pointsCost: r.pointsCost, type: r.type, value: r.value, active: r.active } : blank); setError(""); }
  async function save() {
    try {
      await apiFetch(editing === "new" ? `${base}/rewards` : `${base}/rewards/${editing}`, { method: editing === "new" ? "POST" : "PUT", body: JSON.stringify(draft) });
      setEditing(null); onChanged();
    } catch (e) { setError(message(e)); }
  }
  async function remove(r: Reward) {
    try { await apiFetch<void>(`${base}/rewards/${r.id}`, { method: "DELETE" }); onChanged(); } catch (e) { setError(message(e)); }
  }
  return <div className="space-y-3">
    <div className="flex justify-end"><button className={primary} onClick={() => edit(null)}>{t("Add reward")}</button></div>
    {editing !== null && <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
      <input className={input} aria-label={t("Name")} placeholder={t("Name")} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      <input className={input} type="number" min={1} aria-label={t("Points cost")} value={draft.pointsCost} onChange={(e) => setDraft({ ...draft, pointsCost: Number(e.target.value) })} />
      <select className={input} aria-label={t("Type")} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>{REWARD_TYPES.map((x) => <option key={x} value={x}>{t(typeLabel[x])}</option>)}</select>
      <input className={input} type="number" min={0} step="0.01" aria-label={t("Value (optional)")} placeholder={t("Value (optional)")} value={draft.value ?? ""} onChange={(e) => setDraft({ ...draft, value: e.target.value === "" ? null : Number(e.target.value) })} />
      <textarea className={`${input} sm:col-span-2`} rows={2} aria-label={t("Description")} placeholder={t("Description")} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
      <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />{t("Active (visible to customers)")}</label>
      {error && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{error}</p>}
      <div className="flex gap-2 sm:col-span-2"><button className={primary} onClick={save}>{t("Save")}</button><button className={ghost} onClick={() => setEditing(null)}>{t("Cancel")}</button></div>
    </div>}
    {error && editing === null && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {rewards.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">{t("No rewards yet. Add one so customers have something to redeem.")}</p> :
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">{rewards.map((r) =>
        <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0"><p className="font-semibold text-slate-800">{r.name} {!r.active && <span className="ml-1 rounded border border-slate-200 px-1 text-[10px] uppercase text-slate-400">{t("Hidden")}</span>}</p>
            <p className="text-xs text-slate-500">{r.pointsCost} {t("points")} · {t(typeLabel[r.type] ?? r.type)}{r.value != null ? ` · ${r.value}` : ""}</p></div>
          <div className="flex gap-2"><button className={ghost} onClick={() => edit(r)}>{t("Edit")}</button><button className={ghost} onClick={() => remove(r)}>{t("Delete")}</button></div>
        </div>)}</div>}
  </div>;
}

function Members({ base, onChanged }: { base: string; onChanged: () => void }) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [points, setPoints] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const id = setTimeout(() => apiFetch<Member[]>(`${base}/members?q=${encodeURIComponent(q)}`).then(setMembers).catch((e) => setError(message(e))), 250);
    return () => clearTimeout(id);
  }, [base, q]);
  const open = (email: string) => apiFetch<MemberDetail>(`${base}/member?email=${encodeURIComponent(email)}`).then((d) => { setDetail(d); setError(""); }).catch((e) => setError(message(e)));
  async function adjust() {
    if (!detail) return;
    try {
      setDetail(await apiFetch<MemberDetail>(`${base}/adjustments`, { method: "POST", body: JSON.stringify({ email: detail.email, points: Number(points), note }) }));
      setPoints(""); setNote(""); setError(""); onChanged();
      apiFetch<Member[]>(`${base}/members?q=${encodeURIComponent(q)}`).then(setMembers);
    } catch (e) { setError(message(e)); }
  }
  return <div className="grid gap-4 lg:grid-cols-2">
    <div className="space-y-3">
      <input className={`${input} w-full`} aria-label={t("Search members")} placeholder={t("Search by email")} value={q} onChange={(e) => setQ(e.target.value)} />
      {members.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">{t("No members with points yet.")}</p> :
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">{members.map((m) =>
          <button key={m.email} onClick={() => open(m.email)} className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-slate-50">
            <span className="min-w-0 truncate text-sm text-slate-800">{m.email}</span><span className="text-sm font-bold tabular-nums text-matcha-700">{m.balance}</span></button>)}</div>}
    </div>
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      {!detail ? <p className="text-sm text-slate-500">{t("Pick a member to see their history or adjust their points.")}</p> : <div className="space-y-3">
        <div><p className="font-semibold text-slate-800">{detail.email}</p><p className="text-2xl font-bold text-matcha-700">{detail.balance} <span className="text-sm font-normal text-slate-500">{t("points")}</span></p></div>
        <div className="flex flex-wrap gap-2">
          <input className={`${input} w-24`} type="number" aria-label={t("Points (+/-)")} placeholder="+/-" value={points} onChange={(e) => setPoints(e.target.value)} />
          <input className={`${input} min-w-0 flex-1`} aria-label={t("Reason")} placeholder={t("Reason (required)")} value={note} onChange={(e) => setNote(e.target.value)} />
          <button className={primary} disabled={!points || !note.trim()} onClick={adjust}>{t("Adjust")}</button>
        </div>
        <ul className="max-h-72 divide-y divide-slate-100 overflow-auto text-xs">{detail.history.map((h) =>
          <li key={h.id} className="flex justify-between gap-3 py-1.5"><span className="text-slate-600">{new Date(h.createdAt).toLocaleDateString()} · {h.reason}{h.note ? ` · ${h.note}` : ""}</span>
            <span className={`font-bold tabular-nums ${h.delta >= 0 ? "text-matcha-700" : "text-slate-500"}`}>{h.delta > 0 ? "+" : ""}{h.delta}</span></li>)}</ul>
      </div>}
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  </div>;
}

function Redemptions({ base, onChanged }: { base: string; onChanged: () => void }) {
  const { t } = useI18n();
  const [status, setStatus] = useState("ISSUED");
  const [rows, setRows] = useState<Redemption[]>([]);
  const [error, setError] = useState("");
  const load = useCallback(() => apiFetch<Redemption[]>(`${base}/redemptions?status=${status}`).then(setRows).catch((e) => setError(message(e))), [base, status]);
  useEffect(() => { load(); }, [load]);
  async function act(r: Redemption, action: "use" | "cancel") {
    try { await apiFetch(`${base}/redemptions/${r.id}/${action}`, { method: "POST" }); setError(""); load(); onChanged(); } catch (e) { setError(message(e)); }
  }
  return <div className="space-y-3">
    <select className={input} aria-label={t("Status")} value={status} onChange={(e) => setStatus(e.target.value)}>
      <option value="ISSUED">{t("Waiting")}</option><option value="USED">{t("Used")}</option><option value="CANCELLED">{t("Cancelled")}</option><option value="">{t("All")}</option></select>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {rows.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">{t("Nothing here.")}</p> :
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">{rows.map((r) =>
        <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0"><p className="font-semibold text-slate-800">{r.rewardName} <span className="ml-1 font-mono tracking-widest text-matcha-700">{r.code}</span></p>
            <p className="text-xs text-slate-500">{r.email} · {r.points} {t("points")} · {r.status}{r.usedBy ? ` · ${r.usedBy}` : ""}</p></div>
          {r.status === "ISSUED" && <div className="flex gap-2"><button className={primary} onClick={() => act(r, "use")}>{t("Mark used")}</button><button className={ghost} onClick={() => act(r, "cancel")}>{t("Cancel & refund")}</button></div>}
        </div>)}</div>}
  </div>;
}
