const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
export const SUPER_ADMIN_API = `${API_BASE}/api/saloon-super-admin`;
export const ADMIN_API = `${API_BASE}/api/saloon-admin`;
export const COUNTRIES_API = `${API_BASE}/api/saloon-utility/countries`;

const ATTEMPT_TIMEOUT_MS = 8_000;

export async function apiFetch<T>(url: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
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
