import { useI18n } from "@salon/i18n";
import { NavLink, Outlet, useOutletContext } from "react-router";
import { CreditCard, LayoutDashboard, ScanLine, Ticket, Users } from "lucide-react";
import { InfoBar } from "@salon/ui-shared";
import type { LayoutContext, Salon } from "~/lib/types";

export interface MembershipOutletContext {
  salon: Salon;
}

export default function Membership() {
  const { t: translateUi } = useI18n();
  const { salon } = useOutletContext<LayoutContext>();

  const tabCls = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
      isActive
        ? "bg-matcha-600 text-white border-matcha-600"
        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
    }`;

  const TABS = [
    { to: "", label: "Overview", icon: LayoutDashboard, end: true },
    { to: "plans", label: "Plans", icon: Ticket, end: false },
    { to: "members", label: "Members", icon: Users, end: false },
    { to: "check-in", label: "Check-in", icon: ScanLine, end: false },
    { to: "../payments", label: "Payments", icon: CreditCard, end: false },
  ];

  return (
    <div>
      <div className="mb-5 space-y-2">
        <h1 className="text-xl font-bold text-slate-900">{translateUi("Membership")}</h1>
        <InfoBar id="membership">
          {translateUi("Create membership plans, follow your members and their payments, and check members in with the QR code they receive by email. Plans on sale appear on your public website's Membership page. Customers pay each period by card through your Stripe account — like shop orders — and get an email with a renewal link before their membership ends.")}
        </InfoBar>
      </div>

      <nav className="flex flex-wrap gap-2 mb-6">
        {TABS.map((t) => (
          <NavLink key={t.to || "index"} to={t.to} end={t.end} className={tabCls}>
            <t.icon className="w-4 h-4" />
            {translateUi(t.label)}
          </NavLink>
        ))}
      </nav>

      <Outlet context={{ salon } satisfies MembershipOutletContext} />
    </div>
  );
}
