import { ADMIN_APP_URL } from "~/lib/config";
import { MY_SALONS_API, apiFetch } from "~/lib/api";
import type { Salon } from "~/lib/types";

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
const CLIENT_ID   = import.meta.env.VITE_AUTH_CLIENT_ID ?? "salon-admin";
const SCOPE       = import.meta.env.VITE_AUTH_SCOPE ?? "openid profile";
const REDIRECT_URI = `${ADMIN_APP_URL}/login`;

const SESSION_KEY  = "admin-session";
const TOKEN_KEY    = "admin-oauth2-token";
const VERIFIER_KEY = "admin-pkce-verifier";

export interface AdminSession {
  email: string;
  salons: Salon[];
}

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

export function getAdminSession(): AdminSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    if (AUTH_MODE === "oauth2" && !getAccessToken()) return null;
    return JSON.parse(raw) as AdminSession;
  } catch {
    return null;
  }
}

export function setAdminSession(session: AdminSession) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearAdminSession() {
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

/** Exchanges the ?code= from the callback for tokens, resolves the signed-in
 *  user's email via /userinfo, and loads their salons — same shape the mock
 *  flow produces, so the rest of the app doesn't care which mode is active. */
export async function completeOAuth2Login(code: string): Promise<AdminSession> {
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!verifier) throw new Error("Sign-in expired — please try again.");

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
  const token = (await tokenResp.json()) as TokenSet;
  persistToken(token);
  sessionStorage.removeItem(VERIFIER_KEY);

  const userInfoResp = await fetch(`${AUTH_SERVER}/userinfo`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!userInfoResp.ok) {
    throw new Error(`Failed to load user info (${userInfoResp.status}).`);
  }
  const userInfo = (await userInfoResp.json()) as { email?: string };
  const email = userInfo.email;
  if (!email) throw new Error("Signed-in account has no email on file.");

  const salons = await apiFetch<Salon[]>(`${MY_SALONS_API}?email=${encodeURIComponent(email)}`);
  const session: AdminSession = { email, salons };
  setAdminSession(session);
  return session;
}

/** Signs the user out of both the app and the auth server (mode-aware). */
export function logout(navigate: (path: string) => void) {
  if (AUTH_MODE === "oauth2") {
    const idToken = getIdToken();
    clearAdminSession();
    const params = new URLSearchParams({ post_logout_redirect_uri: REDIRECT_URI });
    if (idToken) params.set("id_token_hint", idToken);
    window.location.href = `${AUTH_SERVER}/logout?${params}`;
    return;
  }
  clearAdminSession();
  navigate("/login");
}
