import { useEffect } from "react";
import { Outlet, useLoaderData } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { SalonErrorPage, SalonDisabledPage, DEFAULT_THEME, apiFetch, API_BASE } from "@salon/ui-website";
import type { Salon, StaffMember, ServiceItem, WebsiteTheme } from "@salon/ui-website";
import { AnalyticsTracker } from "../components/AnalyticsTracker";

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

function slugFromRequest(request: Request): string | null {
  const url = new URL(request.url);
  const hostname = url.hostname;

  // Local dev: hostname is localhost or 127.0.0.1 — use slug query param
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return url.searchParams.get("slug");
  }

  // Production: if the hostname ends with the configured domain, extract the subdomain
  if (hostname.endsWith(`.${SALON_DOMAIN}`)) {
    return hostname.slice(0, -(SALON_DOMAIN.length + 1)) || null;
  }

  // Fallback for any other real domain: if there is a subdomain (3+ labels, e.g. btw.salonsaas.org),
  // treat the first label as the slug so subdomain routing works regardless of VITE_SALON_DOMAIN
  const parts = hostname.split(".");
  if (parts.length > 2) {
    return parts[0] || null;
  }

  return url.searchParams.get("slug");
}

export type TenantData = {
  salon: Salon;
  staff: StaffMember[];
  services: ServiceItem[];
  theme: WebsiteTheme;
};

type LoaderData =
  | ({ status: "ok" } & TenantData)
  | { status: "disabled"; salonName?: string }
  | { status: "not_found" }
  | { status: "error" };

export async function clientLoader({ request }: ClientLoaderFunctionArgs): Promise<LoaderData> {
  const slug = slugFromRequest(request);
  if (!slug) return { status: "not_found" };

  try {
    const salon = await apiFetch<Salon>(`${API_BASE}/api/salon/${slug}`);
    if (salon.status === "DISABLED") {
      return { status: "disabled", salonName: salon.name };
    }
    const [staff, services, theme] = await Promise.all([
      apiFetch<StaffMember[]>(`${API_BASE}/api/salon/${salon.id}/staff`).catch((): StaffMember[] => []),
      apiFetch<ServiceItem[]>(`${API_BASE}/api/salon/${salon.id}/services`).catch((): ServiceItem[] => []),
      apiFetch<WebsiteTheme>(`${API_BASE}/api/salon/${salon.id}/website`).catch((): WebsiteTheme => DEFAULT_THEME),
    ]);
    const resolvedTheme = { ...DEFAULT_THEME, ...theme };
    if (!salon.features?.includes("STATIC_WEBSITE")) {
      return { status: "disabled", salonName: salon.name };
    }
    return { status: "ok", salon, staff, services, theme: resolvedTheme };
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
