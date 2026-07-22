import { useOutletContext, useLocation, useNavigate } from "react-router";
import { SaloonWebsite } from "@saloon/ui-website";
import type { TenantData } from "./website-shell";

export default function PublicWebsitePage() {
  const data = useOutletContext<TenantData | undefined>();
  const location = useLocation();
  const navigate = useNavigate();

  if (!data) return null;

  const activePage = location.pathname.slice(1) || undefined;
  // Preserve ?slug= (used on localhost) so navigation doesn't break slug resolution
  const search = location.search;

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
