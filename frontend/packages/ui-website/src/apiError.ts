// Shared API-error model + message normalisation, used by every app's `apiFetch`
// and by the error UI (RouteErrorBoundary / ErrorState / ErrorNote).
//
// The one rule: whatever goes wrong on an API call — the server returned a
// 4xx/5xx, the network is down, the request timed out — the caller ends up with
// an Error whose `.message` is something we're willing to show a user verbatim.

/** Thrown by `apiFetch` for every failed request. `status === 0` means the
 *  request never got an HTTP response (network down / DNS / CORS / timeout). */
export class ApiError extends Error {
  readonly status: number;
  readonly kind: "http" | "network" | "timeout";
  /** RFC 9457 `detail`, when the body was a problem+json document. */
  readonly detail?: string;
  /** RFC 9457 `title`. */
  readonly title?: string;
  /** The parsed JSON body, if there was one. */
  readonly problem?: unknown;
  readonly url?: string;

  constructor(
    message: string,
    opts: {
      status: number;
      kind?: ApiError["kind"];
      detail?: string;
      title?: string;
      problem?: unknown;
      url?: string;
    },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = opts.status;
    this.kind = opts.kind ?? (opts.status === 0 ? "network" : "http");
    this.detail = opts.detail;
    this.title = opts.title;
    this.problem = opts.problem;
    this.url = opts.url;
  }
}

function fallbackForStatus(status: number): string {
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "We couldn't find what you were looking for.";
  if (status === 408 || status === 504) return "The server took too long to respond. Please try again.";
  if (status === 409) return "That change conflicts with the current state — refresh and try again.";
  if (status === 400 || status === 422) return "Some of the information provided isn't valid.";
  if (status === 429) return "Too many requests — please wait a moment and try again.";
  if (status >= 500) return "Something went wrong on our end. Please try again in a moment.";
  return `The request failed (HTTP ${status}).`;
}

const isMeaningful = (s: unknown): s is string =>
  typeof s === "string" && s.trim().length > 0 && s.trim().toLowerCase() !== "about:blank";

/** Build an {@link ApiError} from a non-OK `Response`, reading the body once.
 *  Prefers the server's own words (problem+json `detail`/`title`, or a legacy
 *  `message`/`error`), then falls back to a friendly per-status sentence. */
export async function errorFromResponse(res: Response, url?: string): Promise<ApiError> {
  let problem: unknown;
  let text: string | undefined;
  const contentType = res.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("json")) problem = await res.json();
    else text = await res.text();
  } catch {
    /* empty or unreadable body — fall through to the status fallback */
  }

  const p = (problem ?? {}) as Record<string, unknown>;
  const detail = isMeaningful(p.detail) ? p.detail.trim()
    : isMeaningful(p.message) ? (p.message as string).trim()
    : isMeaningful(p.error) ? (p.error as string).trim()
    : undefined;
  const title = isMeaningful(p.title) ? (p.title as string).trim() : undefined;
  const fromText = text && text.trim().length > 0 && text.trim().length <= 300 && !text.trim().startsWith("<")
    ? text.trim()
    : undefined;

  const message = detail ?? title ?? fromText ?? fallbackForStatus(res.status);
  return new ApiError(message, { status: res.status, kind: "http", detail, title, problem, url });
}

/** Wrap a raw thrown fetch/abort error as an {@link ApiError} (status 0). */
export function networkError(e: unknown, url?: string): ApiError {
  if (e instanceof ApiError) return e;
  const err = e instanceof Error ? e : undefined;
  const timedOut = !!err && (err.name === "AbortError" || err.name === "TimeoutError" || /timed out|timeout/i.test(err.message));
  return new ApiError(friendlyMessage(e), { status: 0, kind: timedOut ? "timeout" : "network", url });
}

/** The universal "give me a string to show the user" for anything caught off an
 *  API call — an {@link ApiError}, a raw fetch/abort error, a string, or null. */
export function friendlyMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) {
    if (e.name === "AbortError" || e.name === "TimeoutError" || /timed out|timeout/i.test(e.message)) {
      return "The server took too long to respond. Please try again.";
    }
    if (e.name === "TypeError" || /failed to fetch|networkerror|load failed|network request failed/i.test(e.message)) {
      return "Can't reach the server. Check your connection and try again.";
    }
    if (e.message.trim()) return e.message.trim();
  }
  if (typeof e === "string" && e.trim()) return e.trim();
  return "Something went wrong. Please try again.";
}

export const isAuthError = (e: unknown): boolean =>
  e instanceof ApiError && (e.status === 401 || e.status === 403);

export const isNotFoundError = (e: unknown): boolean =>
  e instanceof ApiError && e.status === 404;

/** Convenience for event handlers: log + push the friendly message to a toast.
 *  Returns the message so the caller can also render it inline if it wants. */
export function reportApiError(
  notify: (msg: string, type?: "success" | "error") => void,
  e: unknown,
): string {
  const msg = friendlyMessage(e);
  if (typeof console !== "undefined") console.error(e);
  notify(msg, "error");
  return msg;
}
