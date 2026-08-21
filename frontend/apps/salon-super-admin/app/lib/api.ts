const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
export const SUPER_ADMIN_API = `${API_BASE}/api/salon-super-admin`;
export const ADMIN_API = `${API_BASE}/api/salon-admin`;
export const COUNTRIES_API = `${API_BASE}/api/salon-utility/countries`;

const ATTEMPT_TIMEOUT_MS = 8_000;

export async function apiFetch<T>(url: string, opts: RequestInit = {}): Promise<T> {
  // Lazy import avoids a circular dependency (auth.ts also calls fetch directly for tokens).
  const { AUTH_MODE, getAccessToken, clearSession } = await import("~/lib/auth");
  const accessToken = AUTH_MODE === "oauth2" ? getAccessToken() : null;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    ...opts,
  });

  if (res.status === 401 && AUTH_MODE === "oauth2" && (url.startsWith(SUPER_ADMIN_API) || url.startsWith(ADMIN_API))) {
    clearSession();
    if (!window.location.pathname.endsWith("/login")) {
      window.location.href = "/login";
    }
    throw new Error("Session expired — please sign in again.");
  }

  if (res.status === 403) {
    throw new Error("You are not authorized to perform this action.");
  }

  if (!res.ok) {
    let message: string | undefined;
    try {
      const body = await res.json();
      message = body.message ?? body.error ?? body.detail ?? body.title;
    } catch {
      message = await res.text().catch(() => undefined);
    }
    throw new Error(message || `HTTP ${res.status}`);
  }

  if (res.status === 204) return null as T;
  return res.json() as Promise<T>;
}
