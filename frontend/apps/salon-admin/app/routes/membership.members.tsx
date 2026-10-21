import { useI18n } from "@salon/i18n";
import { useMemo } from "react";
import { Link, useLoaderData, useOutletContext, useSearchParams } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { ChevronRight, Download, Search, Users, X } from "lucide-react";
import { ADMIN_API, apiFetch, resolveSalonUUID } from "~/lib/api";
import { MEMBERSHIP_STATUS_LABEL, fmtDate, planPrice } from "~/lib/membership";
import { MembershipStatusBadge, renewalLine } from "~/components/MembershipStatusBadge";
import { formatPrice } from "~/lib/constants";
import type { MembershipPlan, MembershipStatus, MembershipSubscription } from "~/lib/types";
import type { MembershipOutletContext } from "./membership";

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const sid = await resolveSalonUUID(params.salonId!);
  // Filtering happens client-side: a salon's member list is small, and status counts need the full set.
  const [members, plans] = await Promise.all([
    apiFetch<MembershipSubscription[]>(`${ADMIN_API}/${sid}/membership/subscriptions`),
    apiFetch<MembershipPlan[]>(`${ADMIN_API}/${sid}/membership/plans`),
  ]);
  return { members, plans };
}

const STATUSES: MembershipStatus[] = ["ACTIVE", "EXPIRED", "PENDING_PAYMENT", "CANCELLED", "INCOMPLETE"];
const controlCls =
  "px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-700 outline-none focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10";

function csvCell(value: unknown) {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function MembershipMembers() {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const { salon } = useOutletContext<MembershipOutletContext>();
  const { members, plans } = useLoaderData<typeof clientLoader>();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const status = params.get("status") as MembershipStatus | null;
  const planId = params.get("planId") ? Number(params.get("planId")) : null;

  function update(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) v ? next.set(k, v) : next.delete(k);
    setParams(next, { replace: true });
  }

  const inPlan = useMemo(() => members.filter((m) => planId == null || m.planId === planId), [members, planId]);
  const counts = useMemo(() => {
    const c: Partial<Record<MembershipStatus, number>> = {};
    inPlan.forEach((m) => { c[m.status] = (c[m.status] ?? 0) + 1; });
    return c;
  }, [inPlan]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const code = needle.toUpperCase().replace(/[^A-Z0-9]/g, "");
    return inPlan.filter((m) => (!status || m.status === status)
      && (!needle || m.customerName.toLowerCase().includes(needle) || m.customerEmail.toLowerCase().includes(needle)
        || (code.length > 0 && m.memberCode.includes(code))));
  }, [inPlan, status, q]);

  function exportCsv() {
    const header = ["Member code", "Name", "Email", "Phone", "Plan", "Status", "Price", "Currency", "Billing", "Member since",
      "Paid through", "Cancels at period end", "Last payment", "Last payment at", "Last payment amount"];
    const rows = shown.map((m) => [m.memberCode, m.customerName, m.customerEmail, m.customerPhone, m.planName, m.status, m.price,
      m.currency, m.billingInterval, m.startedAt, m.currentPeriodEnd, m.cancelAtPeriodEnd, m.lastPaymentStatus, m.lastPaymentAt,
      m.lastPaymentAmount]);
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${salon.handler ?? "salon"}-members-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (members.length === 0) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
        <div className="w-10 h-10 rounded-xl bg-matcha-50 border border-matcha-100 flex items-center justify-center mx-auto mb-3">
          <Users className="w-5 h-5 text-matcha-600" />
        </div>
        <h2 className="text-sm font-bold text-slate-800">{translateUi("No members yet")}</h2>
        <p className="text-xs text-slate-500 mt-1">
          {translateUi("Members appear here as soon as a customer starts checkout on your website's Membership page.")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className={`${controlCls} w-full pl-8`} placeholder={translateUi("Search name, email or member code")}
            value={q} onChange={(e) => update({ q: e.target.value || null })} />
        </div>
        <select className={controlCls} value={planId ?? ""} onChange={(e) => update({ planId: e.target.value || null })}>
          <option value="">{translateUi("All plans")}</option>
          {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {(q || status || planId) && (
          <button className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
            onClick={() => setParams(new URLSearchParams(), { replace: true })}>
            <X className="w-3.5 h-3.5" /> {translateUi("Clear")}
          </button>
        )}
        <button className={`${controlCls} ml-auto inline-flex items-center gap-1.5 cursor-pointer hover:bg-slate-50`} onClick={exportCsv}>
          <Download className="w-3.5 h-3.5" /> {translateUi("Export CSV")}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <StatusChip active={!status} label={translateUi("All")} count={inPlan.length} onClick={() => update({ status: null })} />
        {STATUSES.filter((s) => counts[s]).map((s) => (
          <StatusChip key={s} active={status === s} label={translateUi(MEMBERSHIP_STATUS_LABEL[s])} count={counts[s] ?? 0}
            onClick={() => update({ status: s })} />
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="hidden md:grid grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_auto_minmax(0,1.2fr)_minmax(0,1fr)_16px] gap-4 px-4 py-2 bg-slate-50 border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          <span>{translateUi("Member")}</span><span>{translateUi("Plan")}</span><span>{translateUi("Status")}</span>
          <span>{translateUi("Last payment")}</span><span>{translateUi("Paid through")}</span><span />
        </div>
        {shown.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-slate-400">{translateUi("No members match these filters.")}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {shown.map((m) => (
              <li key={m.id}>
                <Link to={String(m.id)} className="grid grid-cols-[1fr_auto] md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_auto_minmax(0,1.2fr)_minmax(0,1fr)_16px] gap-x-4 gap-y-1 items-center px-4 py-3 hover:bg-slate-50 no-underline">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-900 truncate">{m.customerName}</span>
                    <span className="block text-xs text-slate-400 truncate">{m.customerEmail} · <span className="font-mono">{m.memberCode}</span></span>
                  </span>
                  <span className="md:hidden justify-self-end"><MembershipStatusBadge status={m.status} /></span>
                  <span className="min-w-0 text-xs text-slate-600">
                    <span className="block truncate font-medium text-slate-700">{m.planName}</span>
                    <span className="block truncate text-slate-400">{planPrice(m.price, m.currency, m.billingInterval, uiLocale)}</span>
                  </span>
                  <span className="hidden md:block"><MembershipStatusBadge status={m.status} /></span>
                  <span className="text-xs">
                    {m.lastPaymentStatus ? (
                      <>
                        <span className={m.lastPaymentStatus === "PAID" ? "text-green-700 font-medium" : "text-red-600 font-medium"}>
                          {m.lastPaymentStatus === "PAID" ? translateUi("Paid") : translateUi("Failed")}
                          {m.lastPaymentAmount != null && ` ${formatPrice(m.lastPaymentAmount, m.currency, uiLocale)}`}
                        </span>
                        <span className="block text-slate-400">{fmtDate(m.lastPaymentAt, uiLocale)}</span>
                      </>
                    ) : <span className="text-slate-400">{translateUi("No payment yet")}</span>}
                  </span>
                  <span className="text-xs text-slate-600">{renewalLine(m, translateUi, uiLocale)}</span>
                  <ChevronRight className="hidden md:block w-4 h-4 text-slate-300" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatusChip({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer ${
        active ? "bg-matcha-600 text-white border-matcha-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
      }`}>
      {label} <span className={`tabular-nums ${active ? "text-white/80" : "text-slate-400"}`}>{count}</span>
    </button>
  );
}
