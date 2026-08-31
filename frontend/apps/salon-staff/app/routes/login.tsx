import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { Mail, KeyRound, Scissors, ShieldCheck, ArrowLeft, Users, Lock } from "lucide-react";
import { AppLogo } from "@salon/ui-shared";
import { STAFF_PORTAL_API, apiFetch } from "~/lib/api";
import {
  AUTH_MODE,
  startOAuth2Login,
  fetchOAuth2StaffOptions,
  buildStaffSession,
  isSilentRenewFrame,
  handleSilentRenewCallback,
} from "~/lib/auth";
import type { StaffMember } from "~/lib/types";

const DUMMY_OTP = "123456";

const ROLE_LABEL: Record<string, string> = {
  MANAGER: "Manager", STYLIST: "Stylist", COLORIST: "Colorist",
  MAKEUP_ARTIST: "Makeup Artist", NAIL_TECHNICIAN: "Nail Technician",
  RECEPTIONIST: "Receptionist", ASSISTANT: "Assistant",
};

const inputCls =
  "w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white text-slate-900 outline-none focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 transition placeholder:text-slate-400";

function MockLogin() {
  const navigate = useNavigate();

  const [step, setStep]                       = useState<"email" | "pick" | "otp">("email");
  const [email, setEmail]                     = useState("");
  const [emailErr, setEmailErr]               = useState("");
  const [loading, setLoading]                 = useState(false);
  const [staffList, setStaffList]             = useState<StaffMember[]>([]);
  const [selected, setSelected]               = useState<StaffMember | null>(null);
  const [otp, setOtp]                         = useState(["", "", "", "", "", ""]);
  const [otpErr, setOtpErr]                   = useState("");
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

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
      const members = await apiFetch<StaffMember[]>(
        `${STAFF_PORTAL_API}/me?email=${encodeURIComponent(trimmed)}`
      );
      setStaffList(members);
      setOtp(["", "", "", "", "", ""]);
      setOtpErr("");
      if (members.length === 1) {
        setSelected(members[0]);
        setStep("otp");
      } else {
        setStep("pick");
      }
      setTimeout(() => otpRefs.current[0]?.focus(), 60);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("HTTP 404") || msg.toLowerCase().includes("not found")) {
        setEmailErr("No staff account found for this email.");
      } else {
        setEmailErr(msg || "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

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
    if (code.length < 6) { setOtpErr("Enter all 6 digits."); return; }
    if (code !== DUMMY_OTP) {
      setOtpErr("Incorrect code. Please try again.");
      setOtp(["", "", "", "", "", ""]);
      setTimeout(() => otpRefs.current[0]?.focus(), 60);
      return;
    }
    buildStaffSession(selected!, staffList);
    navigate("/portal");
  }

  return (
    <div className="h-[100dvh] bg-slate-50 flex flex-col overflow-y-auto">
      <header className="h-12 border-b border-slate-200 bg-white flex items-center px-6 shrink-0">
        <AppLogo size={24} textColor="#374151" />
        <div className="ml-auto">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
            Staff Portal
          </span>
        </div>
      </header>

      <div className="flex flex-1 items-start justify-center px-4 pt-14 pb-10">
        <div className="w-full max-w-[360px]">

          {step === "email" && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100">
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-7 h-7 rounded-full bg-matcha-100 flex items-center justify-center shrink-0">
                    <Scissors className="w-3.5 h-3.5 text-matcha-600" />
                  </div>
                  <h1 className="text-sm font-semibold text-slate-900">Sign in to Staff Portal</h1>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed pl-9">
                  Enter the email address registered to your staff account.
                </p>
              </div>
              <div className="px-6 py-5">
                <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      Staff email address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                      <input
                        type="email"
                        autoFocus
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setEmailErr(""); }}
                        placeholder="you@salon.com"
                        className={`${inputCls} pl-8 ${emailErr ? "border-red-400 focus:border-red-400 focus:ring-red-400/10" : ""}`}
                      />
                    </div>
                    {emailErr && <p className="text-red-500 text-[11px] mt-1.5">{emailErr}</p>}
                  </div>
                  <button
                    type="submit"
                    disabled={!email.trim() || loading}
                    className="w-full py-2.5 rounded-lg bg-matcha-600 text-white text-xs font-semibold hover:bg-matcha-700 disabled:opacity-50 transition cursor-pointer"
                  >
                    {loading ? "Looking up your account…" : "Continue →"}
                  </button>
                </form>
              </div>
            </div>
          )}

          {step === "pick" && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100">
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-7 h-7 rounded-full bg-matcha-100 flex items-center justify-center shrink-0">
                    <Users className="w-3.5 h-3.5 text-matcha-600" />
                  </div>
                  <h1 className="text-sm font-semibold text-slate-900">Select your account</h1>
                </div>
                <p className="text-xs text-slate-500 pl-9">
                  You're registered at multiple salons. Choose one to continue.
                </p>
              </div>
              <div className="divide-y divide-slate-100">
                {staffList.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { setSelected(m); setStep("otp"); setTimeout(() => otpRefs.current[0]?.focus(), 60); }}
                    className="w-full flex items-center gap-3 px-6 py-3.5 text-left hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    {m.avatarUrl ? (
                      <img src={m.avatarUrl} alt={m.name} className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-matcha-100 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-matcha-700">
                          {m.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{m.name}</p>
                      <p className="text-[11px] text-slate-400">{ROLE_LABEL[m.role] ?? m.role}</p>
                      {(m.salonName || m.salonHandler) && (
                        <div className="flex items-center gap-1 mt-0.5">
                          {m.salonName && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-matcha-50 text-matcha-700 border border-matcha-200 leading-none">
                              {m.salonName}
                            </span>
                          )}
                          {m.salonHandler && (
                            <span className="text-[10px] text-slate-400 font-mono leading-none">
                              @{m.salonHandler}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              <div className="px-6 py-3 border-t border-slate-100">
                <button
                  onClick={() => { setStep("email"); setEmailErr(""); }}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  <ArrowLeft className="w-3 h-3" /> Use a different email
                </button>
              </div>
            </div>
          )}

          {step === "otp" && (
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
                    {selected && staffList.length > 1 && (
                      <> Signing in as <span className="font-medium text-slate-700">{selected.name}</span>.</>
                    )}
                  </p>
                </div>
                <div className="px-6 py-5">
                  <form onSubmit={handleOtpSubmit} className="flex flex-col gap-4">
                    <div>
                      <div className="flex gap-2 justify-between" onPaste={handleOtpPaste}>
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
                      {otpErr && <p className="text-red-500 text-[11px] mt-2 text-center">{otpErr}</p>}
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
                      onClick={() => { setStep(staffList.length > 1 ? "pick" : "email"); setOtpErr(""); }}
                      className="flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    >
                      <ArrowLeft className="w-3 h-3" /> Go back
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

// ── Real OAuth2 (Authorization Code + PKCE) login ────────────────────────────

function OAuth2Login() {
  const navigate = useNavigate();
  const [status, setStatus]       = useState<"idle" | "loading" | "pick" | "error">("idle");
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [error, setError]         = useState("");

  useEffect(() => {
    // The hidden silent-renew iframe (auth.ts's silentRenew) also lands on
    // this same /login route — hand it off before touching any real UI
    // state or this tab's own session.
    if (isSilentRenewFrame()) {
      void handleSilentRenewCallback();
      return;
    }

    const params   = new URLSearchParams(window.location.search);
    const code     = params.get("code");
    const errParam = params.get("error");

    if (errParam) {
      setError(params.get("error_description") ?? errParam);
      setStatus("error");
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

    if (code) {
      setStatus("loading");
      fetchOAuth2StaffOptions(code)
        .then((members) => {
          window.history.replaceState({}, "", window.location.pathname);
          if (members.length === 0) {
            setError("No staff account found for this email.");
            setStatus("error");
            return;
          }
          if (members.length === 1) {
            buildStaffSession(members[0], members);
            navigate("/portal", { replace: true });
            return;
          }
          setStaffList(members);
          setStatus("pick");
        })
        .catch((e: unknown) => {
          setError(e instanceof Error ? e.message : "Sign-in failed.");
          setStatus("error");
        });
    }
  }, []);

  function handlePick(member: StaffMember) {
    buildStaffSession(member, staffList);
    navigate("/portal", { replace: true });
  }

  const loading = status === "loading";

  return (
    <div className="h-[100dvh] bg-slate-50 flex flex-col overflow-y-auto">
      <header className="h-12 border-b border-slate-200 bg-white flex items-center px-6 shrink-0">
        <AppLogo size={24} textColor="#374151" />
        <div className="ml-auto">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
            Staff Portal
          </span>
        </div>
      </header>

      <div className="flex flex-1 items-start justify-center px-4 pt-14 pb-10">
        <div className="w-full max-w-[360px]">

          {status === "pick" ? (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100">
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-7 h-7 rounded-full bg-matcha-100 flex items-center justify-center shrink-0">
                    <Users className="w-3.5 h-3.5 text-matcha-600" />
                  </div>
                  <h1 className="text-sm font-semibold text-slate-900">Select your account</h1>
                </div>
                <p className="text-xs text-slate-500 pl-9">
                  You're registered at multiple salons. Choose one to continue.
                </p>
              </div>
              <div className="divide-y divide-slate-100">
                {staffList.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handlePick(m)}
                    className="w-full flex items-center gap-3 px-6 py-3.5 text-left hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    {m.avatarUrl ? (
                      <img src={m.avatarUrl} alt={m.name} className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-matcha-100 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-matcha-700">
                          {m.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{m.name}</p>
                      <p className="text-[11px] text-slate-400">{ROLE_LABEL[m.role] ?? m.role}</p>
                      {(m.salonName || m.salonHandler) && (
                        <div className="flex items-center gap-1 mt-0.5">
                          {m.salonName && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-matcha-50 text-matcha-700 border border-matcha-200 leading-none">
                              {m.salonName}
                            </span>
                          )}
                          {m.salonHandler && (
                            <span className="text-[10px] text-slate-400 font-mono leading-none">
                              @{m.salonHandler}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100">
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-7 h-7 rounded-full bg-matcha-100 flex items-center justify-center shrink-0">
                    <Lock className="w-3.5 h-3.5 text-matcha-600" />
                  </div>
                  <h1 className="text-sm font-semibold text-slate-900">Sign in to Staff Portal</h1>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed pl-9">
                  You'll be redirected to sign in securely, then brought back here.
                </p>
              </div>
              <div className="px-6 py-5">
                {error && <p className="text-red-500 text-[11px] mb-3 leading-snug">{error}</p>}
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => { setStatus("loading"); startOAuth2Login(); }}
                  className="w-full py-2.5 rounded-lg bg-matcha-600 text-white text-xs font-semibold hover:bg-matcha-700 disabled:opacity-50 transition cursor-pointer"
                >
                  {loading ? "Redirecting…" : "Sign In →"}
                </button>
              </div>
            </div>
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

export default function Login() {
  return AUTH_MODE === "oauth2" ? <OAuth2Login /> : <MockLogin />;
}
