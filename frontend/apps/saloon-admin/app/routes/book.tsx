/**
 * Booking route: /:saloonId/book  (no auth required, works with UUID or handler)
 * Thin wrapper around the shared BookingWizard component.
 * Deep-link: /book?serviceId=5 preselects the service; ?staffId=2 preselects the stylist.
 */

import { useLoaderData, useNavigate, useParams, useSearchParams } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { API, HANDLER_API, apiFetch } from "~/lib/api";
import { DEFAULT_THEME, BookingWizard } from "@saloon/ui-website";
import type { Saloon, ServiceItem, StaffMember, WebsiteTheme } from "~/lib/types";

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const id = params.saloonId!;
  const saloon = await apiFetch<Saloon>(
    /^\d+$/.test(id) ? `${API}/${id}` : `${HANDLER_API}/${id}`
  );
  const [services, staff, theme] = await Promise.all([
    apiFetch<ServiceItem[]>(`${API}/${saloon.id}/services`).catch((): ServiceItem[] => []),
    apiFetch<StaffMember[]>(`${API}/${saloon.id}/staff`).catch((): StaffMember[] => []),
    apiFetch<WebsiteTheme>(`${API}/${saloon.id}/theme`).catch((): WebsiteTheme => DEFAULT_THEME),
  ]);
  return {
    saloon,
    services: services.filter((s) => s.active),
    staff: staff.filter((s) => s.status === "ACTIVE"),
    theme,
  };
}

export default function BookRoute() {
  const { saloon, services, staff, theme: loaderTheme } = useLoaderData<typeof clientLoader>();
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
      initialServiceId={Number.isFinite(serviceId) && serviceId > 0 ? serviceId : null}
      initialStaffId={Number.isFinite(staffId) && staffId > 0 ? staffId : null}
      onExit={() => navigate(`/${params.saloonId}/c`)}
    />
  );
}
