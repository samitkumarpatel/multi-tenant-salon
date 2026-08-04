const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
export const ONBOARDING_API  = `${API_BASE}/api/saloon-onboarding`;
export const CUSTOMER_API    = `${API_BASE}/api/saloon`;
export const ADMIN_API       = `${API_BASE}/api/saloon-admin`;
export const MY_SALOONS_API  = `${API_BASE}/api/saloon-admin/my-saloons`;
export const COUNTRIES_API  = `${API_BASE}/api/saloon-utility/countries`;
export const CURRENCIES_API = `${API_BASE}/api/saloon-utility/currencies`;

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

/** Maps raw URL segment (UUID or handler) → resolved UUID string. */
const saloonUUIDCache = new Map<string, string>();

export function cacheSaloonUUID(rawId: string, uuid: string) {
  saloonUUIDCache.set(rawId, uuid);
}

/** Returns the UUID for a raw saloon URL segment, fetching via customer API if needed. */
export async function resolveSaloonUUID(rawId: string): Promise<string> {
  if (saloonUUIDCache.has(rawId)) return saloonUUIDCache.get(rawId)!;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId)) return rawId;
  const saloon = await apiFetch<{ id: string }>(`${CUSTOMER_API}/${rawId}`);
  const uuid = String(saloon.id);
  saloonUUIDCache.set(rawId, uuid);
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
