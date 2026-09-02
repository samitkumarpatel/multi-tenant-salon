import { ApiError, errorFromResponse, networkError } from "@salon/ui-shared";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
export const SUPER_ADMIN_API = `${API_BASE}/api/salon-super-admin`;
export const ADMIN_API = `${API_BASE}/api/salon-admin`;
export const COUNTRIES_API = `${API_BASE}/api/salon-utility/countries`;

const ATTEMPT_TIMEOUT_MS = 8_000;

export async function apiFetch<T>(url: string, opts: RequestInit = {}): Promise<T> {
  // Lazy import avoids a circular dependency (auth.ts also calls fetch directly for tokens).
  const { AUTH_MODE, getAccessToken, clearSession } = await import("~/lib/auth");
  const accessToken = AUTH_MODE === "oauth2" ? getAccessToken() : null;

  let res: Response;
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      ...opts,
    });
  } catch (e) {
    throw networkError(e, url);
  }

  if (res.status === 401 && AUTH_MODE === "oauth2" && (url.startsWith(SUPER_ADMIN_API) || url.startsWith(ADMIN_API))) {
    clearSession();
    if (!window.location.pathname.endsWith("/login")) {
      window.location.href = "/login";
    }
    throw new ApiError("Your session has expired. Please sign in again.", { status: 401, url });
  }

  if (res.status === 403) {
    throw new ApiError("You don't have permission to perform this action.", { status: 403, url });
  }

  if (!res.ok) {
    throw await errorFromResponse(res, url);
  }

  if (res.status === 204) return null as T;
  return res.json() as Promise<T>;
}
