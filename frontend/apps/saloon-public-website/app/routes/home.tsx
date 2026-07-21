import { useState, useEffect } from "react";
import { SaloonWebsite, SalonErrorPage, DEFAULT_THEME, apiFetch } from "@saloon/ui-website";
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

function applyBranding(name: string, bgColor: string) {
  document.title = name;
  let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = buildFaviconHref(name, bgColor);
}

type TenantState =
  | { status: "loading" }
  | { status: "ok"; saloon: Saloon; staff: StaffMember[]; services: ServiceItem[]; theme: WebsiteTheme }
  | { status: "not_found" }
  | { status: "error" };

function slugFromHostname(hostname: string): string | null {
  // <slug>.my-saloon.online → "slug"
  // localhost / dev fallback: ?slug=xxx query param
  const parts = hostname.split(".");
  if (parts.length >= 3) return parts[0];
  const params = new URLSearchParams(window.location.search);
  return params.get("slug");
}

export default function PublicWebsiteShell() {
  const [state, setState] = useState<TenantState>({ status: "loading" });

  useEffect(() => {
    const slug = slugFromHostname(window.location.hostname);
    if (!slug) {
      setState({ status: "not_found" });
      return;
    }

    (async () => {
      try {
        const saloon = await apiFetch<Saloon>(`/api/saloon/${slug}`);
        const [staff, services, theme] = await Promise.all([
          apiFetch<StaffMember[]>(`/api/saloon/${saloon.id}/staff`).catch((): StaffMember[] => []),
          apiFetch<ServiceItem[]>(`/api/saloon/${saloon.id}/services`).catch((): ServiceItem[] => []),
          apiFetch<WebsiteTheme>(`/api/saloon/${saloon.id}/website`).catch((): WebsiteTheme => DEFAULT_THEME),
        ]);
        const resolvedTheme = { ...DEFAULT_THEME, ...theme };
        applyBranding(saloon.name, resolvedTheme.logoBgColor);
        setState({ status: "ok", saloon, staff, services, theme: resolvedTheme });
      } catch (err) {
        const is404 = err instanceof Error && /HTTP 404|not found/i.test(err.message);
        setState({ status: is404 ? "not_found" : "error" });
      }
    })();
  }, []);

  if (state.status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-slate-400">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
        <p className="text-sm">Loading…</p>
      </div>
    );
  }

  if (state.status === "not_found") return <SalonErrorPage is404 />;
  if (state.status === "error") return <SalonErrorPage is404={false} />;

  return (
    <SaloonWebsite
      saloon={state.saloon}
      staff={state.staff}
      services={state.services}
      theme={state.theme}
    />
  );
}
