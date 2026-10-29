import { useI18n } from "@salon/i18n";
import { GuideLink } from "~/components/GuideLink";
import { Link, NavLink, Outlet, useLocation, useOutletContext, useParams } from "react-router";
import { ExternalLink } from "lucide-react";
import { InfoBar } from "@salon/ui-shared";
import { websiteUrl } from "~/lib/config";
import { shopNavigation } from "~/lib/shopNavigation";
import type { LayoutContext, Salon } from "~/lib/types";

export interface ShopOutletContext {
  salon: Salon;
}

export default function Shop() {
  const { t, locale } = useI18n();
  const { salon } = useOutletContext<LayoutContext>();
  const { salonId } = useParams<{ salonId: string }>();
  const location = useLocation();
  const current = shopNavigation(location.pathname);
  const guide = ["returns", "refunds", "credit-notes"].includes(current?.page ?? "") ? "shop/refunds-returns-and-credit-notes"
    : current?.section === "orders" ? "shop/orders-and-fulfillment"
    : current?.section === "inventory" ? "shop/inventory" : "shop/setting-up-your-shop";
  const storefront = salon.handler ? new URL(websiteUrl(salon.handler)) : null;
  if (storefront) { storefront.pathname = "/shop"; storefront.searchParams.set("lang", locale); }
  return <div>
    <div className="mb-5 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <nav aria-label={t("Breadcrumb")} className="flex items-center gap-2">
            <Link to={`/${salonId}/shop/orders`} className="text-sm font-medium text-slate-500 hover:underline">{t("Shop")}</Link>
            <span aria-hidden="true" className="text-slate-300">/</span>
            <h1 className="text-xl font-bold text-slate-900">{t(current?.label ?? "Shop")}</h1>
          </nav>
          <GuideLink path={guide} />
        </div>
        {salon.features?.includes("STATIC_WEBSITE") && storefront && <a href={storefront.href} target="_blank" rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-matcha-700 hover:underline">
          {t("View webshop")}<ExternalLink aria-hidden="true" className="size-3.5" />
        </a>}
      </div>
      <InfoBar id="shop">{t("Manage your product catalogue, keep stock up to date, and work through customer orders. Shoppers see active products on your public website's Shop page. ")}</InfoBar>
    </div>
    {!!current?.tabs.length && <nav aria-label={t(current.section === "products" ? "Product navigation" : "Order navigation")}
      className="mb-6 flex flex-wrap gap-2">
      {current.tabs.map((tab) => <NavLink key={tab.key} to={`/${salonId}/shop/${tab.key}`}
        className={({ isActive }) => `inline-flex min-h-11 items-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${isActive
          ? "border-matcha-600 bg-matcha-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
        {t(tab.label)}
      </NavLink>)}
    </nav>}
    <Outlet context={{ salon } satisfies ShopOutletContext} />
  </div>;
}
