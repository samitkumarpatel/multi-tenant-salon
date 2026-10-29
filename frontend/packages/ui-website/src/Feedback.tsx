import { createContext, useContext, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { MessageSquare, Star } from "lucide-react";
import { useI18n } from "@salon/i18n";
import { apiFetch, API_BASE } from "./api";
import { friendlyMessage } from "./apiError";
import { feedbackHref } from "./feedbackHref";
import { contrastText } from "./theme";
import type { Salon, StaffMember, WebsiteTheme } from "./types";

export type FeedbackSettings = { publicWebsiteEnabled: boolean };
const FeedbackContext = createContext<{ enabled: boolean; getPagePath: (page: string) => string } | null>(null);
export function FeedbackProvider({ enabled, getPagePath, children }: { enabled: boolean; getPagePath: (page: string) => string; children: ReactNode }) {
  return <FeedbackContext.Provider value={{ enabled, getPagePath }}>{children}</FeedbackContext.Provider>;
}

/** Browsing public stars is available even when the salon closes general feedback submissions. */
export function RatingsLink({ staffId, color, className = "" }: { staffId?: string | number; color?: string; className?: string }) {
  const context = useContext(FeedbackContext);
  const { t } = useI18n();
  if (!context) return null;
  const url = new URL(context.getPagePath("ratings"), "https://salon.invalid");
  if (staffId != null) url.searchParams.set("staff", String(staffId));
  return <a href={`${url.pathname}${url.search}`} onClick={(event) => event.stopPropagation()} style={{ color }}
    className={`inline-flex min-h-11 min-w-0 max-w-full cursor-pointer items-center gap-1.5 rounded-sm text-xs font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 ${className}`}>
    <Star aria-hidden="true" className="size-4 shrink-0" />{t("View ratings")}
  </a>;
}

/** Website entry points share the owner's single visibility switch. */
export function FeedbackLink({ staffId, color, className = "" }: { staffId?: string | number; color?: string; className?: string }) {
  const context = useContext(FeedbackContext);
  const { t } = useI18n();
  if (!context?.enabled) return null;
  const path = context.getPagePath("feedback");
  const href = feedbackHref(path, staffId);
  return <a href={href} onClick={(event) => event.stopPropagation()} style={{ color }}
    className={`inline-flex min-h-11 min-w-0 max-w-full items-center gap-1.5 rounded-sm text-left text-xs font-semibold no-underline hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2 ${className}`}>
    <MessageSquare aria-hidden="true" className="size-4 shrink-0" />
    <span className="min-w-0 [overflow-wrap:anywhere]">{t(staffId ? "Rate this stylist" : "Leave feedback")}</span>
  </a>;
}

export function FeedbackStars({ label, value, onChange }: { label: string; value: number; onChange: (rating: number) => void }) {
  const { t } = useI18n();
  return <fieldset><legend className="mb-2 text-sm font-semibold text-slate-800">{label}</legend>
    <div className="flex items-center gap-2">
      {[1, 2, 3, 4, 5].map((rating) => <label key={rating} className="cursor-pointer">
        <input type="radio" name={label} value={rating} checked={value === rating} onChange={() => onChange(rating)} className="peer sr-only" aria-label={`${rating} ${t("stars")}`} />
        <span className={`flex size-11 items-center justify-center rounded-xl border peer-focus-visible:ring-2 peer-focus-visible:ring-amber-500 ${rating <= value ? "border-amber-300 bg-amber-50 text-amber-500" : "border-slate-200 text-slate-300"}`}><Star aria-hidden="true" className="size-6 fill-current" /></span>
      </label>)}
      {!!value && <button type="button" onClick={() => onChange(0)} className="cursor-pointer text-xs text-slate-500 underline">{t("Clear")}</button>}
    </div>
  </fieldset>;
}

type Receipt = { salonRating: number | null; staffRating: number | null; salonFeedback: string | null; staffFeedback: string | null; reply: string | null; repliedAt: string | null };
export function FeedbackView({ salon, staff, theme, enabled, source = "PUBLIC_WEBSITE", initialStaffId, onBack }: {
  salon: Salon; staff: StaffMember[]; theme: WebsiteTheme; enabled: boolean; source?: string; initialStaffId?: string | null; onBack: () => void;
}) {
  const { t } = useI18n();
  const [staffId, setStaffId] = useState(initialStaffId ?? "");
  const [salonRating, setSalonRating] = useState(0);
  const [staffRating, setStaffRating] = useState(0);
  const [salonFeedback, setSalonFeedback] = useState("");
  const [staffFeedback, setStaffFeedback] = useState("");
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const storageKey = `salon-feedback-receipt:${salon.id}`;
  useEffect(() => { try { setToken(localStorage.getItem(storageKey) ?? ""); } catch { /* Storage is optional. */ } }, [storageKey]);
  useEffect(() => {
    if (!token) return;
    apiFetch<Receipt>(`${API_BASE}/api/salon/${salon.id}/feedback/${encodeURIComponent(token)}`)
      .then(setReceipt).catch(() => setError(t("Could not load your feedback. Please try again.")));
  }, [salon.id, token, t]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await apiFetch<{ token: string }>(`${API_BASE}/api/salon/${salon.id}/feedback`, { method: "POST", body: JSON.stringify({
        customerName: name.trim() || null, staffId: staffId ? Number(staffId) : null,
        salonRating: salonRating || null, staffRating: staffId ? staffRating || null : null,
        salonFeedback: salonFeedback.trim() || null, staffFeedback: staffId ? staffFeedback.trim() || null : null, source, website,
      }) });
      setReceipt({ salonRating: salonRating || null, staffRating: staffRating || null, salonFeedback, staffFeedback, reply: null, repliedAt: null });
      setToken(result.token);
      try { localStorage.setItem(storageKey, result.token); } catch { /* Submission succeeds without storage. */ }
    } catch (e) { setError(friendlyMessage(e)); }
    finally { setBusy(false); }
  }
  const canSubmit = !!(salonRating || (staffId && staffRating) || salonFeedback.trim() || (staffId && staffFeedback.trim()));
  const inputClass = "mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400";
  return <main className="min-h-[80dvh] bg-slate-50 px-4 py-8 sm:py-12"><div className="mx-auto max-w-xl">
    <button type="button" onClick={onBack} className="mb-5 cursor-pointer text-sm font-semibold text-slate-600 hover:underline">← {t("Back")}</button>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
      <p className="text-sm font-semibold" style={{ color: theme.accentColor }}>{salon.name}</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">{t(receipt ? "Thank you for your feedback" : "How was your experience?")}</h1>
      {receipt ? <div className="mt-5 space-y-4 text-sm text-slate-700">
        <p>{t("Your feedback has been sent to the salon. Return here on this browser to see their reply.")}</p>
        {receipt.salonRating != null && <p>{t("Salon")}: {"★".repeat(receipt.salonRating)}</p>}
        {receipt.staffRating != null && <p>{t("Stylist")}: {"★".repeat(receipt.staffRating)}</p>}
        {receipt.salonFeedback && <p className="whitespace-pre-wrap">{receipt.salonFeedback}</p>}
        {receipt.staffFeedback && <p className="whitespace-pre-wrap">{receipt.staffFeedback}</p>}
        {receipt.reply ? <div className="rounded-xl bg-slate-50 p-4"><h2 className="font-semibold">{t("Reply from the salon")}</h2><p className="mt-2 whitespace-pre-wrap">{receipt.reply}</p></div> : <p className="text-slate-500">{t("No reply yet.")}</p>}
        <button type="button" className="cursor-pointer font-semibold underline" onClick={() => { setReceipt(null); setToken(""); setSalonRating(0); setStaffRating(0); setSalonFeedback(""); setStaffFeedback(""); setError(""); try { localStorage.removeItem(storageKey); } catch { /* Optional storage. */ } }}>{t("Leave feedback about another experience")}</button>
      </div> : !enabled && source !== "NOTIFICATION" ? <p className="mt-4 text-sm text-slate-600">{t("Website feedback is currently unavailable. You can still use the review link sent after your visit.")}</p> : <form onSubmit={submit} className="mt-5 space-y-5">
        <p className="text-sm leading-6 text-slate-600">{t("Rate the salon, your stylist, or both. Stars and written feedback can be sent separately. Written feedback and replies are private; star ratings contribute to public averages.")}</p>
        <label className="block text-sm font-medium text-slate-700">{t("Your name (optional)")}<input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="name" className={inputClass} /></label>
        <FeedbackStars label={t("Salon rating (optional)")} value={salonRating} onChange={setSalonRating} />
        <label className="block text-sm font-medium text-slate-700">{t("Feedback about the salon (optional)")}<textarea rows={3} maxLength={1000} value={salonFeedback} onChange={(e) => setSalonFeedback(e.target.value)} className={inputClass} /></label>
        <label className="block text-sm font-medium text-slate-700">{t("Choose a stylist (optional)")}<select className={`${inputClass} cursor-pointer`} value={staffId} onChange={(e) => { setStaffId(e.target.value); setStaffRating(0); setStaffFeedback(""); }}><option value="">{t("Salon feedback only")}</option>{staff.filter((member) => member.status === "ACTIVE").map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
        {staffId && <><FeedbackStars label={t("Stylist rating (optional)")} value={staffRating} onChange={setStaffRating} /><label className="block text-sm font-medium text-slate-700">{t("Feedback about your stylist (optional)")}<textarea rows={3} maxLength={1000} value={staffFeedback} onChange={(e) => setStaffFeedback(e.target.value)} className={inputClass} /></label></>}
        <div hidden aria-hidden="true"><label>Website<input value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" /></label></div>
        <button type="submit" disabled={busy || !canSubmit} style={{ backgroundColor: theme.accentColor, color: contrastText(theme.accentColor) }} className="min-h-11 w-full cursor-pointer rounded-xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">{t(busy ? "Sending…" : "Send feedback")}</button>
      </form>}
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    </section>
  </div></main>;
}
