import React, { useState, useEffect } from "react";
import { Link, NavLink, Outlet, useNavigate, useMatch, useRouteError, isRouteErrorResponse, useLocation, useRevalidator } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { SalonErrorPage } from "@saloon/ui-website";
import { Trash2, LayoutDashboard, Pencil, Briefcase, Users, Mail, KeyRound, LogOut, ChevronRight, Palette, Menu, X as XIcon, CalendarCheck, CreditCard, ShoppingBag, BarChart2, Gift, HelpCircle } from "lucide-react";
import { AppLogo } from "~/components/Logo";
import { ADMIN_API, apiFetch, cacheSaloonUUID } from "~/lib/api";
import type { Saloon, LayoutContext, WebsiteMode } from "~/lib/types";

export async function clientLoader({ params, request }: ClientLoaderFunctionArgs) {
  const saloonId = params.saloonId!;
  const isPreview = new URL(request.url).pathname.endsWith("/c");

  if (isPreview) {
    // single endpoint handles both UUID and handler
    const saloon = await apiFetch<Saloon>(`${ADMIN_API}/${saloonId}`);
    cacheSaloonUUID(saloonId, String(saloon.id));
    return { saloon, saloonId };
  }

  const authed = Boolean(sessionStorage.getItem(`saloon-auth:${saloonId}`));
  if (!authed) {
    return { saloon: null, saloonId };
  }

  // single endpoint handles both UUID and handler
  const saloon = await apiFetch<Saloon>(`${ADMIN_API}/${saloonId}`);
  cacheSaloonUUID(saloonId, String(saloon.id));
  return { saloon, saloonId };
}

// ── Login gate ────────────────────────────────────────────────────────────────

const STATIC_OTP = "123456";

const inputCls =
  "w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white text-slate-900 outline-none focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 transition placeholder:text-slate-400";

type LoginStep = "email" | "sending" | "otp";

function LoginGate({ saloonId, onSuccess }: { saloonId: string; onSuccess: () => void }) {
  const [step, setStep]         = useState<LoginStep>("email");
  const [email, setEmail]       = useState("");
  const [otp, setOtp]           = useState("");
  const [emailErr, setEmailErr] = useState("");
  const [otpErr, setOtpErr]     = useState("");
  const [verifying, setVerifying] = useState(false);

  const displayId = saloonId.length > 16 ? `${saloonId.substring(0, 8)}…` : saloonId;

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();

    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailErr("Enter a valid email address.");
      return;
    }

    setEmailErr("");
    setStep("sending");
    setTimeout(() => setStep("otp"), 1500);
  }

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) return;

    setVerifying(true);
    setTimeout(() => {
      if (otp === STATIC_OTP) {
        onSuccess();
      } else {
        setOtpErr("Incorrect code. Please try again.");
        setOtp("");
        setVerifying(false);
      }
    }, 800);
  }

  function handleOtpChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    setOtp(digits);
    setOtpErr("");
  }

  return (
    <div className="h-[100dvh] bg-slate-50 flex flex-col overflow-y-auto">

      <header className="h-12 border-b border-slate-200 bg-white flex items-center px-6 shrink-0">
        <div className="flex items-center gap-2">
          <AppLogo size={24} textColor="#374151" />
          <span className="text-slate-300 text-sm mx-1">/</span>
          <span className="text-sm text-slate-500 truncate max-w-[180px] font-mono">{displayId}</span>
        </div>
        <div className="ml-auto">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
            Admin
          </span>
        </div>
      </header>

      <div className="flex flex-1 items-start justify-center px-4 pt-14 pb-10">
        <div className="w-full max-w-[360px]">

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">

            <div className="px-6 py-5 border-b border-slate-100">
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-7 h-7 rounded-full bg-matcha-100 flex items-center justify-center shrink-0">
                  <KeyRound className="w-3.5 h-3.5 text-matcha-600" />
                </div>
                <h1 className="text-sm font-semibold text-slate-900">Sign in to admin panel</h1>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed pl-9">
                {step === "email" && "Enter your owner email — we'll send you a one-time code."}
                {step === "sending" && "Sending your code…"}
                {step === "otp"  && <>Code sent to <span className="font-medium text-slate-700">{email}</span>. Check your inbox.</>}
              </p>
            </div>

            <div className="px-6 py-5 space-y-4">

              {step === "email" && (
                <form onSubmit={handleSend} className="flex flex-col gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      Owner email address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                      <input
                        type="email"
                        autoFocus
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setEmailErr(""); }}
                        onKeyDown={(e) => e.key === "Enter" && handleSend(e as unknown as React.FormEvent)}
                        placeholder="owner@example.com"
                        className={`${inputCls} pl-8 ${emailErr ? "border-red-400 focus:border-red-400 focus:ring-red-400/10" : ""}`}
                      />
                    </div>
                    {emailErr && <p className="text-red-500 text-[11px] mt-1.5 leading-snug">{emailErr}</p>}
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-lg bg-matcha-600 text-white text-xs font-semibold hover:bg-matcha-700 transition cursor-pointer"
                  >
                    Send one-time code →
                  </button>
                </form>
              )}

              {step === "sending" && (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-10 h-10 rounded-full border-2 border-matcha-200 border-t-matcha-600 animate-spin" />
                  <p className="text-xs text-slate-500">Delivering your code to <span className="font-medium text-slate-700">{email}</span>…</p>
                </div>
              )}

              {step === "otp" && (
                <form onSubmit={handleVerify} className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 shrink-0">
                      Dev
                    </span>
                    <p className="text-[11px] text-amber-700">
                      Static OTP in use — enter <span className="font-mono font-bold tracking-widest">{STATIC_OTP}</span>
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      6-digit verification code
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="\d{6}"
                      maxLength={6}
                      autoFocus
                      value={otp}
                      onChange={(e) => handleOtpChange(e.target.value)}
                      placeholder="000000"
                      className={`${inputCls} text-center font-mono text-2xl tracking-[0.4em] py-3 ${otpErr ? "border-red-400 focus:border-red-400 focus:ring-red-400/10" : ""}`}
                    />
                    {otpErr && <p className="text-red-500 text-[11px] mt-1.5">{otpErr}</p>}
                  </div>

                  <button
                    type="submit"
                    disabled={otp.length !== 6 || verifying}
                    className="w-full py-2.5 rounded-lg bg-matcha-600 text-white text-xs font-semibold hover:bg-matcha-700 disabled:opacity-50 transition cursor-pointer"
                  >
                    {verifying ? "Verifying…" : "Verify & sign in →"}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setStep("email"); setOtp(""); setOtpErr(""); }}
                    className="text-[11px] text-slate-400 hover:text-slate-600 transition cursor-pointer text-center"
                  >
                    ← Use a different email
                  </button>
                </form>
              )}

            </div>
          </div>

          <p className="text-center text-[11px] text-slate-400 mt-4">
            Not the owner?{" "}
            <Link to="/customer" className="text-matcha-600 hover:underline no-underline">
              Browse as a customer
            </Link>
          </p>
        </div>
      </div>

      <footer className="h-10 border-t border-slate-200 bg-white flex items-center px-6 gap-2 shrink-0">
        <AppLogo size={16} textColor="#94a3b8" />
        <p className="text-[10px] text-slate-400 ml-auto">
          © {new Date().getFullYear()} · All rights reserved.
        </p>
      </footer>

    </div>
  );
}

// ── Feature nav map ───────────────────────────────────────────────────────────

const FEATURE_NAV: { key: string; label: string; hint: string; icon: React.ElementType; route?: string }[] = [
  { key: "STATIC_WEBSITE",  label: "Website",         hint: "Customise your public-facing page",       icon: Palette,        route: "website" },
  { key: "BOOKING",         label: "Calendar",        hint: "Online appointment scheduling",           icon: CalendarCheck,  route: "booking" },
  { key: "MEMBERSHIP",      label: "Membership",      hint: "Subscription plans for regular customers",icon: CreditCard,     route: undefined },
  { key: "WEBSHOP",         label: "Web Shop",        hint: "Sell products and gift cards online",     icon: ShoppingBag,    route: undefined },
  { key: "ANALYTICS",       label: "Analytics",       hint: "Track visits, revenue, and trends",       icon: BarChart2,      route: undefined },
  { key: "LOYALTY_PROGRAM", label: "Loyalty Program", hint: "Reward and retain your best customers",   icon: Gift,           route: undefined },
];

// ── Error boundary ────────────────────────────────────────────────────────────

export function ErrorBoundary() {
  const error    = useRouteError();
  const { pathname } = useLocation();
  const isPublic = pathname.endsWith("/c");

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
  const { saloon: loaderSaloon, saloonId } = useLoaderData<typeof clientLoader>();
  const navigate   = useNavigate();
  const revalidator = useRevalidator();
  const [saloon, setSaloon]             = useState<Saloon | null>(loaderSaloon);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting]         = useState(false);
  const [deleteError, setDeleteError]   = useState<string | null>(null);
  const [websiteMode, setWebsiteModeState] = useState<WebsiteMode | null>(null);

  useEffect(() => { setSaloon(loaderSaloon); }, [loaderSaloon]);

  function setWebsiteMode(m: WebsiteMode | null) {
    setWebsiteModeState(m);
    if (m) {
      apiFetch(`${ADMIN_API}/${saloon!.id}/website-type`, {
        method: "PATCH",
        body: JSON.stringify({ websiteType: m }),
      }).catch(() => {});
    }
  }

  const ctx: LayoutContext = { saloon: saloon!, setSaloon: (s) => setSaloon(s), websiteMode, setWebsiteMode };
  const isPreview = Boolean(useMatch("/:saloonId/c"));
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  if (!saloon) {
    return (
      <LoginGate
        saloonId={saloonId}
        onSuccess={() => {
          sessionStorage.setItem(`saloon-auth:${saloonId}`, "1");
          revalidator.revalidate();
        }}
      />
    );
  }

  const sideNavClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? "bg-matcha-50 text-matcha-700"
        : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
    }`;

  function handleLogout() {
    sessionStorage.removeItem(`saloon-auth:${saloonId}`);
    setSaloon(null);
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiFetch(`${ADMIN_API}/${saloon!.id}`, { method: "DELETE" });
      navigate("/customer");
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : "Delete failed");
      setDeleting(false);
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
          <AppLogo size={24} textColor="#374151" className="hidden sm:inline-flex" />
          <AppLogo size={24} showText={false} className="sm:hidden" />
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300 hidden sm:block" />
        <span className="text-sm text-slate-500 truncate max-w-[160px] sm:max-w-none">{saloon.name}</span>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
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

            <NavLink to="" end className={sideNavClass} onClick={() => setSidebarOpen(false)}>
              <LayoutDashboard className="w-4 h-4 shrink-0" /> Overview
            </NavLink>

            <NavLink to="edit" className={sideNavClass} onClick={() => setSidebarOpen(false)}>
              <Pencil className="w-4 h-4 shrink-0" /> Edit Saloon
            </NavLink>

            <NavLink to="services" className={sideNavClass} onClick={() => setSidebarOpen(false)}>
              <Briefcase className="w-4 h-4 shrink-0" /> Services
            </NavLink>

            <NavLink to="staff" className={sideNavClass} onClick={() => setSidebarOpen(false)}>
              <Users className="w-4 h-4 shrink-0" /> Staff
            </NavLink>

            {FEATURE_NAV.some((f) => saloon.features?.includes(f.key)) && (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 px-3 py-1.5 mt-2">
                  Features
                </p>
                {FEATURE_NAV.filter((f) => saloon.features?.includes(f.key)).map((f) =>
                  f.route ? (
                    <NavLink key={f.key} to={f.route} className={sideNavClass} onClick={() => setSidebarOpen(false)}>
                      <f.icon className="w-4 h-4 shrink-0" /> {f.label}
                    </NavLink>
                  ) : (
                    <span key={f.key} className="flex items-center gap-3 px-3 py-2 rounded-md text-slate-300 cursor-default select-none">
                      <f.icon className="w-4 h-4 shrink-0" />
                      <span className="text-sm font-medium">{f.label}</span>
                      <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-slate-300 border border-slate-200 rounded px-1">Soon</span>
                    </span>
                  )
                )}
              </>
            )}
          </nav>

          <div className="px-3 py-3 border-t border-slate-100 flex flex-col gap-0.5">
            <NavLink to="help" className={sideNavClass} onClick={() => setSidebarOpen(false)}>
              <HelpCircle className="w-4 h-4 shrink-0" /> Help &amp; Support
            </NavLink>
            <button
              onClick={() => { setSidebarOpen(false); setShowDeleteModal(true); }}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-red-500 hover:bg-red-50 transition-colors cursor-pointer w-full text-left"
            >
              <Trash2 className="w-4 h-4 shrink-0" /> Delete saloon
            </button>
          </div>
        </aside>

        {/* ── Main content ──────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8">
            <Outlet context={ctx} />
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
                <h2 className="text-sm font-semibold text-slate-900">Delete saloon</h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  This will permanently remove <strong className="text-slate-700">{saloon.name}</strong> and all its data. This cannot be undone.
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
                onClick={handleDelete}
                disabled={deleting}
              >
                <Trash2 className="w-3 h-3" />
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
