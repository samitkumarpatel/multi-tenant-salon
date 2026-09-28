import { ApiError, errorFromResponse, networkError } from "@salon/ui-shared";
import { AUTH_MODE, clearDashboardSession, getAccessToken } from "~/lib/auth";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
export const ADMIN_API = `${API_BASE}/api/salon-admin`;
export const CUSTOMER_API = `${API_BASE}/api/salon`;
export const MY_SALONS_API = `${ADMIN_API}/my-salons`;

export async function apiFetch<T>(url: string, opts: RequestInit = {}): Promise<T> {
  const token = AUTH_MODE === "oauth2" ? getAccessToken() : null;
  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(55_000),
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...opts,
    });
  } catch (error) {
    throw networkError(error, url);
  }
  if (response.status === 401 && AUTH_MODE === "oauth2") {
    clearDashboardSession();
    window.location.href = `/login?salon=${encodeURIComponent(window.location.pathname.split("/")[1] || "")}`;
    throw new ApiError("Your session has expired. Please sign in again.", { status: 401, url });
  }
  if (!response.ok) throw await errorFromResponse(response, url);
  if (response.status === 204) return null as T;
  return response.json() as Promise<T>;
}
