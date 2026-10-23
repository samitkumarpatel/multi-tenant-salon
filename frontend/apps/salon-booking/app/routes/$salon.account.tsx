import { useEffect } from "react";
import { useLoaderData, useNavigate, useParams } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import type { SalonLanguages, LanguagePolicy } from "@salon/i18n";
import {
  CustomerAccountView, DEFAULT_THEME, SalonErrorPage, apiFetch, API_BASE, hasCustomerAccount,
} from "@salon/ui-website";
import type { AccountPage, Salon, SalonPolicy, WebsiteTheme } from "@salon/ui-website";

const SALON_DOMAIN = import.meta.env.VITE_SALON_DOMAIN || "salonsaas.org";

type LoaderData =
  | { status: "ok"; salon: Salon; theme: WebsiteTheme; policies: SalonPolicy[]; languagePolicy: LanguagePolicy; languageScope: string }
  | { status: "not_found" }
  | { status: "error" };

export async function clientLoader({ params }: ClientLoaderFunctionArgs): Promise<LoaderData> {
  try {
    const salon = await apiFetch<Salon>(`${API_BASE}/api/salon/${params.salon!}`);
    if (salon.status === "DISABLED" || !hasCustomerAccount(salon)) return { status: "not_found" };
    const [theme, languages, policies] = await Promise.all([
      apiFetch<WebsiteTheme>(`${API_BASE}/api/salon/${salon.id}/website`).catch((): WebsiteTheme => DEFAULT_THEME),
      apiFetch<SalonLanguages>(`${API_BASE}/api/salon/${salon.id}/languages`),
      apiFetch<SalonPolicy[]>(`${API_BASE}/api/salon/${salon.id}/policies?placement=booking`).catch((): SalonPolicy[] => []),
    ]);
    return {
      status: "ok", salon, theme: { ...DEFAULT_THEME, ...theme }, policies,
      languagePolicy: languages.booking, languageScope: String(salon.id),
    };
  } catch (err) {
    const is404 = err instanceof Error && /HTTP 404|not found/i.test(err.message);
    return { status: is404 ? "not_found" : "error" };
  }
}

/** The salon's website, when it has one — the shop and membership pages (and renewals) live there. */
function websiteUrl(salon: Salon): string | null {
  return salon.features?.includes("STATIC_WEBSITE") && salon.handler ? `https://${salon.handler}.${SALON_DOMAIN}` : null;
}

export default function SalonAccountRoute() {
  const data = useLoaderData<typeof clientLoader>();
  const navigate = useNavigate();
  const { salon: handle } = useParams();

  useEffect(() => {
    if (data.status === "ok") document.title = `My account · ${data.salon.name}`;
  }, [data]);

  if (data.status === "not_found") return <SalonErrorPage is404 />;
  if (data.status === "error") return <SalonErrorPage is404={false} />;

  const { salon, theme, policies } = data;
  const site = websiteUrl(salon);
  const features = salon.features ?? [];
  const pageHref = (page: AccountPage): string | null => {
    if (page === "book") return features.includes("BOOKING") ? `/${handle}` : null;
    const feature = page === "shop" ? "WEBSHOP" : "MEMBERSHIP";
    return site && features.includes(feature) ? `${site}/${page}` : null;
  };

  return (
    <CustomerAccountView
      salon={salon}
      theme={theme}
      policies={policies}
      standalone
      onBack={() => navigate(`/${handle}`)}
      pageHref={pageHref}
      onNavigate={(page) => {
        const href = pageHref(page);
        if (!href) return;
        if (href.startsWith("/")) navigate(href); else window.location.assign(href);
      }}
      renewHref={(token) => (site && features.includes("MEMBERSHIP") ? `${site}/membership?renew=${encodeURIComponent(token)}` : null)}
    />
  );
}
