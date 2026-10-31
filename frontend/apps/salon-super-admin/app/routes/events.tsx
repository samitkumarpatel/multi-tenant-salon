import { Fragment, useEffect, useState } from "react";
import { useLiveSearch } from "@salon/ui-shared/live-search";
import { useSearchParams } from "react-router";
import { Search } from "lucide-react";
import { useI18n } from "@salon/i18n";
import { apiFetch, SUPER_ADMIN_API } from "~/lib/api";
import { buttonClass, fieldClass, type EventPublication, type EventPublicationDetail, type EventPublicationPage, type EventStatusCount } from "~/lib/users";

const STATUSES = ["ALL", "FAILED", "PUBLISHED", "PROCESSING", "RESUBMITTED", "COMPLETED"];
const statusColors: Record<string, string> = {
  FAILED: "border-rose-200 bg-rose-50 text-rose-700",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  PROCESSING: "border-sky-200 bg-sky-50 text-sky-700",
  RESUBMITTED: "border-amber-200 bg-amber-50 text-amber-700",
  PUBLISHED: "border-stone-200 bg-stone-50 text-stone-600",
};
const shortName = (name: string) => name.slice(name.lastIndexOf(".") + 1);
const when = (value: string | null) => value ? new Date(value).toLocaleString() : "—";

function StatusPill({ status }: { status: string }) {
  return <span className={`inline-block rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${statusColors[status] ?? statusColors.PUBLISHED}`}>{status}</span>;
}

function Payload({ entry }: { entry: EventPublication }) {
  const { t } = useI18n();
  const [detail, setDetail] = useState<EventPublicationDetail>();
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    apiFetch<EventPublicationDetail>(`${SUPER_ADMIN_API}/events/${entry.id}`, { signal: controller.signal })
      .then(setDetail).catch((e) => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [entry.id]);
  if (error) return <p role="alert" className="text-xs text-red-700">{error}</p>;
  if (!detail) return <p role="status" className="text-xs text-stone-500">{t("Loading…")}</p>;
  let text = detail.serializedEvent;
  try { text = JSON.stringify(JSON.parse(text), null, 2); } catch { /* not JSON, show as stored */ }
  return <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-stone-200 bg-stone-50 p-3 font-mono text-[11px] text-stone-700">{text}</pre>;
}

export default function Events() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const status = params.get("status") ?? "ALL";
  const page = Math.max(0, Number(params.get("page")) || 0);
  const [data, setData] = useState<EventPublicationPage>();
  const [counts, setCounts] = useState<EventStatusCount[]>([]);
  const [open, setOpen] = useState<string>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [search, setSearch, submitSearch] = useLiveSearch(q, (value) => update("q", value));

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    const query = new URLSearchParams({ q, status, page: String(page), size: "25" });
    apiFetch<EventPublicationPage>(`${SUPER_ADMIN_API}/events?${query}`, { signal: controller.signal })
      .then((next) => { if (!controller.signal.aborted) setData(next); })
      .catch((e) => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    apiFetch<EventStatusCount[]>(`${SUPER_ADMIN_API}/events/summary`, { signal: controller.signal })
      .then((next) => { if (!controller.signal.aborted) setCounts(next); }).catch(() => {});
    return () => controller.abort();
  }, [q, status, page, refresh]);

  function update(key: string, value: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      value && value !== "ALL" ? next.set(key, value) : next.delete(key);
      if (key !== "page") next.delete("page");
      return next;
    }, { replace: true });
  }
  const count = (s: string) => counts.find((c) => c.status === s)?.count ?? 0;

  return <section className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-xl font-bold text-stone-900">{t("Events")}</h1>
        <p className="mt-1 text-xs text-stone-500">{t("Spring Modulith event publications: what was sent between modules and whether each listener handled it.")}</p></div>
      <button type="button" className={buttonClass} onClick={() => setRefresh((v) => v + 1)}>{t("Refresh")}</button>
    </div>
    <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); submitSearch(); }}>
      <div className="relative min-w-0 flex-1 basis-60"><Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-stone-400" aria-hidden="true" />
        <input type="search" aria-label={t("Search events")} placeholder={t("Search by event type or listener")} className={`${fieldClass} w-full border-stone-200 pl-9 placeholder:text-stone-400`} value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <div role="group" aria-label={t("Event status")} className="flex flex-wrap items-center gap-1 rounded-lg border border-stone-200 bg-white p-1">
        {STATUSES.map((value) => <button key={value} type="button" aria-pressed={status === value} onClick={() => update("status", value)}
          className={`min-h-8 rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-matcha-600 ${status === value ? "bg-matcha-600 text-white" : "text-stone-500 hover:bg-stone-50 hover:text-stone-800"}`}>
          {value === "ALL" ? t("All") : `${value} · ${count(value)}`}
        </button>)}
      </div>
    </form>
    {loading ? <p role="status">{t("Loading…")}</p> : error ? <div role="alert" className="space-y-3 text-red-700"><p>{error}</p><button className={buttonClass} onClick={() => setRefresh((v) => v + 1)}>{t("Retry")}</button></div> : <>
      {!data?.content.length ? <p className="rounded-xl border border-stone-200 bg-white p-6 text-stone-500">{t("No matching events found.")}</p> : <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <caption className="sr-only">{t("Events")}</caption>
          <thead className="border-b border-stone-200 text-[10px] font-bold uppercase tracking-widest text-stone-400">
            <tr>
              <th scope="col" className="px-4 py-3">{t("Event")}</th>
              <th scope="col" className="px-4 py-3">{t("Listener")}</th>
              <th scope="col" className="px-4 py-3">{t("Status")}</th>
              <th scope="col" className="px-4 py-3">{t("Published")}</th>
              <th scope="col" className="px-4 py-3">{t("Attempts")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {data.content.map((entry) => <Fragment key={entry.id}>
              <tr className="cursor-pointer align-top hover:bg-stone-50" onClick={() => setOpen(open === entry.id ? undefined : entry.id)}>
                <td className="px-4 py-3">
                  <button type="button" aria-expanded={open === entry.id} className="text-left font-semibold text-stone-800 focus-visible:outline-2 focus-visible:outline-matcha-600"
                    onClick={(e) => { e.stopPropagation(); setOpen(open === entry.id ? undefined : entry.id); }}>{shortName(entry.eventType)}</button>
                  <p className="break-all font-mono text-[11px] text-stone-500">{entry.eventType}</p>
                </td>
                <td className="break-all px-4 py-3 font-mono text-[11px] text-stone-600">{shortName(entry.listenerId.replace(/[#:].*$/, "")) + (entry.listenerId.match(/[#:].*$/)?.[0] ?? "")}</td>
                <td className="px-4 py-3"><StatusPill status={entry.status} /></td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-stone-600">{when(entry.publicationDate)}</td>
                <td className="px-4 py-3 text-xs text-stone-600">{entry.completionAttempts ?? "—"}</td>
              </tr>
              {open === entry.id && <tr className="bg-stone-50/50">
                <td colSpan={5} className="space-y-3 px-4 py-3">
                  <dl className="grid gap-x-6 gap-y-1 text-xs text-stone-600 sm:grid-cols-2">
                    <div><dt className="inline font-semibold">{t("Id")}: </dt><dd className="inline break-all font-mono">{entry.id}</dd></div>
                    <div><dt className="inline font-semibold">{t("Listener")}: </dt><dd className="inline break-all font-mono">{entry.listenerId}</dd></div>
                    <div><dt className="inline font-semibold">{t("Completed")}: </dt><dd className="inline">{when(entry.completionDate)}</dd></div>
                    <div><dt className="inline font-semibold">{t("Last resubmitted")}: </dt><dd className="inline">{when(entry.lastResubmissionDate)}</dd></div>
                    <div><dt className="inline font-semibold">{t("Archived")}: </dt><dd className="inline">{t(entry.archived ? "Yes" : "No")}</dd></div>
                  </dl>
                  <Payload entry={entry} />
                </td>
              </tr>}
            </Fragment>)}
          </tbody>
        </table>
      </div>}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-stone-500">
        <span>{t("Total")}: {data?.totalElements ?? 0} · {t("Page")} {page + 1} / {Math.max(1, data?.totalPages ?? 1)}</span>
        <div className="flex gap-2"><button className={buttonClass} disabled={page === 0} onClick={() => update("page", String(page - 1))}>{t("Previous")}</button><button className={buttonClass} disabled={page + 1 >= (data?.totalPages ?? 0)} onClick={() => update("page", String(page + 1))}>{t("Next")}</button></div>
      </div>
    </>}
  </section>;
}
