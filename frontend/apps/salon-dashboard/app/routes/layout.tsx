import { useEffect } from "react";
import { Link, Outlet, useLoaderData, useLocation, useNavigate } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { CalendarDays, ChevronDown, LogOut, ShoppingCart } from "lucide-react";
import { DEFAULT_THEME, API_BASE, contrastText } from "@salon/ui-website";
import type { Salon, WebsiteTheme } from "@salon/ui-website";
import { ADMIN_API, apiFetch } from "~/lib/api";
import { getDashboardSession, logout } from "~/lib/auth";

function initials(name: string) {
  return name.split(" ").map((word) => word[0]).slice(0, 2).join("").toUpperCase();
}

function buildFaviconHref(name: string, bgColor: string): string {
  const fg = contrastText(bgColor);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='${bgColor}'/><text x='16' y='22' font-family='system-ui,sans-serif' font-size='13' font-weight='700' fill='${fg}' text-anchor='middle'>${initials(name)}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const session = getDashboardSession();
  if (!session) return null;
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
  if (!data) return <Outlet />;
  const { salon, settings, theme } = data;
  const requestedView = new URLSearchParams(location.search).get("view");
  const search = new URLSearchParams(location.search);
  const requestedAppointmentsView = search.get("appointmentsView");
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
        <div className="ml-auto"><button onClick={() => { logout(); navigate("/login"); }} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Sign out"><LogOut className="h-4 w-4" /></button></div>
      </div>
    </header>
    <div className="mx-auto flex max-w-7xl">
      <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-48 shrink-0 px-4 py-6 md:flex md:flex-col">
        <nav className="space-y-1">
          {navItems.map(({ key, label, icon: Icon }) => <div key={key}>
            <Link to={`?view=${key}`} className={`flex items-center gap-3 rounded-md px-2 py-2.5 text-sm font-semibold no-underline transition-colors ${activeView === key ? "text-matcha-800" : "text-slate-500 hover:text-slate-800"}`}><Icon className={`h-4 w-4 ${activeView === key ? "text-matcha-600" : ""}`} />{label}{key === "appointments" && <ChevronDown className={`ml-auto h-4 w-4 text-slate-400 transition-transform ${activeView === key ? "rotate-180" : ""}`} />}</Link>
            {key === "appointments" && activeView === key && <div className="ml-7 mt-1 space-y-1 border-l border-slate-200 pl-3">
              <Link to="?view=appointments&appointmentsView=today&todayView=day" className={`block rounded px-2 py-1.5 text-xs no-underline ${requestedAppointmentsView !== "new" ? "bg-matcha-100 font-semibold text-matcha-900" : "font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}>Overview</Link>
              <Link to="?view=appointments&appointmentsView=new" className={`my-1 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs no-underline transition-colors ${requestedAppointmentsView === "new" ? "bg-matcha-100 font-semibold text-matcha-900" : "font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-800"}`}>Book</Link>
            </div>}
          </div>)}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <nav className="border-b border-slate-200 bg-white px-4 py-2 md:hidden">
          <div className="flex gap-2 overflow-x-auto">
            {navItems.map(({ key, label, icon: Icon }) => <Link key={key} to={`?view=${key}`} className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold no-underline ${activeView === key ? "bg-matcha-50 text-matcha-700" : "text-slate-500"}`}><Icon className="h-4 w-4" />{label}{key === "appointments" && <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${activeView === key ? "rotate-180" : ""}`} />}</Link>)}
          </div>
          {activeView === "appointments" && <div className="mt-2 flex gap-4 overflow-x-auto border-t border-slate-100 pt-2 text-xs">
            <Link to="?view=appointments&appointmentsView=today&todayView=day" className={`shrink-0 rounded px-2 py-1 no-underline ${requestedAppointmentsView !== "new" ? "bg-matcha-100 font-semibold text-matcha-900" : "text-slate-500"}`}>Overview</Link>
            <Link to="?view=appointments&appointmentsView=new" className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 no-underline transition-colors ${requestedAppointmentsView === "new" ? "bg-matcha-100 font-semibold text-matcha-900" : "text-slate-600"}`}>Book</Link>
          </div>}
        </nav>
        <main className="px-4 py-6 sm:px-7"><div className="mx-auto w-full max-w-5xl"><Outlet /></div></main>
      </div>
    </div>
  </div>;
}
