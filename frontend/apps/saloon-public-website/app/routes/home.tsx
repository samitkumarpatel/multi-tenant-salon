import { useOutletContext, useLocation, useNavigate } from "react-router";
import { SaloonWebsite, GenerativeUIWebsite } from "@saloon/ui-website";
import type { TenantData } from "./website-shell";

export default function PublicWebsitePage() {
  const data = useOutletContext<TenantData | undefined>();
  const location = useLocation();
  const navigate = useNavigate();

  if (!data) return null;

  const activePage = location.pathname.slice(1) || undefined;
  const search = location.search;

  if (data.theme.websiteType === "GENERATIVE_UI") {
    return (
      <div style={{ height: "100dvh", overflow: "hidden" }}>
        <GenerativeUIWebsite
          saloon={data.saloon}
          staff={data.staff}
          services={data.services}
          theme={data.theme}
          getPagePath={(page) => `/${page}${search}`}
          onNavigate={(page) => navigate(page ? `/${page}${search}` : `/${search}`)}
        />
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
