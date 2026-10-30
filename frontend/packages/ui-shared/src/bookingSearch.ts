/** The fields of a booking the desk can search by. */
export interface SearchableBooking {
  id: number;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  appointmentDate: string;
  startTime: string;
}

/** Lower-cased and accent-folded, so "Zoë" finds "zoe". */
const fold = (text: string | null | undefined) =>
  (text ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const digitsOf = (text: string | null | undefined) => (text ?? "").replace(/\D/g, "");

/** Looks like a phone number rather than a name: only digits and the usual separators, at least three digits. */
const phoneLike = (query: string) => /^[+\d\s().-]+$/.test(query) && digitsOf(query).length >= 3;

/** Higher is a better match; 0 means no match. */
function score(booking: SearchableBooking, query: string, tokens: string[]): number {
  const name = fold(booking.customerName);
  const email = fold(booking.customerEmail);
  const id = String(booking.id);

  // A booking number: "#123", "id 123", or a bare number that is exactly an id.
  const idQuery = query.replace(/^(#|id[:\s]*)/, "");
  if (idQuery !== query ? idQuery === id : /^\d+$/.test(query) && query === id) return 100;
  if (idQuery !== query) return 0; // an explicit "#…" is only ever a booking number

  if (query.includes("@")) {
    if (email === query) return 95;
    return email.includes(query) ? 80 : 0;
  }
  if (phoneLike(query)) {
    // "+45 12 34" and "4512 34" are the same number, and the country code may be left off.
    return digitsOf(booking.customerPhone).includes(digitsOf(query)) ? 70 : 0;
  }
  if (name === query) return 90;
  if (name.startsWith(query)) return 75;
  if (tokens.every((token) => name.includes(token))) return 60;
  // A single word may be the start of an email address ("jane" → jane.smith@…).
  return tokens.every((token) => `${name} ${email}`.includes(token)) ? 50 : 0;
}

/**
 * Finds bookings by customer name, booking number, email or phone number, best match first and then the most
 * recent appointment. {@code total} counts every match, even when {@code results} is cut to {@code limit}.
 */
export function searchBookings<T extends SearchableBooking>(bookings: T[], rawQuery: string, limit = 50): { results: T[]; total: number } {
  const query = fold(rawQuery);
  if (!query) return { results: [], total: 0 };
  const tokens = query.split(/\s+/).filter(Boolean);
  const matches = bookings
    .map((booking) => ({ booking, score: score(booking, query, tokens) }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score
      || b.booking.appointmentDate.localeCompare(a.booking.appointmentDate)
      || b.booking.startTime.localeCompare(a.booking.startTime));
  return { results: matches.slice(0, limit).map((match) => match.booking), total: matches.length };
}
