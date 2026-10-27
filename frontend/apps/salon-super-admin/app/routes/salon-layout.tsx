import { AdminHeader } from "~/components/AdminHeader";
import { useI18n } from "@salon/i18n";
import { useState, useEffect } from "react";
import { Link, NavLink, Outlet, useNavigate, redirect } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import {
  ArrowLeft, Shield, LayoutDashboard, Pencil,
  Scissors, Users, CalendarDays, CalendarCheck,
} from "lucide-react";
import { Toast, useToast } from "@salon/ui-shared";
import { apiFetch, ADMIN_API } from "~/lib/api";
import type { Salon, SalonManageContext } from "~/lib/types";
import {
  getSession,
  logout as authLogout,
  startSilentRenewLoop,
  startOAuth2Login,
} from "~/lib/auth";

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  if (!getSession()) throw redirect("/login");
  const salon = await apiFetch<Salon>(`${ADMIN_API}/${params.salonId}`);
  return { salon };
}

const NAV = [
  { label: "Overview",   icon: LayoutDashboard, to: "" },
  { label: "Edit Details", icon: Pencil,        to: "edit" },
  { label: "Services",   icon: Scissors,        to: "services" },
  { label: "Customers", icon: Users, to: "customers" },
  { label: "Staff",      icon: Users,           to: "staff" },
  { label: "Holidays",   icon: CalendarDays,    to: "holidays" },
  { label: "Bookings",   icon: CalendarCheck,   to: "bookings" },
];

export default function SalonLayout() {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const { salon: initial } = useLoaderData<typeof clientLoader>();
  const [salon, setSalon] = useState<Salon>(initial);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { toast, notify } = useToast();
  // Steps 8-13: keep the access token alive via hidden-iframe silent renew
  // for as long as the AS session cookie stays valid. Once that cookie has
  // actually expired the iframe comes back empty-handed, so fall back to a
  // full, visible re-authentication instead of letting the next API call
  // just start failing with 401s.
  useEffect(() => {
    return startSilentRenewLoop(
      () => {
        notify("Session renewed");
      },
      () => {
        notify("Your session expired — signing you in again…", "error");
        setTimeout(() => startOAuth2Login(), 1200);
      }
    );
  }, []);

  function handleSignOut() {
    authLogout(navigate);
  }

  const ctx: SalonManageContext = { salon, setSalon };

  return (
    <div className="min-h-[100dvh] bg-stone-50 flex flex-col">
      <AdminHeader onSignOut={handleSignOut} onToggleMenu={() => setSidebarOpen((v) => !v)} menuOpen={sidebarOpen} />

      <div className="flex flex-1 min-h-0">
        {/* Sidebar backdrop (mobile) */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-stone-900/30 z-20 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <nav id="salon-navigation" className={`
          fixed md:static inset-y-0 left-0 z-20 top-[88px]
          w-56 bg-white border-r border-stone-200 flex flex-col shrink-0
          transition-transform duration-200
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}>
          <div className="px-3 py-4 flex-1 space-y-0.5">
            <Link to="/" className="mb-3 flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-stone-600 hover:bg-stone-100">
              <ArrowLeft className="size-4" aria-hidden="true" />
              {translateUi("All Salons")}
            </Link>
            <p className="text-[9px] font-bold uppercase tracking-widest text-stone-400 px-3 mb-2">
              {salon.name}
            </p>
            {NAV.map(({ label, icon: Icon, to }) => (
              <NavLink
                key={label}
                to={to}
                end={to === ""}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-matcha-50 text-matcha-600 border border-matcha-200"
                      : "text-stone-500 hover:text-stone-800 hover:bg-stone-100"
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                {translateUi(label)}
              </NavLink>
            ))}
          </div>
          <div className="px-3 py-3 border-t border-stone-200">
            <div className="flex items-center gap-2 px-3 py-2">
              <Shield className="w-3.5 h-3.5 text-matcha-500 shrink-0" />
              <span className="text-[10px] text-stone-400">{translateUi("Super Admin Access")}</span>
            </div>
          </div>
        </nav>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
            <Outlet context={ctx} />
          </div>
        </main>
      </div>

      <Toast toast={toast} />
    </div>
  );
}
