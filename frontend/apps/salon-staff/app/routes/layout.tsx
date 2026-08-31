import { redirect, NavLink, Outlet, useNavigate, useRouteError, isRouteErrorResponse, useLoaderData } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { LayoutDashboard, CalendarCheck, CalendarDays, UserCircle, Images, LogOut, Menu, X as XIcon, Store, ChevronDown, Check } from "lucide-react";
import { AppLogo, SessionBadge, Toast, useToast } from "@salon/ui-shared";
import {
  getStaffSession,
  getAccessTokenExpiry,
  logout as authLogout,
  buildStaffSession,
  startSilentRenewLoop,
  startOAuth2Login,
} from "~/lib/auth";
import { STAFF_PORTAL_API, apiFetch } from "~/lib/api";
import type { StaffMember, StaffSession } from "~/lib/types";

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

  const is403 =
    isRouteErrorResponse(error)
      ? error.status === 403
      : error instanceof Error
      ? /HTTP 403|not authorized/i.test(error.message)
      : false;

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 text-center">
      <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-5">
        <span className="text-2xl">{is403 ? "🔒" : "✂️"}</span>
      </div>
      <h1 className="text-lg font-bold text-slate-800 mb-2">
        {is403 ? "You are not authorized" : is404 ? "Page not found" : "Something went wrong"}
      </h1>
      <p className="text-sm text-slate-500 max-w-xs leading-relaxed mb-6">
        {is403
          ? "You don't have permission to view this page."
          : is404
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
        {!is404 && !is403 && (
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

// ── Salon switcher ───────────────────────────────────────────────────────────
// Staff can belong to more than one salon; each shows up as its own account
// in `session.accounts` (captured at login). Switching means signing into a
// different account, so we swap the session and reload the portal fresh.

function StaffSwitcher({ session }: { session: StaffSession }) {
  const accounts = session.accounts ?? [];
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  if (accounts.length <= 1) return null;

  function openDropdown() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPanelPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function handlePick(m: StaffMember) {
    setOpen(false);
    if (m.id === session.staffId) return;
    buildStaffSession(m, accounts);
    window.location.assign("/portal");
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => open ? setOpen(false) : openDropdown()}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
      >
        <Store className="w-3 h-3 text-matcha-500 shrink-0" />
        <span className="truncate max-w-[100px] sm:max-w-[160px]">{session.salonName ?? "Select salon"}</span>
        <ChevronDown className={`w-3 h-3 text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && createPortal(
        <>
          <div className="fixed inset-0 z-[59]" onClick={() => setOpen(false)} />
          <div
            role="listbox"
            aria-label="Switch salon"
            style={{ position: "fixed", top: panelPos.top, right: panelPos.right }}
            className="z-[60] bg-white border border-slate-200 rounded-xl shadow-lg w-64 overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-slate-100">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Switch salon</p>
            </div>
            {accounts.map((m) => {
              const isActive = m.id === session.staffId;
              return (
                <button
                  key={m.id}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => handlePick(m)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer ${
                    isActive ? "bg-matcha-50 text-matcha-700" : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className="w-7 h-7 rounded-md bg-matcha-100 border border-matcha-200 flex items-center justify-center shrink-0">
                    <span className="text-[11px] font-bold text-matcha-600">
                      {m.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.salonName ?? m.salonHandler ?? "Salon"}</p>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{ROLE_LABEL[m.role] ?? m.role}</p>
                  </div>
                  {isActive && <Check className="w-3.5 h-3.5 text-matcha-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        </>,
        document.body
      )}
    </>
  );
}

export default function Layout() {
  const navigate = useNavigate();
  const { toast, notify } = useToast();
  const { staff } = useLoaderData<typeof clientLoader>();
  const session = getStaffSession()!;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // getAccessTokenExpiry() is read once here and then only ever updated by
  // the renew loop below — a silent renew rewrites localStorage but doesn't
  // otherwise touch React state, so without this the header badge would
  // keep counting down to the pre-renewal expiry and flash "Expired".
  const [tokenExpiry, setTokenExpiry] = useState<number | null>(() => getAccessTokenExpiry());
  const [renewing, setRenewing] = useState(false);

  // Steps 8-13: keep the access token alive via hidden-iframe silent renew
  // for as long as the AS session cookie stays valid. Once that cookie has
  // actually expired the iframe comes back empty-handed, so fall back to a
  // full, visible re-authentication instead of letting the next API call
  // just start failing with 401s.
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
        setTimeout(() => startOAuth2Login(), 1200);
      },
      () => setRenewing(true)
    );
  }, []);

  const sideNavClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? "bg-matcha-50 text-matcha-700"
        : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
    }`;

  function handleLogout() {
    authLogout(navigate);
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
            <AppLogo size={24} textColor="#374151" onClick={() => navigate("/portal")} />
          </span>
          <span className="sm:hidden">
            <AppLogo size={24} showText={false} onClick={() => navigate("/portal")} />
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Staff Portal</span>
          {session.salonName && (session.accounts?.length ?? 0) <= 1 && (
            <>
              <span className="text-slate-200 select-none">·</span>
              <span className="text-xs font-semibold text-matcha-600">{session.salonName}</span>
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2 min-w-0">
          <div className="hidden md:flex">
            <SessionBadge email={session.email} expiresAt={tokenExpiry} renewing={renewing} />
          </div>
          <StaffSwitcher session={session} />
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-200 bg-white text-xs text-slate-600 min-w-0">
            <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[session.role] ?? "bg-slate-300"}`} />
            <span className="font-medium truncate max-w-[100px] md:max-w-[160px]">{session.name}</span>
            <span className="text-slate-400 hidden md:inline shrink-0">· {ROLE_LABEL[session.role] ?? session.role}</span>
          </div>
          <button
            onClick={handleLogout}
            className="shrink-0 inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
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
                {session.salonName && (
                  <div className="flex items-center gap-1 mt-1">
                    <Store className="w-3 h-3 text-matcha-500 shrink-0" />
                    <span className="text-[11px] text-matcha-600 font-medium truncate">{session.salonName}</span>
                  </div>
                )}
                {session.salonHandler && (
                  <span className="text-[10px] text-slate-400 font-mono truncate block">@{session.salonHandler}</span>
                )}
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

            <NavLink to="/portal/media" className={sideNavClass} onClick={() => setSidebarOpen(false)}>
              <Images className="w-4 h-4 shrink-0" /> My Work Media
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
