import { LanguageSelector, useI18n } from "@salon/i18n";
import type { SalonLanguages } from "@salon/i18n";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, Outlet, redirect, useLoaderData, useLocation, useNavigate } from "react-router";
import type { ClientLoaderFunctionArgs, ShouldRevalidateFunctionArgs } from "react-router";
import { BadgeCheck, CalendarDays, Gift, Package, Users, Calculator, ChevronDown, LogOut, Receipt, ScanLine, ShoppingCart, UserPlus } from "lucide-react";
import { SessionBadge, Toast, useToast } from "@salon/ui-shared";
import { DEFAULT_THEME, API_BASE, contrastText } from "@salon/ui-website";
import type { Salon, WebsiteTheme } from "@salon/ui-website";
import { ADMIN_API, apiFetch } from "~/lib/api";
import { IDLE_SIGN_OUT_MINUTES } from "~/lib/config";
import { getAccessTokenExpiry, getDashboardSession, logout, startOAuth2Login, startSilentRenewLoop } from "~/lib/auth";

function initials(name: string) {
  return name.split(" ").map((word) => word[0]).slice(0, 2).join("").toUpperCase();
}

function buildFaviconHref(name: string, bgColor: string): string {
  const fg = contrastText(bgColor);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='${bgColor}'/><text x='16' y='22' font-family='system-ui,sans-serif' font-size='13' font-weight='700' fill='${fg}' text-anchor='middle'>${initials(name)}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// Height and fade run on separate curves: the height eases out over 300ms while
// the content fades/slides in slightly behind it, so rows never pop in or get
// visibly clipped mid-flight. One submenu collapsing while the other expands
// share the same curve, so the items between them glide instead of jumping.
const SUBMENU_EASE = "ease-[cubic-bezier(0.32,0.72,0,1)]";

function AnimatedSubmenu({ open, className, children }: { open: boolean; className: string; children: ReactNode }) {
  return <div
    aria-hidden={!open}
    inert={!open}
    className={`grid transition-[grid-template-rows] duration-300 ${SUBMENU_EASE} motion-reduce:transition-none ${open ? "grid-rows-[1fr]" : "pointer-events-none grid-rows-[0fr]"}`}
  >
    <div className="min-h-0 overflow-hidden">
      <div className={`transition-[opacity,translate] ${SUBMENU_EASE} motion-reduce:transition-none ${open ? "translate-y-0 opacity-100 delay-75 duration-300" : "-translate-y-1 opacity-0 duration-150"}`}>
        <div className={className}>{children}</div>
      </div>
    </div>
  </div>;
}

// The sidebar links only change `?view=…` search params. Without this, every
// click re-ran the loader and the UI waited on the API before switching view.
export function shouldRevalidate({ currentParams, nextParams }: ShouldRevalidateFunctionArgs) {
  return currentParams.salonId !== nextParams.salonId;
}

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  if (!getDashboardSession()) {
    throw redirect(`/login?salon=${encodeURIComponent(params.salonId ?? "")}`);
  }
  // Settings are requested alongside the salon (not after it) to save a round
  // trip; the result is only used when the DASHBOARD feature is on.
  const settingsRequest = apiFetch<{ bookingManagementEnabled: boolean; cashierEnabled: boolean }>(`${ADMIN_API}/${params.salonId}/dashboard/settings`)
    .then((value) => ({ value, error: null }), (error: unknown) => ({ value: null, error }));
  const [salon, theme, settingsResult, languages] = await Promise.all([
    apiFetch<Salon>(`${ADMIN_API}/${params.salonId}`),
    apiFetch<WebsiteTheme>(`${API_BASE}/api/salon/${params.salonId}/website`).catch((): WebsiteTheme => DEFAULT_THEME),
    settingsRequest,
    apiFetch<SalonLanguages>(`${API_BASE}/api/salon/${params.salonId}/languages`),
  ]);
  let settings = { bookingManagementEnabled: false, cashierEnabled: false };
  if (salon.features?.includes("DASHBOARD")) {
    if (!settingsResult.value) throw settingsResult.error;
    settings = settingsResult.value;
  }
  return { salon, settings, languagePolicy: languages.dashboard, languageScope: String(salon.id), theme: { ...DEFAULT_THEME, ...theme } };
}

/**
 * Signs out after {@code minutes} without a touch, key press or scroll, warning for the last minute.
 * Resumes correctly after the tablet sleeps: the check compares timestamps rather than counting ticks,
 * so a device that was asleep for hours is signed out on its first tick instead of getting a fresh window.
 */
function useIdleSignOut(minutes: number, onSignOut: () => void): number | null {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!minutes || minutes <= 0) return;
    const idleMs = minutes * 60_000;
    const warnMs = Math.min(60_000, idleMs / 2);
    let lastActive = Date.now();
    const bump = () => {
      lastActive = Date.now();
      setSecondsLeft((current) => (current === null ? current : null));
    };
    const events = ["pointerdown", "keydown", "touchstart", "wheel"] as const;
    events.forEach((name) => window.addEventListener(name, bump, { passive: true }));
    const timer = window.setInterval(() => {
      const idle = Date.now() - lastActive;
      if (idle >= idleMs) {
        window.clearInterval(timer);
        onSignOut();
      } else if (idle >= idleMs - warnMs) {
        setSecondsLeft(Math.ceil((idleMs - idle) / 1000));
      }
    }, 1000);
    return () => {
      window.clearInterval(timer);
      events.forEach((name) => window.removeEventListener(name, bump));
    };
    // onSignOut is stable enough: it only calls logout(navigate), and re-subscribing would reset the clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minutes]);
  return secondsLeft;
}

export default function DashboardLayout() {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const data = useLoaderData<typeof clientLoader>();
  const navigate = useNavigate();
  const idleSecondsLeft = useIdleSignOut(IDLE_SIGN_OUT_MINUTES, () => logout(navigate));
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
  const sellingMembership = search.get("membershipView") === "sell";
  const bookingEnabled = settings.bookingManagementEnabled && salon.features?.includes("BOOKING");
  const membershipEnabled = Boolean(salon.features?.includes("MEMBERSHIP"));
  const loyaltyEnabled = Boolean(salon.features?.includes("LOYALTY_PROGRAM"));
  const ordersEnabled = Boolean(salon.features?.includes("WEBSHOP"));
  // Mirrors the view choice in dashboard.tsx.
  const activeView = requestedView === "cashier" && settings.cashierEnabled
    ? "cashier"
    : requestedView === "membership" && membershipEnabled ? "membership"
    : requestedView === "loyalty" && loyaltyEnabled ? "loyalty"
    : requestedView === "orders" && ordersEnabled ? "orders"
    : requestedView === "customers" ? "customers"
    : bookingEnabled ? "appointments"
    : !settings.cashierEnabled && !membershipEnabled && loyaltyEnabled ? "loyalty"
    : settings.cashierEnabled || !membershipEnabled ? "cashier" : "membership";
  const navItems = [
    ...(bookingEnabled ? [{ key: "appointments", label: "Appointments", icon: CalendarDays }] : []),
    ...(settings.cashierEnabled ? [{ key: "cashier", label: "Cashier", icon: ShoppingCart }] : []),
    ...(membershipEnabled ? [{ key: "membership", label: "Membership", icon: BadgeCheck }] : []),
    ...(loyaltyEnabled ? [{ key: "loyalty", label: "Loyalty", icon: Gift }] : []),
    ...(ordersEnabled ? [{ key: "orders", label: "Orders", icon: Package }] : []),
    { key: "customers", label: "Customers", icon: Users },
  ];
  const navTarget = (key: string) => key === "cashier" ? "?view=cashier&cashierView=pos"
    : key === "membership" ? "?view=membership&membershipView=check-in" : `?view=${key}`;
  return <div className="min-h-dvh">
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-7">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: theme.logoBgColor }}>
          <span className="text-[10px] font-bold leading-none" style={{ color: contrastText(theme.logoBgColor) }}>{initials(salon.name)}</span>
        </div>
        <div className="ml-5 border-l border-slate-200 pl-5"><p className="text-xs font-semibold text-slate-800">{salon.name}</p><p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{translateUi("Salon desk")}</p></div>
        <div className="ml-auto flex items-center gap-2">
          <LanguageSelector compact />
          {session && <div className="hidden md:flex"><SessionBadge email={session.email} expiresAt={tokenExpiry} renewing={renewing} /></div>}
          <button onClick={() => logout(navigate)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={translateUi("Sign out")}><LogOut className="h-4 w-4" /></button>
        </div>
      </div>
    </header>
    <div className="mx-auto flex max-w-7xl 2xl:max-w-screen-2xl">
      <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-48 shrink-0 px-4 py-6 md:flex md:flex-col">
        <nav className="space-y-1">
          {navItems.map(({ key, label, icon: Icon }) => <div key={key}>
            <Link to={navTarget(key)} className={`flex items-center gap-3 rounded-md px-2 py-2.5 text-sm font-semibold no-underline transition-colors ${activeView === key ? "text-matcha-800" : "text-slate-500 hover:text-slate-800"}`}><Icon className={`h-4 w-4 ${activeView === key ? "text-matcha-600" : ""}`} />{translateUi(label)}<ChevronDown className={`ml-auto h-4 w-4 text-slate-400 transition-transform duration-300 ${SUBMENU_EASE} motion-reduce:transition-none ${activeView === key ? "rotate-180" : ""}`} /></Link>
            {key === "appointments" && <AnimatedSubmenu open={activeView === key} className="ml-7 mt-1 space-y-1 border-l border-slate-200 pl-3">
              <Link to="?view=appointments&appointmentsView=today&todayView=day" className={`block rounded px-2 py-1.5 text-xs no-underline ${requestedAppointmentsView !== "new" && requestedAppointmentsView !== "payments" ? "bg-matcha-100 font-semibold text-matcha-900" : "font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}>{translateUi("Overview")}</Link>
              <Link to="?view=appointments&appointmentsView=payments" className={`block rounded px-2 py-1.5 text-xs no-underline ${requestedAppointmentsView === "payments" ? "bg-matcha-100 font-semibold text-matcha-900" : "font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}>{translateUi("Payment follow-ups")}</Link>
              <Link to="?view=appointments&appointmentsView=new" className={`my-1 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs no-underline transition-colors ${requestedAppointmentsView === "new" ? "bg-matcha-100 font-semibold text-matcha-900" : "font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-800"}`}>{translateUi("Book")}</Link>
            </AnimatedSubmenu>}
            {key === "cashier" && <AnimatedSubmenu open={activeView === key} className="ml-7 mt-1 space-y-1 border-l border-slate-200 pl-3">
              <Link to="?view=cashier&cashierView=pos" className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs no-underline ${requestedCashierView !== "invoices" && requestedCashierView !== "report" && requestedCashierView !== "shift" ? "bg-matcha-100 font-semibold text-matcha-900" : "font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}><ShoppingCart className="h-3.5 w-3.5" />{translateUi("Till / POS")}</Link>
              <Link to="?view=cashier&cashierView=invoices" className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs no-underline ${requestedCashierView === "invoices" ? "bg-matcha-100 font-semibold text-matcha-900" : "font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}><Receipt className="h-3.5 w-3.5" />{translateUi("Invoices")}</Link>
              <Link to="?view=cashier&cashierView=shift" className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs no-underline ${requestedCashierView === "shift" ? "bg-matcha-100 font-semibold text-matcha-900" : "font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}><Calculator className="h-3.5 w-3.5" />{translateUi("Till shift")}</Link>
              <Link to="?view=cashier&cashierView=report" className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs no-underline ${requestedCashierView === "report" ? "bg-matcha-100 font-semibold text-matcha-900" : "font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}><Calculator className="h-3.5 w-3.5" />{translateUi("End of day")}</Link>
            </AnimatedSubmenu>}
            {key === "membership" && <AnimatedSubmenu open={activeView === key} className="ml-7 mt-1 space-y-1 border-l border-slate-200 pl-3">
              <Link to="?view=membership&membershipView=check-in" className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs no-underline ${!sellingMembership ? "bg-matcha-100 font-semibold text-matcha-900" : "font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}><ScanLine className="h-3.5 w-3.5" />{translateUi("Check in")}</Link>
              <Link to="?view=membership&membershipView=sell" className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs no-underline ${sellingMembership ? "bg-matcha-100 font-semibold text-matcha-900" : "font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}><UserPlus className="h-3.5 w-3.5" />{translateUi("Sell")}</Link>
            </AnimatedSubmenu>}
          </div>)}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <nav className="border-b border-slate-200 bg-white px-4 py-2 md:hidden">
          <div className="flex gap-2 overflow-x-auto">
            {navItems.map(({ key, label, icon: Icon }) => <Link key={key} to={navTarget(key)} className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold no-underline ${activeView === key ? "bg-matcha-50 text-matcha-700" : "text-slate-500"}`}><Icon className="h-4 w-4" />{translateUi(label)}<ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-300 ${SUBMENU_EASE} motion-reduce:transition-none ${activeView === key ? "rotate-180" : ""}`} /></Link>)}
          </div>
          <AnimatedSubmenu open={activeView === "appointments"} className="mt-2 flex gap-4 overflow-x-auto border-t border-slate-100 pt-2 text-xs">
            <Link to="?view=appointments&appointmentsView=today&todayView=day" className={`shrink-0 rounded px-2 py-1 no-underline ${requestedAppointmentsView !== "new" && requestedAppointmentsView !== "payments" ? "bg-matcha-100 font-semibold text-matcha-900" : "text-slate-500"}`}>{translateUi("Overview")}</Link>
            <Link to="?view=appointments&appointmentsView=payments" className={`shrink-0 rounded px-2 py-1 no-underline ${requestedAppointmentsView === "payments" ? "bg-matcha-100 font-semibold text-matcha-900" : "text-slate-500"}`}>{translateUi("Payment follow-ups")}</Link>
            <Link to="?view=appointments&appointmentsView=new" className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 no-underline transition-colors ${requestedAppointmentsView === "new" ? "bg-matcha-100 font-semibold text-matcha-900" : "text-slate-600"}`}>{translateUi("Book")}</Link>
          </AnimatedSubmenu>
          <AnimatedSubmenu open={activeView === "cashier"} className="mt-2 flex gap-4 overflow-x-auto border-t border-slate-100 pt-2 text-xs">
            <Link to="?view=cashier&cashierView=pos" className={`shrink-0 rounded px-2 py-1 no-underline ${requestedCashierView !== "invoices" && requestedCashierView !== "report" && requestedCashierView !== "shift" ? "bg-matcha-100 font-semibold text-matcha-900" : "text-slate-500"}`}>{translateUi("Till / POS")}</Link>
            <Link to="?view=cashier&cashierView=invoices" className={`shrink-0 rounded px-2 py-1 no-underline ${requestedCashierView === "invoices" ? "bg-matcha-100 font-semibold text-matcha-900" : "text-slate-500"}`}>{translateUi("Invoices")}</Link>
            <Link to="?view=cashier&cashierView=shift" className={`shrink-0 rounded px-2 py-1 no-underline ${requestedCashierView === "shift" ? "bg-matcha-100 font-semibold text-matcha-900" : "text-slate-500"}`}>{translateUi("Till shift")}</Link>
            <Link to="?view=cashier&cashierView=report" className={`shrink-0 rounded px-2 py-1 no-underline ${requestedCashierView === "report" ? "bg-matcha-100 font-semibold text-matcha-900" : "text-slate-500"}`}>{translateUi("End of day")}</Link>
          </AnimatedSubmenu>
          <AnimatedSubmenu open={activeView === "membership"} className="mt-2 flex gap-4 overflow-x-auto border-t border-slate-100 pt-2 text-xs">
            <Link to="?view=membership&membershipView=check-in" className={`shrink-0 rounded px-2 py-1 no-underline ${!sellingMembership ? "bg-matcha-100 font-semibold text-matcha-900" : "text-slate-500"}`}>{translateUi("Check in")}</Link>
            <Link to="?view=membership&membershipView=sell" className={`shrink-0 rounded px-2 py-1 no-underline ${sellingMembership ? "bg-matcha-100 font-semibold text-matcha-900" : "text-slate-500"}`}>{translateUi("Sell")}</Link>
          </AnimatedSubmenu>
        </nav>
        <main className="px-4 py-6 sm:px-7"><div className="mx-auto w-full max-w-5xl xl:max-w-6xl 2xl:max-w-7xl"><Outlet /></div></main>
      </div>
    </div>
    {idleSecondsLeft !== null && (
        <div role="alert" aria-live="assertive"
          className="fixed inset-x-4 bottom-4 z-[70] mx-auto max-w-md rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-900 shadow-lg">
          {translateUi("Signing out in {seconds}s to keep this till secure. Tap anywhere to stay signed in.", { seconds: idleSecondsLeft })}
        </div>
      )}
      <Toast toast={toast} />
  </div>;
}
