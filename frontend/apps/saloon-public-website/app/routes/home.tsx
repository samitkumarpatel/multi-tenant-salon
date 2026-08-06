import { useOutletContext, useLocation, useNavigate } from "react-router";
import { SaloonWebsite, GenerativeUIWebsite, BookingWizard } from "@saloon/ui-website";
import type { TenantData } from "./website-shell";

export default function PublicWebsitePage() {
  const data = useOutletContext<TenantData | undefined>();
  const location = useLocation();
  const navigate = useNavigate();

  if (!data) return null;

  const activePage = location.pathname.slice(1) || undefined;
  const search = location.search;

  if (data.theme.websiteType === "GENERATIVE_UI") {
    const { theme } = data;

    // When the visitor navigates to /book, show the wizard (same UX as a regular website)
    if (activePage === "book" && data.saloon.features?.includes("BOOKING")) {
      return (
        <BookingWizard
          saloon={data.saloon}
          staff={data.staff}
          services={data.services}
          theme={theme}
          onExit={() => navigate(`/${search}`)}
          getPagePath={(page) => `/${page}${search}`}
        />
      );
    }

    return (
      <div
        className="flex min-h-[100dvh] sm:items-center sm:justify-center sm:p-6"
        style={{
          background: `radial-gradient(ellipse 110% 60% at 50% 0%, ${theme.accentColor}20 0%, transparent 55%), radial-gradient(ellipse 60% 40% at 80% 110%, ${theme.accentColor}0c 0%, transparent 50%), ${theme.heroBg ?? "#1E293B"}`,
        }}
      >
        <div className="w-full sm:max-w-[700px] h-[100dvh] sm:h-[calc(100dvh-48px)]">
          <GenerativeUIWebsite
            saloon={data.saloon}
            staff={data.staff}
            services={data.services}
            theme={data.theme}
            getPagePath={(page) => `/${page}${search}`}
            onNavigate={(page) => navigate(page ? `/${page}${search}` : `/${search}`)}
          />
        </div>
      </div>
    );
  }

  return (
    <SaloonWebsite
      saloon={data.saloon}
      staff={data.staff}
      services={data.services}
      theme={data.theme}
      activePage={activePage}
      getPagePath={(page) => `/${page}${search}`}
      onNavigate={(page) => navigate(page ? `/${page}${search}` : `/${search}`)}
    />
  );
}
