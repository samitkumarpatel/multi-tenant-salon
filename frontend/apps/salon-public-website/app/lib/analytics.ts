import { API_BASE } from "@salon/ui-website";

type EventType = "PAGE_VIEW" | "CLICK";

interface ActivityEvent {
  salonId: string;
  sessionId: string;
  eventType: EventType;
  path: string;
  label?: string;
  occurredAt: string;
}

const ENDPOINT = `${API_BASE}/api/analytics/events`;
const FLUSH_INTERVAL_MS = 5_000;
const MAX_BUFFER_SIZE = 50;
const SESSION_STORAGE_KEY = "salon-analytics-session-id";

let buffer: ActivityEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_STORAGE_KEY, id);
  }
  return id;
}

function flush(useBeacon: boolean) {
  if (buffer.length === 0) return;
  const events = buffer;
  buffer = [];
  const body = JSON.stringify(events);

  // sendBeacon on unload guarantees delivery survives the page tearing down;
  // a regular fetch would just get cancelled mid-flight.
  if (useBeacon && navigator.sendBeacon) {
    navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
    return;
  }
  fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Best-effort telemetry — dropped events are simply lost, never retried.
  });
}

function ensureFlushTimer() {
  if (flushTimer) return;
  flushTimer = setInterval(() => flush(false), FLUSH_INTERVAL_MS);
  window.addEventListener("pagehide", () => flush(true));
}

function enqueue(event: Omit<ActivityEvent, "sessionId" | "occurredAt">) {
  if (typeof window === "undefined") return;
  buffer.push({ ...event, sessionId: getSessionId(), occurredAt: new Date().toISOString() });
  ensureFlushTimer();
  if (buffer.length >= MAX_BUFFER_SIZE) flush(false);
}

export function trackPageView(salonId: string, path: string) {
  enqueue({ salonId, eventType: "PAGE_VIEW", path });
}

export function trackClick(salonId: string, path: string, label: string) {
  enqueue({ salonId, eventType: "CLICK", path, label });
}
