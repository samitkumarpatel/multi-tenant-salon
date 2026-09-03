import { ApiError, errorFromResponse, networkError } from "@salon/ui-shared";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
export const ONBOARDING_API = `${API_BASE}/api/salon-onboarding`;
export const CUSTOMER_API   = `${API_BASE}/api/salon`;
export const ADMIN_API      = `${API_BASE}/api/salon-admin`;
export const COUNTRIES_API  = `${API_BASE}/api/salon-utility/countries`;
export const CURRENCIES_API = `${API_BASE}/api/salon-utility/currencies`;

const ATTEMPT_TIMEOUT_MS = 55_000;
const MAX_EXTRA_RETRIES  = 1;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function isRetryable(method: string | undefined, err: unknown, status?: number): boolean {
  const isReadOnly = !method || method.toUpperCase() === "GET";
  if (!isReadOnly) return false;
  if (err instanceof Error && (err.name === "TypeError" || err.name === "AbortError")) return true;
  if (status !== undefined && status >= 500) return true;
  return false;
}

/** Maps raw URL segment (UUID or handler) → resolved UUID string. */
const salonUUIDCache = new Map<string, string>();

export function cacheSalonUUID(rawId: string, uuid: string) {
  salonUUIDCache.set(rawId, uuid);
}

/** Returns the UUID for a raw salon URL segment, fetching via customer API if needed. */
export async function resolveSalonUUID(rawId: string): Promise<string> {
  if (salonUUIDCache.has(rawId)) return salonUUIDCache.get(rawId)!;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId)) return rawId;
  const salon = await apiFetch<{ id: string }>(`${CUSTOMER_API}/${rawId}`);
  const uuid = String(salon.id);
  salonUUIDCache.set(rawId, uuid);
  return uuid;
}

export async function apiFetch<T>(url: string, opts: RequestInit = {}): Promise<T> {
  const method = opts.method;
  let lastError: Error = new Error("Request failed");

  for (let attempt = 0; attempt <= MAX_EXTRA_RETRIES; attempt++) {
    if (attempt > 0) await sleep(1000 * attempt);

    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
        headers: { "Content-Type": "application/json" },
        ...opts,
      });

      if (!res.ok) {
        if (isRetryable(method, undefined, res.status) && attempt < MAX_EXTRA_RETRIES) {
          lastError = new Error(`HTTP ${res.status}`);
          continue;
        }
        throw await errorFromResponse(res, url);
      }

      if (res.status === 204) return null as T;
      return res.json() as Promise<T>;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      if (e instanceof Error && isRetryable(method, e) && attempt < MAX_EXTRA_RETRIES) {
        lastError = e;
        continue;
      }
      throw networkError(e, url);
    }
  }

  throw networkError(lastError, url);
}
