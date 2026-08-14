/**
 * Booking route: /:salonId/book  (no auth required, works with UUID or handler)
 * Thin wrapper around the shared BookingWizard component.
 * Deep-link: /book?serviceId=5 preselects the service; ?staffId=2 preselects the stylist.
 */

import { useLoaderData, useNavigate, useParams, useSearchParams } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { CUSTOMER_API, COUNTRIES_API, apiFetch } from "~/lib/api";
import { DEFAULT_THEME, BookingWizard } from "@salon/ui-website";
import type { Salon, ServiceItem, StaffMember, WebsiteTheme, Country } from "~/lib/types";

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const id = params.salonId!;
  // single endpoint handles both UUID and handler
  const salon = await apiFetch<Salon>(`${CUSTOMER_API}/${id}`);
  const [services, staff, theme, countries] = await Promise.all([
    apiFetch<ServiceItem[]>(`${CUSTOMER_API}/${salon.id}/services`).catch((): ServiceItem[] => []),
    apiFetch<StaffMember[]>(`${CUSTOMER_API}/${salon.id}/staff`).catch((): StaffMember[] => []),
    apiFetch<WebsiteTheme>(`${CUSTOMER_API}/${salon.id}/website`).catch((): WebsiteTheme => DEFAULT_THEME),
    apiFetch<Country[]>(COUNTRIES_API).catch((): Country[] => []),
  ]);
  return {
    salon,
    services: services.filter((s) => s.active),
    staff: staff.filter((s) => s.status === "ACTIVE"),
    theme,
    countries,
  };
}

export default function BookRoute() {
  const { salon, services, staff, theme: loaderTheme, countries } = useLoaderData<typeof clientLoader>();
  const theme = { ...DEFAULT_THEME, ...(loaderTheme ?? {}) };
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const serviceId = Number(searchParams.get("serviceId"));
  const staffId = Number(searchParams.get("staffId"));

  return (
    <BookingWizard
      salon={salon}
      services={services}
      staff={staff}
      theme={theme}
      countries={countries}
      initialServiceId={Number.isFinite(serviceId) && serviceId > 0 ? serviceId : null}
      initialStaffId={Number.isFinite(staffId) && staffId > 0 ? staffId : null}
      onExit={() => navigate(`/${params.salonId}/c`)}
    />
  );
}
