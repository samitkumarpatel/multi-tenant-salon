import type { Salon } from "@salon/ui-website";
import { DASHBOARD_APP_URL } from "~/lib/config";

export const AUTH_MODE: "mock" | "oauth2" =
  (import.meta.env.VITE_AUTH_MODE as "mock" | "oauth2" | undefined) ?? (import.meta.env.DEV ? "mock" : "oauth2");

const AUTH_SERVER = (import.meta.env.VITE_AUTH_SERVER_URL ?? "https://auth.salonsaas.org").replace(/\/$/, "");
const CLIENT_ID = import.meta.env.VITE_AUTH_CLIENT_ID ?? "salon-dashboard";
const REDIRECT_URI = `${DASHBOARD_APP_URL}/login`;
const SESSION_KEY = "dashboard-session";
const TOKEN_KEY = "dashboard-oauth2-token";
const VERIFIER_KEY = "dashboard-pkce-verifier";

export interface DashboardSession { email: string; salons: Salon[] }
interface TokenSet { access_token: string; id_token?: string }

export function getDashboardSession(): DashboardSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw || (AUTH_MODE === "oauth2" && !getAccessToken())) return null;
    return JSON.parse(raw) as DashboardSession;
  } catch { return null; }
}

export function setDashboardSession(session: DashboardSession) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearDashboardSession() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

export function getAccessToken(): string | null {
  try {
    const token = JSON.parse(localStorage.getItem(TOKEN_KEY) ?? "null") as TokenSet | null;
    if (!token) return null;
    const payload = JSON.parse(atob(token.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (typeof payload.exp === "number" && Date.now() / 1000 >= payload.exp) return null;
    return token.access_token;
  } catch { return null; }
}

async function pkce() {
  const verifier = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  return { verifier, challenge };
}

export async function startOAuth2Login(salonId?: string) {
  const { verifier, challenge } = await pkce();
  const state = crypto.randomUUID();
  localStorage.setItem(VERIFIER_KEY, JSON.stringify({ state, verifier, salonId }));
  const params = new URLSearchParams({ response_type: "code", client_id: CLIENT_ID, redirect_uri: REDIRECT_URI,
    scope: "openid profile", code_challenge: challenge, code_challenge_method: "S256", state });
  window.location.href = `${AUTH_SERVER}/oauth2/authorize?${params}`;
}

export async function completeOAuth2Login(code: string): Promise<{ session: DashboardSession; salonId?: string }> {
  const saved = JSON.parse(localStorage.getItem(VERIFIER_KEY) ?? "null") as { state: string; verifier: string; salonId?: string } | null;
  const state = new URLSearchParams(window.location.search).get("state");
  localStorage.removeItem(VERIFIER_KEY);
  if (!saved || saved.state !== state) throw new Error("Sign-in expired — please try again.");
  const response = await fetch(`${AUTH_SERVER}/oauth2/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI, client_id: CLIENT_ID, code_verifier: saved.verifier }) });
  if (!response.ok) throw new Error("Could not complete sign-in.");
  const token = await response.json() as TokenSet;
  localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
  const userResponse = await fetch(`${AUTH_SERVER}/userinfo`, { headers: { Authorization: `Bearer ${token.access_token}` } });
  if (!userResponse.ok) throw new Error("Could not load your account.");
  const { sub: email } = await userResponse.json() as { sub?: string };
  if (!email) throw new Error("Signed-in account has no email address.");
  const salonResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080"}/api/salon-admin/my-salons`, { headers: { Authorization: `Bearer ${token.access_token}` } });
  if (!salonResponse.ok) throw new Error("Could not load your salons.");
  const session = { email, salons: await salonResponse.json() as Salon[] };
  setDashboardSession(session);
  return { session, salonId: saved.salonId };
}

export function logout() {
  clearDashboardSession();
  window.location.href = "/login";
}
