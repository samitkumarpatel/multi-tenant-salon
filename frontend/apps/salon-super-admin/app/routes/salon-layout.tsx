import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate, redirect } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import {
  ArrowLeft, Shield, LogOut, LayoutDashboard, Pencil,
  Scissors, Users, CalendarDays, CalendarCheck, Menu, X,
} from "lucide-react";
import { AppLogo, SessionBadge } from "@salon/ui-shared";
import { apiFetch, ADMIN_API } from "~/lib/api";
import type { Salon, SalonManageContext } from "~/lib/types";
import { getSession, getAccessTokenExpiry, logout as authLogout } from "~/lib/auth";

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  if (!getSession()) throw redirect("/login");
  const salon = await apiFetch<Salon>(`${ADMIN_API}/${params.salonId}`);
  return { salon };
}

const NAV = [
  { label: "Overview",   icon: LayoutDashboard, to: "" },
  { label: "Edit Details", icon: Pencil,        to: "edit" },
  { label: "Services",   icon: Scissors,        to: "services" },
  { label: "Staff",      icon: Users,           to: "staff" },
  { label: "Holidays",   icon: CalendarDays,    to: "holidays" },
  { label: "Bookings",   icon: CalendarCheck,   to: "bookings" },
];

export default function SalonLayout() {
  const { salon: initial } = useLoaderData<typeof clientLoader>();
  const [salon, setSalon] = useState<Salon>(initial);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const session = getSession();

  function handleSignOut() {
    authLogout(navigate);
  }

  const ctx: SalonManageContext = { salon, setSalon };

  return (
    <div className="min-h-[100dvh] bg-stone-50 flex flex-col">
      {/* Top bar */}
      <header className="h-12 border-b border-stone-200 bg-white/80 flex items-center px-4 gap-3 shrink-0 sticky top-0 z-30">
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="md:hidden p-1.5 text-stone-400 hover:text-stone-800 transition-colors cursor-pointer"
        >
          {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
        <AppLogo size={24} textColor="#e2e8f0" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-matcha-500 bg-matcha-50 border border-matcha-200 px-2 py-0.5 rounded hidden sm:inline">
          Super Admin
        </span>
        <div className="h-4 border-l border-stone-200 hidden sm:block" />
        <span className="text-sm font-semibold text-stone-600 truncate hidden sm:block max-w-[200px]">
          {salon.name}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {session && <SessionBadge email={session.email} expiresAt={getAccessTokenExpiry()} tone="stone" />}
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-stone-200 text-xs font-medium text-stone-500 hover:text-stone-800 hover:border-stone-300 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            <span className="hidden sm:inline">All Salons</span>
          </Link>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-stone-200 text-xs font-medium text-stone-500 hover:text-stone-800 hover:border-stone-300 transition-colors cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar backdrop (mobile) */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-stone-900/30 z-20 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <nav className={`
          fixed md:static inset-y-0 left-0 z-20 top-12
          w-56 bg-white border-r border-stone-200 flex flex-col shrink-0
          transition-transform duration-200
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}>
          <div className="px-3 py-4 flex-1 space-y-0.5">
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
                {label}
              </NavLink>
            ))}
          </div>
          <div className="px-3 py-3 border-t border-stone-200">
            <div className="flex items-center gap-2 px-3 py-2">
              <Shield className="w-3.5 h-3.5 text-matcha-500 shrink-0" />
              <span className="text-[10px] text-stone-400">Super Admin Access</span>
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
    </div>
  );
}
