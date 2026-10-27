import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useI18n } from "@salon/i18n";
import { ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import { apiFetch, ADMIN_API, SUPER_ADMIN_API } from "~/lib/api";
import { buttonClass, type CustomerProfile, type LoginAuditPage, type UserDetail } from "~/lib/users";

type History = { bookings: { id: number; serviceName: string; appointmentDate: string; status: string }[];
  orders: { id: number; orderNumber: string; status: string }[];
  memberships: { id: number; planName: string; status: string }[] };

function CustomerHistory({ customer }: { customer: CustomerProfile }) {
  const { t } = useI18n();
  const [history, setHistory] = useState<History>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  async function load() {
    setLoading(true); setError("");
    try { setHistory((await apiFetch<{ history: History }>(`${ADMIN_API}/${customer.salon_id}/customers/${customer.id}`)).history); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }
  return <div className="rounded-xl border border-stone-200 bg-white p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><Link to={`/${customer.salon_id}`} className="text-xs font-medium text-matcha-700 hover:underline">{customer.salon_name}</Link>
        <p className="mt-1 font-semibold text-stone-800">{customer.name}</p>
        {customer.phone && <p className="mt-0.5 text-xs text-stone-500">{customer.phone}</p>}
      </div>
      <div className="text-right"><p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">{t("Last seen")}</p><p className="mt-1 text-xs text-stone-600">{new Date(customer.last_seen_at).toLocaleDateString()}</p></div>
    </div>
    <button type="button" aria-expanded={expanded} onClick={() => { setExpanded((value) => !value); if (!history && !loading && !expanded) void load(); }}
      className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-lg border border-stone-200 px-3 text-xs font-medium text-stone-600 hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-matcha-600">
      {t(expanded ? "Hide activity" : "View activity")} {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
    </button>
    {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
    {expanded && history && <div className="mt-4 grid gap-3 border-t border-stone-100 pt-4 sm:grid-cols-3">
      <ActivityGroup title={t("Bookings")} items={history.bookings.map((b) => `${b.serviceName} · ${b.appointmentDate} · ${b.status}`)} />
      <ActivityGroup title={t("Orders")} items={history.orders.map((o) => `${o.orderNumber} · ${o.status}`)} />
      <ActivityGroup title={t("Memberships")} items={history.memberships.map((m) => `${m.planName} · ${m.status}`)} />
    </div>}
  </div>;
}

function ActivityGroup({ title, items }: { title: string; items: string[] }) {
  return <div className="rounded-lg bg-stone-50 p-3"><h4 className="text-xs font-semibold text-stone-700">{title} <span className="text-stone-400">{items.length}</span></h4>
    {items.length ? <ul className="mt-2 space-y-1.5 text-xs text-stone-600">{items.map((item, index) => <li key={`${item}:${index}`}>{item}</li>)}</ul> : <p className="mt-2 text-xs text-stone-400">—</p>}</div>;
}

export default function UserDetailPage() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const email = params.get("email") ?? "";
  const [data, setData] = useState<UserDetail>();
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [loginHistory, setLoginHistory] = useState<LoginAuditPage>();
  const [historyPage, setHistoryPage] = useState(0);
  const [historyError, setHistoryError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setError(""); setData(undefined);
    apiFetch<UserDetail>(`${SUPER_ADMIN_API}/users/detail?${new URLSearchParams({ email })}`, { signal: controller.signal })
      .then(setData).catch((e) => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [email, refresh]);
  useEffect(() => {
    if (!email) return;
    const controller = new AbortController();
    setHistoryError("");
    apiFetch<LoginAuditPage>(`${SUPER_ADMIN_API}/users/login-history?${new URLSearchParams({ email, page: String(historyPage), size: "20" })}`, { signal: controller.signal })
      .then(setLoginHistory).catch((e) => { if (!controller.signal.aborted) setHistoryError(e.message); });
    return () => controller.abort();
  }, [email, historyPage]);
  if (error) return <div role="alert" className="space-y-3"><p className="text-red-700">{error}</p><button className={buttonClass} onClick={() => setRefresh((v) => v + 1)}>{t("Retry")}</button></div>;
  if (!data) return <p role="status">{t("Loading…")}</p>;

  return <div className="space-y-6">
    <div className="space-y-3">
      <Link to="/" className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 text-xs font-medium text-stone-600 hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-matcha-600"><ArrowLeft className="size-4" aria-hidden="true" />{t("Back to home")}</Link>
      <div><Link to="/users" className="text-xs font-medium text-matcha-700 hover:underline">{t("All people")}</Link><h1 className="mt-1 break-all text-xl font-bold text-stone-900">{data.email}</h1></div>
    </div>
    <section className="rounded-xl border border-stone-200 bg-white p-4 sm:p-6">
      <h2 className="mb-4 text-lg font-semibold">{t("Roles and salon access")}</h2>
      <p className="mb-3 text-xs text-stone-500">{t("Current roles and access by salon.")}</p>
      <ul className="divide-y divide-stone-100">{data.grants.map((grant, index) => <li key={`${grant.role}:${grant.salonId}:${grant.sourceId}:${index}`} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
        <div>{grant.salonId ? <Link to={`/${grant.salonId}`} className="font-medium text-matcha-700 underline">{grant.salonName}</Link> : <span className="font-medium">{t("Platform-wide")}</span>}
          <p className="mt-1 text-xs text-stone-500">{grant.role === "OWNER" ? "SALON_OWNER" : grant.role}{grant.staffRole ? ` · ${grant.staffRole}` : ""}</p></div>
        <div><span className={`rounded border px-2 py-1 text-[10px] font-semibold uppercase ${grant.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-stone-200 bg-stone-50 text-stone-500"}`}>{t(grant.active ? "Active" : "Inactive")}</span></div>
      </li>)}</ul>
    </section>
    <section className="overflow-hidden rounded-xl border border-stone-200 bg-white">
      <div className="border-b border-stone-200 px-4 py-4 sm:px-6"><h2 className="text-lg font-semibold">{t("Login history")}</h2>
        <p className="mt-1 text-xs text-stone-500">{t("Customer email-code attempts recorded since audit logging began. Other sign-in types will appear when their authentication source is connected.")}</p></div>
      {historyError ? <div className="p-4 text-sm text-red-700" role="alert">{historyError}</div> : !loginHistory ? <p className="p-4 text-sm text-stone-500" role="status">{t("Loading…")}</p> : loginHistory.content.length === 0 ?
        <p className="p-4 text-sm text-stone-500">{t("No customer login attempts recorded yet.")}</p> : <>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-stone-200 text-[10px] font-bold uppercase tracking-widest text-stone-400"><tr>
            <th className="px-4 py-3">{t("Date and time")}</th><th className="px-4 py-3">{t("Application")}</th><th className="px-4 py-3">{t("Method")}</th><th className="px-4 py-3">{t("Result")}</th><th className="px-4 py-3">{t("Salon")}</th>
          </tr></thead><tbody className="divide-y divide-stone-100">{loginHistory.content.map((event) => <tr key={event.id}>
            <td className="whitespace-nowrap px-4 py-3 text-xs text-stone-600">{new Date(event.occurredAt).toLocaleString()}</td><td className="px-4 py-3 text-xs">{event.application}</td><td className="px-4 py-3 text-xs">{event.method}</td>
            <td className="px-4 py-3"><span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase ${event.result === "SUCCESS" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{t(event.result === "SUCCESS" ? "Successful" : "Failed")}</span>{!event.identityVerified && <p className="mt-1 text-[10px] text-stone-400">{t("Email unverified")}</p>}</td>
            <td className="px-4 py-3 text-xs text-stone-600">{event.salonName ?? "—"}</td>
          </tr>)}</tbody></table></div>
          <div className="flex items-center justify-between border-t border-stone-100 px-4 py-3 text-xs text-stone-500"><span>{t("Total")}: {loginHistory.totalElements}</span><div className="flex gap-2"><button className={buttonClass} disabled={historyPage === 0} onClick={() => setHistoryPage((p) => p - 1)}>{t("Previous")}</button><button className={buttonClass} disabled={historyPage + 1 >= loginHistory.totalPages} onClick={() => setHistoryPage((p) => p + 1)}>{t("Next")}</button></div></div>
        </>}
    </section>
    {data.customers.length > 0 && <section className="space-y-3"><h2 className="text-lg font-semibold">{t("Customer relationships")}</h2>{data.customers.map((customer) => <CustomerHistory key={customer.id} customer={customer} />)}</section>}
  </div>;
}
