import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ChevronRight, Search } from "lucide-react";
import { useI18n } from "@salon/i18n";
import { apiFetch, SUPER_ADMIN_API } from "~/lib/api";
import { buttonClass, fieldClass, type UserPage } from "~/lib/users";

const roleLabels: Record<string, string> = { OWNER: "SALON_OWNER" };
const roleColors: Record<string, string> = {
  CUSTOMER: "border-sky-200 bg-sky-50 text-sky-700",
  OWNER: "border-violet-200 bg-violet-50 text-violet-700",
  STAFF: "border-amber-200 bg-amber-50 text-amber-700",
  SUPER_ADMIN: "border-rose-200 bg-rose-50 text-rose-700",
};

function RolePills({ roles }: { roles: string }) {
  const values = roles.split(",").map((role) => role.trim()).filter(Boolean);
  return <div className="flex flex-wrap gap-1">
    {(values.length ? values : ["USER"]).map((role) =>
      <span key={role} className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${roleColors[role] ?? "border-stone-200 bg-stone-50 text-stone-600"}`}>
        {roleLabels[role] ?? role}
      </span>)}
  </div>;
}

export function UserDirectory({ customers = false, salonId }: { customers?: boolean; salonId?: string }) {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const selectedSalon = salonId ?? params.get("salonId") ?? undefined;
  const [salons, setSalons] = useState<{ id: string; name: string }[]>([]);
  const [salonError, setSalonError] = useState(false);
  const q = params.get("q") ?? "";
  const role = customers ? "CUSTOMER" : params.get("role") ?? "";
  const status = params.get("status") ?? "ALL";
  const page = Math.max(0, Number(params.get("page")) || 0);
  const [data, setData] = useState<UserPage>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState(q);

  useEffect(() => { setSearch(q); }, [q]);
  useEffect(() => {
    if (salonId) return;
    const controller = new AbortController();
    apiFetch<{ id: string; name: string }[]>(`${SUPER_ADMIN_API}/salons`, { signal: controller.signal })
      .then(setSalons).catch(() => { if (!controller.signal.aborted) setSalonError(true); });
    return () => controller.abort();
  }, [salonId]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    const query = new URLSearchParams({ q, role, status, page: String(page), size: "25" });
    if (selectedSalon) query.set("salonId", selectedSalon);
    apiFetch<UserPage>(`${SUPER_ADMIN_API}/users?${query}`, { signal: controller.signal })
      .then(setData).catch((e) => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [q, role, status, page, selectedSalon, refresh]);

  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  }

  return <section className="space-y-5">
    <div><h1 className="text-xl font-bold text-stone-900">{t(customers ? "Customers" : "Users")}</h1>
      <p className="mt-1 text-xs text-stone-500">{t(customers ? "Browse customers and their salon access." : "Browse users, roles and salon access.")}</p></div>
    <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); update("q", search.trim()); }}>
      <div className="relative min-w-0 flex-1 basis-60"><Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-stone-400" aria-hidden="true" /><input type="search" aria-label={t(customers ? "Search customers" : "Search users")} placeholder={t("Search by email, customer name or phone")} className={`${fieldClass} w-full border-stone-200 pl-9 placeholder:text-stone-400`} value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <button className={buttonClass} type="submit">{t("Search")}</button>
      {!salonId && <select className={`${fieldClass} max-w-full`} aria-label={t("Salon")} value={selectedSalon ?? ""} onChange={(e) => update("salonId", e.target.value)}>
        <option value="">{t("All salons")}</option>
        {salonError && <option disabled>{t("Salon list unavailable")}</option>}
        {salons.map((salon) => <option key={salon.id} value={salon.id}>{salon.name}</option>)}
      </select>}
      {!customers && <select className={fieldClass} aria-label={t("Role")} value={role} onChange={(e) => update("role", e.target.value)}>
        <option value="">{t("All roles")}</option>{["SUPER_ADMIN", "OWNER", "STAFF", "CUSTOMER"].map((value) => <option key={value} value={value}>{roleLabels[value] ?? value}</option>)}
      </select>}
      <div role="group" aria-label={t("Access status")} className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white p-1">
        {[["ALL", "All"], ["ACTIVE", "Active access"], ["INACTIVE", "No active access"]].map(([value, label]) => <button key={value} type="button" aria-pressed={status === value} onClick={() => update("status", value)}
          className={`min-h-8 rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-matcha-600 ${status === value ? "bg-matcha-600 text-white" : "text-stone-500 hover:bg-stone-50 hover:text-stone-800"}`}>
          {t(label)}
        </button>)}
      </div>
    </form>
    {loading ? <p role="status">{t("Loading…")}</p> : error ? <div role="alert" className="space-y-3 text-red-700"><p>{error}</p><button className={buttonClass} onClick={() => setRefresh((v) => v + 1)}>{t("Retry")}</button></div> : <>
      {!data?.content.length ? <p className="rounded-xl border border-stone-200 bg-white p-6 text-stone-500">{t("No matching users found.")}</p> : <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        <table className="w-full table-fixed text-left text-sm">
          <caption className="sr-only">{t(customers ? "Customers" : "Users")}</caption>
          <thead className="border-b border-stone-200 text-[10px] font-bold uppercase tracking-widest text-stone-400">
            <tr>
              <th scope="col" className="px-4 py-3">{t(customers ? "Customer" : "User")}</th>
              <th scope="col" className="hidden w-[25%] px-4 py-3 sm:table-cell">{t("Role")}</th>
              <th scope="col" className="hidden w-24 px-4 py-3 sm:table-cell">{t("Salons")}</th>
              <th scope="col" className="w-28 px-2 py-3 sm:w-40 sm:px-4">{t("Access")}</th>
              <th scope="col" className="w-8"><span className="sr-only">{t("Details")}</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {data.content.map((user) => {
              const detailUrl = `/users/detail?${new URLSearchParams({ email: user.email, ...(selectedSalon ? { salonId: selectedSalon } : {}) })}`;
              const name = user.name || user.email;
              return <tr key={user.email} className="group relative transition-colors hover:bg-stone-50 focus-within:bg-stone-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div aria-hidden="true" className="hidden size-8 shrink-0 items-center justify-center rounded-lg border border-matcha-200 bg-matcha-50 text-xs font-bold text-matcha-600 sm:flex">
                      {name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <Link to={detailUrl} className="break-words font-semibold text-stone-800 focus-visible:outline-2 focus-visible:outline-matcha-600 after:absolute after:inset-0" aria-label={`${t("View details")}: ${name}`}>
                        {name}
                      </Link>
                      {name !== user.email && <p className="break-all font-mono text-[11px] text-stone-500">{user.email}</p>}
                      <div className="mt-1.5 space-y-1 sm:hidden"><RolePills roles={user.roles} /><p className="text-[11px] text-stone-500">{t("Salons")}: {user.salonCount}</p></div>
                    </div>
                  </div>
                </td>
                <td className="hidden px-4 py-3 sm:table-cell"><RolePills roles={user.roles} /></td>
                <td className="hidden px-4 py-3 text-xs text-stone-600 sm:table-cell">{user.salonCount}</td>
                <td className="px-2 py-3 sm:px-4">
                  <span className={`inline-block rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${user.hasAccess ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-stone-200 bg-stone-50 text-stone-500"}`}>
                    {t(user.hasAccess ? "Active access" : "No active access")}
                  </span>
                </td>
                <td className="pr-3"><ChevronRight className="size-4 text-stone-400 group-hover:text-matcha-600" aria-hidden="true" /></td>
              </tr>;
            })}
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
