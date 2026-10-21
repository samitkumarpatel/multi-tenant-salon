import { useI18n } from "@salon/i18n";
import type { ElementType } from "react";
import { Link, useLoaderData, useOutletContext } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { AlertTriangle, CalendarClock, History, Plus, Repeat, Ticket, TrendingUp, UserMinus, UserPlus, Users, Wallet } from "lucide-react";
import { ADMIN_API, apiFetch, resolveSalonUUID } from "~/lib/api";
import { PLAN_STATUS_LABEL, PLAN_STATUS_STYLE, fmtDate, fmtDateTime, moneyList, planPrice } from "~/lib/membership";
import { formatPrice } from "~/lib/constants";
import type { MembershipOverview } from "~/lib/types";
import type { MembershipOutletContext } from "./membership";

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const sid = await resolveSalonUUID(params.salonId!);
  const overview = await apiFetch<MembershipOverview>(`${ADMIN_API}/${sid}/membership/overview`);
  return { overview };
}

export default function MembershipOverviewPage() {
  const { t: translateUi, locale: uiLocale } = useI18n();
  useOutletContext<MembershipOutletContext>();
  const { overview: o } = useLoaderData<typeof clientLoader>();
  const currency = o.plans[0]?.monthlyRecurringRevenue.currency ?? "EUR";

  if (o.plans.length === 0) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
        <div className="w-10 h-10 rounded-xl bg-matcha-50 border border-matcha-100 flex items-center justify-center mx-auto mb-3">
          <Ticket className="w-5 h-5 text-matcha-600" />
        </div>
        <h2 className="text-sm font-bold text-slate-800">{translateUi("No membership plans yet")}</h2>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          {translateUi("Create a plan, put it on sale, and turn on Memberships under Payments so customers can join from your website.")}
        </p>
        <Link to="plans" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-matcha-600 text-white text-sm font-medium hover:bg-matcha-700 no-underline">
          <Plus className="w-4 h-4" /> {translateUi("Create a plan")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile icon={Users} label="Active members" value={o.activeMembers.toLocaleString(uiLocale)} />
        <Tile icon={TrendingUp} label="Monthly recurring revenue" value={moneyList(o.monthlyRecurringRevenue, currency, uiLocale)} />
        <Tile icon={Wallet} label="Collected this month" value={moneyList(o.collectedThisMonth, currency, uiLocale)} />
        <Tile icon={AlertTriangle} label="Expired — not renewed" value={o.expiredMembers.toLocaleString(uiLocale)} warn={o.expiredMembers > 0}
          to={o.expiredMembers > 0 ? "members?status=EXPIRED" : undefined} />
        <Tile icon={UserPlus} label="New this month" value={o.newThisMonth.toLocaleString(uiLocale)} />
        <Tile icon={UserMinus} label="Cancelled this month" value={o.cancelledThisMonth.toLocaleString(uiLocale)} />
        <Tile icon={Repeat} label="Renewals due in 7 days" value={o.renewalsNext7Days.toLocaleString(uiLocale)} />
        <Tile icon={CalendarClock} label="Renewals due in 30 days" value={o.renewalsNext30Days.toLocaleString(uiLocale)} />
      </div>
      {o.pendingCheckouts > 0 && (
        <p className="text-xs text-slate-500">
          {translateUi("{count} checkout(s) waiting for payment — unpaid ones stop holding a place after an hour.", { count: o.pendingCheckouts })}
        </p>
      )}

      <section className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <Header icon={Ticket} title="Plans" />
        <div className="divide-y divide-slate-100">
          {o.plans.map((p) => {
            const fill = p.maxMembers ? Math.min(100, Math.round((p.activeMembers / p.maxMembers) * 100)) : null;
            return (
              <Link key={p.planId} to={`members?planId=${p.planId}`} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 no-underline">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 truncate">{p.name}</span>
                    <span className={`text-[0.6rem] font-semibold px-1.5 py-0.5 rounded-full border ${PLAN_STATUS_STYLE[p.status]}`}>
                      {translateUi(PLAN_STATUS_LABEL[p.status])}
                    </span>
                  </div>
                  {fill !== null && (
                    <div className="mt-1.5 flex items-center gap-2 max-w-xs">
                      <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-full rounded-full ${fill >= 100 ? "bg-amber-500" : "bg-matcha-500"}`} style={{ width: `${fill}%` }} />
                      </div>
                      <span className="text-[11px] text-slate-400 tabular-nums">{p.activeMembers}/{p.maxMembers}</span>
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-slate-900 tabular-nums">
                    {p.activeMembers.toLocaleString(uiLocale)} <span className="text-xs font-normal text-slate-400">{translateUi("members")}</span>
                  </p>
                  <p className="text-xs text-slate-500 tabular-nums">
                    {formatPrice(p.monthlyRecurringRevenue.amount, p.monthlyRecurringRevenue.currency, uiLocale)} {translateUi("/ month")}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-5">
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <Header icon={CalendarClock} title="Renewals coming up" />
          {o.upcomingRenewals.length === 0 ? (
            <p className="px-5 py-6 text-xs text-slate-400 text-center">{translateUi("No renewals coming up.")}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {o.upcomingRenewals.map((s) => (
                <li key={s.id}>
                  <Link to={`members/${s.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-slate-50 no-underline">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-800 truncate">{s.customerName}</span>
                      <span className="block text-xs text-slate-400 truncate">{s.planName} · {planPrice(s.price, s.currency, s.billingInterval, uiLocale)}</span>
                    </span>
                    <span className="text-xs font-medium text-slate-600 shrink-0">{fmtDate(s.currentPeriodEnd, uiLocale)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <Header icon={History} title="Recent activity" />
          {o.recentActivity.length === 0 ? (
            <p className="px-5 py-6 text-xs text-slate-400 text-center">{translateUi("Nothing yet — activity appears as customers join.")}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {o.recentActivity.map((a) => (
                <li key={a.id}>
                  <Link to={`members/${a.subscriptionId}`} className="block px-5 py-2.5 hover:bg-slate-50 no-underline">
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-slate-800 truncate">{a.customerName}</span>
                      <span className="text-[11px] text-slate-400 shrink-0">{fmtDateTime(a.createdAt, uiLocale)}</span>
                    </span>
                    <span className="block text-xs text-slate-500 truncate">{a.message}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Tile({ icon: Icon, label, value, warn, to }: { icon: ElementType; label: string; value: string; warn?: boolean; to?: string }) {
  const { t: translateUi } = useI18n();
  const body = (
    <>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${warn ? "bg-amber-50" : "bg-matcha-50"}`}>
        <Icon className={`w-4 h-4 ${warn ? "text-amber-600" : "text-matcha-600"}`} />
      </div>
      <p className="text-xl font-bold text-slate-900 tabular-nums break-words">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{translateUi(label)}</p>
    </>
  );
  const cls = `block bg-white rounded-xl p-4 border shadow-sm ${warn ? "border-amber-200" : "border-slate-200"}`;
  return to ? <Link to={to} className={`${cls} no-underline hover:bg-slate-50`}>{body}</Link> : <div className={cls}>{body}</div>;
}

function Header({ icon: Icon, title }: { icon: ElementType; title: string }) {
  const { t: translateUi } = useI18n();
  return (
    <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
      <Icon className="w-3.5 h-3.5 text-slate-400" />
      <h2 className="text-sm font-semibold text-slate-800">{translateUi(title)}</h2>
    </div>
  );
}
