import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { useI18n } from "@salon/i18n";
import { STAFF_PORTAL_API, apiFetch } from "~/lib/api";
import { getStaffSession } from "~/lib/auth";

type Rating = { bookingId: number; customerName: string; serviceName: string; staffName: string; appointmentDate: string; salonRating: number; staffRating: number; submittedAt: string; salonFeedback: string | null; staffFeedback: string | null; reply: string | null; repliedAt: string | null };
const stars = (count: number) => "★".repeat(count) + "☆".repeat(5 - count);

export default function StaffRatingsPage() {
  const { t } = useI18n();
  const session = getStaffSession()!;
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    apiFetch<Rating[]>(`${STAFF_PORTAL_API}/${session.staffId}/ratings`, { signal: controller.signal })
      .then(setRatings).catch((e) => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [session.staffId]);

  const average = ratings.length ? ratings.reduce((sum, rating) => sum + rating.staffRating, 0) / ratings.length : 0;
  return <section className="space-y-5">
    <div><h1 className="text-xl font-bold text-slate-900">{t("Feedback ratings")}</h1><p className="mt-1 text-sm text-slate-500">{t("Read-only ratings from customers who visited you.")}</p></div>
    <div className="flex gap-3"><div className="rounded-xl border border-slate-200 bg-white px-4 py-3"><p className="text-xl font-bold text-slate-900">{ratings.length}</p><p className="text-xs text-slate-500">{t("Ratings received")}</p></div><div className="rounded-xl border border-slate-200 bg-white px-4 py-3"><p className="flex items-center gap-1 text-xl font-bold text-slate-900"><Star className="size-4 fill-amber-400 text-amber-400" />{ratings.length ? average.toFixed(1) : "—"}</p><p className="text-xs text-slate-500">{t("Your average rating")}</p></div></div>
    {loading ? <p className="py-10 text-center text-sm text-slate-500" role="status">{t("Loading ratings…")}</p> : error ? <p className="rounded-xl border border-red-200 bg-white p-4 text-sm text-red-700" role="alert">{error}</p> : !ratings.length ? <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">{t("No customer ratings received yet.")}</p> :
      <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">{ratings.map((rating) => <article key={rating.bookingId} className="p-4"><div className="space-y-2 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div><p className="font-semibold text-slate-800">{rating.customerName || t("Customer")}</p><p className="mt-0.5 text-xs text-slate-500">{rating.serviceName} · {new Date(`${rating.appointmentDate}T00:00:00`).toLocaleDateString()}</p></div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs"><span><span className="text-slate-500">{t("Salon")}: </span><span className="font-semibold tracking-wider text-amber-500" aria-label={`${rating.salonRating} ${t("stars")}`}>{stars(rating.salonRating)}</span></span><span><span className="text-slate-500">{t("Your rating")}: </span><span className="font-semibold tracking-wider text-amber-500" aria-label={`${rating.staffRating} ${t("stars")}`}>{stars(rating.staffRating)}</span></span></div>
      </div>
      {rating.staffFeedback && <p className="mt-2 whitespace-pre-line text-sm text-slate-600"><span className="text-xs font-semibold text-slate-500">{t("About you")}: </span><span className="italic">“{rating.staffFeedback}”</span></p>}
      {rating.salonFeedback && <p className="mt-1.5 whitespace-pre-line text-sm text-slate-600"><span className="text-xs font-semibold text-slate-500">{t("About the salon")}: </span><span className="italic">“{rating.salonFeedback}”</span></p>}
      {rating.reply && <div className="mt-2 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700"><p className="font-semibold">{t("Reply from the salon")}</p><p className="mt-0.5 whitespace-pre-line">{rating.reply}</p></div>}
      </article>)}</div>}
  </section>;
}
