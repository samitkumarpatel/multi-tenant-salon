import { useEffect } from "react";
import { Outlet, useLoaderData } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { SalonErrorPage, SaloonDisabledPage, DEFAULT_THEME, apiFetch, API_BASE } from "@saloon/ui-website";
import type { Saloon, StaffMember, ServiceItem, WebsiteTheme } from "@saloon/ui-website";

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

const SALOON_DOMAIN = import.meta.env.VITE_SALOON_DOMAIN || "my-saloon.online";

function slugFromRequest(request: Request): string | null {
  const url = new URL(request.url);
  if (url.hostname.endsWith(`.${SALOON_DOMAIN}`)) {
    return url.hostname.slice(0, -(SALOON_DOMAIN.length + 1)) || null;
  }
  return url.searchParams.get("slug");
}

export type TenantData = {
  saloon: Saloon;
  staff: StaffMember[];
  services: ServiceItem[];
  theme: WebsiteTheme;
};

type LoaderData =
  | ({ status: "ok" } & TenantData)
  | { status: "disabled"; saloonName?: string }
  | { status: "not_found" }
  | { status: "error" };

export async function clientLoader({ request }: ClientLoaderFunctionArgs): Promise<LoaderData> {
  const slug = slugFromRequest(request);
  if (!slug) return { status: "not_found" };

  try {
    const saloon = await apiFetch<Saloon>(`${API_BASE}/api/saloon/${slug}`);
    if (saloon.status === "DISABLED") {
      return { status: "disabled", saloonName: saloon.name };
    }
    const [staff, services, theme] = await Promise.all([
      apiFetch<StaffMember[]>(`${API_BASE}/api/saloon/${saloon.id}/staff`).catch((): StaffMember[] => []),
      apiFetch<ServiceItem[]>(`${API_BASE}/api/saloon/${saloon.id}/services`).catch((): ServiceItem[] => []),
      apiFetch<WebsiteTheme>(`${API_BASE}/api/saloon/${saloon.id}/website`).catch((): WebsiteTheme => DEFAULT_THEME),
    ]);
    const resolvedTheme = { ...DEFAULT_THEME, ...theme };
    if (!saloon.features?.includes("STATIC_WEBSITE")) {
      return { status: "disabled", saloonName: saloon.name };
    }
    return { status: "ok", saloon, staff, services, theme: resolvedTheme };
  } catch (err) {
    const is404 = err instanceof Error && /HTTP 404|not found/i.test(err.message);
    return { status: is404 ? "not_found" : "error" };
  }
}

// Prevent re-fetching when navigating between sub-pages within the same saloon
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
      document.title = data.saloon.name;
      let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = buildFaviconHref(data.saloon.name, data.theme.logoBgColor);
    }
  }, [data]);

  if (data.status === "disabled") return <SaloonDisabledPage saloonName={data.saloonName} />;
  if (data.status === "not_found") return <SalonErrorPage is404 />;
  if (data.status === "error") return <SalonErrorPage is404={false} />;

  const { saloon, staff, services, theme } = data;
  return <Outlet context={{ saloon, staff, services, theme } satisfies TenantData} />;
}
