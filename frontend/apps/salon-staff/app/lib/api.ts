const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
export const STAFF_PORTAL_API = `${API_BASE}/api/salon-staff`;
export const COUNTRIES_API    = `${API_BASE}/api/salon-utility/countries`;

const ATTEMPT_TIMEOUT_MS = 5_000;
const MAX_EXTRA_RETRIES  = 1;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function isRetryable(method: string | undefined, err: unknown, status?: number): boolean {
  const isReadOnly = !method || method.toUpperCase() === "GET";
  if (!isReadOnly) return false;
  if (err instanceof Error && (err.name === "TypeError" || err.name === "AbortError")) return true;
  if (status !== undefined && status >= 500) return true;
  return false;
}

export async function apiFetch<T>(url: string, opts: RequestInit = {}): Promise<T> {
  const method = opts.method;
  let lastError: Error = new Error("Request failed");

  // Lazy import avoids a circular dependency (auth.ts also calls apiFetch for /me).
  const { AUTH_MODE, getAccessToken, clearStaffSession } = await import("~/lib/auth");
  const accessToken = AUTH_MODE === "oauth2" ? getAccessToken() : null;

  for (let attempt = 0; attempt <= MAX_EXTRA_RETRIES; attempt++) {
    if (attempt > 0) await sleep(1000 * attempt);

    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        ...opts,
      });

      if (res.status === 401 && AUTH_MODE === "oauth2" && url.startsWith(STAFF_PORTAL_API)) {
        clearStaffSession();
        if (!window.location.pathname.endsWith("/login")) {
          window.location.href = "/login";
        }
        throw new Error("Session expired — please sign in again.");
      }

      if (res.status === 403) {
        throw new Error("You are not authorized to perform this action.");
      }

      if (!res.ok) {
        if (isRetryable(method, undefined, res.status) && attempt < MAX_EXTRA_RETRIES) {
          lastError = new Error(`HTTP ${res.status}`);
          continue;
        }
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
    } catch (e) {
      if (e instanceof Error && isRetryable(method, e) && attempt < MAX_EXTRA_RETRIES) {
        lastError = e;
        continue;
      }
      throw e;
    }
  }

  throw lastError;
}
