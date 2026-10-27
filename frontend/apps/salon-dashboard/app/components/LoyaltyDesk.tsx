import { useI18n } from "@salon/i18n";
import { useState } from "react";
import { CheckCircle2, Loader2, Search } from "lucide-react";
import { isNotFoundError } from "@salon/ui-shared";
import { ADMIN_API, apiFetch } from "~/lib/api";

type Notify = (message: string, kind?: "success" | "error") => void;
type Redemption = { id: number; email: string; rewardName: string; points: number; code: string; status: "ISSUED" | "USED" | "CANCELLED"; createdAt: string; usedAt: string | null; usedBy: string | null };
type Entry = { id: number; delta: number; reason: string; note: string | null; createdAt: string };
type Member = { email: string; balance: number; history: Entry[]; redemptions: Redemption[] };

const inputCls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10";

/** Hand over a reward (type or scan its code) and look up a customer's points. Settings and adjustments stay with the owner. */
export function LoyaltyDesk({ sid, notify }: { sid: string; notify: Notify }) {
  const { t, locale } = useI18n();
  const base = `${ADMIN_API}/${sid}/loyalty`;
  const [code, setCode] = useState("");
  const [found, setFound] = useState<Redemption | null>(null);
  const [email, setEmail] = useState("");
  const [member, setMember] = useState<Member | null>(null);
  const [busy, setBusy] = useState(false);

  async function lookupCode(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true); setFound(null);
    try { setFound(await apiFetch<Redemption>(`${base}/redemptions/by-code/${encodeURIComponent(code.trim())}`)); }
    catch (err) { notify(isNotFoundError(err) ? t("No reward with that code.") : t("Could not look up the code."), "error"); }
    finally { setBusy(false); }
  }
  async function handOver(r: Redemption) {
    setBusy(true);
    try {
      setFound(await apiFetch<Redemption>(`${base}/redemptions/${r.id}/use`, { method: "POST" }));
      notify(t("Reward handed over."), "success");
    } catch (err) { notify(err instanceof Error ? err.message : t("Could not mark the code as used."), "error"); }
    finally { setBusy(false); }
  }
  async function lookupMember(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true); setMember(null);
    try { setMember(await apiFetch<Member>(`${base}/member?email=${encodeURIComponent(email.trim())}`)); }
    catch { notify(t("Could not look up that customer."), "error"); }
    finally { setBusy(false); }
  }

  return <div className="grid gap-5 lg:grid-cols-2">
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-800">{t("Redeem a reward code")}</h2>
      <form onSubmit={lookupCode} className="flex gap-2">
        <input className={`${inputCls} font-mono uppercase tracking-widest`} aria-label={t("Reward code")} placeholder="ABCD2345" maxLength={16} value={code} onChange={(e) => setCode(e.target.value)} />
        <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-matcha-600 px-4 py-2 text-sm font-semibold text-white hover:bg-matcha-700 disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}{t("Find")}</button>
      </form>
      {found && <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="font-semibold text-slate-800">{found.rewardName}</p>
        <p className="text-xs text-slate-500">{found.email} · {found.points} {t("points")} · {new Date(found.createdAt).toLocaleDateString(locale)}</p>
        {found.status === "ISSUED"
          ? <button disabled={busy} onClick={() => handOver(found)} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-matcha-600 px-4 py-2 text-sm font-semibold text-white hover:bg-matcha-700 disabled:opacity-50"><CheckCircle2 className="size-4" />{t("Hand over reward")}</button>
          : <p className="mt-2 text-sm font-semibold text-amber-700">{found.status === "USED" ? t("Already used") : t("Cancelled")}{found.usedAt ? ` · ${new Date(found.usedAt).toLocaleString(locale)}` : ""}</p>}
      </div>}
    </section>

    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-800">{t("Customer points")}</h2>
      <form onSubmit={lookupMember} className="flex gap-2">
        <input className={inputCls} type="email" aria-label={t("Customer email")} placeholder={t("Customer email")} value={email} onChange={(e) => setEmail(e.target.value)} />
        <button type="submit" disabled={busy} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{t("Look up")}</button>
      </form>
      {member && <div>
        <p className="text-2xl font-bold text-matcha-700">{member.balance} <span className="text-sm font-normal text-slate-500">{t("points")}</span></p>
        {member.redemptions.filter((r) => r.status === "ISSUED").map((r) => <p key={r.id} className="mt-1 text-xs text-slate-600">{t("Waiting code")}: <span className="font-mono tracking-widest">{r.code}</span> · {r.rewardName}</p>)}
        <ul className="mt-3 max-h-60 divide-y divide-slate-100 overflow-auto text-xs">{member.history.map((h) =>
          <li key={h.id} className="flex justify-between gap-3 py-1.5"><span className="text-slate-600">{new Date(h.createdAt).toLocaleDateString(locale)} · {h.reason}{h.note ? ` · ${h.note}` : ""}</span>
            <span className="font-bold tabular-nums">{h.delta > 0 ? "+" : ""}{h.delta}</span></li>)}</ul>
      </div>}
    </section>
  </div>;
}
