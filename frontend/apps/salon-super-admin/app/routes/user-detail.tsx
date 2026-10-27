import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useI18n } from "@salon/i18n";
import { apiFetch, ADMIN_API, SUPER_ADMIN_API } from "~/lib/api";
import { buttonClass, type CustomerProfile, type UserDetail } from "~/lib/users";

type History = { bookings: { id: number; serviceName: string; appointmentDate: string; status: string }[];
  orders: { id: number; orderNumber: string; status: string }[];
  memberships: { id: number; planName: string; status: string }[] };

function CustomerHistory({ customer }: { customer: CustomerProfile }) {
  const { t } = useI18n();
  const [history, setHistory] = useState<History>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function load() {
    setLoading(true); setError("");
    try { setHistory((await apiFetch<{ history: History }>(`${ADMIN_API}/${customer.salon_id}/customers/${customer.id}`)).history); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }
  return <div className="rounded-lg border border-stone-200 p-4 text-sm">
    <Link to={`/${customer.salon_id}/customers`} className="font-semibold text-matcha-700 underline">{customer.salon_name}</Link>
    <p className="mt-2">{customer.name}{customer.phone ? ` · ${customer.phone}` : ""}</p>
    {customer.notes && <p className="mt-2 whitespace-pre-wrap text-stone-500">{t("Salon notes")}: {customer.notes}</p>}
    <p className="mt-1 text-xs text-stone-500">{t("Last seen")}: {customer.last_seen_at}</p>
    {!history && <button type="button" disabled={loading} onClick={load} className={`${buttonClass} mt-3`}>{t(loading ? "Loading…" : "Load customer history")}</button>}
    {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
    {history && <div className="mt-3 space-y-3">
      <div><h4 className="font-semibold">{t("Bookings")} ({history.bookings.length})</h4><ul>{history.bookings.map((b) => <li key={b.id}>#{b.id} · {b.serviceName} · {b.appointmentDate} · {b.status}</li>)}</ul></div>
      <div><h4 className="font-semibold">{t("Orders")} ({history.orders.length})</h4><ul>{history.orders.map((o) => <li key={o.id}>{o.orderNumber} · {o.status}</li>)}</ul></div>
      <div><h4 className="font-semibold">{t("Memberships")} ({history.memberships.length})</h4><ul>{history.memberships.map((m) => <li key={m.id}>{m.planName} · {m.status}</li>)}</ul></div>
    </div>}
  </div>;
}

export default function UserDetailPage() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const email = params.get("email") ?? "";
  const [data, setData] = useState<UserDetail>();
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(""); setData(undefined);
    apiFetch<UserDetail>(`${SUPER_ADMIN_API}/users/detail?${new URLSearchParams({ email })}`, { signal: controller.signal })
      .then(setData).catch((e) => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [email, refresh]);
  if (error) return <div role="alert" className="space-y-3"><p className="text-red-700">{error}</p><button className={buttonClass} onClick={() => setRefresh((v) => v + 1)}>{t("Retry")}</button></div>;
  if (!data) return <p role="status">{t("Loading…")}</p>;

  return <div className="space-y-6">
    <div><Link to="/users" className="text-sm text-matcha-700 underline">{t("All users")}</Link><h1 className="mt-2 break-all text-xl font-bold text-stone-900">{data.email}</h1><p className="mt-2 text-sm text-stone-500">{t("Read-only account details. Salon owners manage their own customers and staff in Salon Admin.")}</p></div>
    <section className="rounded-xl border border-stone-200 bg-white p-4 sm:p-6">
      <h2 className="mb-4 text-lg font-semibold">{t("Roles and salon access")}</h2>
      <p className="mb-4 text-sm text-stone-500">{t("Source roles are shown separately from the effective sign-in role. Access depends on current salon and staff status.")}</p>
      <ul className="divide-y divide-stone-100">{data.grants.map((grant, index) => <li key={`${grant.role}:${grant.salonId}:${grant.sourceId}:${index}`} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
        <div>{grant.salonId ? <Link to={`/${grant.salonId}`} className="font-medium text-matcha-700 underline">{grant.salonName}</Link> : <span className="font-medium">{t("Platform-wide")}</span>}
          {grant.salonId && <p className="mt-1 break-all text-xs text-stone-400">{grant.salonId}</p>}
          <p className="mt-1">{grant.role}{grant.staffRole ? ` · ${grant.staffRole}` : ""}</p>
          {grant.sourceId != null && <p className="text-xs text-stone-400">{t("Source record")}: {grant.sourceId}</p>}</div>
        <div className="text-stone-500"><p>{t("Effective role")}: {grant.effectiveRole}</p><p>{t("Source status")}: {t(grant.active ? "Active" : "Inactive")}</p></div>
      </li>)}</ul>
    </section>
    {data.customers.length > 0 && <section className="space-y-3"><h2 className="text-lg font-semibold">{t("Customer relationships")}</h2>{data.customers.map((customer) => <CustomerHistory key={customer.id} customer={customer} />)}</section>}
  </div>;
}
