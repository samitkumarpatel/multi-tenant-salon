import { useEffect, useState } from "react";
import { useI18n } from "@salon/i18n";
import { Star } from "lucide-react";
import { apiFetch, API_BASE } from "./api";
import { friendlyMessage } from "./apiError";
import { SiteHeader, SiteFooter } from "./SiteChrome";
import { fontStack, isLightColor } from "./theme";
import type { Salon, StaffMember, WebsiteTheme } from "./types";
import type { SalonPolicy } from "./SalonPolicyLinks";

type PublicScore = { rating: number | null; comment?: string; staffId: number | null; staffName: string | null; date: string; verifiedVisit: boolean };
type ScorePage = { items: PublicScore[]; count: number; average: number | null; distribution: Record<string, number>; page: number; size: number; totalPages: number; totalItems: number };

/** Public scores and consented comments; customer names and replies remain private. */
export function PublicRatingsView({ salon, staff, theme, policies = [], getPagePath, onNavigate, initialStaffId }: {
  salon: Salon; staff: StaffMember[]; theme: WebsiteTheme; policies?: SalonPolicy[];
  getPagePath: (page: string) => string; onNavigate: (page: string | null) => void; initialStaffId?: string | null;
}) {
  const { t, locale } = useI18n();
  const [target, setTarget] = useState(initialStaffId ? "stylist" : "salon");
  const [staffId, setStaffId] = useState(initialStaffId ?? "");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ScorePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const light = isLightColor(theme.heroBg);
  const text = theme.heroTextColor ?? (light ? "#0f172a" : "#ffffff");
  const sub = light ? "#475569" : "#94a3b8";
  const panel = { backgroundColor: light ? "#ffffff" : "rgba(255,255,255,0.06)", borderColor: light ? "rgba(15,23,42,0.12)" : "rgba(255,255,255,0.16)" };
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setResult(null);
    const params = new URLSearchParams({ target, page: String(page), size: "20" });
    if (target === "stylist" && staffId) params.set("staffId", staffId);
    apiFetch<ScorePage>(`${API_BASE}/api/salon/${salon.id}/ratings/public?${params}`, { signal: controller.signal })
      .then((value) => { if (!controller.signal.aborted) setResult(value); })
      .catch((e) => { if (!controller.signal.aborted) setError(friendlyMessage(e)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [salon.id, target, staffId, page, retry]);
  const knownStaff = staff.some((member) => String(member.id) === staffId);
  return <div className="min-h-[100dvh] flex flex-col" style={{ backgroundColor: theme.heroBg, fontFamily: fontStack(theme.fontFamily), color: text }}>
    <SiteHeader salon={salon} theme={theme} current="ratings" onBack={() => onNavigate(null)} getPagePath={getPagePath} onNavigate={onNavigate} />
    <main className="mx-auto w-full min-w-0 max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12 [overflow-wrap:anywhere]">
      <h1 className="text-3xl font-bold tracking-tight">{t("Reviews")}</h1>
      <p className="mt-2 text-sm" style={{ color: sub }}>{t("Explore ratings and reviews for the salon and its stylists. Written reviews appear only with customer permission.")}</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold">{t("Rating type")}
          <select value={target} onChange={(e) => { setTarget(e.target.value); setStaffId(""); setPage(1); }} className="mt-1.5 min-h-11 w-full min-w-0 cursor-pointer rounded-xl border bg-white px-3 text-sm text-slate-900" style={{ borderColor: panel.borderColor }}>
            <option value="salon">{t("Salon")}</option><option value="stylist">{t("Stylist")}</option>
          </select>
        </label>
        {target === "stylist" && <label className="text-xs font-semibold">{t("Stylist")}
          <select value={staffId} onChange={(e) => { setStaffId(e.target.value); setPage(1); }} className="mt-1.5 min-h-11 w-full min-w-0 cursor-pointer rounded-xl border bg-white px-3 text-sm text-slate-900" style={{ borderColor: panel.borderColor }}>
            <option value="">{t("All stylists")}</option>
            {staffId && !knownStaff && <option value={staffId}>{result?.items[0]?.staffName ?? t("Stylist")}</option>}
            {staff.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        </label>}
      </div>
      {loading ? <p role="status" className="py-12 text-center text-sm" style={{ color: sub }}>{t("Loading ratings…")}</p> : error ? <div role="alert" className="mt-6 rounded-xl border p-5" style={panel}>
        <p className="text-sm">{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-2 min-h-11 cursor-pointer text-sm font-semibold underline">{t("Try again")}</button>
      </div> : result && <>
        <section aria-label={t("Rating summary")} className="mt-6 grid gap-6 rounded-2xl border p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:p-6" style={panel}>
          <div><p className="flex items-center gap-2 text-4xl font-bold"><Star aria-hidden="true" className="size-7 fill-amber-400 text-amber-400" />{result.average == null ? "—" : new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(result.average)}</p>
            <p className="mt-2 text-sm" style={{ color: sub }}>{result.count} {t("ratings")}</p>
          </div>
          <div className="space-y-2">{[5, 4, 3, 2, 1].map((score) => <div key={score} className="flex items-center gap-3 text-xs" aria-label={`${score} ${t("stars")}: ${result.distribution[score] ?? 0}`}>
            <span className="w-6 shrink-0">{score} ★</span><div className="h-2 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: panel.borderColor }}><div className="h-full rounded-full bg-amber-400" style={{ width: `${result.count ? 100 * (result.distribution[score] ?? 0) / result.count : 0}%` }} /></div><span className="w-10 shrink-0 text-right tabular-nums">{result.distribution[score] ?? 0}</span>
          </div>)}</div>
        </section>
        {result.totalItems === 0 ? <p className="py-12 text-center text-sm" style={{ color: sub }}>{t("No reviews yet")}</p> : <>
          <p className="mb-3 mt-6 text-xs" style={{ color: sub }}>{t("Newest reviews first")}</p>
          <div className="grid gap-3 sm:grid-cols-2">{result.items.map((score, index) => <article key={`${result.page}-${index}`} className="min-w-0 rounded-xl border p-4" style={panel}>
            <div className="flex flex-wrap items-center justify-between gap-2">{score.rating != null && <p className="tracking-widest text-amber-500" aria-label={`${score.rating} ${t("stars")}`}>{"★".repeat(score.rating)}{"☆".repeat(5 - score.rating)}</p>}<time className="text-xs" dateTime={score.date} style={{ color: sub }}>{new Date(`${score.date}T00:00:00`).toLocaleDateString(locale)}</time></div>
            {score.comment && <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{score.comment}</p>}
            {score.staffName && <p className="mt-2 text-sm font-semibold">{t("Stylist")}: {score.staffName}</p>}
            <p className="mt-2 text-xs" style={{ color: sub }}>{t(score.verifiedVisit ? "Completed visit" : "General feedback")}</p>
          </article>)}</div>
          {result.totalPages > 1 && <nav aria-label={t("Review pages")} className="mt-6 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
            <button type="button" disabled={result.page === 1} onClick={() => setPage(result.page - 1)} className="min-h-11 cursor-pointer rounded-xl border px-3 text-sm disabled:cursor-not-allowed disabled:opacity-40" style={panel}>{t("Previous")}</button>
            <span className="text-center text-xs tabular-nums">{result.page} / {result.totalPages}</span>
            <button type="button" disabled={result.page >= result.totalPages} onClick={() => setPage(result.page + 1)} className="min-h-11 cursor-pointer rounded-xl border px-3 text-sm disabled:cursor-not-allowed disabled:opacity-40" style={panel}>{t("Next")}</button>
          </nav>}
        </>}
      </>}
    </main>
    <SiteFooter salon={salon} theme={theme} policies={policies} current="ratings" onBack={() => onNavigate(null)} getPagePath={getPagePath} />
  </div>;
}
