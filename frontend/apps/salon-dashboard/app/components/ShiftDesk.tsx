import { useI18n } from "@salon/i18n";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ADMIN_API, apiFetch } from "~/lib/api";
import { formatPrice } from "~/lib/format";

type Notify = (message: string, kind?: "success" | "error") => void;
type Shift = {
  id: number; currency: string; openingFloat: number; openedBy: string | null; openedAt: string;
  closedBy: string | null; closedAt: string | null; countedCash: number | null; expectedCash: number | null; difference: number | null; note: string | null;
};

const inputCls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10";

/** Open the cash drawer with a float, close it with the counted cash, and see how far off it was. */
export function ShiftDesk({ sid, currency, notify }: { sid: string; currency: string; notify: Notify }) {
  const { t, locale } = useI18n();
  const base = `${ADMIN_API}/${sid}/dashboard`;
  const [current, setCurrent] = useState<Shift | null>(null);
  const [history, setHistory] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [open, recent] = await Promise.all([apiFetch<Shift | null>(`${base}/shift`), apiFetch<Shift[]>(`${base}/shifts`)]);
      setCurrent(open); setHistory(recent.filter((shift) => shift.closedAt));
    } catch { notify(t("Could not load the shift."), "error"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [sid]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0 || amount === "") return;
    setBusy(true);
    try {
      if (current) {
        const closed = await apiFetch<Shift>(`${base}/shift/close`, { method: "POST", body: JSON.stringify({ countedCash: value, note: note.trim() || null }) });
        notify(closed.difference === 0 ? t("Shift closed — the drawer matches.") : t("Shift closed."), "success");
      } else {
        await apiFetch<Shift>(`${base}/shift/open`, { method: "POST", body: JSON.stringify({ openingFloat: value, currency }) });
        notify(t("Shift opened."), "success");
      }
      setAmount(""); setNote("");
      await load();
    } catch (err) { notify(err instanceof Error ? err.message : t("Could not save the shift."), "error"); }
    finally { setBusy(false); }
  }

  const when = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  const money = (value: number | null, cur: string) => value == null ? "—" : formatPrice(value, cur, locale);
  if (loading) return <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500" role="status"><Loader2 className="size-4 animate-spin" />{t("Loading…")}</p>;
  return <div className="grid gap-5 lg:grid-cols-2">
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-800">{current ? t("Close the drawer") : t("Open the drawer")}</h2>
      {current && <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
        <p>{t("Opened")} {when(current.openedAt)}{current.openedBy ? ` · ${current.openedBy}` : ""}</p>
        <p>{t("Opening float")}: <b>{money(current.openingFloat, current.currency)}</b></p>
        <p>{t("Should hold now")}: <b>{money(current.expectedCash, current.currency)}</b></p>
      </div>}
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-xs font-medium text-slate-600">{current ? t("Cash counted") : t("Opening float")} ({current?.currency ?? currency})
          <input type="number" min="0" step="0.01" inputMode="decimal" required className={`${inputCls} mt-1`} value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
        {current && <input className={inputCls} aria-label={t("Note (optional)")} placeholder={t("Note (optional)")} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />}
        <button type="submit" disabled={busy || amount === ""} className="rounded-lg bg-matcha-600 px-4 py-2 text-sm font-semibold text-white hover:bg-matcha-700 disabled:opacity-50">
          {busy ? t("Saving…") : current ? t("Close shift") : t("Open shift")}</button>
      </form>
    </section>

    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-800">{t("Recent shifts")}</h2>
      {!history.length ? <p className="mt-3 text-sm text-slate-500">{t("No closed shifts yet.")}</p>
        : <ul className="mt-2 divide-y divide-slate-100">{history.map((shift) => <li key={shift.id} className="py-2.5 text-xs text-slate-600">
          <p className="font-semibold text-slate-800">{when(shift.openedAt)} → {shift.closedAt ? when(shift.closedAt) : ""}</p>
          <p>{shift.openedBy ?? "—"} · {t("float")} {money(shift.openingFloat, shift.currency)} · {t("expected")} {money(shift.expectedCash, shift.currency)} · {t("counted")} {money(shift.countedCash, shift.currency)}</p>
          <p className={shift.difference ? (shift.difference < 0 ? "font-semibold text-red-600" : "font-semibold text-amber-600") : "font-semibold text-matcha-700"}>
            {shift.difference ? `${shift.difference > 0 ? t("Over") : t("Short")} ${money(Math.abs(shift.difference), shift.currency)}` : t("Balanced")}{shift.note ? ` · ${shift.note}` : ""}</p>
        </li>)}</ul>}
    </section>
  </div>;
}
