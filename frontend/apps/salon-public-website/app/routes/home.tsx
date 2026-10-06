import { useOutletContext, useLocation, useNavigate } from "react-router";
import { useI18n } from "@salon/i18n";
import { ArrowUp } from "lucide-react";
import { SalonWebsite, GenerativeUIWebsite, BookingWizard, ShopView, SalonPolicyLinks } from "@salon/ui-website";
import type { TenantData } from "./website-shell";

export default function PublicWebsitePage() {
  const data = useOutletContext<TenantData | undefined>();
  const location = useLocation();
  const navigate = useNavigate();
  const { t: translateUi } = useI18n();

  if (!data) return null;

  const activePage = location.pathname.slice(1) || undefined;
  const search = location.search;

  if (data.theme.websiteType === "GENERATIVE_UI") {
    const { theme } = data;

    // When the visitor navigates to /book, show the wizard (same UX as a regular website)
    if (activePage === "book" && data.salon.features?.includes("BOOKING")) {
      return (
        <BookingWizard
          salon={data.salon}
          staff={data.staff}
          services={data.services}
          theme={theme}
          policies={data.bookingPolicies}
          onExit={() => navigate(`/${search}`)}
          getPagePath={(page) => `/${page}${search}`}
        />
      );
    }

    // Same for /shop — the full storefront, themed to match the site
    if (activePage === "shop" && data.salon.features?.includes("WEBSHOP")) {
      return (
        <ShopView
          salon={data.salon}
          theme={theme}
          policies={data.websitePolicies}
          getPagePath={(page) => `/${page}${search}`}
          onNavigate={(page) => navigate(page ? `/${page}${search}` : `/${search}`)}
        />
      );
    }

    return (
      <div
        className="flex min-h-[100dvh] flex-col sm:items-center sm:justify-center sm:p-6"
        style={{
          background: `radial-gradient(ellipse 110% 60% at 50% 0%, ${theme.accentColor}20 0%, transparent 55%), radial-gradient(ellipse 60% 40% at 80% 110%, ${theme.accentColor}0c 0%, transparent 50%), ${theme.heroBg ?? "#EEF2F4"}`,
        }}
      >
        <div className="w-full sm:max-w-[700px] lg:max-w-[1080px] h-[100dvh] sm:h-[calc(100dvh-48px)] sm:rounded-2xl sm:overflow-hidden sm:shadow-2xl">
          <GenerativeUIWebsite
            salon={data.salon}
            staff={data.staff}
            services={data.services}
            theme={data.theme}
            getPagePath={(page) => `/${page}${search}`}
            onNavigate={(page) => navigate(page ? `/${page}${search}` : `/${search}`)}
          />
        </div>
        <footer className="w-full px-5 py-4 sm:max-w-[700px] lg:max-w-[1080px] sm:mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-slate-500">© {new Date().getFullYear()} {data.salon.name}</p>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-x-5 gap-y-3">
              <SalonPolicyLinks policies={data.websitePolicies} color="#64748B" salonName={data.salon.name} />
              <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:opacity-75">
                {translateUi("Back to top ")}<ArrowUp className="h-3 w-3" />
              </button>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <SalonWebsite
      salon={data.salon}
      staff={data.staff}
      services={data.services}
      theme={data.theme}
      websitePolicies={data.websitePolicies}
      bookingPolicies={data.bookingPolicies}
      activePage={activePage}
      getPagePath={(page) => `/${page}${search}`}
      onNavigate={(page) => navigate(page ? `/${page}${search}` : `/${search}`)}
    />
  );
}
