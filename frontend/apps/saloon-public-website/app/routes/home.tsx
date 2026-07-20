import { useState, useEffect } from "react";
import { SaloonWebsite, SalonErrorPage, DEFAULT_THEME, apiFetch } from "@saloon/ui-website";
import type { Saloon, StaffMember, ServiceItem, WebsiteTheme } from "@saloon/ui-website";

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
        setState({ status: "ok", saloon, staff, services, theme: { ...DEFAULT_THEME, ...theme } });
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
