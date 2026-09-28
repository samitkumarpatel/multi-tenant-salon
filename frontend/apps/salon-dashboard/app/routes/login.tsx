import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Gauge, LogIn, Mail } from "lucide-react";
import { AppLogo } from "@salon/ui-shared";
import type { Salon } from "@salon/ui-website";
import { MY_SALONS_API } from "~/lib/api";
import { AUTH_MODE, completeOAuth2Login, setDashboardSession, startOAuth2Login } from "~/lib/auth";

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const salonId = params.get("salon") ?? undefined;
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const code = params.get("code");
    if (AUTH_MODE !== "oauth2" || !code) return;
    setLoading(true);
    completeOAuth2Login(code)
      .then(({ session, salonId: intended }) => {
        const target = session.salons.find((salon) => String(salon.id) === intended && salon.features?.includes("DASHBOARD"))
          ?? session.salons.find((salon) => salon.features?.includes("DASHBOARD"));
        if (!target) throw new Error("Dashboard is not enabled for any of your salons.");
        navigate(`/${target.id}`, { replace: true });
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Could not sign in."))
      .finally(() => setLoading(false));
  }, [navigate, params]);

  async function mockLogin(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const response = await fetch(`${MY_SALONS_API}?email=${encodeURIComponent(email.trim())}`);
      if (!response.ok) throw new Error("No salon was found for that email address.");
      const salons = await response.json() as Salon[];
      const target = salons.find((salon) => String(salon.id) === salonId && salon.features?.includes("DASHBOARD"))
        ?? salons.find((salon) => salon.features?.includes("DASHBOARD"));
      if (!target) throw new Error("Dashboard is not enabled for this salon.");
      setDashboardSession({ email: email.trim(), salons });
      navigate(`/${target.id}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not sign in."); }
    finally { setLoading(false); }
  }

  return <main className="flex min-h-screen flex-col bg-slate-50">
    <header className="flex h-14 items-center border-b border-slate-200 bg-white px-6"><AppLogo size={25} textColor="#374151" /><span className="ml-auto text-xs font-semibold text-slate-400">Salon Dashboard</span></header>
    <div className="flex flex-1 items-start justify-center px-4 pt-20">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-6"><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-matcha-100"><Gauge className="h-5 w-5 text-matcha-700" /></div><h1 className="text-lg font-bold">Open your Dashboard</h1><p className="mt-1 text-sm text-slate-500">Manage appointments and in-salon checkout.</p></div>
        <div className="p-6">
          {AUTH_MODE === "oauth2" ? <button type="button" disabled={loading} onClick={() => startOAuth2Login(salonId)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-matcha-600 px-4 py-3 text-sm font-semibold text-white hover:bg-matcha-700 disabled:opacity-50"><LogIn className="h-4 w-4" />{loading ? "Signing in…" : "Sign in"}</button>
            : <form onSubmit={mockLogin} className="space-y-3"><label className="block text-xs font-semibold text-slate-600">Work email</label><div className="relative"><Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-matcha-500" placeholder="you@salon.com" /></div><button disabled={loading} className="w-full rounded-lg bg-matcha-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{loading ? "Opening…" : "Continue"}</button><p className="text-center text-[11px] text-slate-400">Local development sign-in</p></form>}
          {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-xs font-medium text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  </main>;
}
