import { useState } from "react";
import { useNavigate } from "react-router";
import { Mail, KeyRound, Building2 } from "lucide-react";
import { AppLogo } from "@saloon/ui-shared";
import { MY_SALOONS_API, apiFetch } from "~/lib/api";
import type { Saloon } from "~/lib/types";

const SESSION_KEY = "admin-session";

export interface AdminSession {
  email: string;
  saloons: Saloon[];
}

export function getAdminSession(): AdminSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AdminSession) : null;
  } catch {
    return null;
  }
}

export function clearAdminSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

const inputCls =
  "w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white text-slate-900 outline-none focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 transition placeholder:text-slate-400";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail]       = useState("");
  const [emailErr, setEmailErr] = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();

    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailErr("Enter a valid email address.");
      return;
    }

    setEmailErr("");
    setLoading(true);

    try {
      const saloons = await apiFetch<Saloon[]>(
        `${MY_SALOONS_API}?email=${encodeURIComponent(trimmed)}`
      );

      const session: AdminSession = { email: trimmed, saloons };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

      if (saloons.length === 1) {
        navigate(`/${saloons[0].id}`);
      } else {
        navigate("/saloons");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("HTTP 404") || msg.toLowerCase().includes("not found")) {
        setEmailErr("No saloon found for this email address.");
      } else {
        setEmailErr(msg || "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-[100dvh] bg-slate-50 flex flex-col overflow-y-auto">

      <header className="h-12 border-b border-slate-200 bg-white flex items-center px-6 shrink-0">
        <AppLogo size={24} textColor="#374151" />
        <div className="ml-auto">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
            Admin Portal
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
                <h1 className="text-sm font-semibold text-slate-900">Sign in to your saloon</h1>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed pl-9">
                Enter the email address you used when registering your saloon.
              </p>
            </div>

            <div className="px-6 py-5">
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
                      placeholder="owner@example.com"
                      className={`${inputCls} pl-8 ${emailErr ? "border-red-400 focus:border-red-400 focus:ring-red-400/10" : ""}`}
                    />
                  </div>
                  {emailErr && (
                    <p className="text-red-500 text-[11px] mt-1.5 leading-snug">{emailErr}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!email.trim() || loading}
                  className="w-full py-2.5 rounded-lg bg-matcha-600 text-white text-xs font-semibold hover:bg-matcha-700 disabled:opacity-50 transition cursor-pointer"
                >
                  {loading ? "Looking up your saloon…" : "Continue →"}
                </button>
              </form>
            </div>
          </div>

          <div className="mt-5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <div className="flex items-start gap-2">
              <Building2 className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-700 leading-relaxed">
                Don't have a saloon yet?{" "}
                <a
                  href={import.meta.env.VITE_ONBOARDING_URL ?? "/"}
                  className="font-semibold underline text-amber-800"
                >
                  Register one here
                </a>
              </p>
            </div>
          </div>

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
