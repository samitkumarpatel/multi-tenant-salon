import { ApiError, errorFromResponse, networkError } from "./apiError";

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

const ATTEMPT_TIMEOUT_MS = 8_000;

export async function apiFetch<T>(url: string, opts: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      headers: { "Content-Type": "application/json" },
      ...opts,
    });
  } catch (e) {
    // Network down / DNS / CORS / timeout — never got an HTTP response.
    throw networkError(e, url);
  }

  if (!res.ok) throw await errorFromResponse(res, url);

  if (res.status === 204) return null as T;
  return res.json() as Promise<T>;
}

export { ApiError };
