// In dev, Vite proxies /api → localhost:8080.
// In production, set VITE_API_BASE_URL to the backend origin (e.g. https://api.example.com).
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export const API = `${API_BASE}/api/saloons`;

export async function apiFetch<T>(url: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => res.statusText);
    throw new Error(t || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null as T;
  return res.json() as Promise<T>;
}
