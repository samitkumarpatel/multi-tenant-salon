/**
 * Booking route: /:saloonId/book  (no auth required, works with UUID or handler)
 * Thin wrapper around the shared BookingWizard component.
 * Deep-link: /book?serviceId=5 preselects the service; ?staffId=2 preselects the stylist.
 */

import { useLoaderData, useNavigate, useParams, useSearchParams } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { CUSTOMER_API, COUNTRIES_API, apiFetch } from "~/lib/api";
import { DEFAULT_THEME, BookingWizard } from "@saloon/ui-website";
import type { Saloon, ServiceItem, StaffMember, WebsiteTheme, Country } from "~/lib/types";

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const id = params.saloonId!;
  // single endpoint handles both UUID and handler
  const saloon = await apiFetch<Saloon>(`${CUSTOMER_API}/${id}`);
  const [services, staff, theme, countries] = await Promise.all([
    apiFetch<ServiceItem[]>(`${CUSTOMER_API}/${saloon.id}/services`).catch((): ServiceItem[] => []),
    apiFetch<StaffMember[]>(`${CUSTOMER_API}/${saloon.id}/staff`).catch((): StaffMember[] => []),
    apiFetch<WebsiteTheme>(`${CUSTOMER_API}/${saloon.id}/website`).catch((): WebsiteTheme => DEFAULT_THEME),
    apiFetch<Country[]>(COUNTRIES_API).catch((): Country[] => []),
  ]);
  return {
    saloon,
    services: services.filter((s) => s.active),
    staff: staff.filter((s) => s.status === "ACTIVE"),
    theme,
    countries,
  };
}

export default function BookRoute() {
  const { saloon, services, staff, theme: loaderTheme, countries } = useLoaderData<typeof clientLoader>();
  const theme = { ...DEFAULT_THEME, ...(loaderTheme ?? {}) };
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const serviceId = Number(searchParams.get("serviceId"));
  const staffId = Number(searchParams.get("staffId"));

  return (
    <BookingWizard
      saloon={saloon}
      services={services}
      staff={staff}
      theme={theme}
      countries={countries}
      initialServiceId={Number.isFinite(serviceId) && serviceId > 0 ? serviceId : null}
      initialStaffId={Number.isFinite(staffId) && staffId > 0 ? staffId : null}
      onExit={() => navigate(`/${params.saloonId}/c`)}
    />
  );
}
