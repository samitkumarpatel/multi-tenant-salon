import { STAFF_PORTAL_API, apiFetch } from "~/lib/api";
import type { StaffMember, StaffSession } from "~/lib/types";

/**
 * Local dev (`react-router dev`, served from localhost) keeps the existing
 * email + dummy-OTP mock flow so the app works offline without an auth
 * server. Any real build (`react-router build`, deployed anywhere) switches
 * on real OAuth2 Authorization Code + PKCE against the auth server.
 * Override with VITE_AUTH_MODE=mock|oauth2 to force either mode.
 */
export const AUTH_MODE: "mock" | "oauth2" =
  (import.meta.env.VITE_AUTH_MODE as "mock" | "oauth2" | undefined) ??
  (import.meta.env.DEV ? "mock" : "oauth2");

const SALON_DOMAIN = import.meta.env.VITE_SALON_DOMAIN ?? "salonsaas.org";
const APP_URL =
  import.meta.env.VITE_STAFF_APP_URL ??
  (import.meta.env.DEV ? "http://localhost:5178" : `https://staff.${SALON_DOMAIN}`);

const AUTH_SERVER = (import.meta.env.VITE_AUTH_SERVER_URL ?? "https://auth.salonsaas.org").replace(/\/$/, "");
const CLIENT_ID   = import.meta.env.VITE_AUTH_CLIENT_ID ?? "salon-staff";
const SCOPE       = import.meta.env.VITE_AUTH_SCOPE ?? "openid profile";
const REDIRECT_URI = `${APP_URL}/login`;

const SESSION_KEY  = "staff-session";
const TOKEN_KEY    = "staff-oauth2-token";
const VERIFIER_KEY = "staff-pkce-verifier";

// ── Silent renew (steps 8-13) ─────────────────────────────────────────────
// Public clients get no refresh token, so a live access token is kept alive
// by repeating the authorization_code+PKCE dance in a hidden iframe against
// the AS session cookie set once at OTT login — no visible UI, as long as
// that cookie is still alive. `SILENT_RENEW_MESSAGE` is how the iframe
// (running this same app at /login) reports success/failure back to the tab
// that spawned it; `RENEW_MARGIN_MS` is how far ahead of expiry it fires.
const SILENT_RENEW_MESSAGE = "salon-staff-oauth2-silent-renew";
const RENEW_MARGIN_MS        = 60_000;
const SILENT_RENEW_TIMEOUT_MS = 8_000;

interface TokenSet {
  access_token: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
}

// ── JWT helpers ──────────────────────────────────────────────────────────

function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  try {
    const b64 = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}

function isExpired(accessToken: string): boolean {
  const payload = decodeJwtPayload(accessToken);
  const exp = payload?.exp;
  return typeof exp === "number" && Date.now() / 1000 >= exp;
}

// ── Session storage (both modes) ────────────────────────────────────────

export function getStaffSession(): StaffSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    if (AUTH_MODE === "oauth2" && !getAccessToken()) return null;
    return JSON.parse(raw) as StaffSession;
  } catch {
    return null;
  }
}

export function setStaffSession(session: StaffSession) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearStaffSession() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

// ── Access token (oauth2 mode) ──────────────────────────────────────────

export function getAccessToken(): string | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const token = JSON.parse(raw) as TokenSet;
    if (isExpired(token.access_token)) {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return token.access_token;
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }
}

/** Access token expiry as epoch ms, or null if there's no (valid) token — e.g. mock mode. */
export function getAccessTokenExpiry(): number | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const token = JSON.parse(raw) as TokenSet;
    const exp = decodeJwtPayload(token.access_token)?.exp;
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
}

function persistToken(token: TokenSet) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
}

function getIdToken(): string | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? ((JSON.parse(raw) as TokenSet).id_token ?? null) : null;
  } catch {
    return null;
  }
}

// ── PKCE ──────────────────────────────────────────────────────────────────

async function generatePKCE() {
  const verifier =
    crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  return { verifier, challenge };
}

// ── OAuth2 login/logout ──────────────────────────────────────────────────

export async function startOAuth2Login() {
  const { verifier, challenge } = await generatePKCE();
  sessionStorage.setItem(VERIFIER_KEY, verifier);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  window.location.href = `${AUTH_SERVER}/oauth2/authorize?${params}`;
}

async function exchangeCodeForToken(code: string, verifier: string): Promise<TokenSet> {
  const tokenResp = await fetch(`${AUTH_SERVER}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: verifier,
    }),
  });
  if (!tokenResp.ok) {
    throw new Error(`Token exchange failed (${tokenResp.status}): ${await tokenResp.text()}`);
  }
  return (await tokenResp.json()) as TokenSet;
}

/** Exchanges the ?code= from the callback for tokens and resolves the
 *  signed-in user's staff account(s) via /me?email= — same lookup the mock
 *  flow's email step performs, so a single account signs straight in while
 *  multiple accounts still need to be disambiguated by the caller. */
export async function fetchOAuth2StaffOptions(code: string): Promise<StaffMember[]> {
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!verifier) throw new Error("Sign-in expired — please try again.");

  const token = await exchangeCodeForToken(code, verifier);
  persistToken(token);
  sessionStorage.removeItem(VERIFIER_KEY);

  const userInfoResp = await fetch(`${AUTH_SERVER}/userinfo`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!userInfoResp.ok) {
    throw new Error(`Failed to load user info (${userInfoResp.status}).`);
  }
  const userInfo = (await userInfoResp.json()) as { sub?: string };
  const email = userInfo.sub;
  if (!email) throw new Error("Signed-in account has no email on file.");

  // The access token authenticates the request; the server derives the
  // caller's identity from it, so no email is passed on the wire here.
  return apiFetch<StaffMember[]>(`${STAFF_PORTAL_API}/me`);
}

/** Runs inside the hidden iframe once the AS has 302'd it back to our own
 *  /login (step 11-12). Exchanges the fresh code for a token set exactly
 *  like the visible flow, then reports success/failure to the tab that
 *  spawned the iframe via postMessage — it never touches this frame's own
 *  session or navigates anywhere, since nothing here is meant to be seen. */
export async function handleSilentRenewCallback(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  try {
    if (!code) {
      throw new Error(params.get("error_description") ?? params.get("error") ?? "No code returned");
    }
    const verifier = sessionStorage.getItem(VERIFIER_KEY);
    if (!verifier) throw new Error("Missing PKCE verifier");

    const token = await exchangeCodeForToken(code, verifier);
    persistToken(token);
    sessionStorage.removeItem(VERIFIER_KEY);
    window.parent.postMessage({ type: SILENT_RENEW_MESSAGE, ok: true }, window.location.origin);
  } catch {
    window.parent.postMessage({ type: SILENT_RENEW_MESSAGE, ok: false }, window.location.origin);
  }
}

/** True when this code is running inside the hidden silent-renew iframe
 *  rather than the visible tab — checked by the /login route so it can
 *  hand off to `handleSilentRenewCallback` instead of doing a normal
 *  sign-in (choosing an account, redirecting to /portal, etc). */
export function isSilentRenewFrame(): boolean {
  return typeof window !== "undefined" && window.self !== window.top;
}

/** Steps 9-11: silently repeats the authorization_code+PKCE dance in a
 *  hidden iframe, relying on the AS session cookie set at OTT login instead
 *  of a refresh token. Resolves `true` once a fresh token has been
 *  persisted, or `false` if the AS session cookie has died (it renders its
 *  login page instead of 302ing straight back) or nothing came back within
 *  `SILENT_RENEW_TIMEOUT_MS` — Spring AS doesn't reliably support
 *  prompt=none/login_required, so a timeout is the only way to detect that. */
export async function silentRenew(): Promise<boolean> {
  const { verifier, challenge } = await generatePKCE();
  sessionStorage.setItem(VERIFIER_KEY, verifier);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "none",
  });

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.setAttribute("aria-hidden", "true");

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
      iframe.remove();
      resolve(ok);
    };

    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (!e.data || e.data.type !== SILENT_RENEW_MESSAGE) return;
      finish(Boolean(e.data.ok));
    }

    window.addEventListener("message", onMessage);
    const timer = setTimeout(() => finish(false), SILENT_RENEW_TIMEOUT_MS);

    document.body.appendChild(iframe);
    iframe.src = `${AUTH_SERVER}/oauth2/authorize?${params}`;
  });
}

/** Keeps the access token alive for as long as the AS session cookie stays
 *  valid, by scheduling `silentRenew()` shortly before each expiry (steps
 *  8-13 — the whole substitute for a refresh token). Call once from the
 *  authenticated shell; returns a cleanup function for effect teardown.
 *  `onRenewed` fires after each successful renew with the new expiry (epoch
 *  ms) — the UI has no other way to notice, since a renew never touches
 *  React state on its own. `onRenewFailed` fires once the AS session has
 *  actually expired, so the caller can fall back to a full, visible
 *  re-authentication. `onRenewStart`, if given, fires right as each renew
 *  attempt kicks off — so the UI can show a "renewing…" indicator for the
 *  couple of seconds the hidden iframe takes to round-trip. */
export function startSilentRenewLoop(
  onRenewed: (expiresAt: number) => void,
  onRenewFailed: () => void,
  onRenewStart?: () => void
): () => void {
  if (AUTH_MODE !== "oauth2") return () => {};

  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancelled = false;

  function scheduleNext() {
    const expiry = getAccessTokenExpiry();
    if (expiry == null) return; // signed out, or mock mode — nothing to renew

    const delay = Math.max(0, expiry - Date.now() - RENEW_MARGIN_MS);
    timer = setTimeout(async () => {
      if (cancelled) return;
      onRenewStart?.();
      const ok = await silentRenew();
      if (cancelled) return;
      if (ok) {
        const newExpiry = getAccessTokenExpiry();
        if (newExpiry != null) onRenewed(newExpiry);
        scheduleNext();
      } else {
        onRenewFailed();
      }
    }, delay);
  }

  scheduleNext();
  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}

/** `accounts` is the full list of staff accounts this person signed in with
 *  (one per salon they belong to). Pass it whenever known so the portal can
 *  offer a salon switcher; omit only to fall back to whatever the previous
 *  session already had (e.g. when switching accounts from within the portal). */
export function buildStaffSession(member: StaffMember, accounts?: StaffMember[]): StaffSession {
  const session: StaffSession = {
    staffId: member.id,
    salonId: String(member.salonId),
    salonName: member.salonName,
    salonHandler: member.salonHandler,
    email: member.email,
    name: member.name,
    role: member.role,
    accounts: accounts ?? getStaffSession()?.accounts,
  };
  setStaffSession(session);
  return session;
}

/** Signs the user out of both the app and the auth server (mode-aware). */
export function logout(navigate: (path: string) => void) {
  if (AUTH_MODE === "oauth2") {
    const idToken = getIdToken();
    clearStaffSession();
    const params = new URLSearchParams({ post_logout_redirect_uri: REDIRECT_URI });
    if (idToken) params.set("id_token_hint", idToken);
    window.location.href = `${AUTH_SERVER}/connect/logout?${params}`;
    return;
  }
  clearStaffSession();
  navigate("/login");
}
