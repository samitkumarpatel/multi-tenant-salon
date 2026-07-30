const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
export const ONBOARDING_API  = `${API_BASE}/api/saloon-onboarding`;
export const CUSTOMER_API    = `${API_BASE}/api/saloon`;
export const ADMIN_API       = `${API_BASE}/api/saloon-admin`;
export const MY_SALOONS_API  = `${API_BASE}/api/saloon-admin/my-saloons`;
export const COUNTRIES_API   = `${API_BASE}/api/saloon-utility/countries`;
export const CURRENCIES_API  = `${API_BASE}/api/saloon-utility/currencies`;

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
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
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
