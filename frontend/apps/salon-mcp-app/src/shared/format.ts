/** Display formatting shared by every Salon MCP App. Dates are ISO yyyy-MM-dd, times HH:mm. */

export function money(price: unknown, currency: unknown) {
  if (typeof price !== "number" && typeof price !== "string") return "";
  const amount = Number(price);
  if (!Number.isFinite(amount)) return "";
  const code = typeof currency === "string" && /^[A-Z]{3}$/i.test(currency) ? currency.toUpperCase() : undefined;
  try {
    return code
      ? new Intl.NumberFormat(undefined, { style: "currency", currency: code, maximumFractionDigits: amount % 1 ? 2 : 0 }).format(amount)
      : amount.toFixed(amount % 1 ? 2 : 0);
  } catch {
    return `${code ?? ""} ${amount}`.trim();
  }
}

export function duration(minutes: unknown) {
  const total = Number(minutes);
  if (!Number.isFinite(total) || total <= 0) return "";
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return hours ? `${hours} h${rest ? ` ${rest} min` : ""}` : `${rest} min`;
}

/** Parses yyyy-MM-dd as a local calendar date (never shifted by the time zone). */
export function parseIso(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

export function toIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function addDays(iso: string, days: number) {
  const date = parseIso(iso);
  date.setDate(date.getDate() + days);
  return toIso(date);
}

export function todayIso() {
  return toIso(new Date());
}

export function dateLabel(iso: string, style: "short" | "long" = "short") {
  return parseIso(iso).toLocaleDateString(undefined, style === "long"
    ? { weekday: "long", day: "numeric", month: "long" }
    : { weekday: "short", day: "numeric", month: "short" });
}

export function weekdayShort(iso: string) {
  return parseIso(iso).toLocaleDateString(undefined, { weekday: "short" });
}

export function dayOfMonth(iso: string) {
  return parseIso(iso).getDate();
}

export function monthLabel(month: string) {
  return parseIso(`${month}-01`).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function shiftMonth(month: string, delta: number) {
  const date = parseIso(`${month}-01`);
  date.setMonth(date.getMonth() + delta);
  return toIso(date).slice(0, 7);
}

export function timeLabel(time: unknown) {
  if (typeof time !== "string") return "";
  const [hh, mm] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hh ?? 0, mm ?? 0, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Morning / Afternoon / Evening bucket for a HH:mm start time. */
export function dayPart(time: string) {
  const hour = Number(time.slice(0, 2));
  return hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
}

/** HAIR → Hair, SKIN_CARE → Skin care, SENIOR_STYLIST → Senior stylist. */
export function enumLabel(value: unknown) {
  const text = String(value ?? "").toLowerCase().replace(/_/g, " ").trim();
  return text ? text[0]!.toUpperCase() + text.slice(1) : "";
}

export function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}
