import { useEffect, useState } from "react";
import { NavLink, Outlet, useOutletContext, useParams } from "react-router";
import { Boxes, ClipboardList, Layers, Package, Tag, RefreshCcw } from "lucide-react";
import { InfoBar } from "@salon/ui-shared";
import { ADMIN_API, apiFetch, resolveSalonUUID } from "~/lib/api";
import type { LayoutContext, Salon, ShopOrder } from "~/lib/types";

export interface ShopOutletContext {
  salon: Salon;
}

const PENDING_STATUSES = new Set(["NEW"]);

export default function Shop() {
  const { salon } = useOutletContext<LayoutContext>();
  const { salonId } = useParams<{ salonId: string }>();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!salonId) return;
    resolveSalonUUID(salonId).then((uuid) =>
      apiFetch<ShopOrder[]>(`${ADMIN_API}/${uuid}/shop/orders`)
        .then((orders) => setPendingCount(orders.filter((o) => PENDING_STATUSES.has(o.status)).length))
        .catch(() => {})
    );
  }, [salonId]);

  const tabCls = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
      isActive
        ? "bg-matcha-600 text-white border-matcha-600"
        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
    }`;

  const TABS = [
    { to: "", label: "Products", icon: Package, end: true, badge: 0 },
    { to: "brands", label: "Brands", icon: Tag, end: false, badge: 0 },
    { to: "categories", label: "Categories", icon: Layers, end: false, badge: 0 },
    { to: "inventory", label: "Inventory", icon: Boxes, end: false, badge: 0 },
    { to: "orders", label: "Orders", icon: ClipboardList, end: false, badge: pendingCount },
    { to: "refunds", label: "Refunds", icon: RefreshCcw, end: false, badge: 0 },
  ];

  return (
    <div>
      <div className="mb-5 space-y-2">
        <h1 className="text-xl font-bold text-slate-900">Web Shop</h1>
        <InfoBar id="shop">
          Manage your product catalogue, keep stock up to date, and work through customer orders.
          Shoppers see active products on your public website's Shop page.
        </InfoBar>
      </div>

      <nav className="flex flex-wrap gap-2 mb-6">
        {TABS.map((t) => (
          <NavLink key={t.to || "index"} to={t.to} end={t.end} className={tabCls}>
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.badge > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-red-500 text-white">
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
