import { useState, useRef } from "react";
import { useNavigate } from "react-router";
import { Shield, Mail, KeyRound, ArrowLeft } from "lucide-react";
import { AppLogo } from "@salon/ui-shared";
import { setSession, SUPER_ADMIN_EMAIL, DUMMY_OTP } from "~/lib/types";

const inputCls =
  "w-full px-3 py-2 border border-stone-200 rounded-md text-sm bg-stone-100 text-stone-900 outline-none focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10 transition placeholder:text-stone-400";

export default function SuperAdminLogin() {
  const navigate = useNavigate();

  const [step, setStep]     = useState<"email" | "otp">("email");
  const [email, setEmail]   = useState(SUPER_ADMIN_EMAIL);
  const [emailErr, setEmailErr] = useState("");
  const [otp, setOtp]       = useState(["", "", "", "", "", ""]);
  const [otpErr, setOtpErr] = useState("");
  const [loading, setLoading] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (trimmed !== SUPER_ADMIN_EMAIL) {
      setEmailErr("Access denied. This portal is restricted to the platform super-admin.");
      return;
    }
    setEmailErr("");
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep("otp");
      setTimeout(() => otpRefs.current[0]?.focus(), 60);
    }, 600);
  }

  function handleOtpChange(i: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[i] = digit;
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
    setSession({ email: SUPER_ADMIN_EMAIL });
    navigate("/");
  }

  return (
    <div className="min-h-[100dvh] bg-stone-50 flex flex-col">
      <header className="h-12 border-b border-stone-200 bg-white/80 flex items-center px-6 shrink-0">
        <AppLogo size={24} textColor="#e2e8f0" />
        <span className="ml-3 text-[10px] font-bold uppercase tracking-widest text-matcha-500 bg-matcha-50 border border-matcha-200 px-2 py-0.5 rounded">
          Super Admin
        </span>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[360px]">

          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-matcha-600/20 border border-matcha-600/40 flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-matcha-500" />
            </div>
            <h1 className="text-lg font-bold text-stone-900">Platform Super Admin</h1>
            <p className="text-xs text-stone-400 mt-1 text-center">
              Restricted access · Platform management portal
            </p>
          </div>

          {step === "email" ? (
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-2xl">
              <div className="px-6 py-5 border-b border-stone-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-matcha-50 flex items-center justify-center shrink-0">
                    <Mail className="w-3 h-3 text-matcha-500" />
                  </div>
                  <h2 className="text-sm font-semibold text-stone-800">Sign in with admin email</h2>
                </div>
                <p className="text-xs text-stone-400 mt-2 pl-8 leading-relaxed">
                  Enter the super-admin email address to receive a verification code.
                </p>
              </div>

              <div className="px-6 py-5">
                <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1.5">
                      Admin email address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400 pointer-events-none" />
                      <input
                        type="email"
                        autoFocus
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setEmailErr(""); }}
                        placeholder="admin@my-salon.online"
                        className={`${inputCls} pl-8 ${emailErr ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/20" : ""}`}
                      />
                    </div>
                    {emailErr && (
                      <p className="text-red-600 text-[11px] mt-1.5 leading-snug">{emailErr}</p>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={!email.trim() || loading}
                    className="w-full py-2.5 rounded-lg bg-matcha-600 text-white text-xs font-semibold hover:bg-matcha-500 disabled:opacity-40 transition cursor-pointer"
                  >
                    {loading ? "Verifying…" : "Continue →"}
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-2xl">
              <div className="px-6 py-5 border-b border-stone-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-matcha-50 flex items-center justify-center shrink-0">
                    <KeyRound className="w-3 h-3 text-matcha-500" />
                  </div>
                  <h2 className="text-sm font-semibold text-stone-800">Verification code</h2>
                </div>
                <p className="text-xs text-stone-400 mt-2 pl-8 leading-relaxed">
                  A 6-digit code was sent to{" "}
                  <span className="font-medium text-stone-600">{email}</span>.
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
                          className={`w-11 h-12 text-center text-lg font-bold border rounded-lg outline-none transition bg-stone-100 text-stone-900 ${
                            otpErr
                              ? "border-red-500/60 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                              : "border-stone-200 focus:border-matcha-500 focus:ring-2 focus:ring-matcha-500/10"
                          }`}
                        />
                      ))}
                    </div>
                    {otpErr && (
                      <p className="text-red-600 text-[11px] mt-2 text-center">{otpErr}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={otp.join("").length < 6}
                    className="w-full py-2.5 rounded-lg bg-matcha-600 text-white text-xs font-semibold hover:bg-matcha-500 disabled:opacity-40 transition cursor-pointer"
                  >
                    Verify &amp; sign in →
                  </button>

                  <button
                    type="button"
                    onClick={() => { setStep("email"); setOtpErr(""); setOtp(["", "", "", "", "", ""]); }}
                    className="flex items-center justify-center gap-1.5 text-xs text-stone-400 hover:text-stone-600 transition cursor-pointer"
                  >
                    <ArrowLeft className="w-3 h-3" /> Use a different email
                  </button>
                </form>
              </div>
            </div>
          )}

          <div className="mt-4 bg-white/60 border border-stone-200 rounded-xl px-4 py-3">
            <p className="text-[11px] text-stone-400 text-center">
              <span className="font-semibold text-stone-400">Dev mode</span> — use code{" "}
              <span className="font-mono font-bold tracking-widest text-stone-500">{DUMMY_OTP}</span>
            </p>
          </div>

        </div>
      </div>

      <footer className="h-10 border-t border-stone-200 bg-white/50 flex items-center px-6 shrink-0">
        <AppLogo size={16} textColor="#475569" />
        <p className="text-[10px] text-stone-400 ml-auto">
          © {new Date().getFullYear()} · my-salon platform
        </p>
      </footer>
    </div>
  );
}
