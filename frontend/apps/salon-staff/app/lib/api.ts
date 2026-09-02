import { ApiError, errorFromResponse, networkError } from "@salon/ui-shared";

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

/**
 * Uploads a file to a pre-signed PUT URL from `.../photo-upload-url` — S3, Azure
 * Blob, or the local media endpoint all use the same contract here. Azure Blob
 * is the exception that needs a hint: a block-blob PUT MUST carry
 * `x-ms-blob-type: BlockBlob` or it 400s, so that header is added whenever the
 * target is a Blob Storage endpoint. Throws on a non-2xx response (a plain
 * `fetch` would resolve and leave a dead publicUrl behind).
 */
export async function uploadToPresignedUrl(presignedUrl: string, file: File): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": file.type };
  if (/\.blob\.core\.windows\.net\//.test(presignedUrl)) {
    headers["x-ms-blob-type"] = "BlockBlob";
  }
  let res: Response;
  try {
    res = await fetch(presignedUrl, { method: "PUT", body: file, headers });
  } catch (e) {
    throw networkError(e, presignedUrl);
  }
  if (!res.ok) throw new ApiError("The file upload failed. Please try again.", { status: res.status, url: presignedUrl });
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
        throw new ApiError("Your session has expired. Please sign in again.", { status: 401, url });
      }

      if (res.status === 403) {
        throw new ApiError("You don't have permission to perform this action.", { status: 403, url });
      }

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
