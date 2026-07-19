const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
export const SALOON_ONBOARDING_API = `${API_BASE}/api/saloon-onboarding`;
export const SALOON_API = `${API_BASE}/api/saloon`;
export const SALOON_ADMIN_API = `${API_BASE}/api/saloon-admin`;
export const COUNTRIES_API = `${API_BASE}/api/saloon-utility/countries`;

/** Maps raw URL segment (UUID or handler) → resolved UUID string. */
const saloonUUIDCache = new Map<string, string>();

export function cacheSaloonUUID(rawId: string, uuid: string) {
  saloonUUIDCache.set(rawId, uuid);
}

/** Returns the UUID for a raw saloon URL segment. Accepts UUID or handler slug. */
export async function resolveSaloonUUID(rawId: string): Promise<string> {
  if (saloonUUIDCache.has(rawId)) return saloonUUIDCache.get(rawId)!;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId)) return rawId;
  const saloon = await apiFetch<{ id: string }>(`${SALOON_API}/${rawId}`);
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
