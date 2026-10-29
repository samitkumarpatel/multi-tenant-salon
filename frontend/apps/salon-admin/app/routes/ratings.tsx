import { useEffect, useMemo, useState } from "react";
import { Star, Globe2, MessageSquare } from "lucide-react";
import { useOutletContext } from "react-router";
import { useI18n } from "@salon/i18n";
import { apiFetch, ADMIN_API } from "~/lib/api";
import type { LayoutContext } from "~/lib/types";

type Rating = { bookingId: number | null; feedbackId: number | null; source: string; customerName: string; serviceName: string; staffName: string; appointmentDate: string | null; salonRating: number | null; staffRating: number | null; submittedAt: string; salonFeedback: string | null; staffFeedback: string | null; reply: string | null; repliedAt: string | null };
const inputClass = "min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-matcha-500 focus:outline-none";
const MAX_REPLY = 1000;
const stars = (count: number | null) => count == null ? "—" : "★".repeat(count) + "☆".repeat(5 - count);
const ratingKey = (rating: Rating) => rating.feedbackId != null ? `feedback-${rating.feedbackId}` : `booking-${rating.bookingId}`;
const SOURCES: Record<string, string> = { NOTIFICATION: "Notification", WEBSITE_FOOTER: "Website footer", WEBSITE_STYLIST: "Stylist card", PUBLIC_WEBSITE: "Public website", CUSTOMER_ACCOUNT: "Customer account", LEGACY: "Earlier feedback (source unknown)" };
type FeedbackSettings = { publicWebsiteEnabled: boolean };

/** The owner's reply to one review. Only the reply is editable; the customer's rating and words are read-only. */
function ReplyBox({ salonId, rating, onSaved }: { salonId: string | number; rating: Rating; onSaved: (key: string, reply: string) => void }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(rating.reply ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    setBusy(true); setError("");
    try {
      await apiFetch<void>(`${ADMIN_API}/${salonId}/${rating.feedbackId != null ? `feedback/${rating.feedbackId}` : `ratings/${rating.bookingId}`}/reply`, { method: "PUT", body: JSON.stringify({ reply: draft.trim() }) });
      onSaved(ratingKey(rating), draft.trim()); setEditing(false);
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
  const [settings, setSettings] = useState<FeedbackSettings | null>(null);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [source, setSource] = useState("");
  const [replyStatus, setReplyStatus] = useState("");
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setRatings([]); setSettings(null);
    apiFetch<FeedbackSettings>(`${ADMIN_API}/${salon.id}/feedback-settings`, { signal: controller.signal })
      .then(setSettings).catch((e) => { if (!controller.signal.aborted) setSettingsError(e.message); });
    apiFetch<Rating[]>(`${ADMIN_API}/${salon.id}/ratings`, { signal: controller.signal })
      .then(setRatings).catch((e) => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [salon.id]);

  const staffNames = useMemo(() => [...new Set(ratings.map((rating) => rating.staffName).filter(Boolean))].sort(), [ratings]);
  const filtered = ratings.filter((rating) => (!source || rating.source === source) && (!replyStatus || (replyStatus === "replied" ? !!rating.reply : !rating.reply)) && (!staff || rating.staffName === staff) &&
    (!query || `${rating.customerName} ${rating.serviceName}`.toLowerCase().includes(query.toLowerCase())));
  const scored = ratings.filter((rating) => rating.salonRating != null);
  const average = scored.length ? scored.reduce((sum, rating) => sum + (rating.salonRating ?? 0), 0) / scored.length : 0;
  const totalPages = Math.max(1, Math.ceil(filtered.length / 25));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * 25, currentPage * 25);
  async function toggleWebsiteFeedback() {
    if (!settings) return;
    setSettingsBusy(true); setSettingsError(""); setSettingsMessage("");
    try {
      const result = await apiFetch<FeedbackSettings>(`${ADMIN_API}/${salon.id}/feedback-settings`, { method: "PUT", body: JSON.stringify({ publicWebsiteEnabled: !settings.publicWebsiteEnabled }) });
      setSettings(result); setSettingsMessage(t("Feedback link settings saved."));
    } catch (e) { setSettingsError(e instanceof Error ? e.message : String(e)); }
    finally { setSettingsBusy(false); }
  }

  return <section className="mx-auto max-w-6xl space-y-5">
    <div><h1 className="text-xl font-bold text-slate-900">{t("Feedback ratings")}</h1><p className="mt-1 text-sm text-slate-500">{t("Customer ratings and feedback for your salon and staff. You can reply, but not change what customers wrote.")}</p></div>
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4"><div className="flex gap-3"><Globe2 className="mt-1 size-5 shrink-0 text-matcha-700" /><div><h2 className="font-semibold text-slate-900">{t("Public website feedback")}</h2><p className="mt-1 max-w-2xl text-sm text-slate-500">{t("Let any customer leave stars or private feedback from the website footer and stylist cards. Completed-visit email invitations and account reviews remain available when this is off.")}</p></div></div>
      <button type="button" role="switch" aria-checked={settings?.publicWebsiteEnabled ?? false} aria-label={t("Public website feedback")} disabled={!settings || settingsBusy} onClick={toggleWebsiteFeedback}
        className={`relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-matcha-600 focus-visible:ring-offset-2 disabled:opacity-50 ${settings?.publicWebsiteEnabled ? "bg-matcha-700" : "bg-slate-300"}`}><span className={`inline-block size-4 rounded-full bg-white transition-transform ${settings?.publicWebsiteEnabled ? "translate-x-6" : "translate-x-1"}`} /></button></div>
      {settingsError && <p role="alert" className="mt-3 text-sm text-red-700">{settingsError}</p>}
      {settingsMessage && <p role="status" className="mt-3 text-sm text-matcha-800">{settingsMessage}</p>}
    </div>
    <div className="grid grid-cols-2 gap-3 sm:max-w-md">
      <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-2xl font-bold text-slate-900">{ratings.length}</p><p className="text-xs text-slate-500">{t("Feedback received")}</p></div>
      <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="flex items-center gap-2 text-2xl font-bold text-slate-900"><Star className="size-5 fill-amber-400 text-amber-400" />{scored.length ? average.toFixed(1) : "—"}</p><p className="text-xs text-slate-500">{t("Average salon rating")}</p></div>
    </div>
    <div className="flex flex-col gap-2 sm:flex-row">
      <input className={`${inputClass} min-w-0 flex-1`} aria-label={t("Search ratings")} placeholder={t("Search customer or service")} value={query} onChange={(e) => setQuery(e.target.value)} />
      <select className={inputClass} aria-label={t("Filter by staff")} value={staff} onChange={(e) => setStaff(e.target.value)}><option value="">{t("All staff")}</option>{staffNames.map((name) => <option key={name}>{name}</option>)}</select>
      <select className={inputClass} aria-label={t("Filter by source")} value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }}><option value="">{t("All sources")}</option>{Object.entries(SOURCES).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select>
      <select className={inputClass} aria-label={t("Filter by reply")} value={replyStatus} onChange={(e) => { setReplyStatus(e.target.value); setPage(1); }}><option value="">{t("All replies")}</option><option value="pending">{t("Needs reply")}</option><option value="replied">{t("Replied")}</option></select>
    </div>
    {loading ? <p className="py-12 text-center text-sm text-slate-500" role="status">{t("Loading ratings…")}</p> : error ? <p className="rounded-xl border border-red-200 bg-white p-5 text-sm text-red-700" role="alert">{error}</p> : !filtered.length ?
      <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">{ratings.length ? t("No ratings match these filters.") : t("No customer ratings received yet.")}</p> :
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="divide-y divide-slate-100">
        {visible.map((rating) => <article key={ratingKey(rating)} className="p-4 sm:px-5">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0"><p className="truncate font-semibold text-slate-800">{rating.customerName || t("Customer")}</p><p className="mt-0.5 text-xs text-slate-500">{[rating.serviceName, rating.staffName, rating.appointmentDate ? new Date(`${rating.appointmentDate}T00:00:00`).toLocaleDateString() : new Date(rating.submittedAt).toLocaleDateString()].filter(Boolean).join(" · ")}</p></div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs"><span><span className="text-slate-500">{t("Salon")}: </span><span className="font-semibold tracking-wider text-amber-500" aria-label={rating.salonRating == null ? t("Not rated") : `${rating.salonRating} ${t("stars")}`}>{stars(rating.salonRating)}</span></span><span><span className="text-slate-500">{t("Stylist")}: </span><span className="font-semibold tracking-wider text-amber-500" aria-label={rating.staffRating == null ? t("Not rated") : `${rating.staffRating} ${t("stars")}`}>{stars(rating.staffRating)}</span></span></div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px]"><span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-slate-600"><MessageSquare aria-hidden="true" className="size-3" />{t(SOURCES[rating.source] ?? rating.source)}</span><span className="rounded-full bg-matcha-50 px-2 py-1 text-matcha-800">{t(rating.bookingId != null ? "Completed visit" : "General feedback")}</span></div>
          {rating.salonFeedback && <p className="mt-2 whitespace-pre-line text-sm text-slate-600"><span className="text-xs font-semibold not-italic text-slate-500">{t("About the salon")}: </span><span className="italic">“{rating.salonFeedback}”</span></p>}
          {rating.staffFeedback && <p className="mt-1.5 whitespace-pre-line text-sm text-slate-600"><span className="text-xs font-semibold not-italic text-slate-500">{t("About {name}", { name: rating.staffName })}: </span><span className="italic">“{rating.staffFeedback}”</span></p>}
          <ReplyBox salonId={salon.id} rating={rating} onSaved={(key, reply) => setRatings((items) => items.map((item) => ratingKey(item) === key ? { ...item, reply, repliedAt: new Date().toISOString() } : item))} />
        </article>)}
      </div></div>}
    {filtered.length > 25 && <nav aria-label={t("Feedback pages")} className="flex items-center justify-between text-sm"><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">{t("Previous")}</button><span>{currentPage} / {totalPages} · {filtered.length} {t("feedback entries")}</span><button type="button" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">{t("Next")}</button></nav>}
  </section>;
}
