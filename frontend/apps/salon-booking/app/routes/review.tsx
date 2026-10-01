import { useState } from "react";
import { useLoaderData } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { apiFetch, API_BASE } from "@salon/ui-website";

type ReviewTarget = {
  salonName: string;
  staffName: string;
  expiresAt: string;
  submitted: boolean;
};

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  try {
    const target = await apiFetch<ReviewTarget>(`${API_BASE}/api/public/rating/${encodeURIComponent(params.token ?? "")}`);
    return { target, token: params.token ?? "", invalid: false };
  } catch {
    return { target: null, token: params.token ?? "", invalid: true };
  }
}

function RatingInput({ label, value, onChange }: { label: string; value: number; onChange: (rating: number) => void }) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold text-slate-800">{label}</legend>
      <div className="flex gap-2" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((rating) => (
          <button key={rating} type="button" role="radio" aria-checked={value === rating}
            aria-label={`${rating} ${rating === 1 ? "star" : "stars"}`} onClick={() => onChange(rating)}
            className={`h-11 w-11 rounded-xl border text-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${rating <= value ? "border-amber-300 bg-amber-50 text-amber-500" : "border-slate-200 bg-white text-slate-300 hover:border-amber-200"}`}>
            ★
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function ReviewPage() {
  const { target, token, invalid } = useLoaderData<typeof clientLoader>();
  const [salonRating, setSalonRating] = useState(0);
  const [staffRating, setStaffRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (salonRating < 1 || staffRating < 1) return;
    setSubmitting(true);
    setError("");
    try {
      await apiFetch<void>(`${API_BASE}/api/public/rating/${encodeURIComponent(token)}`, {
        method: "POST",
        body: JSON.stringify({ salonRating, staffRating }),
      });
      setSubmitted(true);
    } catch {
      setError("We couldn't save your ratings. The link may have expired or already been used.");
    } finally {
      setSubmitting(false);
    }
  }

  const complete = submitted || target?.submitted;
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4 py-10 font-sans">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">SalonSaaS</p>
        {invalid || !target ? (
          <><h1 className="text-xl font-bold text-slate-900">Rating link unavailable</h1><p className="mt-2 text-sm leading-relaxed text-slate-600">This rating link has expired or is invalid. Please contact the salon if you need help.</p></>
        ) : complete ? (
          <><h1 className="text-xl font-bold text-slate-900">Thank you for your ratings</h1><p className="mt-2 text-sm leading-relaxed text-slate-600">Your feedback has been recorded for {target.salonName}.</p></>
        ) : (
          <>
            <h1 className="text-xl font-bold text-slate-900">How was your visit?</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">Rate your experience at {target.salonName} and with {target.staffName}.</p>
            <div className="mt-7 space-y-6">
              <RatingInput label={`Your experience at ${target.salonName}`} value={salonRating} onChange={setSalonRating} />
              <RatingInput label={`Your experience with ${target.staffName}`} value={staffRating} onChange={setStaffRating} />
            </div>
            {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
            <button type="button" disabled={submitting || salonRating < 1 || staffRating < 1} onClick={submit}
              className="mt-7 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
              {submitting ? "Submitting…" : "Submit ratings"}
            </button>
          </>
        )}
      </section>
    </main>
  );
}
