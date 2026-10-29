import { useI18n } from "@salon/i18n";
import { useState } from "react";
import { useLoaderData } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { apiFetch, API_BASE, FeedbackStars, PublicReviewConsent, ApiError } from "@salon/ui-website";

type ReviewTarget = {
  salonName: string;
  staffName: string;
  expiresAt: string;
  submitted: boolean;
};

export function meta() { return [{ name: "robots", content: "noindex, nofollow" }, { name: "referrer", content: "no-referrer" }]; }

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  try {
    const target = await apiFetch<ReviewTarget>(`${API_BASE}/api/public/rating/${encodeURIComponent(params.token ?? "")}`);
    return { target, token: params.token ?? "", invalid: false, failed: false };
  } catch (error) {
    const invalid = error instanceof ApiError && error.status === 404;
    return { target: null, token: params.token ?? "", invalid, failed: !invalid };
  }
}

function FeedbackInput({ label, value, onChange }: { label: string; value: string; onChange: (text: string) => void }) {
  const { t: translateUi } = useI18n();
  return (
    <label className="block text-xs font-medium text-slate-600">{translateUi(label)}
      <textarea value={value} onChange={(e) => onChange(e.target.value)} maxLength={1000} rows={3}
        className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none" />
    </label>
  );
}

export default function ReviewPage() {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const { target, token, invalid, failed } = useLoaderData<typeof clientLoader>();
  const [salonRating, setSalonRating] = useState(0);
  const [staffRating, setStaffRating] = useState(0);
  const [salonFeedback, setSalonFeedback] = useState("");
  const [staffFeedback, setStaffFeedback] = useState("");
  const [publicConsent, setPublicConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!salonRating && !staffRating && !salonFeedback.trim() && !staffFeedback.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      await apiFetch<void>(`${API_BASE}/api/public/rating/${encodeURIComponent(token)}`, {
        method: "POST",
        body: JSON.stringify({ salonRating: salonRating || null, staffRating: staffRating || null, salonFeedback: salonFeedback.trim() || null, staffFeedback: staffFeedback.trim() || null, publicConsent }),
      });
      setSubmitted(true);
    } catch {
      setError("We couldn't save your feedback. Please try again. Your input has been kept.");
    } finally {
      setSubmitting(false);
    }
  }

  const complete = submitted || target?.submitted;
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4 py-10 font-sans">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">{translateUi("SalonSaaS")}</p>
        {failed ? (
          <><h1 className="text-xl font-bold text-slate-900">{translateUi("Could not load your review")}</h1><button type="button" onClick={() => window.location.reload()} className="mt-4 underline">{translateUi("Try again")}</button></>
        ) : invalid || !target ? (
          <><h1 className="text-xl font-bold text-slate-900">{translateUi("Rating link unavailable")}</h1><p className="mt-2 text-sm leading-relaxed text-slate-600">{translateUi("This rating link has expired or is invalid. Please contact the salon if you need help.")}</p></>
        ) : complete ? (
          <><h1 className="text-xl font-bold text-slate-900">{translateUi("Thank you for your ratings")}</h1><p className="mt-2 text-sm leading-relaxed text-slate-600">{translateUi("Your feedback has been recorded for ")}{target.salonName}.</p></>
        ) : (
          <>
            <h1 className="text-xl font-bold text-slate-900">{translateUi("How was your visit?")}</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{translateUi("Rate your experience at ")}{target.salonName} {translateUi("and with ")}{target.staffName}.</p>
            <p className="mt-3 text-xs leading-5 text-slate-500">{translateUi("Rate the salon, your stylist, or both. You can send just stars or written feedback. Written feedback is private unless you choose to share it publicly. Replies stay private.")}</p>
            <div className="mt-7 space-y-6">
              <FeedbackStars label={`Your experience at ${target.salonName}`} value={salonRating} onChange={setSalonRating} />
              <FeedbackInput label={`Anything to tell ${target.salonName}? (optional)`} value={salonFeedback} onChange={setSalonFeedback} />
              <FeedbackStars label={`Your experience with ${target.staffName}`} value={staffRating} onChange={setStaffRating} />
              <FeedbackInput label={`Anything to tell ${target.staffName}? (optional)`} value={staffFeedback} onChange={setStaffFeedback} />
            </div>
            <div className="mt-5 text-slate-700"><PublicReviewConsent checked={publicConsent} onChange={setPublicConsent} /></div>
            {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
            <button type="button" disabled={submitting || (!salonRating && !staffRating && !salonFeedback.trim() && !staffFeedback.trim())} onClick={submit}
              className="mt-7 w-full cursor-pointer rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
              {submitting ? translateUi("Submitting…") : translateUi("Submit ratings")}
            </button>
          </>
        )}
      </section>
    </main>
  );
}
