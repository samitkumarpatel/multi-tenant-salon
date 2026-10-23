import { useI18n } from "@salon/i18n";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Printer, TriangleAlert } from "lucide-react";
import { ADMIN_API, apiFetch } from "~/lib/api";
import { formatPrice } from "~/lib/format";

interface MethodTotal { currency: string; method: "CASH" | "CARD" | "OTHER"; count: number; total: number }
interface PersonTotal { person: string; currency: string; count: number; total: number }
interface Reversed { currency: string; count: number; total: number }
interface DailyReport {
  date: string;
  zone: string;
  takings: MethodTotal[];
  refunded: MethodTotal[];
  byPerson: PersonTotal[];
  voided: Reversed[];
  awaitingPayment: number;
}

const METHOD_LABEL = { CASH: "Cash", CARD: "Card", OTHER: "Other" } as const;

/** Today in the browser's own timezone as YYYY-MM-DD — the counter's clock is the salon's clock. */
function localDay(offsetDays = 0, from?: string) {
  const d = from ? new Date(`${from}T12:00:00`) : new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString("sv-SE");
}

function sum(rows: { total: number }[]) {
  return rows.reduce((acc, row) => acc + Number(row.total), 0);
}

/**
 * The end-of-day sheet: what was taken, how, by whom — enough to count the drawer against.
 *
 * Cash is the figure that matters most, so it is called out on its own per currency: cash taken minus
 * cash handed back. Card money is settled by Stripe and never in the drawer; a card sale still waiting
 * is flagged rather than counted, because it is not money anyone has.
 */
export function DaySheet({ sid }: { sid: string }) {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const zone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const [date, setDate] = useState(() => localDay());
  const [report, setReport] = useState<DailyReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setReport(null);
    setError(null);
    apiFetch<DailyReport>(`${ADMIN_API}/${sid}/dashboard/reports/daily?date=${date}&zone=${encodeURIComponent(zone)}`)
      .then((r) => { if (current) setReport(r); })
      .catch((e: unknown) => { if (current) setError(e instanceof Error ? e.message : "Could not load the day sheet"); });
    return () => { current = false; };
  }, [sid, date, zone]);

  const currencies = useMemo(() => {
    if (!report) return [] as string[];
    return [...new Set([...report.takings, ...report.refunded, ...report.voided].map((row) => row.currency))].sort();
  }, [report]);

  const isToday = date === localDay();
  const shownDate = new Intl.DateTimeFormat(uiLocale, { dateStyle: "full" }).format(new Date(`${date}T12:00:00`));

  return (
    <section className="space-y-4 print:space-y-3">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <button type="button" onClick={() => setDate(localDay(-1, date))} aria-label={translateUi("Previous day")}
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button>
        <input type="date" value={date} max={localDay()} onChange={(e) => e.target.value && setDate(e.target.value)}
          aria-label={translateUi("Choose a day")}
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-matcha-500" />
        <button type="button" disabled={isToday} onClick={() => setDate(localDay(1, date))} aria-label={translateUi("Next day")}
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
        {!isToday && (
          <button type="button" onClick={() => setDate(localDay())}
            className="h-10 cursor-pointer rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50">{translateUi("Today")}</button>
        )}
        <button type="button" onClick={() => window.print()}
          className="ml-auto inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50">
          <Printer className="h-4 w-4" /> {translateUi("Print")}
        </button>
      </div>

      <h2 className="text-sm font-semibold text-slate-800">{shownDate}</h2>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</p>}
      {!report && !error && <p className="py-10 text-center text-sm text-slate-400">{translateUi("Loading…")}</p>}

      {report && (
        <>
          {report.awaitingPayment > 0 && (
            <div role="status" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{translateUi("{count} card sale(s) are still waiting for payment and are not counted below.", { count: report.awaitingPayment })}</p>
            </div>
          )}

          {currencies.length === 0 && (
            <p className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400">{translateUi("Nothing was taken on this day.")}</p>
          )}

          {currencies.map((currency) => {
            const taken = report.takings.filter((row) => row.currency === currency);
            const handedBack = report.refunded.filter((row) => row.currency === currency);
            const cashIn = sum(taken.filter((row) => row.method === "CASH"));
            const cashOut = sum(handedBack.filter((row) => row.method === "CASH"));
            const voided = report.voided.find((row) => row.currency === currency);
            return (
              <div key={currency} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="flex items-baseline justify-between border-b border-slate-100 px-4 py-3">
                  <h3 className="text-sm font-semibold text-slate-800">{translateUi("Taken today")} · {currency}</h3>
                  <span className="text-lg font-bold text-slate-900">{formatPrice(sum(taken), currency, uiLocale)}</span>
                </div>
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-slate-100">
                    {(["CASH", "CARD", "OTHER"] as const).map((method) => {
                      const row = taken.find((r) => r.method === method);
                      return (
                        <tr key={method} className={row ? "" : "text-slate-300"}>
                          <td className="px-4 py-2.5 font-medium">{translateUi(METHOD_LABEL[method])}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{translateUi("{count} sale(s)", { count: row?.count ?? 0 })}</td>
                          <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatPrice(row?.total ?? 0, currency, uiLocale)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="flex items-baseline justify-between">
                    <p className="text-xs font-semibold text-slate-700">{translateUi("Cash to count")}</p>
                    <p className="text-base font-bold text-slate-900 tabular-nums">{formatPrice(cashIn - cashOut, currency, uiLocale)}</p>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {cashOut > 0
                      ? translateUi("{taken} cash taken, less {back} handed back — plus whatever float you started with.", { taken: formatPrice(cashIn, currency, uiLocale), back: formatPrice(cashOut, currency, uiLocale) })
                      : translateUi("Cash taken today — plus whatever float you started with. Card payments are never in the drawer.")}
                  </p>
                </div>

                {(handedBack.length > 0 || voided) && (
                  <ul className="space-y-1 border-t border-slate-100 px-4 py-3 text-[11px] text-slate-500">
                    {handedBack.map((row) => (
                      <li key={row.method}>{translateUi("Handed back ({method}): {amount}", { method: translateUi(METHOD_LABEL[row.method]), amount: formatPrice(row.total, currency, uiLocale) })}</li>
                    ))}
                    {voided && <li>{translateUi("{count} voided sale(s) worth {amount} — not counted above.", { count: voided.count, amount: formatPrice(voided.total, currency, uiLocale) })}</li>}
                  </ul>
                )}
              </div>
            );
          })}

          {report.byPerson.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-800">{translateUi("Rung up by")}</h3>
                <p className="mt-0.5 text-[11px] text-slate-400">{translateUi("Till sales only. Memberships sold at the desk are counted above but not split by person here.")}</p>
              </div>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-100">
                  {report.byPerson.map((row) => (
                    <tr key={`${row.person}-${row.currency}`}>
                      <td className="px-4 py-2.5 font-medium text-slate-700">{row.person === "Unknown" ? translateUi("Unknown") : row.person}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{translateUi("{count} sale(s)", { count: row.count })}</td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatPrice(row.total, row.currency, uiLocale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
