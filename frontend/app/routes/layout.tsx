import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useMatch } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { Scissors, Trash2, LayoutDashboard, Pencil, Briefcase, Users, Eye, Mail, KeyRound, LogOut, ChevronRight } from "lucide-react";
import { API, HANDLER_API, apiFetch } from "~/lib/api";
import type { Saloon, LayoutContext } from "~/lib/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const { saloonId } = params;
  const url = UUID_RE.test(saloonId!) ? `${API}/${saloonId}` : `${HANDLER_API}/${saloonId}`;
  return apiFetch<Saloon>(url);
}

// ── Login gate ────────────────────────────────────────────────────────────────

const inputCls =
  "w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white text-slate-900 outline-none focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 transition placeholder:text-slate-400";

function LoginGate({ saloon, onSuccess }: { saloon: Saloon; onSuccess: () => void }) {
  const [step, setStep]         = useState<"email" | "token">("email");
  const [email, setEmail]       = useState("");
  const [token, setToken]       = useState("");
  const [emailErr, setEmailErr] = useState("");
  const [busy, setBusy]         = useState(false);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailErr("Enter a valid email address.");
      return;
    }
    setEmailErr("");
    setBusy(true);
    setTimeout(() => { setBusy(false); setStep("token"); }, 1000);
  }

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setBusy(true);
    setTimeout(() => { setBusy(false); onSuccess(); }, 700);
  }

  return (
    <div className="h-[100dvh] bg-slate-50 flex flex-col overflow-y-auto">

      {/* Top bar */}
      <header className="h-12 border-b border-slate-200 bg-white flex items-center px-6 shrink-0">
        <div className="flex items-center gap-2">
          <Scissors className="w-4 h-4 text-matcha-600" />
          <span className="text-sm font-semibold text-slate-700">my-saloon</span>
          <span className="text-slate-300 text-sm mx-1">/</span>
          <span className="text-sm text-slate-500 truncate max-w-[180px]">{saloon.name}</span>
        </div>
        <div className="ml-auto">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
            Admin
          </span>
        </div>
      </header>

      {/* Center content */}
      <div className="flex flex-1 items-start justify-center px-4 pt-14 pb-10">
        <div className="w-full max-w-[340px]">

          {/* Card */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">

            {/* Card header */}
            <div className="px-6 py-5 border-b border-slate-100">
              <h1 className="text-sm font-semibold text-slate-900">Sign in to admin panel</h1>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                {step === "email"
                  ? "Enter your owner email to receive a sign-in code."
                  : `Check your inbox — code sent to ${email}.`}
              </p>
            </div>

            <div className="px-6 py-5">
              {step === "email" ? (
                <form onSubmit={handleSend} className="flex flex-col gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Email address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                      <input
                        type="email"
                        autoFocus
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setEmailErr(""); }}
                        placeholder="owner@example.com"
                        className={`${inputCls} pl-8 ${emailErr ? "border-red-400 focus:border-red-400 focus:ring-red-400/10" : ""}`}
                      />
                    </div>
                    {emailErr && <p className="text-red-500 text-[11px] mt-1">{emailErr}</p>}
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full py-2 rounded-md bg-matcha-600 text-white text-xs font-semibold hover:bg-matcha-700 disabled:opacity-50 transition cursor-pointer mt-1"
                  >
                    {busy ? "Sending…" : "Send sign-in code"}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerify} className="flex flex-col gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Verification code
                    </label>
                    <div className="relative">
                      <KeyRound className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        autoFocus
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="Paste code from email"
                        className={`${inputCls} pl-8 font-mono tracking-widest`}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={busy || !token.trim()}
                    className="w-full py-2 rounded-md bg-matcha-600 text-white text-xs font-semibold hover:bg-matcha-700 disabled:opacity-50 transition cursor-pointer mt-1"
                  >
                    {busy ? "Verifying…" : "Continue →"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStep("email"); setToken(""); }}
                    className="text-[11px] text-slate-400 hover:text-slate-600 transition cursor-pointer text-center"
                  >
                    Use a different email
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Below card */}
          <p className="text-center text-[11px] text-slate-400 mt-4">
            Not the owner?{" "}
            <Link to="/customer" className="text-matcha-600 hover:underline no-underline">
              Browse as a customer
            </Link>
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="h-10 border-t border-slate-200 bg-white flex items-center px-6 shrink-0">
        <p className="text-[10px] text-slate-400 ml-auto">
          © {new Date().getFullYear()} my-saloon · All rights reserved.
        </p>
      </footer>

    </div>
  );
}

// ── Admin layout ──────────────────────────────────────────────────────────────

export default function Layout() {
  const initial  = useLoaderData<typeof clientLoader>();
  const navigate = useNavigate();
  const [saloon, setSaloon]             = useState<Saloon>(initial);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting]         = useState(false);
  const [deleteError, setDeleteError]   = useState<string | null>(null);
  const [authed, setAuthed]             = useState(() =>
    Boolean(sessionStorage.getItem(`saloon-auth:${initial.id}`))
  );

  const ctx: LayoutContext = { saloon, setSaloon };
  const isPreview = Boolean(useMatch("/:saloonId/c"));

  // Customer preview — no auth required
  if (isPreview) return <Outlet context={ctx} />;

  // Not yet authenticated — show login gate
  if (!authed) {
    return (
      <LoginGate
        saloon={saloon}
        onSuccess={() => {
          sessionStorage.setItem(`saloon-auth:${saloon.id}`, "1");
          setAuthed(true);
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
    sessionStorage.removeItem(`saloon-auth:${saloon.id}`);
    setAuthed(false);
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiFetch(`${API}/${saloon.id}`, { method: "DELETE" });
      navigate("/customer");
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : "Delete failed");
      setDeleting(false);
    }
  }

  return (
    <div className="h-[100dvh] bg-slate-50 flex flex-col overflow-hidden">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="h-12 bg-white border-b border-slate-200 flex items-center px-4 gap-3 shrink-0 z-40">
        {/* Brand */}
        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 pr-4 border-r border-slate-200">
          <Scissors className="w-4 h-4 text-matcha-600" />
          my-saloon
        </div>
        {/* Breadcrumb */}
        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
        <span className="text-sm text-slate-500 truncate">{saloon.name}</span>

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-2">
          {saloon.handler && (
            <Link
              to={`/${saloon.handler}/c`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 transition-colors no-underline"
            >
              <Eye className="w-3 h-3" />
              Preview site
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
            Sign out
          </button>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        <aside className="w-52 bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-y-auto">

          {/* Saloon identity */}
          <div className="px-4 py-4 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-900 truncate">{saloon.name}</p>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
              {saloon.owner?.name}
              {saloon.location?.city ? ` · ${saloon.location.city}` : ""}
            </p>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 px-3 py-1.5">
              Manage
            </p>
            <NavLink to="" end className={sideNavClass}>
              <LayoutDashboard className="w-4 h-4 shrink-0" /> Overview
            </NavLink>
            <NavLink to="edit" className={sideNavClass}>
              <Pencil className="w-4 h-4 shrink-0" /> Edit Saloon
            </NavLink>
            <NavLink to="services" className={sideNavClass}>
              <Briefcase className="w-4 h-4 shrink-0" /> Saloon Service
            </NavLink>
            <NavLink to="staff" className={sideNavClass}>
              <Users className="w-4 h-4 shrink-0" /> Staff
            </NavLink>
          </nav>

          {/* Sidebar footer */}
          <div className="px-3 py-3 border-t border-slate-100 flex flex-col gap-0.5">
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-red-500 hover:bg-red-50 transition-colors cursor-pointer w-full text-left"
            >
              <Trash2 className="w-4 h-4 shrink-0" /> Delete saloon
            </button>
          </div>
        </aside>

        {/* ── Main content ──────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-8 py-8">
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
