import { redirect, NavLink, Outlet, useNavigate, useRouteError, isRouteErrorResponse, useLoaderData } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { useState } from "react";
import { LayoutDashboard, CalendarCheck, CalendarDays, UserCircle, LogOut, Menu, X as XIcon } from "lucide-react";
import { AppLogo, Toast, useToast } from "@saloon/ui-shared";
import { getStaffSession, clearStaffSession } from "~/routes/login";
import { STAFF_PORTAL_API, apiFetch } from "~/lib/api";
import type { StaffMember } from "~/lib/types";

export async function clientLoader({ request }: ClientLoaderFunctionArgs) {
  const session = getStaffSession();
  if (!session) throw redirect("/login");

  const staff = await apiFetch<StaffMember>(`${STAFF_PORTAL_API}/${session.staffId}`);
  return { staff, session };
}

export function ErrorBoundary() {
  const error = useRouteError();
  const is404 =
    isRouteErrorResponse(error)
      ? error.status === 404
      : error instanceof Error
      ? /HTTP 404|not found/i.test(error.message)
      : false;

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 text-center">
      <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-5">
        <span className="text-2xl">✂️</span>
      </div>
      <h1 className="text-lg font-bold text-slate-800 mb-2">
        {is404 ? "Page not found" : "Something went wrong"}
      </h1>
      <p className="text-sm text-slate-500 max-w-xs leading-relaxed mb-6">
        {is404
          ? "This page doesn't exist."
          : "An error occurred while loading this page."}
      </p>
      <div className="flex gap-3">
        <a
          href="/portal"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium no-underline"
        >
          ← Go to dashboard
        </a>
        {!is404 && (
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium cursor-pointer"
          >
            ↻ Retry
          </button>
        )}
      </div>
    </div>
  );
}

const ROLE_LABEL: Record<string, string> = {
  MANAGER: "Manager", STYLIST: "Stylist", COLORIST: "Colorist",
  MAKEUP_ARTIST: "Makeup Artist", NAIL_TECHNICIAN: "Nail Technician",
  RECEPTIONIST: "Receptionist", ASSISTANT: "Assistant",
};

const STATUS_DOT: Record<string, string> = {
  ACTIVE: "bg-green-500", INACTIVE: "bg-slate-300", ON_LEAVE: "bg-amber-500",
};

export default function Layout() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { staff } = useLoaderData<typeof clientLoader>();
  const session = getStaffSession()!;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const sideNavClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? "bg-matcha-50 text-matcha-700"
        : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
    }`;

  function handleLogout() {
    clearStaffSession();
    navigate("/login");
  }

  return (
    <div className="h-[100dvh] bg-slate-50 flex flex-col overflow-hidden">

      {/* ── Top bar ── */}
      <header className="h-12 bg-white border-b border-slate-200 flex items-center px-3 gap-2 shrink-0 z-40">
        <button
          className="md:hidden p-1.5 rounded-md text-slate-500 hover:bg-slate-100 cursor-pointer"
          onClick={() => setSidebarOpen((v) => !v)}
          aria-label="Toggle navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="pr-3 border-r border-slate-200">
          <span className="hidden sm:inline-flex">
            <AppLogo size={24} textColor="#374151" />
          </span>
          <span className="sm:hidden">
            <AppLogo size={24} showText={false} />
          </span>
        </div>

        <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider hidden sm:inline">
          Staff Portal
        </span>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-200 bg-white text-xs text-slate-600">
            <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[session.role] ?? "bg-slate-300"}`} />
            <span className="font-medium">{session.name}</span>
            <span className="text-slate-400 hidden sm:inline">· {ROLE_LABEL[session.role] ?? session.role}</span>
          </div>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden relative">

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/20 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── Sidebar ── */}
        <aside className={`
          absolute inset-y-0 left-0 z-50 w-52 bg-white border-r border-slate-200
          flex flex-col shrink-0 overflow-y-auto transition-transform duration-200
          md:relative md:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}>

          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 md:hidden">
            <span className="text-xs font-semibold text-slate-500">Navigation</span>
            <button onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
              <XIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="px-4 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              {staff.photoUrl ? (
                <img src={staff.photoUrl} alt={session.name} className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-matcha-100 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-matcha-700">
                    {session.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
                  </span>
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 truncate">{session.name}</p>
                <p className="text-[11px] text-slate-400 truncate">
                  {ROLE_LABEL[session.role] ?? session.role}
                </p>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 px-3 py-1.5">
              My Portal
            </p>

            <NavLink to="/portal" end className={sideNavClass} onClick={() => setSidebarOpen(false)}>
              <LayoutDashboard className="w-4 h-4 shrink-0" /> Dashboard
            </NavLink>

            <NavLink to="/portal/profile" className={sideNavClass} onClick={() => setSidebarOpen(false)}>
              <UserCircle className="w-4 h-4 shrink-0" /> My Profile
            </NavLink>

            <NavLink to="/portal/appointments" className={sideNavClass} onClick={() => setSidebarOpen(false)}>
              <CalendarCheck className="w-4 h-4 shrink-0" /> My Appointments
            </NavLink>

            <NavLink to="/portal/holidays" className={sideNavClass} onClick={() => setSidebarOpen(false)}>
              <CalendarDays className="w-4 h-4 shrink-0" /> My Holidays
            </NavLink>
          </nav>

          <div className="px-3 py-3 border-t border-slate-100">
            <button
              onClick={() => { setSidebarOpen(false); handleLogout(); }}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer w-full text-left"
            >
              <LogOut className="w-4 h-4 shrink-0" /> Sign out
            </button>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8">
            <Outlet />
          </div>
        </main>
      </div>

      <Toast toast={toast} />
    </div>
  );
}
