import { useEffect, useMemo, useState } from "react";
import { Star } from "lucide-react";
import { useOutletContext } from "react-router";
import { useI18n } from "@salon/i18n";
import { apiFetch, ADMIN_API } from "~/lib/api";
import type { LayoutContext } from "~/lib/types";

type Rating = { bookingId: number; customerName: string; serviceName: string; staffName: string; appointmentDate: string; salonRating: number; staffRating: number; submittedAt: string; salonFeedback: string | null; staffFeedback: string | null; reply: string | null; repliedAt: string | null };
const inputClass = "min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-matcha-500 focus:outline-none";
const MAX_REPLY = 1000;
const stars = (count: number) => "★".repeat(count) + "☆".repeat(5 - count);

/** The owner's reply to one review. Only the reply is editable; the customer's rating and words are read-only. */
function ReplyBox({ salonId, rating, onSaved }: { salonId: string | number; rating: Rating; onSaved: (bookingId: number, reply: string) => void }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(rating.reply ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    setBusy(true); setError("");
    try {
      await apiFetch<void>(`${ADMIN_API}/${salonId}/ratings/${rating.bookingId}/reply`, { method: "PUT", body: JSON.stringify({ reply: draft.trim() }) });
      onSaved(rating.bookingId, draft.trim()); setEditing(false);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  if (!editing) return <div className="mt-2 text-xs">
    {rating.reply && <div className="rounded-lg bg-slate-50 p-2.5 text-slate-700"><p className="font-semibold">{t("Your reply")}</p><p className="mt-0.5 whitespace-pre-line">{rating.reply}</p></div>}
    <button type="button" onClick={() => setEditing(true)} className="mt-1.5 font-semibold text-matcha-700 hover:underline">{rating.reply ? t("Edit reply") : t("Reply")}</button>
  </div>;
  return <div className="mt-2 space-y-2">
    <textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-matcha-500 focus:outline-none" rows={3} maxLength={MAX_REPLY} aria-label={t("Reply")} value={draft} onChange={(e) => setDraft(e.target.value)} />
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    <div className="flex gap-2">
      <button type="button" disabled={busy || !draft.trim()} onClick={save} className="rounded-lg bg-matcha-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{busy ? t("Saving…") : t("Send reply")}</button>
      <button type="button" disabled={busy} onClick={() => { setEditing(false); setDraft(rating.reply ?? ""); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">{t("Cancel")}</button>
    </div>
  </div>;
}

export default function RatingsPage() {
  const { t } = useI18n();
  const { salon } = useOutletContext<LayoutContext>();
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [staff, setStaff] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    apiFetch<Rating[]>(`${ADMIN_API}/${salon.id}/ratings`, { signal: controller.signal })
      .then(setRatings).catch((e) => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [salon.id]);

  const staffNames = useMemo(() => [...new Set(ratings.map((rating) => rating.staffName))].sort(), [ratings]);
  const filtered = ratings.filter((rating) => (!staff || rating.staffName === staff) &&
    (!query || `${rating.customerName} ${rating.serviceName}`.toLowerCase().includes(query.toLowerCase())));
  const average = ratings.length ? ratings.reduce((sum, rating) => sum + rating.salonRating, 0) / ratings.length : 0;

  return <section className="mx-auto max-w-6xl space-y-5">
    <div><h1 className="text-xl font-bold text-slate-900">{t("Feedback ratings")}</h1><p className="mt-1 text-sm text-slate-500">{t("Customer ratings and feedback for your salon and staff. You can reply, but not change what customers wrote.")}</p></div>
    <div className="grid grid-cols-2 gap-3 sm:max-w-md">
      <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-2xl font-bold text-slate-900">{ratings.length}</p><p className="text-xs text-slate-500">{t("Ratings received")}</p></div>
      <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="flex items-center gap-2 text-2xl font-bold text-slate-900"><Star className="size-5 fill-amber-400 text-amber-400" />{ratings.length ? average.toFixed(1) : "—"}</p><p className="text-xs text-slate-500">{t("Average salon rating")}</p></div>
    </div>
    <div className="flex flex-col gap-2 sm:flex-row">
      <input className={`${inputClass} min-w-0 flex-1`} aria-label={t("Search ratings")} placeholder={t("Search customer or service")} value={query} onChange={(e) => setQuery(e.target.value)} />
      <select className={inputClass} aria-label={t("Filter by staff")} value={staff} onChange={(e) => setStaff(e.target.value)}><option value="">{t("All staff")}</option>{staffNames.map((name) => <option key={name}>{name}</option>)}</select>
    </div>
    {loading ? <p className="py-12 text-center text-sm text-slate-500" role="status">{t("Loading ratings…")}</p> : error ? <p className="rounded-xl border border-red-200 bg-white p-5 text-sm text-red-700" role="alert">{error}</p> : !filtered.length ?
      <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">{ratings.length ? t("No ratings match these filters.") : t("No customer ratings received yet.")}</p> :
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="divide-y divide-slate-100">
        {filtered.map((rating) => <article key={rating.bookingId} className="p-4 sm:px-5">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0"><p className="truncate font-semibold text-slate-800">{rating.customerName || t("Customer")}</p><p className="mt-0.5 text-xs text-slate-500">{rating.serviceName} · {rating.staffName} · {new Date(`${rating.appointmentDate}T00:00:00`).toLocaleDateString()}</p></div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs"><span><span className="text-slate-500">{t("Salon")}: </span><span className="font-semibold tracking-wider text-amber-500" aria-label={`${rating.salonRating} ${t("stars")}`}>{stars(rating.salonRating)}</span></span><span><span className="text-slate-500">{t("Stylist")}: </span><span className="font-semibold tracking-wider text-amber-500" aria-label={`${rating.staffRating} ${t("stars")}`}>{stars(rating.staffRating)}</span></span></div>
          </div>
          {rating.salonFeedback && <p className="mt-2 whitespace-pre-line text-sm text-slate-600"><span className="text-xs font-semibold not-italic text-slate-500">{t("About the salon")}: </span><span className="italic">“{rating.salonFeedback}”</span></p>}
          {rating.staffFeedback && <p className="mt-1.5 whitespace-pre-line text-sm text-slate-600"><span className="text-xs font-semibold not-italic text-slate-500">{t("About {name}", { name: rating.staffName })}: </span><span className="italic">“{rating.staffFeedback}”</span></p>}
          <ReplyBox salonId={salon.id} rating={rating} onSaved={(bookingId, reply) => setRatings((items) => items.map((item) => item.bookingId === bookingId ? { ...item, reply, repliedAt: new Date().toISOString() } : item))} />
        </article>)}
      </div></div>}
  </section>;
}
