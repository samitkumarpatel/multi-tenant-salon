import { useI18n } from "@salon/i18n";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft, CalendarDays, Gift, ChevronDown, Clock, Crown, Loader2, LogOut, Mail, Package, Truck, User, X, Star,
} from "lucide-react";
import { apiFetch, API_BASE } from "./api";
import { ApiError, friendlyMessage } from "./apiError";
import { formatDate, formatPrice } from "./constants";
import { SiteFooter, SiteHeader } from "./SiteChrome";
import type { SalonPolicy } from "./SalonPolicyLinks";
import { contrastText, fontStack, isLightColor, loadGoogleFont } from "./theme";
import type {
  AvailableSlot, CustomerAccount, CustomerBooking, CustomerMembership, CustomerOrder, CustomerSelfServicePolicy, CustomerSession, Salon,
  WebsiteTheme, CustomerRatingOption, CustomerLoyalty,
} from "./types";

/**
 * The customer's self-service account for one salon: sign in with an emailed one-time code, then see
 * every booking, shop order and membership the salon holds under that email. Read-only for now.
 *
 * The session token lives in localStorage per salon and is sent as `X-Customer-Session` — never as
 * `Authorization`, which the API reserves for staff JWTs.
 */

const SESSION_HEADER = "X-Customer-Session";
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const RESEND_AFTER_SECONDS = 30;

type Translate = (s: string, v?: Record<string, string | number>) => string;

/** Pages the account links out to ("Book again", "Visit the shop", the renewal screen). */
export type AccountPage = "book" | "shop" | "membership";

export interface CustomerAccountLinks {
  /** href for a page, or null when this app can't show it (the link is then hidden). */
  pageHref?: (page: AccountPage) => string | null;
  /** In-app navigation for a page; falls back to following `pageHref`. */
  onNavigate?: (page: AccountPage) => void;
  /** href of the membership renewal screen for a renewal token, or null to hide the button. */
  renewHref?: (token: string) => string | null;
}

const FEATURE_FOR_PAGE: Record<AccountPage, string> = { book: "BOOKING", shop: "WEBSHOP", membership: "MEMBERSHIP" };

/** Links for an account shown inside the salon website: every page the salon has enabled. */
export function siteAccountLinks(salon: Salon, getPagePath?: (page: string) => string,
                                 onNavigate?: (page: string) => void): CustomerAccountLinks {
  const enabled = (page: AccountPage) => (salon.features ?? []).includes(FEATURE_FOR_PAGE[page]);
  return {
    pageHref: (page) => (enabled(page) ? (getPagePath ? getPagePath(page) : `/${page}`) : null),
    onNavigate: onNavigate ? (page) => onNavigate(page) : undefined,
  };
}

// ── Session storage ─────────────────────────────────────────────────────────────

const storageKey = (salonId: number | string) => `salon-account:${salonId}`;

function readSession(salonId: number | string): CustomerSession | null {
  try {
    const raw = window.localStorage.getItem(storageKey(salonId));
    if (!raw) return null;
    const session = JSON.parse(raw) as CustomerSession;
    if (!session.sessionToken || new Date(session.expiresAt).getTime() <= Date.now()) {
      window.localStorage.removeItem(storageKey(salonId));
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function writeSession(salonId: number | string, session: CustomerSession | null) {
  try {
    if (session) window.localStorage.setItem(storageKey(salonId), JSON.stringify(session));
    else window.localStorage.removeItem(storageKey(salonId));
  } catch {
    // Private mode / blocked storage: the session simply lasts as long as the page.
  }
}

const jsonHeaders = (token?: string): HeadersInit =>
  token ? { "Content-Type": "application/json", [SESSION_HEADER]: token } : { "Content-Type": "application/json" };

/** The signed-in session for a salon, kept in localStorage so the visitor stays signed in. */
export function useCustomerSession(salonId: number | string) {
  const [session, setSession] = useState<CustomerSession | null>(null);
  useEffect(() => { setSession(readSession(salonId)); }, [salonId]);
  const save = useCallback((next: CustomerSession | null) => {
    writeSession(salonId, next);
    setSession(next);
  }, [salonId]);
  return [session, save] as const;
}

// ── Look ────────────────────────────────────────────────────────────────────────

type Tone = {
  text: string; sub: string; card: string; border: string; inputBg: string; inputBorder: string; soft: string;
};

function toneFor(theme: WebsiteTheme): Tone {
  const light = isLightColor(theme.heroBg);
  return {
    text: theme.heroTextColor ?? (light ? "#0F172A" : "#F8FAFC"),
    sub: light ? "#475569" : "#94A3B8",
    card: light ? "#FFFFFF" : "rgba(255,255,255,0.06)",
    border: light ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.12)",
    inputBg: light ? "#F8FAFC" : "rgba(255,255,255,0.06)",
    inputBorder: light ? "rgba(15,23,42,0.15)" : "rgba(255,255,255,0.18)",
    soft: light ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)",
  };
}

type ChipKind = "good" | "warn" | "bad" | "neutral";
const CHIP_COLOR: Record<Exclude<ChipKind, "neutral">, string> = { good: "#16A34A", warn: "#D97706", bad: "#DC2626" };

function Chip({ label, kind, tone }: { label: string; kind: ChipKind; tone: Tone }) {
  const color = kind === "neutral" ? tone.sub : CHIP_COLOR[kind];
  return (
    <span className="inline-flex items-center shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={{ color, backgroundColor: `${color}1A`, border: `1px solid ${color}33` }}>
      {label}
    </span>
  );
}

const BOOKING_CHIP: Record<CustomerBooking["status"], [string, ChipKind]> = {
  PENDING: ["Awaiting confirmation", "warn"],
  CONFIRMED: ["Confirmed", "good"],
  CANCELLED: ["Cancelled", "bad"],
  COMPLETED: ["Completed", "neutral"],
  NO_SHOW: ["Missed", "bad"],
};

const ORDER_CHIP: Record<CustomerOrder["status"], [string, ChipKind]> = {
  NEW: ["Received", "warn"],
  CONFIRMED: ["Confirmed", "good"],
  PROCESSING: ["Being prepared", "warn"],
  READY_TO_SHIP: ["Ready to ship", "warn"],
  SHIPPED: ["Shipped", "good"],
  DELIVERED: ["Delivered", "good"],
  FULFILLED: ["Completed", "neutral"],
  CANCELLED: ["Cancelled", "bad"],
  FAILED: ["Failed", "bad"],
  ON_HOLD: ["On hold", "warn"],
};

const MEMBERSHIP_CHIP: Record<CustomerMembership["status"], [string, ChipKind]> = {
  PENDING_PAYMENT: ["Awaiting payment", "warn"],
  ACTIVE: ["Active", "good"],
  EXPIRED: ["Expired", "bad"],
  CANCELLED: ["Cancelled", "neutral"],
  INCOMPLETE: ["Not completed", "neutral"],
};

const INTERVAL: Record<CustomerMembership["billingInterval"], string> = {
  MONTHLY: "/ month", QUARTERLY: "/ 3 months", YEARLY: "/ year",
};

function appointmentStart(b: CustomerBooking) {
  return new Date(`${b.appointmentDate}T${b.startTime}`);
}

function timeOf(date: string, time: string, locale: string) {
  return new Date(`${date}T${time}`).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
}

function longDate(date: Date, locale: string) {
  return date.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function withQuery(href: string, key: string, value: string) {
  return `${href}${href.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`;
}

// ── Panel (shared by the page and the drawer) ──────────────────────────────────

export interface CustomerAccountPanelProps extends CustomerAccountLinks {
  salon: Salon;
  theme: WebsiteTheme;
}

/** Sign-in, or the signed-in account. Renders on whatever surface it's placed on. */
export function CustomerAccountPanel({ salon, theme, pageHref, onNavigate, renewHref }: CustomerAccountPanelProps) {
  const { t: translateUi } = useI18n();
  const tone = toneFor(theme);
  const [session, setSession] = useCustomerSession(salon.id);
  const [account, setAccount] = useState<CustomerAccount | null>(null);
  const [ratingOptions, setRatingOptions] = useState<CustomerRatingOption[]>([]);
  const [ratingLoadError, setRatingLoadError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!session) { setAccount(null); return; }
    let alive = true;
    setLoadError(null);
    apiFetch<CustomerAccount>(`${API_BASE}/api/salon/${salon.id}/account`, { headers: jsonHeaders(session.sessionToken) })
      .then((a) => alive && setAccount(a))
      .catch((e) => {
        if (!alive) return;
        if (e instanceof ApiError && e.status === 401) {
          setExpired(true);
          setSession(null);
        } else {
          setLoadError(friendlyMessage(e));
        }
      });
    return () => { alive = false; };
  }, [session, salon.id, setSession]);

  useEffect(() => {
    if (!session) { setRatingOptions([]); return; }
    let alive = true;
    setRatingLoadError(null);
    apiFetch<CustomerRatingOption[]>(`${API_BASE}/api/salon/${salon.id}/account/ratings`, { headers: jsonHeaders(session.sessionToken) })
      .then((options) => alive && setRatingOptions(options))
      .catch((e) => alive && setRatingLoadError(friendlyMessage(e)));
    return () => { alive = false; };
  }, [session, salon.id]);

  function signOut() {
    const token = session?.sessionToken;
    setSession(null);
    setAccount(null);
    setRatingOptions([]);
    setExpired(false);
    if (token) {
      apiFetch<void>(`${API_BASE}/api/salon/${salon.id}/account/sign-out`, { method: "POST", headers: jsonHeaders(token) })
        .catch(() => {});
    }
  }

  if (!session) {
    return (
      <SignIn salon={salon} theme={theme} tone={tone} translateUi={translateUi}
        notice={expired ? translateUi("Your session has ended. Sign in again to continue.") : null}
        onSignedIn={(s) => { setExpired(false); setSession(s); }} />
    );
  }

  if (loadError) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm mb-4" style={{ color: tone.sub }}>{loadError}</p>
        <button onClick={() => setSession({ ...session })} className="text-sm font-semibold underline cursor-pointer"
          style={{ color: theme.accentColor }}>{translateUi("Try again")}</button>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="py-16 flex justify-center" aria-busy="true">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: theme.accentColor }} />
      </div>
    );
  }

  return (
    <AccountDetails salon={salon} theme={theme} tone={tone} account={account} translateUi={translateUi}
      onSignOut={signOut} links={{ pageHref, onNavigate, renewHref }} token={session.sessionToken}
      ratingOptions={ratingOptions} ratingLoadError={ratingLoadError}
      onRatingSubmitted={(bookingId, feedback) => setRatingOptions((items) => items.map((item) => item.bookingId === bookingId ? { ...item, submitted: true, salonFeedback: feedback.salon, staffFeedback: feedback.staff } : item))}
      onBookingChanged={(b) => setAccount((a) => (a ? { ...a, bookings: a.bookings.map((x) => (x.id === b.id ? b : x)) } : a))} />
  );
}

// ── Sign in ────────────────────────────────────────────────────────────────────

function SignIn({ salon, theme, tone, translateUi, notice, onSignedIn }: {
  salon: Salon; theme: WebsiteTheme; tone: Tone; translateUi: Translate; notice: string | null;
  onSignedIn: (s: CustomerSession) => void;
}) {
  const accentText = contrastText(theme.accentColor);
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [resendIn]);

  useEffect(() => { if (step === "code") codeRef.current?.focus(); }, [step]);

  async function requestCode() {
    const value = email.trim();
    if (!EMAIL.test(value)) { setError(translateUi("Enter a valid email address.")); return; }
    setBusy(true); setError(null);
    try {
      await apiFetch(`${API_BASE}/api/salon/${salon.id}/account/sign-in`, {
        method: "POST", headers: jsonHeaders(), body: JSON.stringify({ email: value }),
      });
      setStep("code");
      setCode("");
      setResendIn(RESEND_AFTER_SECONDS);
    } catch (e) {
      setError(friendlyMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function verify(value: string) {
    if (value.length !== 6) return;
    setBusy(true); setError(null);
    try {
      const session = await apiFetch<CustomerSession>(`${API_BASE}/api/salon/${salon.id}/account/verify`, {
        method: "POST", headers: jsonHeaders(), body: JSON.stringify({ email: email.trim(), code: value }),
      });
      onSignedIn(session);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401
        ? translateUi("That code is wrong or has expired.")
        : friendlyMessage(e));
      setCode("");
      codeRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = { backgroundColor: tone.inputBg, border: `1px solid ${tone.inputBorder}`, color: tone.text };
  const button = (label: string, disabled: boolean) => (
    <button type="submit" disabled={disabled}
      className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold px-4 py-3 rounded-xl transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
      style={{ backgroundColor: theme.accentColor, color: accentText }}>
      {busy && <Loader2 className="w-4 h-4 animate-spin" />}{label}
    </button>
  );

  return (
    <div className="flex flex-col gap-5">
      {notice && (
        <p className="text-xs px-3 py-2.5 rounded-xl" style={{ color: tone.sub, backgroundColor: tone.soft, border: `1px solid ${tone.border}` }}>
          {notice}
        </p>
      )}
      {step === "email" ? (
        <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); void requestCode(); }}>
          <div>
            <h2 className="text-lg font-bold mb-1.5" style={{ color: tone.text }}>{translateUi("Sign in to your account")}</h2>
            <p className="text-sm leading-relaxed" style={{ color: tone.sub }}>
              {translateUi("See your appointments, orders and membership at {salon}. Use the email you booked, shopped or joined with — we'll send you a 6-digit code. No password needed.", { salon: salon.name })}
            </p>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: tone.sub }}>{translateUi("Email")}</span>
            <input type="email" autoComplete="email" inputMode="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
              className="w-full text-sm rounded-lg px-3 py-2.5 outline-none" style={inputStyle} />
          </label>
          {error && <p role="alert" className="text-xs" style={{ color: CHIP_COLOR.bad }}>{error}</p>}
          {button(translateUi("Email me a code"), busy || !email.trim())}
        </form>
      ) : (
        <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); void verify(code); }}>
          <div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
              style={{ backgroundColor: `${theme.accentColor}1F`, color: theme.accentColor }}>
              <Mail className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold mb-1.5" style={{ color: tone.text }}>{translateUi("Check your email")}</h2>
            <p className="text-sm leading-relaxed" style={{ color: tone.sub }}>
              {translateUi("If {email} has appointments, orders or a membership with {salon}, we've sent it a 6-digit code. It expires in 10 minutes.", { email: email.trim(), salon: salon.name })}
            </p>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: tone.sub }}>{translateUi("6-digit code")}</span>
            <input ref={codeRef} value={code} inputMode="numeric" autoComplete="one-time-code" maxLength={6}
              onChange={(e) => {
                const next = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(next);
                if (next.length === 6) void verify(next);
              }}
              placeholder="••••••"
              className="w-full text-center text-2xl font-bold tracking-[0.5em] tabular-nums rounded-lg px-3 py-3 outline-none"
              style={inputStyle} />
          </label>
          {error && <p role="alert" className="text-xs" style={{ color: CHIP_COLOR.bad }}>{error}</p>}
          {button(translateUi("Sign in"), busy || code.length !== 6)}
          <div className="flex items-center justify-between gap-3 text-xs">
            <button type="button" onClick={() => { setStep("email"); setError(null); }}
              className="inline-flex items-center gap-1 cursor-pointer hover:opacity-80" style={{ color: tone.sub }}>
              <ArrowLeft className="w-3.5 h-3.5" /> {translateUi("Use a different email")}
            </button>
            <button type="button" disabled={resendIn > 0 || busy} onClick={() => void requestCode()}
              className="font-semibold cursor-pointer disabled:cursor-default disabled:opacity-60"
              style={{ color: resendIn > 0 ? tone.sub : theme.accentColor }}>
              {resendIn > 0 ? translateUi("Send a new code in {seconds}s", { seconds: resendIn }) : translateUi("Send a new code")}
            </button>
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: tone.sub }}>
            {translateUi("No email? Check your spam folder, and make sure it's the address you used with this salon.")}
          </p>
        </form>
      )}
    </div>
  );
}

// ── Signed in ──────────────────────────────────────────────────────────────────

type Tab = "bookings" | "orders" | "memberships" | "loyalty";

function AccountDetails({ salon, theme, tone, account, translateUi, onSignOut, links, token, onBookingChanged, ratingOptions, ratingLoadError, onRatingSubmitted }: {
  salon: Salon; theme: WebsiteTheme; tone: Tone; account: CustomerAccount; translateUi: Translate;
  onSignOut: () => void; links: CustomerAccountLinks; token: string; onBookingChanged: (b: CustomerBooking) => void;
  ratingOptions: CustomerRatingOption[]; ratingLoadError: string | null; onRatingSubmitted: (bookingId: number, feedback: RatingFeedback) => void;
}) {
  const features = salon.features ?? [];
  const tabs = [
    { key: "bookings" as const, label: translateUi("Appointments"), count: account.bookings.length, on: features.includes("BOOKING") },
    { key: "orders" as const, label: translateUi("Orders"), count: account.orders.length, on: features.includes("WEBSHOP") },
    { key: "memberships" as const, label: translateUi("Membership"), count: account.memberships.length, on: features.includes("MEMBERSHIP") },
    { key: "loyalty" as const, label: translateUi("Loyalty"), count: 0, on: features.includes("LOYALTY_PROGRAM") },
  ].filter((t) => t.on || t.count > 0);
  const [tab, setTab] = useState<Tab>(() => (tabs.find((t) => t.key === "bookings" && t.count > 0) ?? tabs.find((t) => t.count > 0) ?? tabs[0])?.key ?? "bookings");
  const name = account.profile.name;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
          style={{ backgroundColor: theme.accentColor, color: contrastText(theme.accentColor) }}>
          {name ? name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() : <User className="w-5 h-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold truncate" style={{ color: tone.text }}>
            {name ? translateUi("Hi, {name}", { name: name.split(/\s+/)[0] }) : translateUi("Your account")}
          </p>
          <p className="text-xs truncate" style={{ color: tone.sub }}>{account.profile.email}</p>
        </div>
        <button onClick={onSignOut} className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg cursor-pointer hover:opacity-80"
          style={{ color: tone.sub, border: `1px solid ${tone.border}` }}>
          <LogOut className="w-3.5 h-3.5" /> {translateUi("Sign out")}
        </button>
      </div>

      {tabs.length > 1 && (
        <div role="tablist" className="grid gap-1 p-1 rounded-xl" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`, backgroundColor: tone.soft, border: `1px solid ${tone.border}` }}>
          {tabs.map((t) => {
            const active = t.key === tab;
            return (
              <button key={t.key} role="tab" aria-selected={active} onClick={() => setTab(t.key)}
                className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-2 py-2 rounded-lg cursor-pointer transition-colors min-w-0"
                style={active ? { backgroundColor: theme.accentColor, color: contrastText(theme.accentColor) } : { color: tone.sub }}>
                <span className="truncate">{t.label}</span>
                {t.count > 0 && <span className="tabular-nums opacity-80">{t.count}</span>}
              </button>
            );
          })}
        </div>
      )}

      {tab === "bookings" && <BookingsList salon={salon} theme={theme} tone={tone} bookings={account.bookings} policy={account.selfService} token={token}
        onChanged={onBookingChanged} translateUi={translateUi} links={links} ratingOptions={ratingOptions} ratingLoadError={ratingLoadError} onRatingSubmitted={onRatingSubmitted} />}
      {tab === "orders" && <OrdersList theme={theme} tone={tone} orders={account.orders} translateUi={translateUi} links={links} />}
      {tab === "loyalty" && <LoyaltyTab salon={salon} theme={theme} tone={tone} token={token} translateUi={translateUi} links={links} />}
      {tab === "memberships" && <MembershipsList salon={salon} theme={theme} tone={tone} memberships={account.memberships} translateUi={translateUi} links={links} />}
    </div>
  );
}

// ── Loyalty ────────────────────────────────────────────────────────────────────

const LOYALTY_REASON: Record<string, string> = {
  EARN_BOOKING: "Appointment", EARN_ORDER: "Shop order", REDEEM: "Reward redeemed", REDEEM_REFUND: "Redemption cancelled",
  REVERSAL: "Points taken back", ADJUST: "Adjustment", EXPIRE: "Points expired",
};

function LoyaltyTab({ salon, theme, tone, token, translateUi, links }: {
  salon: Salon; theme: WebsiteTheme; tone: Tone; token: string; translateUi: Translate; links: CustomerAccountLinks;
}) {
  const { locale } = useI18n();
  const [data, setData] = useState<CustomerLoyalty | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const load = useCallback(() => {
    let alive = true;
    apiFetch<CustomerLoyalty>(`${API_BASE}/api/salon/${salon.id}/account/loyalty`, { headers: jsonHeaders(token) })
      .then((d) => alive && setData(d)).catch((e) => alive && setError(friendlyMessage(e)));
    return () => { alive = false; };
  }, [salon.id, token]);
  useEffect(() => load(), [load]);

  async function redeem(rewardId: number) {
    setBusy(rewardId); setError(null); setNotice(null);
    try {
      const r = await apiFetch<{ code: string }>(`${API_BASE}/api/salon/${salon.id}/account/loyalty/rewards/${rewardId}/redeem`, { method: "POST", headers: jsonHeaders(token) });
      setNotice(translateUi("Reward claimed! Show code {code} at the salon.", { code: r.code }));
      load();
    } catch (e) { setError(friendlyMessage(e)); }
    finally { setBusy(null); }
  }

  if (error && !data) return <p role="alert" className="text-xs text-red-600">{error}</p>;
  if (!data) return <p role="status" className="text-xs py-6 text-center" style={{ color: tone.sub }}>{translateUi("Loading…")}</p>;
  if (!data.enabled) return <Empty tone={tone} icon={<Gift className="w-5 h-5" />} title={translateUi("No loyalty programme yet")}
    body={translateUi("{salon} hasn't opened its loyalty programme yet.", { salon: salon.name })} />;

  const open = data.redemptions.filter((r) => r.status === "ISSUED");
  return (
    <div className="flex flex-col gap-5">
      <Card tone={tone}>
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: tone.sub }}>{translateUi("Your points")}</p>
        <p className="text-3xl font-black tabular-nums" style={{ color: theme.accentColor }}>{data.balance}</p>
        <p className="text-[11px] mt-1" style={{ color: tone.sub }}>
          {translateUi("Earn {points} per 1 spent.", { points: data.program.pointsPerUnit })}
          {data.program.expiryMonths ? ` ${translateUi("Points expire after {months} months.", { months: data.program.expiryMonths })}` : ""}
        </p>
      </Card>

      {notice && <p role="status" className="text-xs font-semibold" style={{ color: CHIP_COLOR.good }}>{notice}</p>}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}

      {open.length > 0 && (
        <section>
          <SectionTitle tone={tone}>{translateUi("Your codes")}</SectionTitle>
          <div className="flex flex-col gap-2">
            {open.map((r) => (
              <Card key={r.id} tone={tone}>
                <p className="text-sm font-semibold" style={{ color: tone.text }}>{r.rewardName}</p>
                <p className="text-lg font-black tracking-[0.25em] tabular-nums" style={{ color: theme.accentColor }}>{r.code}</p>
                <p className="text-[11px]" style={{ color: tone.sub }}>{translateUi("Show this code at the salon.")}</p>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle tone={tone}>{translateUi("Rewards")}</SectionTitle>
        {data.rewards.length === 0
          ? <p className="text-xs py-2" style={{ color: tone.sub }}>{translateUi("Rewards will appear here soon.")}</p>
          : <div className="flex flex-col gap-2.5">
              {data.rewards.map((r) => {
                const enough = data.balance >= r.pointsCost;
                return (
                  <Card key={r.id} tone={tone}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold" style={{ color: tone.text }}>{r.name}</p>
                        {r.description && <p className="text-xs" style={{ color: tone.sub }}>{r.description}</p>}
                        <p className="text-xs font-bold tabular-nums mt-1" style={{ color: theme.accentColor }}>{r.pointsCost} {translateUi("points")}</p>
                      </div>
                      <button type="button" disabled={!enough || busy !== null} onClick={() => redeem(r.id)}
                        className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                        style={{ backgroundColor: theme.accentColor, color: contrastText(theme.accentColor) }}>
                        {busy === r.id ? translateUi("Claiming…") : enough ? translateUi("Redeem") : translateUi("Not enough points")}
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>}
      </section>

      {data.history.length > 0 && (
        <section>
          <SectionTitle tone={tone}>{translateUi("History")}</SectionTitle>
          <div className="flex flex-col gap-1.5">
            {data.history.map((h) => (
              <div key={h.id} className="flex items-center justify-between gap-3 text-xs rounded-xl px-3 py-2" style={{ backgroundColor: tone.soft, border: `1px solid ${tone.border}` }}>
                <div className="min-w-0">
                  <p className="font-semibold truncate" style={{ color: tone.text }}>{translateUi(LOYALTY_REASON[h.reason] ?? h.reason)}{h.note ? ` · ${h.note}` : ""}</p>
                  <p style={{ color: tone.sub }}>{new Date(h.createdAt).toLocaleDateString(locale)}</p>
                </div>
                <span className="font-bold tabular-nums" style={{ color: h.delta >= 0 ? CHIP_COLOR.good : tone.sub }}>{h.delta > 0 ? "+" : ""}{h.delta}</span>
              </div>
            ))}
          </div>
        </section>
      )}
      <div className="flex flex-wrap gap-2"><PageLink page="book" label={translateUi("Book an appointment")} theme={theme} links={links} primary /></div>
    </div>
  );
}

function PageLink({ page, label, theme, links, primary = false }: {
  page: AccountPage; label: string; theme: WebsiteTheme; links: CustomerAccountLinks; primary?: boolean;
}) {
  const href = links.pageHref?.(page);
  if (!href) return null;
  return (
    <a href={href}
      onClick={links.onNavigate ? (e) => { e.preventDefault(); links.onNavigate!(page); } : undefined}
      className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl no-underline transition-opacity hover:opacity-85"
      style={primary
        ? { backgroundColor: theme.accentColor, color: contrastText(theme.accentColor) }
        : { color: theme.accentColor, border: `1px solid ${theme.accentColor}55` }}>
      {label}
    </a>
  );
}

function Empty({ icon, title, body, action, tone }: { icon: React.ReactNode; title: string; body: string; action?: React.ReactNode; tone: Tone }) {
  return (
    <div className="text-center py-10 px-4 rounded-2xl" style={{ border: `1px dashed ${tone.border}` }}>
      <div className="w-10 h-10 mx-auto mb-3 rounded-xl flex items-center justify-center" style={{ backgroundColor: tone.soft, color: tone.sub }}>{icon}</div>
      <p className="text-sm font-semibold mb-1" style={{ color: tone.text }}>{title}</p>
      <p className="text-xs mb-4" style={{ color: tone.sub }}>{body}</p>
      {action}
    </div>
  );
}

function Card({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <div className="rounded-2xl p-4" style={{ backgroundColor: tone.card, border: `1px solid ${tone.border}` }}>{children}</div>;
}

function SectionTitle({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: tone.sub }}>{children}</h3>;
}

// ── Bookings ───────────────────────────────────────────────────────────────────

function BookingsList({ salon, theme, tone, bookings, policy, token, onChanged, translateUi, links, ratingOptions, ratingLoadError, onRatingSubmitted }: {
  salon: Salon; theme: WebsiteTheme; tone: Tone; bookings: CustomerBooking[]; policy: CustomerSelfServicePolicy | undefined;
  token: string; onChanged: (b: CustomerBooking) => void; translateUi: Translate; links: CustomerAccountLinks;
  ratingOptions: CustomerRatingOption[]; ratingLoadError: string | null; onRatingSubmitted: (bookingId: number, feedback: RatingFeedback) => void;
}) {
  const { locale } = useI18n();
  const now = Date.now();
  const isUpcoming = (b: CustomerBooking) =>
    appointmentStart(b).getTime() >= now && (b.status === "PENDING" || b.status === "CONFIRMED");
  // `?staff=<id>` (from a stylist card's "Rate" link) narrows the list to visits with that stylist.
  const [focusStaff, setFocusStaff] = useState<number | null>(null);
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get("staff"));
    setFocusStaff(Number.isFinite(id) && id > 0 ? id : null);
  }, []);
  const focusName = focusStaff == null ? null : bookings.find((b) => b.staffId === focusStaff)?.staffName ?? null;
  const upcoming = bookings.filter(isUpcoming).sort((a, b) => appointmentStart(a).getTime() - appointmentStart(b).getTime());
  const past = bookings.filter((b) => !isUpcoming(b) && (focusStaff == null || b.staffId === focusStaff)).sort((a, b) => appointmentStart(b).getTime() - appointmentStart(a).getTime());

  if (bookings.length === 0) {
    return <Empty tone={tone} icon={<CalendarDays className="w-5 h-5" />} title={translateUi("No appointments yet")}
      body={translateUi("When you book at {salon}, your appointments show up here.", { salon: salon.name })}
      action={<PageLink page="book" label={translateUi("Book an appointment")} theme={theme} links={links} primary />} />;
  }

  const row = (b: CustomerBooking, faded: boolean) => {
    const [label, kind] = BOOKING_CHIP[b.status];
    return (
      <Card key={b.id} tone={tone}>
        <div className="flex items-start gap-3" style={{ opacity: faded ? 0.85 : 1 }}>
          <div className="w-12 shrink-0 rounded-xl text-center py-1.5" style={{ backgroundColor: `${theme.accentColor}14`, color: theme.accentColor }}>
            <div className="text-[10px] font-semibold uppercase">{appointmentStart(b).toLocaleDateString(locale, { month: "short" })}</div>
            <div className="text-lg font-black leading-tight tabular-nums">{appointmentStart(b).getDate()}</div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold" style={{ color: tone.text }}>{b.serviceName ?? translateUi("Appointment")}</p>
              <Chip label={translateUi(label)} kind={kind} tone={tone} />
            </div>
            <p className="text-xs mt-1 flex items-center gap-1.5" style={{ color: tone.sub }}>
              <Clock className="w-3.5 h-3.5 shrink-0" />
              {longDate(appointmentStart(b), locale)} · {timeOf(b.appointmentDate, b.startTime, locale)}–{timeOf(b.appointmentDate, b.endTime, locale)}
            </p>
            {(b.staffName || b.price != null) && (
              <p className="text-xs mt-1" style={{ color: tone.sub }}>
                {b.staffName && translateUi("with {name}", { name: b.staffName })}
                {b.staffName && b.price != null && " · "}
                {b.price != null && formatPrice(b.price, b.currency, locale)}
              </p>
            )}
            {b.paymentStatus === "PAID" && <p className="text-[11px] mt-1 font-medium" style={{ color: CHIP_COLOR.good }}>{translateUi("Paid")}</p>}
            {!faded && (b.canCancel || b.canReschedule || b.blockedReason) && (
              <BookingActions salon={salon} theme={theme} tone={tone} booking={b} token={token} onChanged={onChanged} translateUi={translateUi} />
            )}
            {b.status === "COMPLETED" && ratingOptions.some((item) => item.bookingId === b.id) && (
              <CustomerBookingRating salon={salon} theme={theme} tone={tone} booking={b}
                option={ratingOptions.find((item) => item.bookingId === b.id)!} token={token}
                error={ratingLoadError} translateUi={translateUi} onSubmitted={onRatingSubmitted} />
            )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {focusStaff != null && (
        <div className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs" style={{ backgroundColor: tone.soft, border: `1px solid ${tone.border}`, color: tone.text }}>
          <span>{focusName ? translateUi("Rate your visits with {name}", { name: focusName }) : translateUi("Rate your visits with this stylist")}</span>
          <button type="button" className="font-semibold underline" onClick={() => setFocusStaff(null)}>{translateUi("Show all")}</button>
        </div>
      )}
      <section>
        <SectionTitle tone={tone}>{translateUi("Upcoming")}</SectionTitle>
        {upcoming.length > 0
          ? <div className="flex flex-col gap-2.5">{upcoming.map((b) => row(b, false))}</div>
          : <p className="text-xs py-2" style={{ color: tone.sub }}>{translateUi("Nothing coming up.")}</p>}
      </section>
      <div className="flex flex-wrap gap-2">
        <PageLink page="book" label={translateUi("Book again")} theme={theme} links={links} primary />
      </div>
      <p className="text-[11px]" style={{ color: tone.sub }}>
        {policy && (policy.allowCancel || policy.allowReschedule) && (
          <>{translateUi("You can change or cancel online up to {hours} hours before your appointment.", { hours: Math.min(...[policy.allowCancel ? policy.cancelNoticeHours : Infinity, policy.allowReschedule ? policy.rescheduleNoticeHours : Infinity]) })} </>
        )}
        {translateUi("Need to change or cancel? Contact {salon} directly.", { salon: salon.name })}
        {salon.contact?.phone && <> · <a href={`tel:${salon.contact.phone}`} className="underline" style={{ color: tone.sub }}>{salon.contact.phone}</a></>}
      </p>
      {past.length > 0 && (
        <section>
          <SectionTitle tone={tone}>{translateUi("Past")}</SectionTitle>
          <div className="flex flex-col gap-2.5">{past.map((b) => row(b, true))}</div>
        </section>
      )}
    </div>
  );
}

type RatingFeedback = { salon: string | null; staff: string | null };

function CustomerBookingRating({ salon, theme, tone, booking, option, token, error, translateUi, onSubmitted }: {
  salon: Salon; theme: WebsiteTheme; tone: Tone; booking: CustomerBooking; option: CustomerRatingOption;
  token: string; error: string | null; translateUi: Translate; onSubmitted: (bookingId: number, feedback: RatingFeedback) => void;
}) {
  const [salonRating, setSalonRating] = useState(0);
  const [staffRating, setStaffRating] = useState(0);
  const [salonFeedback, setSalonFeedback] = useState("");
  const [staffFeedback, setStaffFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  async function submit() {
    setBusy(true); setSubmitError("");
    try {
      await apiFetch<void>(`${API_BASE}/api/salon/${salon.id}/account/ratings`, {
        method: "POST", headers: jsonHeaders(token), body: JSON.stringify({ bookingId: booking.id, salonRating, staffRating, salonFeedback: salonFeedback.trim() || null, staffFeedback: staffFeedback.trim() || null }),
      });
      onSubmitted(booking.id, { salon: salonFeedback.trim() || null, staff: staffFeedback.trim() || null });
    } catch (e) { setSubmitError(friendlyMessage(e)); }
    finally { setBusy(false); }
  }
  if (option.submitted) return <div className="mt-3 space-y-2">
    <p className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: CHIP_COLOR.good }}><Star className="size-3.5 fill-current" />{translateUi("Thanks for rating your visit")}</p>
    {option.salonFeedback && <p className="text-xs italic" style={{ color: tone.sub }}>{salon.name}: “{option.salonFeedback}”</p>}
    {option.staffFeedback && <p className="text-xs italic" style={{ color: tone.sub }}>{booking.staffName ?? option.staffName ?? translateUi("Your stylist")}: “{option.staffFeedback}”</p>}
    {option.reply && <div className="rounded-lg p-2.5 text-xs" style={{ backgroundColor: tone.soft, border: `1px solid ${tone.border}`, color: tone.text }}>
      <p className="font-semibold">{translateUi("Reply from {salon}", { salon: salon.name })}</p><p className="mt-0.5 whitespace-pre-line">{option.reply}</p></div>}
  </div>;
  return <div className="mt-3 rounded-xl p-3" style={{ backgroundColor: tone.soft, border: `1px solid ${tone.border}` }}>
    <p className="text-xs font-semibold" style={{ color: tone.text }}>{translateUi("How was your visit?")}</p>
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      {[{ label: salon.name, value: salonRating, set: setSalonRating }, { label: booking.staffName ?? option.staffName ?? translateUi("Your stylist"), value: staffRating, set: setStaffRating }].map((rating) => <div key={rating.label}>
        <p className="mb-1 text-[11px]" style={{ color: tone.sub }}>{rating.label}</p><div className="flex gap-1" role="radiogroup" aria-label={rating.label}>
          {[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" role="radio" aria-checked={rating.value === value} aria-label={`${value} ${translateUi("stars")}`} onClick={() => rating.set(value)}
            className="size-8 rounded-md text-lg focus-visible:outline focus-visible:outline-2" style={{ color: value <= rating.value ? "#D97706" : tone.border }}>{value <= rating.value ? "★" : "☆"}</button>)}
        </div>
      </div>)}
    </div>
    {[{ label: translateUi("Feedback about {name} (optional)", { name: salon.name }), value: salonFeedback, set: setSalonFeedback },
      { label: translateUi("Feedback about {name} (optional)", { name: booking.staffName ?? option.staffName ?? translateUi("your stylist") }), value: staffFeedback, set: setStaffFeedback }].map((field) =>
      <label key={field.label} className="mt-3 block text-[11px]" style={{ color: tone.sub }}>{field.label}
        <textarea value={field.value} onChange={(e) => field.set(e.target.value)} maxLength={1000} rows={3}
          className="mt-1 w-full rounded-lg border px-2.5 py-2 text-xs" style={{ borderColor: tone.border, color: tone.text, backgroundColor: "transparent" }} />
      </label>)}
    {(error || submitError) && <p role="alert" className="mt-2 text-xs text-red-600">{submitError || error}</p>}
    <button type="button" disabled={busy || salonRating < 1 || staffRating < 1} onClick={submit}
      className="mt-3 rounded-lg px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
      style={{ backgroundColor: theme.accentColor, color: contrastText(theme.accentColor) }}>{busy ? translateUi("Submitting…") : translateUi("Send feedback")}</button>
  </div>;
}

/** Cancel / reschedule one upcoming appointment; the server re-checks every rule, this only mirrors them. */
function BookingActions({ salon, theme, tone, booking: b, token, onChanged, translateUi }: {
  salon: Salon; theme: WebsiteTheme; tone: Tone; booking: CustomerBooking; token: string;
  onChanged: (b: CustomerBooking) => void; translateUi: Translate;
}) {
  const { locale } = useI18n();
  const [mode, setMode] = useState<"cancel" | "reschedule" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<AvailableSlot[] | null>(null);
  const [slot, setSlot] = useState<AvailableSlot | null>(null);
  const accentText = contrastText(theme.accentColor);
  const base = `${API_BASE}/api/salon/${salon.id}/account/bookings/${b.id}`;
  const btn = "inline-flex items-center justify-center min-h-10 px-3.5 text-xs font-semibold rounded-lg cursor-pointer disabled:opacity-50";

  function close() { setMode(null); setError(null); setDate(""); setSlots(null); setSlot(null); }

  // Free times on the chosen day, from the same endpoint the booking page uses. Any staff member is
  // offered; for a time several can do, the appointment's current staff member is preferred.
  useEffect(() => {
    if (mode !== "reschedule" || !date || b.serviceId == null) { setSlots(null); return; }
    let alive = true;
    setSlots(null); setSlot(null); setError(null);
    const params = new URLSearchParams({ serviceId: String(b.serviceId), date });
    apiFetch<AvailableSlot[]>(`${API_BASE}/api/salon/${salon.id}/booking/slots?${params}`)
      .then((all) => {
        if (!alive) return;
        const now = new Date();
        const byTime = new Map<string, AvailableSlot>();
        for (const s of all) {
          if (s.booked || new Date(`${date}T${s.startTime}`) <= now) continue;
          const key = s.startTime.slice(0, 5);
          const kept = byTime.get(key);
          if (!kept || (s.staffId === b.staffId && kept.staffId !== b.staffId)) byTime.set(key, s);
        }
        setSlots([...byTime.values()].sort((x, y) => x.startTime.localeCompare(y.startTime)));
      })
      .catch((e) => { if (alive) { setSlots([]); setError(friendlyMessage(e)); } });
    return () => { alive = false; };
  }, [mode, date, b.serviceId, b.staffId, salon.id]);

  async function submit(path: "cancel" | "reschedule") {
    setBusy(true); setError(null);
    try {
      const updated = await apiFetch<CustomerBooking>(`${base}/${path}`, {
        method: "POST", headers: jsonHeaders(token),
        body: path === "reschedule" ? JSON.stringify({ appointmentDate: date, startTime: slot!.startTime, staffId: slot!.staffId }) : undefined,
      });
      onChanged(updated);
      close();
    } catch (e) {
      setError(friendlyMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!mode) {
    return (
      <div className="mt-3">
        <div className="flex flex-wrap gap-2">
          {b.canReschedule && (
            <button onClick={() => setMode("reschedule")} className={btn} style={{ border: `1px solid ${tone.border}`, color: tone.text }}>
              {translateUi("Reschedule")}
            </button>
          )}
          {b.canCancel && (
            <button onClick={() => setMode("cancel")} className={btn} style={{ border: `1px solid ${tone.border}`, color: CHIP_COLOR.bad }}>
              {translateUi("Cancel appointment")}
            </button>
          )}
        </div>
        {!b.canCancel && b.blockedReason && (
          <p className="text-[11px] mt-2" style={{ color: tone.sub }}>
            {b.blockedReason === "TOO_LATE" && translateUi("It's too close to your appointment to change it online. Please contact the salon.")}
            {b.blockedReason === "PAID" && translateUi("Paid online — to cancel, please contact the salon.")}
            {b.blockedReason === "DISABLED" && translateUi("Please contact the salon to change this appointment.")}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl p-3" style={{ backgroundColor: tone.soft, border: `1px solid ${tone.border}` }}>
      {mode === "cancel" ? (
        <>
          <p className="text-xs" style={{ color: tone.text }}>{translateUi("Cancel this appointment? You'll get a confirmation email.")}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={close} disabled={busy} className={btn} style={{ border: `1px solid ${tone.border}`, color: tone.text }}>{translateUi("Keep it")}</button>
            <button onClick={() => submit("cancel")} disabled={busy} className={btn} style={{ backgroundColor: CHIP_COLOR.bad, color: "#fff" }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : translateUi("Yes, cancel")}
            </button>
          </div>
        </>
      ) : (
        <>
          <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: tone.sub }} htmlFor={`resched-${b.id}`}>
            {translateUi("Choose a new day")}
          </label>
          <input id={`resched-${b.id}`} type="date" value={date} min={new Date().toLocaleDateString("en-CA")}
            onChange={(e) => setDate(e.target.value)}
            className="w-full min-h-10 px-3 rounded-lg text-sm" style={{ border: `1px solid ${tone.border}`, color: tone.text, backgroundColor: "transparent" }} />
          {date && slots === null && <Loader2 className="w-4 h-4 animate-spin mt-3" style={{ color: theme.accentColor }} />}
          {date && slots !== null && slots.length === 0 && !error && (
            <p className="text-xs mt-3" style={{ color: tone.sub }}>{translateUi("No free times that day. Try another day.")}</p>
          )}
          {slots && slots.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3" role="listbox" aria-label={translateUi("Available times")}>
              {slots.map((s) => {
                const active = slot?.startTime === s.startTime;
                return (
                  <button key={s.startTime} role="option" aria-selected={active} onClick={() => setSlot(s)}
                    className="min-h-10 rounded-lg text-xs font-semibold cursor-pointer tabular-nums"
                    style={active ? { backgroundColor: theme.accentColor, color: accentText } : { border: `1px solid ${tone.border}`, color: tone.text }}>
                    {timeOf(date, s.startTime, locale)}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={close} disabled={busy} className={btn} style={{ border: `1px solid ${tone.border}`, color: tone.text }}>{translateUi("Back")}</button>
            <button onClick={() => submit("reschedule")} disabled={busy || !slot} className={btn} style={{ backgroundColor: theme.accentColor, color: accentText }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : translateUi("Confirm new time")}
            </button>
          </div>
        </>
      )}
      {error && <p role="alert" className="text-xs mt-2" style={{ color: CHIP_COLOR.bad }}>{error}</p>}
    </div>
  );
}

// ── Orders ─────────────────────────────────────────────────────────────────────

const TIMELINE_LABEL: Record<string, string> = {
  ORDER_PLACED: "Order placed",
  PAYMENT_PAID: "Payment received",
  PAYMENT_FAILED: "Payment failed",
  STATUS_CHANGED: "Status updated",
  SHIPMENT_CREATED: "Shipped",
  CUSTOMER_NOTIFIED: "Email sent to you",
  INVOICE_SENT: "Invoice sent",
  REFUND_INITIATED: "Refund started",
  REFUND_APPROVED: "Refund approved",
  REFUND_ACCEPTED: "Refunded",
  REFUND_REJECTED: "Refund declined",
  RETURN_REQUESTED: "Return requested",
  RETURN_UPDATED: "Return updated",
  CREDIT_PAID: "Credit paid out",
};

function OrdersList({ theme, tone, orders, translateUi, links }: {
  theme: WebsiteTheme; tone: Tone; orders: CustomerOrder[]; translateUi: Translate; links: CustomerAccountLinks;
}) {
  const { locale } = useI18n();
  const [open, setOpen] = useState<number | null>(orders[0]?.id ?? null);

  if (orders.length === 0) {
    return <Empty tone={tone} icon={<Package className="w-5 h-5" />} title={translateUi("No orders yet")}
      body={translateUi("Orders you place in the shop show up here, with their delivery status.")}
      action={<PageLink page="shop" label={translateUi("Visit the shop")} theme={theme} links={links} primary />} />;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {orders.map((o) => {
        const [label, kind] = o.paymentStatus === "PENDING" ? ["Awaiting payment", "warn" as ChipKind] : ORDER_CHIP[o.status];
        const expanded = open === o.id;
        const items = o.lines.reduce((n, l) => n + l.quantity, 0);
        return (
          <Card key={o.id} tone={tone}>
            <button onClick={() => setOpen(expanded ? null : o.id)} aria-expanded={expanded}
              className="w-full flex items-start gap-3 text-left cursor-pointer">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold" style={{ color: tone.text }}>{translateUi("Order {number}", { number: o.orderNumber })}</p>
                  <Chip label={translateUi(label)} kind={kind} tone={tone} />
                </div>
                <p className="text-xs mt-1" style={{ color: tone.sub }}>
                  {formatDate(o.createdAt, locale)} · {items === 1 ? translateUi("1 item") : translateUi("{count} items", { count: items })} · <span className="font-semibold" style={{ color: tone.text }}>{formatPrice(o.total, o.currency, locale)}</span>
                </p>
              </div>
              <ChevronDown className="w-4 h-4 mt-1 shrink-0 transition-transform" style={{ color: tone.sub, transform: expanded ? "rotate(180deg)" : undefined }} />
            </button>

            {expanded && (
              <div className="mt-4 pt-4 flex flex-col gap-4" style={{ borderTop: `1px solid ${tone.border}` }}>
                <ul className="flex flex-col gap-2">
                  {o.lines.map((l, i) => (
                    <li key={i} className="flex items-start justify-between gap-3 text-xs">
                      <span style={{ color: tone.text }}>
                        {l.quantity} × {l.productName}{l.variantLabel ? <span style={{ color: tone.sub }}> · {l.variantLabel}</span> : null}
                      </span>
                      <span className="tabular-nums shrink-0" style={{ color: tone.text }}>{formatPrice(l.lineTotal, o.currency, locale)}</span>
                    </li>
                  ))}
                  <li className="flex justify-between text-xs pt-2" style={{ color: tone.sub, borderTop: `1px dashed ${tone.border}` }}>
                    <span>{o.shippingMethodName ? translateUi("Shipping · {method}", { method: o.shippingMethodName }) : translateUi("Shipping")}</span>
                    <span className="tabular-nums">{formatPrice(o.shippingCost, o.currency, locale)}</span>
                  </li>
                  <li className="flex justify-between text-sm font-bold" style={{ color: tone.text }}>
                    <span>{translateUi("Total")}</span>
                    <span className="tabular-nums">{formatPrice(o.total, o.currency, locale)}</span>
                  </li>
                </ul>

                {(o.trackingNumber || o.trackingCarrier) && (
                  <p className="text-xs flex items-center gap-2 px-3 py-2 rounded-xl" style={{ color: tone.text, backgroundColor: tone.soft }}>
                    <Truck className="w-4 h-4 shrink-0" style={{ color: theme.accentColor }} />
                    <span>{[o.trackingCarrier, o.trackingNumber].filter(Boolean).join(" · ")}</span>
                  </p>
                )}
                {o.refundStatus && (
                  <p className="text-xs" style={{ color: tone.sub }}>
                    {translateUi("Refund: {status}", { status: o.refundStatus.toLowerCase().replace(/_/g, " ") })}
                    {o.refundAmount != null && ` · ${formatPrice(o.refundAmount, o.currency, locale)}`}
                  </p>
                )}
                {o.returnStatus && (
                  <p className="text-xs" style={{ color: tone.sub }}>
                    {translateUi("Return: {status}", { status: o.returnStatus.toLowerCase().replace(/_/g, " ") })}
                  </p>
                )}

                {o.timeline.length > 0 && (
                  <div>
                    <SectionTitle tone={tone}>{translateUi("History")}</SectionTitle>
                    <ol className="relative flex flex-col gap-3 pl-4" style={{ borderLeft: `2px solid ${tone.border}` }}>
                      {o.timeline.map((t, i) => (
                        <li key={i} className="relative">
                          <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: i === o.timeline.length - 1 ? theme.accentColor : tone.border }} />
                          <p className="text-xs font-semibold" style={{ color: tone.text }}>{translateUi(TIMELINE_LABEL[t.type] ?? "Update")}</p>
                          {t.message && t.type !== "ORDER_PLACED" && <p className="text-[11px]" style={{ color: tone.sub }}>{t.message}</p>}
                          <p className="text-[10px] mt-0.5" style={{ color: tone.sub }}>
                            {new Date(t.createdAt).toLocaleString(locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ── Memberships ────────────────────────────────────────────────────────────────

function MembershipsList({ salon, theme, tone, memberships, translateUi, links }: {
  salon: Salon; theme: WebsiteTheme; tone: Tone; memberships: CustomerMembership[]; translateUi: Translate; links: CustomerAccountLinks;
}) {
  const { locale } = useI18n();

  if (memberships.length === 0) {
    return <Empty tone={tone} icon={<Crown className="w-5 h-5" />} title={translateUi("No membership yet")}
      body={translateUi("Join {salon}'s membership for perks on every visit.", { salon: salon.name })}
      action={<PageLink page="membership" label={translateUi("See membership plans")} theme={theme} links={links} primary />} />;
  }

  const renewHrefFor = (token: string) => links.renewHref
    ? links.renewHref(token)
    : (links.pageHref?.("membership") ? withQuery(links.pageHref("membership")!, "renew", token) : null);

  return (
    <div className="flex flex-col gap-3">
      {memberships.map((m) => {
        const [label, kind] = MEMBERSHIP_CHIP[m.status];
        const renew = m.renewalToken ? renewHrefFor(m.renewalToken) : null;
        const until = m.currentPeriodEnd ? formatDate(m.currentPeriodEnd, locale) : null;
        return (
          <Card key={m.id} tone={tone}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: tone.text }}>{m.planName}</p>
                <p className="text-xs mt-0.5" style={{ color: tone.sub }}>
                  {formatPrice(m.price, m.currency, locale)} {translateUi(INTERVAL[m.billingInterval])}
                </p>
              </div>
              <Chip label={translateUi(label)} kind={kind} tone={tone} />
            </div>

            {m.qrCode && (
              <div className="mt-4 flex flex-col items-center gap-2 p-4 rounded-2xl" style={{ backgroundColor: tone.soft }}>
                <img src={m.qrCode} alt={translateUi("Membership QR code")} width={168} height={168}
                  className="rounded-xl bg-white p-2" style={{ imageRendering: "pixelated" }} />
                <p className="text-[11px]" style={{ color: tone.sub }}>{translateUi("Show this at the desk when you visit")}</p>
                <p className="font-mono text-base font-bold tracking-[0.2em]" style={{ color: tone.text }}>{m.memberCode}</p>
              </div>
            )}

            <div className="mt-3 text-xs flex flex-col gap-1" style={{ color: tone.sub }}>
              {m.status === "ACTIVE" && until && (
                <p>{m.cancelAtPeriodEnd
                  ? translateUi("Ends on {date} and won't renew.", { date: until })
                  : translateUi("Paid until {date}. Nothing renews automatically — we'll email you a renewal link before then.", { date: until })}</p>
              )}
              {m.status === "EXPIRED" && until && <p>{translateUi("Ended on {date}. Renew any time and keep your member code.", { date: until })}</p>}
              {m.status === "CANCELLED" && <p>{translateUi("This membership has been cancelled.")}</p>}
              {m.status === "PENDING_PAYMENT" && <p>{translateUi("We're waiting for your payment to be confirmed.")}</p>}
              {!m.qrCode && m.status !== "PENDING_PAYMENT" && <p>{translateUi("Member code")}: <span className="font-mono font-semibold" style={{ color: tone.text }}>{m.memberCode}</span></p>}
            </div>

            {renew && (
              <a href={renew} className="mt-4 w-full inline-flex items-center justify-center text-sm font-semibold px-4 py-2.5 rounded-xl no-underline transition-opacity hover:opacity-90"
                style={{ backgroundColor: theme.accentColor, color: contrastText(theme.accentColor) }}>
                {m.status === "EXPIRED" ? translateUi("Renew membership") : translateUi("Renew early")}
              </a>
            )}

            {m.payments.length > 0 && (
              <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${tone.border}` }}>
                <SectionTitle tone={tone}>{translateUi("Payments")}</SectionTitle>
                <ul className="flex flex-col gap-1.5">
                  {m.payments.map((p, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 text-xs">
                      <span style={{ color: tone.text }}>
                        {p.kind === "SIGNUP" ? translateUi("Sign-up") : translateUi("Renewal")}
                        <span style={{ color: tone.sub }}> · {formatDate(p.paidAt ?? p.createdAt, locale)}</span>
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        {p.status === "PENDING" && <Chip label={translateUi("Pending")} kind="warn" tone={tone} />}
                        {(p.refundedAmount ?? 0) > 0 && <Chip label={translateUi("Refunded")} kind="neutral" tone={tone} />}
                        <span className="tabular-nums font-semibold" style={{ color: tone.text }}>{formatPrice(p.amount, p.currency, locale)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ── Drawer (shop header avatar) ────────────────────────────────────────────────

export function CustomerAccountDrawer({ open, onClose, ...panel }: CustomerAccountPanelProps & { open: boolean; onClose: () => void }) {
  const { t: translateUi } = useI18n();
  const { theme } = panel;
  const tone = toneFor(theme);
  const panelBg = isLightColor(theme.heroBg) ? "#FFFFFF" : "#0F172A";

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ fontFamily: fontStack(theme.fontFamily) }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-label={translateUi("My account")}
        className="relative w-full max-w-md h-full flex flex-col shadow-2xl" style={{ backgroundColor: panelBg }}>
        <div className="flex items-center justify-between px-5 h-14 border-b shrink-0" style={{ borderColor: tone.border }}>
          <div className="flex items-center gap-2">
            <User className="w-4 h-4" style={{ color: theme.accentColor }} />
            <span className="text-sm font-bold" style={{ color: tone.text }}>{translateUi("My account")}</span>
          </div>
          <button onClick={onClose} aria-label={translateUi("Close")} className="cursor-pointer" style={{ color: tone.sub }}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-6">
          <CustomerAccountPanel {...panel} />
        </div>
      </aside>
    </div>
  );
}

// ── Page (/account on the website, /:salon/account in the booking app) ─────────

export interface CustomerAccountViewProps extends CustomerAccountLinks {
  salon: Salon;
  theme: WebsiteTheme;
  policies?: SalonPolicy[];
  /** Leave the account (back to the site or the booking page). */
  onBack: () => void;
  /** For the header's nav links (website only). */
  getPagePath?: (page: string) => string;
  onNavigateSite?: (page: string) => void;
  /** No website around it (booking app): hide the site nav. */
  standalone?: boolean;
}

export function CustomerAccountView({
  salon, theme, policies = [], onBack, getPagePath, onNavigateSite, standalone = false, ...links
}: CustomerAccountViewProps) {
  const { t: translateUi } = useI18n();
  const tone = toneFor(theme);
  useEffect(() => { loadGoogleFont(theme.fontFamily); }, [theme.fontFamily]);

  return (
    <div className="min-h-[100dvh] flex flex-col" style={{ fontFamily: fontStack(theme.fontFamily), backgroundColor: theme.heroBg }}>
      <SiteHeader salon={salon} theme={theme} current="account" onBack={onBack} getPagePath={getPagePath}
        onNavigate={onNavigateSite} standalone={standalone} />
      <main className="flex-1 w-full max-w-xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-medium mb-6 cursor-pointer hover:opacity-80" style={{ color: tone.sub }}>
          <ArrowLeft className="w-3.5 h-3.5" /> {standalone ? translateUi("Back to booking") : translateUi("Back to {salon}", { salon: salon.name })}
        </button>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-6" style={{ color: tone.text }}>{translateUi("My account")}</h1>
        <CustomerAccountPanel salon={salon} theme={theme} {...links} />
      </main>
      <SiteFooter salon={salon} theme={theme} current="account" onBack={onBack} getPagePath={getPagePath} standalone={standalone} policies={policies} />
    </div>
  );
}
