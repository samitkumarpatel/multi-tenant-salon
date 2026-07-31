import { useState, useRef } from "react";
import { useNavigate } from "react-router";
import { Mail, KeyRound, Building2, ShieldCheck, ArrowLeft } from "lucide-react";
import { AppLogo } from "@saloon/ui-shared";
import { MY_SALOONS_API, apiFetch } from "~/lib/api";
import type { Saloon } from "~/lib/types";

const SESSION_KEY = "admin-session";
const DUMMY_OTP   = "123456";

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

  const [step, setStep]                     = useState<"email" | "otp">("email");
  const [email, setEmail]                   = useState("");
  const [emailErr, setEmailErr]             = useState("");
  const [loading, setLoading]               = useState(false);
  const [pendingSaloons, setPendingSaloons] = useState<Saloon[]>([]);
  const [otp, setOtp]                       = useState(["", "", "", "", "", ""]);
  const [otpErr, setOtpErr]                 = useState("");
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── Step 1: email ──────────────────────────────────────────────────────────

  async function handleEmailSubmit(e: React.FormEvent) {
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
      setPendingSaloons(saloons);
      setOtp(["", "", "", "", "", ""]);
      setOtpErr("");
      setStep("otp");
      setTimeout(() => otpRefs.current[0]?.focus(), 60);
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

  // ── Step 2: OTP ───────────────────────────────────────────────────────────

  function handleOtpChange(i: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next  = [...otp];
    next[i]     = digit;
    setOtp(next);
    setOtpErr("");
    if (digit && i < 5) otpRefs.current[i + 1]?.focus();
  }

  function handleOtpKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otp[i] && i > 0) {
      otpRefs.current[i - 1]?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!digits) return;
    e.preventDefault();
    const next = ["", "", "", "", "", ""];
    for (let i = 0; i < digits.length; i++) next[i] = digits[i];
    setOtp(next);
    otpRefs.current[Math.min(digits.length, 5)]?.focus();
  }

  function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = otp.join("");
    if (code.length < 6) {
      setOtpErr("Enter all 6 digits.");
      return;
    }
    if (code !== DUMMY_OTP) {
      setOtpErr("Incorrect code. Please try again.");
      setOtp(["", "", "", "", "", ""]);
      setTimeout(() => otpRefs.current[0]?.focus(), 60);
      return;
    }
    const session: AdminSession = { email, saloons: pendingSaloons };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    if (pendingSaloons.length === 1) {
      navigate(`/${pendingSaloons[0].id}`);
    } else {
      navigate("/saloons");
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

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

          {step === "email" ? (
            <>
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
                  <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
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
            </>
          ) : (
            <>
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">

                <div className="px-6 py-5 border-b border-slate-100">
                  <div className="flex items-center gap-2.5 mb-1">
                    <div className="w-7 h-7 rounded-full bg-matcha-100 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-3.5 h-3.5 text-matcha-600" />
                    </div>
                    <h1 className="text-sm font-semibold text-slate-900">Enter verification code</h1>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed pl-9">
                    We sent a 6-digit code to{" "}
                    <span className="font-medium text-slate-700">{email}</span>.
                    Enter it below to continue.
                  </p>
                </div>

                <div className="px-6 py-5">
                  <form onSubmit={handleOtpSubmit} className="flex flex-col gap-4">

                    <div>
                      <div
                        className="flex gap-2 justify-between"
                        onPaste={handleOtpPaste}
                      >
                        {otp.map((digit, i) => (
                          <input
                            key={i}
                            ref={(el) => { otpRefs.current[i] = el; }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleOtpChange(i, e.target.value)}
                            onKeyDown={(e) => handleOtpKeyDown(i, e)}
                            className={`w-11 h-12 text-center text-lg font-bold border rounded-lg outline-none transition bg-white text-slate-900 ${
                              otpErr
                                ? "border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-400/10"
                                : "border-slate-200 focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10"
                            }`}
                          />
                        ))}
                      </div>
                      {otpErr && (
                        <p className="text-red-500 text-[11px] mt-2 text-center">{otpErr}</p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={otp.join("").length < 6}
                      className="w-full py-2.5 rounded-lg bg-matcha-600 text-white text-xs font-semibold hover:bg-matcha-700 disabled:opacity-50 transition cursor-pointer"
                    >
                      Verify &amp; sign in →
                    </button>

                    <button
                      type="button"
                      onClick={() => { setStep("email"); setOtpErr(""); }}
                      className="flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    >
                      <ArrowLeft className="w-3 h-3" /> Use a different email
                    </button>
                  </form>
                </div>
              </div>

              <div className="mt-5 bg-slate-100 border border-slate-200 rounded-xl px-4 py-3">
                <p className="text-[11px] text-slate-500 text-center">
                  <span className="font-semibold text-slate-600">Dev mode</span> — use code{" "}
                  <span className="font-mono font-bold tracking-widest text-slate-700">{DUMMY_OTP}</span>
                </p>
              </div>
            </>
          )}

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
