import { useEffect } from "react";
import { Outlet, useLoaderData, useLocation } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { SalonErrorPage, SalonDisabledPage, DEFAULT_THEME, apiFetch, API_BASE } from "@salon/ui-website";
import type { Salon, StaffMember, ServiceItem, WebsiteTheme } from "@salon/ui-website";
import { AnalyticsTracker } from "../components/AnalyticsTracker";
import { tenantHost } from "../lib/tenant-host";

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function isLight(hex: string) {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const lin = (x: number) => x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) > 0.45;
}

function buildFaviconHref(name: string, bgColor: string): string {
  const fg = isLight(bgColor) ? "#0F172A" : "#FFFFFF";
  const text = initials(name);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='${bgColor}'/><text x='16' y='22' font-family='system-ui,sans-serif' font-size='13' font-weight='700' fill='${fg}' text-anchor='middle'>${text}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const SALON_DOMAIN = import.meta.env.VITE_SALON_DOMAIN || "salonsaas.org";

export type TenantData = {
  salon: Salon;
  staff: StaffMember[];
  services: ServiceItem[];
  theme: WebsiteTheme;
};

type LoaderData =
  | ({ status: "ok"; canonicalOrigin: string } & TenantData)
  | { status: "disabled"; salonName?: string }
  | { status: "not_found" }
  | { status: "error" };

export async function clientLoader({ request }: ClientLoaderFunctionArgs): Promise<LoaderData> {
  const { slug, customHostname } = tenantHost(new URL(request.url), SALON_DOMAIN);
  if (!slug && !customHostname) return { status: "not_found" };

  try {
    const resolution = customHostname ? await apiFetch<{ salonId: string }>(`${API_BASE}/api/salon/domain/resolve?hostname=${encodeURIComponent(customHostname)}`) : null;
    const salon = await apiFetch<Salon>(`${API_BASE}/api/salon/${resolution?.salonId ?? slug}`);
    if (salon.status === "DISABLED") {
      return { status: "disabled", salonName: salon.name };
    }
    const [staff, services, theme, preferredDomain, ratings] = await Promise.all([
      apiFetch<StaffMember[]>(`${API_BASE}/api/salon/${salon.id}/staff`).catch((): StaffMember[] => []),
      apiFetch<ServiceItem[]>(`${API_BASE}/api/salon/${salon.id}/services`).catch((): ServiceItem[] => []),
      apiFetch<WebsiteTheme>(`${API_BASE}/api/salon/${salon.id}/website`).catch((): WebsiteTheme => DEFAULT_THEME),
      apiFetch<{ hostname: string | null }>(`${API_BASE}/api/salon/${salon.id}/website/domain`).catch(() => null),
      apiFetch<{ salon: { average: number | null; count: number }; staff: Record<string, { average: number | null; count: number }> }>(`${API_BASE}/api/salon/${salon.id}/ratings`).catch(() => null),
    ]);
    const resolvedTheme = { ...DEFAULT_THEME, ...theme };
    if (!salon.features?.includes("STATIC_WEBSITE")) {
      return { status: "disabled", salonName: salon.name };
    }
    const canonicalOrigin = preferredDomain?.hostname ? `https://${preferredDomain.hostname}` : new URL(request.url).origin;
    const ratedStaff = staff.map((member) => ({ ...member, rating: ratings?.staff[String(member.id)]?.average ?? undefined, reviewCount: ratings?.staff[String(member.id)]?.count ?? 0 }));
    const ratedSalon = { ...salon, rating: ratings?.salon.average ?? undefined, ratingCount: ratings?.salon.count ?? 0 };
    return { status: "ok", salon: ratedSalon, staff: ratedStaff, services, theme: resolvedTheme, canonicalOrigin };
  } catch (err) {
    const is404 = err instanceof Error && /HTTP 404|not found/i.test(err.message);
    return { status: is404 ? "not_found" : "error" };
  }
}

// Prevent re-fetching when navigating between sub-pages within the same salon
export function shouldRevalidate({
  currentUrl,
  nextUrl,
}: {
  currentUrl: URL;
  nextUrl: URL;
}) {
  return (
    currentUrl.hostname !== nextUrl.hostname ||
    currentUrl.searchParams.get("slug") !== nextUrl.searchParams.get("slug")
  );
}

export default function WebsiteShell() {
  const data = useLoaderData<typeof clientLoader>();
  const location = useLocation();

  useEffect(() => {
    if (data.status !== "ok") return;
    const canonical = document.createElement("link");
    canonical.rel = "canonical";
    canonical.href = new URL(location.pathname, data.canonicalOrigin).href;
    document.head.appendChild(canonical);
    return () => canonical.remove();
  }, [data, location.pathname]);

  useEffect(() => {
    if (data.status === "ok") {
      document.title = data.salon.name;
      let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = buildFaviconHref(data.salon.name, data.theme.logoBgColor);
    }
  }, [data]);

  if (data.status === "disabled") return <SalonDisabledPage salonName={data.salonName} />;
  if (data.status === "not_found") return <SalonErrorPage is404 />;
  if (data.status === "error") return <SalonErrorPage is404={false} />;

  const { salon, staff, services, theme } = data;
  return (
    <>
      <AnalyticsTracker salonId={String(salon.id)} enabled={salon.features?.includes("ANALYTICS") ?? false} />
      <Outlet context={{ salon, staff, services, theme } satisfies TenantData} />
    </>
  );
}
