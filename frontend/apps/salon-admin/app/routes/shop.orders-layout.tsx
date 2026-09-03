import { useEffect, useState } from "react";
import { NavLink, Outlet, useOutletContext, useParams } from "react-router";
import { ClipboardList, RefreshCcw, Receipt } from "lucide-react";
import type { ShopOutletContext } from "./shop";
import type { LayoutContext, ShopRefund, ShopCreditNote } from "~/lib/types";
import { ADMIN_API, apiFetch, resolveSalonUUID } from "~/lib/api";

export default function ShopOrdersLayout() {
  const { salon } = useOutletContext<LayoutContext>();
  const { salonId } = useParams<{ salonId: string }>();
  const [refundBadge, setRefundBadge] = useState(0);
  const [cnBadge, setCnBadge] = useState(0);

  useEffect(() => {
    if (!salonId) return;
    resolveSalonUUID(salonId).then((uuid) => {
      apiFetch<ShopRefund[]>(`${ADMIN_API}/${uuid}/shop/refunds`)
        .then((r) => setRefundBadge(r.filter((x) => x.status === "PENDING").length))
        .catch(() => {});
      apiFetch<ShopCreditNote[]>(`${ADMIN_API}/${uuid}/shop/credit-notes`)
        .then((c) => setCnBadge(c.filter((x) => !x.status || x.status === "PENDING").length))
        .catch(() => {});
    });
  }, [salonId]);

  const SUB_TABS = [
    { to: "", label: "All Orders", icon: ClipboardList, end: true, badge: 0 },
    { to: "refunds", label: "Refunds", icon: RefreshCcw, end: false, badge: refundBadge },
    { to: "credit-notes", label: "Credit Notes", icon: Receipt, end: false, badge: cnBadge },
  ];

  const tabCls = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
      isActive
        ? "bg-slate-800 text-white border-slate-800"
        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
    }`;

  return (
    <div>
      <nav className="flex flex-wrap gap-2 mb-5">
        {SUB_TABS.map((t) => (
          <NavLink key={t.to || "index"} to={t.to} end={t.end} className={tabCls}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
            {t.badge > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-red-500 text-white">
                {t.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
      <Outlet context={{ salon } satisfies ShopOutletContext} />
    </div>
  );
}
