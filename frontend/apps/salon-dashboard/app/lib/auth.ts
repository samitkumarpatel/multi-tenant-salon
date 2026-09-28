import type { Salon } from "@salon/ui-website";
import { DASHBOARD_APP_URL } from "~/lib/config";
import { MY_SALONS_API, apiFetch } from "~/lib/api";

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

const AUTH_SERVER = (import.meta.env.VITE_AUTH_SERVER_URL ?? "https://auth.salonsaas.org").replace(/\/$/, "");
const CLIENT_ID   = import.meta.env.VITE_AUTH_CLIENT_ID ?? "salon-dashboard";
const SCOPE       = import.meta.env.VITE_AUTH_SCOPE ?? "openid profile";
const REDIRECT_URI = `${DASHBOARD_APP_URL}/login`;

const SESSION_KEY  = "dashboard-session";
const TOKEN_KEY    = "dashboard-oauth2-token";
const VERIFIER_KEY = "dashboard-pkce-verifier";

// ── Silent renew (steps 8-13) ─────────────────────────────────────────────
// Public clients get no refresh token, so a live access token is kept alive
// by repeating the authorization_code+PKCE dance in a hidden iframe against
// the AS session cookie set once at OTT login — no visible UI, as long as
// that cookie is still alive. `SILENT_RENEW_MESSAGE` is how the iframe
// (running this same app at /login) reports success/failure back to the tab
// that spawned it; `RENEW_MARGIN_MS` is how far ahead of expiry it fires.
const SILENT_RENEW_MESSAGE = "salon-dashboard-oauth2-silent-renew";
const RENEW_MARGIN_MS        = 60_000;
const SILENT_RENEW_TIMEOUT_MS = 8_000;

export interface DashboardSession {
  email: string;
  salons: Salon[];
}

/** Thrown by completeOAuth2Login when the signed-in account has no salon on file. */
export class NoSalonFoundError extends Error {
  email: string;
  constructor(email: string) {
    super("No salon found for this email address.");
    this.name = "NoSalonFoundError";
    this.email = email;
  }
}

interface TokenSet {
  access_token: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
}

/** The salon whose Dashboard to open: the requested one if it has the
 *  DASHBOARD feature, else the first salon that does. */
export function pickDashboardSalon(salons: Salon[], requestedId?: string | null): Salon | undefined {
  const enabled = salons.filter((salon) => salon.features?.includes("DASHBOARD"));
  return enabled.find((salon) => String(salon.id) === requestedId) ?? enabled[0];
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

export function getDashboardSession(): DashboardSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    if (AUTH_MODE === "oauth2" && !getAccessToken()) return null;
    return JSON.parse(raw) as DashboardSession;
  } catch {
    return null;
  }
}

export function setDashboardSession(session: DashboardSession) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearDashboardSession() {
  sessionStorage.removeItem(SESSION_KEY);
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

// ── PKCE verifier storage ────────────────────────────────────────────────
// Kept in localStorage, keyed by the OAuth `state`, rather than in sessionStorage: a magic-link
// email opens in a new tab whose sessionStorage is empty, so the callback couldn't find the
// verifier and showed "Sign-in expired". Keying by `state` also stops concurrent flows (e.g.
// another tab's silent renew) from overwriting each other. Entries are single-use with a short TTL.
// The dashboard also stashes the salon the user was heading to, so the callback can land there.

const PKCE_TTL_MS = 10 * 60 * 1000;
const PKCE_KEY_PREFIX = `${VERIFIER_KEY}:`;

interface PkceEntry {
  verifier: string;
  createdAt: number;
  salonId?: string;
}

function prunePkceVerifiers() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key?.startsWith(PKCE_KEY_PREFIX)) continue;
      let createdAt = 0;
      try {
        createdAt = JSON.parse(localStorage.getItem(key) ?? "{}").createdAt ?? 0;
      } catch {}
      if (Date.now() - createdAt > PKCE_TTL_MS) localStorage.removeItem(key);
    }
  } catch {}
}

/** Stores the verifier and returns the `state` to send on the authorize request. */
function savePkceVerifier(verifier: string, salonId?: string): string {
  prunePkceVerifiers();
  const state = crypto.randomUUID();
  const entry: PkceEntry = { verifier, createdAt: Date.now(), salonId };
  localStorage.setItem(PKCE_KEY_PREFIX + state, JSON.stringify(entry));
  return state;
}

/** Returns and deletes the entry saved for this `state`, or null if it is unknown or expired. */
function takePkceVerifier(state: string | null): PkceEntry | null {
  if (!state) return null;
  const key = PKCE_KEY_PREFIX + state;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    localStorage.removeItem(key);
    const entry = JSON.parse(raw) as PkceEntry;
    return Date.now() - entry.createdAt <= PKCE_TTL_MS ? entry : null;
  } catch {
    return null;
  }
}

// ── OAuth2 login/logout ──────────────────────────────────────────────────

/** `salonId` is the salon to land on after sign-in (e.g. from `/login?salon=`). */
export async function startOAuth2Login(salonId?: string) {
  const { verifier, challenge } = await generatePKCE();
  const state = savePkceVerifier(verifier, salonId);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
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

/** Exchanges the ?code= from the callback for tokens, resolves the signed-in
 *  user's email via /userinfo, and loads their salons — same shape the mock
 *  flow produces, so the rest of the app doesn't care which mode is active.
 *  Also returns the salon the user was heading to when sign-in started. */
export async function completeOAuth2Login(code: string): Promise<{ session: DashboardSession; salonId?: string }> {
  const saved = takePkceVerifier(new URLSearchParams(window.location.search).get("state"));
  if (!saved) throw new Error("Sign-in expired — please try again.");

  const token = await exchangeCodeForToken(code, saved.verifier);
  persistToken(token);

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
  let salons: Salon[];
  try {
    salons = await apiFetch<Salon[]>(MY_SALONS_API);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("HTTP 404") || msg.toLowerCase().includes("not found")) {
      throw new NoSalonFoundError(email);
    }
    throw e;
  }
  const session: DashboardSession = { email, salons };
  setDashboardSession(session);
  return { session, salonId: saved.salonId };
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
    const saved = takePkceVerifier(params.get("state"));
    if (!saved) throw new Error("Missing PKCE verifier");

    const token = await exchangeCodeForToken(code, saved.verifier);
    persistToken(token);
    window.parent.postMessage({ type: SILENT_RENEW_MESSAGE, ok: true }, window.location.origin);
  } catch {
    window.parent.postMessage({ type: SILENT_RENEW_MESSAGE, ok: false }, window.location.origin);
  }
}

/** True when this code is running inside the hidden silent-renew iframe
 *  rather than the visible tab — checked by the /login route so it can
 *  hand off to `handleSilentRenewCallback` instead of doing a normal
 *  sign-in (redirecting to a salon, etc). */
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
  const state = savePkceVerifier(verifier);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
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
      takePkceVerifier(state); // no-op if the iframe already consumed it; drops it on timeout/failure
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
 *  8-13 — the whole substitute for a refresh token). Call once from an
 *  authenticated screen; returns a cleanup function for effect teardown.
 *  `onRenewed` fires after each successful renew with the new expiry (epoch
 *  ms). `onRenewFailed` fires once the AS session has actually expired, so
 *  the caller can fall back to a full, visible re-authentication.
 *  `onRenewStart`, if given, fires right as each renew attempt kicks off. */
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

/** Signs the user out of both the app and the auth server (mode-aware). */
export function logout(navigate: (path: string) => void) {
  if (AUTH_MODE === "oauth2") {
    const idToken = getIdToken();
    clearDashboardSession();
    const params = new URLSearchParams({ post_logout_redirect_uri: REDIRECT_URI });
    if (idToken) params.set("id_token_hint", idToken);
    window.location.href = `${AUTH_SERVER}/connect/logout?${params}`;
    return;
  }
  clearDashboardSession();
  navigate("/login");
}
