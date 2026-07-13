const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
export const API = `${API_BASE}/api/saloons`;
export const HANDLER_API = `${API_BASE}/api/saloons/handler`;
export const COUNTRIES_API = `${API_BASE}/api/utility/countries`;

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
