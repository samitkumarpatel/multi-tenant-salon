import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { redirect, Link, NavLink, Outlet, useNavigate, useMatch, useRouteError, isRouteErrorResponse, useLocation } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { getAdminSession, getAccessTokenExpiry, logout as authLogout, startSilentRenewLoop, startOAuth2Login } from "~/lib/auth";
import { SalonErrorPage } from "@salon/ui-website";
import { Trash2, LayoutDashboard, Pencil, Briefcase, Users, LogOut, ChevronRight, ChevronDown, Check, MapPin, Palette, Menu, X as XIcon, CalendarCheck, CalendarDays, CreditCard, ShoppingBag, BarChart2, Gift, HelpCircle, Sparkles, ListChecks, Power, AlertTriangle } from "lucide-react";
import { AppLogo, SessionBadge, Toast, useToast } from "@salon/ui-shared";
import { Tooltip } from "~/components/Tooltip";
import { ADMIN_API, CUSTOMER_API, apiFetch, cacheSalonUUID } from "~/lib/api";
import { SALON_DOMAIN } from "~/lib/config";
import type { Salon, LayoutContext, WebsiteMode } from "~/lib/types";

export async function clientLoader({ params, request }: ClientLoaderFunctionArgs) {
  const salonId = params.salonId!;
  const isPreview = new URL(request.url).pathname.endsWith("/website-preview");

  if (isPreview) {
    // Public, shareable preview — deliberately skips the session check below,
    // so it must fetch through the public alias (CUSTOMER_API), not the
    // owner-gated ADMIN_API. Using ADMIN_API here would 401/403 for anyone
    // but the salon's own owner, defeating the point of a shareable link,
    // and would surface as an "authorized" error rather than a clean 404
    // for a bad/unknown id.
    const salon = await apiFetch<Salon>(`${CUSTOMER_API}/${salonId}`);
    cacheSalonUUID(salonId, String(salon.id));
    return { salon, salonId, pendingServices: false, pendingStaff: false, pendingWebsite: false };
  }

  if (!getAdminSession()) {
    throw redirect("/login");
  }

  const salon = await apiFetch<Salon>(`${ADMIN_API}/${salonId}`);
  cacheSalonUUID(salonId, String(salon.id));

  if (salon.status === "DISABLED") {
    return { salon, salonId, pendingServices: false, pendingStaff: false, pendingWebsite: false };
  }

  let pendingServices = false;
  let pendingStaff = false;
  let pendingWebsite = false;

  const fetchTasks: Promise<void>[] = [];

  if (salon.features?.includes("BOOKING")) {
    fetchTasks.push(
      Promise.all([
        apiFetch<{ id: number }[]>(`${ADMIN_API}/${salon.id}/staff`).catch(() => [] as { id: number }[]),
        apiFetch<{ id: number }[]>(`${ADMIN_API}/${salon.id}/services`).catch(() => [] as { id: number }[]),
      ]).then(([staffList, serviceList]) => {
        pendingServices = serviceList.length <= 1;
        pendingStaff = staffList.length <= 1;
      })
    );
  }

  if (salon.features?.includes("STATIC_WEBSITE")) {
    fetchTasks.push(
      apiFetch<{ websiteType: string | null }>(`${ADMIN_API}/${salon.id}/website`)
        .then((d) => { pendingWebsite = d.websiteType == null; })
        .catch(() => { pendingWebsite = true; })
    );
  }

  await Promise.all(fetchTasks);

  const pathname = new URL(request.url).pathname;
  const isIndex = pathname.endsWith(`/${salonId}`) || pathname.endsWith(`/${salonId}/`);
  if (isIndex && (pendingServices || pendingStaff || pendingWebsite)) {
    throw redirect(`/${salonId}/setup`);
  }

  return { salon, salonId, pendingServices, pendingStaff, pendingWebsite };
}

// ── Feature nav map ───────────────────────────────────────────────────────────

const FEATURE_NAV: { key: string; label: string; hint: string; icon: React.ElementType; route?: string }[] = [
  { key: "STATIC_WEBSITE",  label: "Website",         hint: "Customise your public-facing page",       icon: Palette,        route: "website" },
  { key: "BOOKING",         label: "Booking Calendar", hint: "Online appointment scheduling",           icon: CalendarCheck,  route: "booking" },
  { key: "MEMBERSHIP",      label: "Membership",      hint: "Subscription plans for regular customers",icon: CreditCard,     route: "coming-soon" },
  { key: "WEBSHOP",         label: "Web Shop",        hint: "Sell products and gift cards online",     icon: ShoppingBag,    route: "coming-soon" },
  { key: "ANALYTICS",       label: "Analytics",       hint: "Track visits, revenue, and trends",       icon: BarChart2,      route: "analytics" },
  { key: "LOYALTY_PROGRAM", label: "Loyalty Program", hint: "Reward and retain your best customers",   icon: Gift,           route: "coming-soon" },
];

// ── Salon switcher ───────────────────────────────────────────────────────────

function SalonSwitcher({ current, salonId, onSalonEnabled }: { current: Salon; salonId: string; onSalonEnabled: (s: Salon) => void }) {
  const navigate = useNavigate();
  const session  = getAdminSession();
  const salons  = session?.salons ?? [];
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 0, right: 0 });
  const [enablingId, setEnablingId] = useState<string | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const multiple  = salons.length > 1;
  const currentId = String(current.id);

  if (!multiple) return null;

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

  async function handleEnable(e: React.MouseEvent, s: Salon) {
    e.stopPropagation();
    setEnablingId(String(s.id));
    try {
      const updated = await apiFetch<Salon>(`${ADMIN_API}/${s.id}/enable`, { method: "PUT" });
      setOpen(false);
      if (String(s.id) === currentId) {
        onSalonEnabled(updated);
      } else {
        navigate(`/${s.id}`);
      }
    } finally {
      setEnablingId(null);
    }
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
        <span className="truncate max-w-[100px] sm:max-w-[160px]">{current.name}</span>
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
            {salons.map((s) => {
              const isActive  = String(s.id) === currentId;
              const isDisabled = s.status === "DISABLED";
              const isEnabling = enablingId === String(s.id);
              if (isDisabled) {
                return (
                  <div
                    key={String(s.id)}
                    className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 opacity-60"
                  >
                    <div className="w-7 h-7 rounded-md bg-slate-200 border border-slate-300 flex items-center justify-center shrink-0">
                      <span className="text-[11px] font-bold text-slate-400">
                        {s.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-400 truncate line-through">{s.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Deleted</p>
                    </div>
                    <button
                      onClick={(e) => handleEnable(e, s)}
                      disabled={isEnabling}
                      className="shrink-0 text-[10px] font-semibold text-matcha-600 hover:text-matcha-700 border border-matcha-200 rounded px-1.5 py-0.5 bg-white hover:bg-matcha-50 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isEnabling ? "…" : "Restore"}
                    </button>
                  </div>
                );
              }
              return (
                <button
                  key={String(s.id)}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => { setOpen(false); if (!isActive) navigate(`/${s.id}`); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer ${
                    isActive ? "bg-matcha-50 text-matcha-700" : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className="w-7 h-7 rounded-md bg-matcha-100 border border-matcha-200 flex items-center justify-center shrink-0">
                    <span className="text-[11px] font-bold text-matcha-600">
                      {s.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.name}</p>
                    {s.location?.city && (
                      <p className="text-[11px] text-slate-400 truncate flex items-center gap-0.5 mt-0.5">
                        <MapPin className="w-2.5 h-2.5 shrink-0" />
                        {s.location.city}{s.location.country ? `, ${s.location.country}` : ""}
                      </p>
                    )}
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

// ── Error boundary ────────────────────────────────────────────────────────────

export function ErrorBoundary() {
  const error    = useRouteError();
  const { pathname } = useLocation();
  const isPublic = pathname.endsWith("/website-preview");

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

  if (isPublic) {
    return <SalonErrorPage is404={is404} />;
  }

  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center justify-center px-6 text-center"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-5">
        <span className="text-2xl">{is403 ? "🔒" : "✂️"}</span>
      </div>
      <h1 className="text-lg font-bold text-slate-800 mb-2">
        {is403 ? "You are not authorized" : is404 ? "Salon not found" : "Something went wrong"}
      </h1>
      <p className="text-sm text-slate-500 max-w-xs leading-relaxed mb-6">
        {is403
          ? "You don't have permission to view this salon."
          : is404
          ? "This salon doesn't exist or the link is incorrect."
          : "An error occurred while loading this page."}
      </p>
      <div className="flex gap-3">
        <a
          href="/"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium no-underline hover:bg-slate-700 transition-colors"
        >
          ← Go home
        </a>
        {!is404 && !is403 && (
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer"
          >
            ↻ Retry
          </button>
        )}
      </div>
    </div>
  );
}

// ── Admin layout ──────────────────────────────────────────────────────────────

export default function Layout() {
  const { salon: loaderSalon, salonId, pendingServices, pendingStaff, pendingWebsite } = useLoaderData<typeof clientLoader>();
  const navigate = useNavigate();
  const session = getAdminSession();
  const [salon, setSalon]             = useState<Salon>(loaderSalon as Salon);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting]         = useState(false);
  const [deleteError, setDeleteError]   = useState<string | null>(null);
  const [enabling, setEnabling]         = useState(false);
  const [websiteMode, setWebsiteModeState] = useState<WebsiteMode | null>(null);
  const { toast, notify } = useToast();
  // getAccessTokenExpiry() is read once here and then only ever updated by
  // the renew loop below — a silent renew rewrites localStorage but doesn't
  // otherwise touch React state, so without this the header badge would
  // keep counting down to the pre-renewal expiry and flash "Expired".
  const [tokenExpiry, setTokenExpiry] = useState<number | null>(() => getAccessTokenExpiry());
  const [renewing, setRenewing] = useState(false);

  useEffect(() => { if (loaderSalon) setSalon(loaderSalon); }, [loaderSalon]);

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

  useEffect(() => {
    if (!salon?.name) return;
    document.title = `${salon.name} · ${SALON_DOMAIN}`;
    const initials = salon.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><defs><linearGradient id='g' x1='0' y1='0' x2='32' y2='32' gradientUnits='userSpaceOnUse'><stop offset='0' stop-color='#4ade80'/><stop offset='1' stop-color='#059669'/></linearGradient></defs><rect width='32' height='32' rx='8' fill='url(#g)'/><text x='16' y='22' font-family='system-ui,sans-serif' font-size='13' font-weight='700' fill='white' text-anchor='middle'>${initials}</text></svg>`;
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
    link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }, [salon?.name]);

  function setWebsiteMode(m: WebsiteMode | null) {
    setWebsiteModeState(m);
    if (m) {
      apiFetch(`${ADMIN_API}/${salon!.id}/website-type`, {
        method: "PATCH",
        body: JSON.stringify({ websiteType: m }),
      }).catch((e) => notify(e instanceof Error ? e.message : "Failed to update website type", "error"));
    }
  }

  const ctx: LayoutContext = { salon, setSalon: (s) => setSalon(s), websiteMode, setWebsiteMode, pendingServices, pendingStaff, pendingWebsite };
  const isPreview = Boolean(useMatch("/:salonId/website-preview"));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [websiteCoachSeen, setWebsiteCoachSeen] = useState(
    () => Boolean(salon && localStorage.getItem(`website-style-hint-seen:${salon.id}`))
  );

  function markWebsiteCoachSeen() {
    if (salon) localStorage.setItem(`website-style-hint-seen:${salon.id}`, "1");
    setWebsiteCoachSeen(true);
  }

  if (isPreview) {
    if (!salon?.features?.includes("STATIC_WEBSITE")) {
      return (
        <div className="min-h-[100dvh] bg-slate-50 flex flex-col items-center justify-center px-5 text-center">
          <div className="w-14 h-14 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mb-5">
            <AppLogo size={32} showText={false} />
          </div>
          <h1 className="text-lg font-bold text-slate-800 mb-2">{salon?.name}</h1>
          <p className="text-sm text-slate-500 max-w-xs leading-relaxed">
            This salon hasn't published a public website yet.
          </p>
        </div>
      );
    }
    return <Outlet context={ctx} />;
  }

  const sideNavClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? "bg-matcha-50 text-matcha-700"
        : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
    }`;

  function handleLogout() {
    authLogout(navigate);
  }

  async function handleDisable() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const updated = await apiFetch<Salon>(`${ADMIN_API}/${salon!.id}`, { method: "DELETE" });
      setSalon(updated);
      setShowDeleteModal(false);
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : "Disable failed");
      setDeleting(false);
    }
  }

  async function handleEnable() {
    setEnabling(true);
    try {
      const updated = await apiFetch<Salon>(`${ADMIN_API}/${salon!.id}/enable`, { method: "PUT" });
      setSalon(updated);
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Enable failed", "error");
    } finally {
      setEnabling(false);
    }
  }

  return (
    <div className="h-[100dvh] bg-slate-50 flex flex-col overflow-hidden">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
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
            <AppLogo size={24} textColor="#374151" onClick={() => navigate("/salons")} />
          </span>
          <span className="sm:hidden">
            <AppLogo size={24} showText={false} onClick={() => navigate("/salons")} />
          </span>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300 hidden sm:block" />
        <span className="text-sm text-slate-500 truncate max-w-[120px] sm:max-w-none min-w-0">{salon.name}</span>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2 shrink-0">
          {session && (
            <div className="hidden md:flex">
              <SessionBadge email={session.email} expiresAt={tokenExpiry} renewing={renewing} />
            </div>
          )}
          <SalonSwitcher current={salon} salonId={salonId} onSalonEnabled={(s) => setSalon(s)} />
          <Tooltip content="Sign out of the admin panel. You'll need to verify your email again to get back in." side="bottom">
            <button
              onClick={handleLogout}
              className="shrink-0 inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <LogOut className="w-3 h-3" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </Tooltip>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative">

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/20 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── Sidebar ───────────────────────────────────────────────────── */}
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
            <p className="text-xs font-semibold text-slate-900 truncate">{salon.name}</p>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
              {salon.owner?.name}
              {salon.location?.city ? ` · ${salon.location.city}` : ""}
            </p>
          </div>

          <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 px-3 py-1.5">
              Manage
            </p>

            {(pendingServices || pendingStaff || pendingWebsite) && (
              <Tooltip content="Finish your onboarding checklist to prepare for your first customer.">
                <NavLink to="setup" className={sideNavClass} onClick={() => setSidebarOpen(false)}>
                  <ListChecks className="w-4 h-4 shrink-0" /> Get started
                  <span className="ml-auto relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                  </span>
                </NavLink>
              </Tooltip>
            )}

            <Tooltip content="A read-only snapshot of your salon — identity, location, hours, and active features.">
              <NavLink to="" end className={sideNavClass} onClick={() => setSidebarOpen(false)}>
                <LayoutDashboard className="w-4 h-4 shrink-0" /> Overview
              </NavLink>
            </Tooltip>

            <Tooltip content="Update your salon's name, location, contact info, operating hours, and enabled features.">
              <NavLink to="edit" className={sideNavClass} onClick={() => setSidebarOpen(false)}>
                <Pencil className="w-4 h-4 shrink-0" /> Edit Salon
              </NavLink>
            </Tooltip>

            <Tooltip content="Build your booking menu — add treatments, set pricing, duration, and assign staff.">
              <NavLink to="services" className={sideNavClass} onClick={() => setSidebarOpen(false)}>
                <Briefcase className="w-4 h-4 shrink-0" /> Salon Services
                {pendingServices && (
                  <span className="ml-auto relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                  </span>
                )}
              </NavLink>
            </Tooltip>

            <Tooltip content="Add team members, set their roles and specializations, and control booking availability.">
              <NavLink to="staff" className={sideNavClass} onClick={() => setSidebarOpen(false)}>
                <Users className="w-4 h-4 shrink-0" /> Staff
                {pendingStaff && (
                  <span className="ml-auto relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                  </span>
                )}
              </NavLink>
            </Tooltip>

            {salon.features?.includes("BOOKING") && (
              <Tooltip content="Define recurring or one-time public holidays that block the booking calendar.">
                <NavLink to="holiday" className={sideNavClass} onClick={() => setSidebarOpen(false)}>
                  <CalendarDays className="w-4 h-4 shrink-0" /> Holidays
                </NavLink>
              </Tooltip>
            )}

            {FEATURE_NAV.some((f) => salon.features?.includes(f.key)) && (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 px-3 py-1.5 mt-2">
                  Features
                </p>
                {FEATURE_NAV.filter((f) => salon.features?.includes(f.key)).map((f) =>
                  f.route ? (
                    <React.Fragment key={f.key}>
                      <Tooltip content={f.hint}>
                        <NavLink
                          to={f.route}
                          className={sideNavClass}
                          onClick={() => {
                            setSidebarOpen(false);
                            if (f.key === "STATIC_WEBSITE") markWebsiteCoachSeen();
                          }}
                        >
                          <f.icon className="w-4 h-4 shrink-0" />
                          {f.label}
                          {f.route === "coming-soon" && (
                            <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-slate-400 border border-slate-200 rounded px-1">Soon</span>
                          )}
                          {f.key === "STATIC_WEBSITE" && !websiteCoachSeen && (
                            <span className="ml-auto relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                            </span>
                          )}
                        </NavLink>
                      </Tooltip>
                      {f.key === "STATIC_WEBSITE" && !websiteCoachSeen && (
                        <div className="mx-3 mt-0.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5" /> Tip
                            </span>
                            <button
                              onClick={markWebsiteCoachSeen}
                              className="text-amber-400 hover:text-amber-700 transition-colors cursor-pointer"
                              title="Dismiss tip"
                            >
                              <XIcon className="w-3 h-3" />
                            </button>
                          </div>
                          <p className="text-[11px] text-amber-800 leading-snug">
                            Choose how your public page looks — classic, AI-generated, or contact form.
                          </p>
                        </div>
                      )}
                    </React.Fragment>
                  ) : (
                    <Tooltip key={f.key} content={`${f.hint} Coming soon.`}>
                      <span className="flex items-center gap-3 px-3 py-2 rounded-md text-slate-300 cursor-default select-none">
                        <f.icon className="w-4 h-4 shrink-0" />
                        <span className="text-sm font-medium">{f.label}</span>
                        <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-slate-300 border border-slate-200 rounded px-1">Soon</span>
                      </span>
                    </Tooltip>
                  )
                )}
              </>
            )}
          </nav>

          <div className="px-3 py-3 border-t border-slate-100 flex flex-col gap-0.5">
            <Tooltip content="Find documentation, FAQs, and ways to get in touch with support.">
              <NavLink to="help" className={sideNavClass} onClick={() => setSidebarOpen(false)}>
                <HelpCircle className="w-4 h-4 shrink-0" /> Help &amp; Support
              </NavLink>
            </Tooltip>
            <Tooltip content="Delete this salon. It will no longer accept bookings or appear publicly, but all data is preserved and it can be re-enabled later.">
              <button
                onClick={() => { setSidebarOpen(false); setShowDeleteModal(true); }}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-red-500 hover:bg-red-50 transition-colors cursor-pointer w-full text-left"
              >
                <Trash2 className="w-4 h-4 shrink-0" /> Delete salon
              </button>
            </Tooltip>
          </div>
        </aside>

        {/* ── Main content ──────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8">
            {salon.status === "DISABLED" ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center mb-5">
                  <AlertTriangle className="w-6 h-6 text-amber-500" />
                </div>
                <h2 className="text-lg font-bold text-slate-800 mb-2">This salon is disabled</h2>
                <p className="text-sm text-slate-500 max-w-xs leading-relaxed mb-6">
                  <strong className="text-slate-700">{salon.name}</strong> is currently disabled. It won't accept new bookings or appear publicly. All data is intact — enable it to restore full access.
                </p>
                <button
                  onClick={handleEnable}
                  disabled={enabling}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-matcha-600 hover:bg-matcha-700 text-white transition-colors cursor-pointer disabled:opacity-45"
                >
                  <Power className="w-4 h-4" />
                  {enabling ? "Enabling…" : "Enable salon"}
                </button>
              </div>
            ) : (
              <Outlet context={ctx} />
            )}
          </div>
        </main>
      </div>

      {/* ── Delete modal ────────────────────────────────────────────────── */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => !deleting && setShowDeleteModal(false)}
        >
          <div
            className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Delete salon</h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  <strong className="text-slate-700">{salon.name}</strong> will be deleted — it won't accept bookings or appear publicly. All data is preserved and you can restore it at any time.
                </p>
              </div>
            </div>
            {deleteError && (
              <p className="text-xs font-semibold text-red-600 mb-3">{deleteError}</p>
            )}
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                className="px-4 py-2 rounded-md border border-slate-200 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-45"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium text-white bg-red-600 hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-45"
                onClick={handleDisable}
                disabled={deleting}
              >
                <Trash2 className="w-3 h-3" />
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </div>
  );
}
