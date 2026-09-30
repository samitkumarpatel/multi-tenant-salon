import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, Outlet, redirect, useLoaderData, useLocation, useNavigate } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { CalendarDays, ChevronDown, LogOut, Receipt, ShoppingCart } from "lucide-react";
import { SessionBadge, Toast, useToast } from "@salon/ui-shared";
import { DEFAULT_THEME, API_BASE, contrastText } from "@salon/ui-website";
import type { Salon, WebsiteTheme } from "@salon/ui-website";
import { ADMIN_API, apiFetch } from "~/lib/api";
import { getAccessTokenExpiry, getDashboardSession, logout, startOAuth2Login, startSilentRenewLoop } from "~/lib/auth";

function initials(name: string) {
  return name.split(" ").map((word) => word[0]).slice(0, 2).join("").toUpperCase();
}

function buildFaviconHref(name: string, bgColor: string): string {
  const fg = contrastText(bgColor);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='${bgColor}'/><text x='16' y='22' font-family='system-ui,sans-serif' font-size='13' font-weight='700' fill='${fg}' text-anchor='middle'>${initials(name)}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function AnimatedSubmenu({ open, className, children }: { open: boolean; className: string; children: ReactNode }) {
  return <div
    aria-hidden={!open}
    inert={!open}
    className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out motion-reduce:transition-none ${open ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0"}`}
  >
    <div className="min-h-0 overflow-hidden">
      <div className={className}>{children}</div>
    </div>
  </div>;
}

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  if (!getDashboardSession()) {
    throw redirect(`/login?salon=${encodeURIComponent(params.salonId ?? "")}`);
  }
  const [salon, theme] = await Promise.all([
    apiFetch<Salon>(`${ADMIN_API}/${params.salonId}`),
    apiFetch<WebsiteTheme>(`${API_BASE}/api/salon/${params.salonId}/website`).catch((): WebsiteTheme => DEFAULT_THEME),
  ]);
  const settings = salon.features?.includes("DASHBOARD")
    ? await apiFetch<{ bookingManagementEnabled: boolean; cashierEnabled: boolean }>(`${ADMIN_API}/${params.salonId}/dashboard/settings`)
    : { bookingManagementEnabled: false, cashierEnabled: false };
  return { salon, settings, theme: { ...DEFAULT_THEME, ...theme } };
}

export default function DashboardLayout() {
  const data = useLoaderData<typeof clientLoader>();
  const navigate = useNavigate();
  const location = useLocation();
  const session = getDashboardSession();
  const { toast, notify } = useToast();
  // A silent renew rewrites localStorage but not React state, so the badge's
  // expiry is only ever updated by the renew loop below.
  const [tokenExpiry, setTokenExpiry] = useState<number | null>(() => getAccessTokenExpiry());
  const [renewing, setRenewing] = useState(false);

  // Keep the access token alive via hidden-iframe silent renew for as long as
  // the AS session cookie stays valid; once it has expired, fall back to a
  // full, visible re-authentication instead of letting API calls 401.
  useEffect(() => {
    return startSilentRenewLoop(
      (expiresAt) => {
        setRenewing(false);
        setTokenExpiry(expiresAt);
        notify("Session renewed");
      },
      () => {
        setRenewing(false);
        notify("Your session expired — signing you in again…", "error");
        setTimeout(() => startOAuth2Login(data?.salon.id != null ? String(data.salon.id) : undefined), 1200);
      },
      () => setRenewing(true)
    );
  }, []);

  useEffect(() => {
    if (!data) return;
    document.title = data.salon.name;
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = buildFaviconHref(data.salon.name, data.theme.logoBgColor);
  }, [data]);
  const { salon, settings, theme } = data;
  const requestedView = new URLSearchParams(location.search).get("view");
  const search = new URLSearchParams(location.search);
  const requestedAppointmentsView = search.get("appointmentsView");
  const requestedCashierView = search.get("cashierView");
  const bookingEnabled = settings.bookingManagementEnabled && salon.features?.includes("BOOKING");
  const activeView = requestedView === "cashier" && settings.cashierEnabled
    ? "cashier"
    : bookingEnabled ? "appointments" : "cashier";
  const navItems = [
    ...(bookingEnabled ? [{ key: "appointments", label: "Appointments", icon: CalendarDays }] : []),
    ...(settings.cashierEnabled ? [{ key: "cashier", label: "Cashier", icon: ShoppingCart }] : []),
  ];
  return <div className="min-h-screen">
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-7">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: theme.logoBgColor }}>
          <span className="text-[10px] font-bold leading-none" style={{ color: contrastText(theme.logoBgColor) }}>{initials(salon.name)}</span>
        </div>
        <div className="ml-5 border-l border-slate-200 pl-5"><p className="text-xs font-semibold text-slate-800">{salon.name}</p><p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Salon desk</p></div>
        <div className="ml-auto flex items-center gap-2">
          {session && <div className="hidden md:flex"><SessionBadge email={session.email} expiresAt={tokenExpiry} renewing={renewing} /></div>}
          <button onClick={() => logout(navigate)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>
        </div>
      </div>
    </header>
    <div className="mx-auto flex max-w-7xl">
      <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-48 shrink-0 px-4 py-6 md:flex md:flex-col">
        <nav className="space-y-1">
          {navItems.map(({ key, label, icon: Icon }) => <div key={key}>
            <Link to={key === "cashier" ? "?view=cashier&cashierView=pos" : `?view=${key}`} className={`flex items-center gap-3 rounded-md px-2 py-2.5 text-sm font-semibold no-underline transition-colors ${activeView === key ? "text-matcha-800" : "text-slate-500 hover:text-slate-800"}`}><Icon className={`h-4 w-4 ${activeView === key ? "text-matcha-600" : ""}`} />{label}<ChevronDown className={`ml-auto h-4 w-4 text-slate-400 transition-transform ${activeView === key ? "rotate-180" : ""}`} /></Link>
            {key === "appointments" && <AnimatedSubmenu open={activeView === key} className="ml-7 mt-1 space-y-1 border-l border-slate-200 pl-3">
              <Link to="?view=appointments&appointmentsView=today&todayView=day" className={`block rounded px-2 py-1.5 text-xs no-underline ${requestedAppointmentsView !== "new" ? "bg-matcha-100 font-semibold text-matcha-900" : "font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}>Overview</Link>
              <Link to="?view=appointments&appointmentsView=new" className={`my-1 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs no-underline transition-colors ${requestedAppointmentsView === "new" ? "bg-matcha-100 font-semibold text-matcha-900" : "font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-800"}`}>Book</Link>
            </AnimatedSubmenu>}
            {key === "cashier" && <AnimatedSubmenu open={activeView === key} className="ml-7 mt-1 space-y-1 border-l border-slate-200 pl-3">
              <Link to="?view=cashier&cashierView=pos" className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs no-underline ${requestedCashierView !== "invoices" ? "bg-matcha-100 font-semibold text-matcha-900" : "font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}><ShoppingCart className="h-3.5 w-3.5" />Till / POS</Link>
              <Link to="?view=cashier&cashierView=invoices" className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs no-underline ${requestedCashierView === "invoices" ? "bg-matcha-100 font-semibold text-matcha-900" : "font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}><Receipt className="h-3.5 w-3.5" />Invoices</Link>
            </AnimatedSubmenu>}
          </div>)}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <nav className="border-b border-slate-200 bg-white px-4 py-2 md:hidden">
          <div className="flex gap-2 overflow-x-auto">
            {navItems.map(({ key, label, icon: Icon }) => <Link key={key} to={key === "cashier" ? "?view=cashier&cashierView=pos" : `?view=${key}`} className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold no-underline ${activeView === key ? "bg-matcha-50 text-matcha-700" : "text-slate-500"}`}><Icon className="h-4 w-4" />{label}<ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${activeView === key ? "rotate-180" : ""}`} /></Link>)}
          </div>
          <AnimatedSubmenu open={activeView === "appointments"} className="mt-2 flex gap-4 overflow-x-auto border-t border-slate-100 pt-2 text-xs">
            <Link to="?view=appointments&appointmentsView=today&todayView=day" className={`shrink-0 rounded px-2 py-1 no-underline ${requestedAppointmentsView !== "new" ? "bg-matcha-100 font-semibold text-matcha-900" : "text-slate-500"}`}>Overview</Link>
            <Link to="?view=appointments&appointmentsView=new" className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 no-underline transition-colors ${requestedAppointmentsView === "new" ? "bg-matcha-100 font-semibold text-matcha-900" : "text-slate-600"}`}>Book</Link>
          </AnimatedSubmenu>
          <AnimatedSubmenu open={activeView === "cashier"} className="mt-2 flex gap-4 overflow-x-auto border-t border-slate-100 pt-2 text-xs">
            <Link to="?view=cashier&cashierView=pos" className={`shrink-0 rounded px-2 py-1 no-underline ${requestedCashierView !== "invoices" ? "bg-matcha-100 font-semibold text-matcha-900" : "text-slate-500"}`}>Till / POS</Link>
            <Link to="?view=cashier&cashierView=invoices" className={`shrink-0 rounded px-2 py-1 no-underline ${requestedCashierView === "invoices" ? "bg-matcha-100 font-semibold text-matcha-900" : "text-slate-500"}`}>Invoices</Link>
          </AnimatedSubmenu>
        </nav>
        <main className="px-4 py-6 sm:px-7"><div className="mx-auto w-full max-w-5xl"><Outlet /></div></main>
      </div>
    </div>
    <Toast toast={toast} />
  </div>;
}
