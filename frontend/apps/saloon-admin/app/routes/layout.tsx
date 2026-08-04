import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { redirect, Link, NavLink, Outlet, useNavigate, useMatch, useRouteError, isRouteErrorResponse, useLocation } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { getAdminSession, clearAdminSession } from "~/routes/login";
import { SalonErrorPage } from "@saloon/ui-website";
import { Trash2, LayoutDashboard, Pencil, Briefcase, Users, LogOut, ChevronRight, ChevronDown, Check, MapPin, Palette, Menu, X as XIcon, CalendarCheck, CreditCard, ShoppingBag, BarChart2, Gift, HelpCircle, Sparkles, ListChecks, PowerOff, Power, AlertTriangle } from "lucide-react";
import { AppLogo, Toast, useToast } from "@saloon/ui-shared";
import { Tooltip } from "~/components/Tooltip";
import { ADMIN_API, apiFetch, cacheSaloonUUID } from "~/lib/api";
import type { Saloon, LayoutContext, WebsiteMode } from "~/lib/types";

export async function clientLoader({ params, request }: ClientLoaderFunctionArgs) {
  const saloonId = params.saloonId!;
  const isPreview = new URL(request.url).pathname.endsWith("/website-preview");

  if (isPreview) {
    const saloon = await apiFetch<Saloon>(`${ADMIN_API}/${saloonId}`);
    cacheSaloonUUID(saloonId, String(saloon.id));
    return { saloon, saloonId, pendingServices: false, pendingStaff: false, pendingWebsite: false };
  }

  if (!getAdminSession()) {
    throw redirect("/login");
  }

  const saloon = await apiFetch<Saloon>(`${ADMIN_API}/${saloonId}`);
  cacheSaloonUUID(saloonId, String(saloon.id));

  let pendingServices = false;
  let pendingStaff = false;
  let pendingWebsite = false;

  const fetchTasks: Promise<void>[] = [];

  if (saloon.features?.includes("BOOKING")) {
    fetchTasks.push(
      Promise.all([
        apiFetch<{ id: number }[]>(`${ADMIN_API}/${saloon.id}/staff`).catch(() => [] as { id: number }[]),
        apiFetch<{ id: number }[]>(`${ADMIN_API}/${saloon.id}/services`).catch(() => [] as { id: number }[]),
      ]).then(([staffList, serviceList]) => {
        pendingServices = serviceList.length <= 1;
        pendingStaff = staffList.length <= 1;
      })
    );
  }

  if (saloon.features?.includes("STATIC_WEBSITE")) {
    fetchTasks.push(
      apiFetch<{ websiteType: string | null }>(`${ADMIN_API}/${saloon.id}/website`)
        .then((d) => { pendingWebsite = d.websiteType == null; })
        .catch(() => { pendingWebsite = true; })
    );
  }

  await Promise.all(fetchTasks);

  const pathname = new URL(request.url).pathname;
  const isIndex = pathname.endsWith(`/${saloonId}`) || pathname.endsWith(`/${saloonId}/`);
  if (isIndex && (pendingServices || pendingStaff || pendingWebsite)) {
    throw redirect(`/${saloonId}/setup`);
  }

  return { saloon, saloonId, pendingServices, pendingStaff, pendingWebsite };
}

// ── Feature nav map ───────────────────────────────────────────────────────────

const FEATURE_NAV: { key: string; label: string; hint: string; icon: React.ElementType; route?: string }[] = [
  { key: "STATIC_WEBSITE",  label: "Website",         hint: "Customise your public-facing page",       icon: Palette,        route: "website" },
  { key: "BOOKING",         label: "Booking Calendar", hint: "Online appointment scheduling",           icon: CalendarCheck,  route: "booking" },
  { key: "MEMBERSHIP",      label: "Membership",      hint: "Subscription plans for regular customers",icon: CreditCard,     route: "coming-soon" },
  { key: "WEBSHOP",         label: "Web Shop",        hint: "Sell products and gift cards online",     icon: ShoppingBag,    route: "coming-soon" },
  { key: "ANALYTICS",       label: "Analytics",       hint: "Track visits, revenue, and trends",       icon: BarChart2,      route: "coming-soon" },
  { key: "LOYALTY_PROGRAM", label: "Loyalty Program", hint: "Reward and retain your best customers",   icon: Gift,           route: "coming-soon" },
];

// ── Saloon switcher ───────────────────────────────────────────────────────────

function SaloonSwitcher({ current, saloonId }: { current: Saloon; saloonId: string }) {
  const navigate = useNavigate();
  const session  = getAdminSession();
  const saloons  = session?.saloons ?? [];
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const multiple  = saloons.length > 1;
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
            aria-label="Switch saloon"
            style={{ position: "fixed", top: panelPos.top, right: panelPos.right }}
            className="z-[60] bg-white border border-slate-200 rounded-xl shadow-lg w-64 overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-slate-100">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Switch saloon</p>
            </div>
            {saloons.map((s) => {
              const isActive = String(s.id) === currentId;
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

  if (isPublic) {
    return <SalonErrorPage is404={is404} />;
  }

  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center justify-center px-6 text-center"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-5">
        <span className="text-2xl">✂️</span>
      </div>
      <h1 className="text-lg font-bold text-slate-800 mb-2">
        {is404 ? "Saloon not found" : "Something went wrong"}
      </h1>
      <p className="text-sm text-slate-500 max-w-xs leading-relaxed mb-6">
        {is404
          ? "This saloon doesn't exist or the link is incorrect."
          : "An error occurred while loading this page."}
      </p>
      <div className="flex gap-3">
        <a
          href="/"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium no-underline hover:bg-slate-700 transition-colors"
        >
          ← Go home
        </a>
        {!is404 && (
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
  const { saloon: loaderSaloon, saloonId, pendingServices, pendingStaff, pendingWebsite } = useLoaderData<typeof clientLoader>();
  const navigate = useNavigate();
  const [saloon, setSaloon]             = useState<Saloon>(loaderSaloon as Saloon);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting]         = useState(false);
  const [deleteError, setDeleteError]   = useState<string | null>(null);
  const [enabling, setEnabling]         = useState(false);
  const [websiteMode, setWebsiteModeState] = useState<WebsiteMode | null>(null);
  const { toast, notify } = useToast();

  useEffect(() => { if (loaderSaloon) setSaloon(loaderSaloon); }, [loaderSaloon]);

  useEffect(() => {
    if (!saloon?.name) return;
    document.title = `${saloon.name} · my-saloon`;
    const initials = saloon.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><defs><linearGradient id='g' x1='0' y1='0' x2='32' y2='32' gradientUnits='userSpaceOnUse'><stop offset='0' stop-color='#4ade80'/><stop offset='1' stop-color='#059669'/></linearGradient></defs><rect width='32' height='32' rx='8' fill='url(#g)'/><text x='16' y='22' font-family='system-ui,sans-serif' font-size='13' font-weight='700' fill='white' text-anchor='middle'>${initials}</text></svg>`;
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
    link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }, [saloon?.name]);

  function setWebsiteMode(m: WebsiteMode | null) {
    setWebsiteModeState(m);
    if (m) {
      apiFetch(`${ADMIN_API}/${saloon!.id}/website-type`, {
        method: "PATCH",
        body: JSON.stringify({ websiteType: m }),
      }).catch((e) => notify(e instanceof Error ? e.message : "Failed to update website type", "error"));
    }
  }

  const ctx: LayoutContext = { saloon, setSaloon: (s) => setSaloon(s), websiteMode, setWebsiteMode, pendingServices, pendingStaff, pendingWebsite };
  const isPreview = Boolean(useMatch("/:saloonId/website-preview"));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [websiteCoachSeen, setWebsiteCoachSeen] = useState(
    () => Boolean(saloon && localStorage.getItem(`website-style-hint-seen:${saloon.id}`))
  );

  function markWebsiteCoachSeen() {
    if (saloon) localStorage.setItem(`website-style-hint-seen:${saloon.id}`, "1");
    setWebsiteCoachSeen(true);
  }

  if (isPreview) {
    if (!saloon?.features?.includes("STATIC_WEBSITE")) {
      return (
        <div className="min-h-[100dvh] bg-slate-50 flex flex-col items-center justify-center px-5 text-center">
          <div className="w-14 h-14 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mb-5">
            <AppLogo size={32} showText={false} />
          </div>
          <h1 className="text-lg font-bold text-slate-800 mb-2">{saloon?.name}</h1>
          <p className="text-sm text-slate-500 max-w-xs leading-relaxed">
            This saloon hasn't published a public website yet.
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
    clearAdminSession();
    navigate("/login");
  }

  async function handleDisable() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const updated = await apiFetch<Saloon>(`${ADMIN_API}/${saloon!.id}`, { method: "DELETE" });
      setSaloon(updated);
      setShowDeleteModal(false);
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : "Disable failed");
      setDeleting(false);
    }
  }

  async function handleEnable() {
    setEnabling(true);
    try {
      const updated = await apiFetch<Saloon>(`${ADMIN_API}/${saloon!.id}/enable`, { method: "PUT" });
      setSaloon(updated);
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
            <AppLogo size={24} textColor="#374151" />
          </span>
          <span className="sm:hidden">
            <AppLogo size={24} showText={false} />
          </span>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300 hidden sm:block" />
        <span className="text-sm text-slate-500 truncate max-w-[160px] sm:max-w-none">{saloon.name}</span>

        <div className="ml-auto flex items-center gap-2">
          <SaloonSwitcher current={saloon} saloonId={saloonId} />
          <Tooltip content="Sign out of the admin panel. You'll need to verify your email again to get back in." side="bottom">
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
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
            <p className="text-xs font-semibold text-slate-900 truncate">{saloon.name}</p>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
              {saloon.owner?.name}
              {saloon.location?.city ? ` · ${saloon.location.city}` : ""}
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

            <Tooltip content="A read-only snapshot of your saloon — identity, location, hours, and active features.">
              <NavLink to="" end className={sideNavClass} onClick={() => setSidebarOpen(false)}>
                <LayoutDashboard className="w-4 h-4 shrink-0" /> Overview
              </NavLink>
            </Tooltip>

            <Tooltip content="Update your saloon's name, location, contact info, operating hours, and enabled features.">
              <NavLink to="edit" className={sideNavClass} onClick={() => setSidebarOpen(false)}>
                <Pencil className="w-4 h-4 shrink-0" /> Edit Saloon
              </NavLink>
            </Tooltip>

            <Tooltip content="Build your booking menu — add treatments, set pricing, duration, and assign staff.">
              <NavLink to="services" className={sideNavClass} onClick={() => setSidebarOpen(false)}>
                <Briefcase className="w-4 h-4 shrink-0" /> Saloon Services
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

            {FEATURE_NAV.some((f) => saloon.features?.includes(f.key)) && (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 px-3 py-1.5 mt-2">
                  Features
                </p>
                {FEATURE_NAV.filter((f) => saloon.features?.includes(f.key)).map((f) =>
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
            <Tooltip content="Disable this saloon. It will no longer accept bookings or appear publicly, but all data is preserved and it can be re-enabled later.">
              <button
                onClick={() => { setSidebarOpen(false); setShowDeleteModal(true); }}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer w-full text-left"
              >
                <PowerOff className="w-4 h-4 shrink-0" /> Disable saloon
              </button>
            </Tooltip>
          </div>
        </aside>

        {/* ── Main content ──────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8">
            {saloon.status === "DISABLED" ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center mb-5">
                  <AlertTriangle className="w-6 h-6 text-amber-500" />
                </div>
                <h2 className="text-lg font-bold text-slate-800 mb-2">This saloon is disabled</h2>
                <p className="text-sm text-slate-500 max-w-xs leading-relaxed mb-6">
                  <strong className="text-slate-700">{saloon.name}</strong> is currently disabled. It won't accept new bookings or appear publicly. All data is intact — enable it to restore full access.
                </p>
                <button
                  onClick={handleEnable}
                  disabled={enabling}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-matcha-600 hover:bg-matcha-700 text-white transition-colors cursor-pointer disabled:opacity-45"
                >
                  <Power className="w-4 h-4" />
                  {enabling ? "Enabling…" : "Enable saloon"}
                </button>
              </div>
            ) : (
              <Outlet context={ctx} />
            )}
          </div>
        </main>
      </div>

      {/* ── Disable modal ───────────────────────────────────────────────── */}
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
              <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <PowerOff className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Disable saloon</h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  <strong className="text-slate-700">{saloon.name}</strong> will be disabled — it won't accept bookings or appear publicly. All data is preserved and you can re-enable it at any time.
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
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 transition-colors cursor-pointer disabled:opacity-45"
                onClick={handleDisable}
                disabled={deleting}
              >
                <PowerOff className="w-3 h-3" />
                {deleting ? "Disabling…" : "Disable"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </div>
  );
}
