/** A calendar entry (.ics) for a booked appointment, in the salon's local wall-clock time. */
export type CalendarEvent = {
  uid: string;
  title: string;
  date: string; // yyyy-MM-dd
  startTime: string; // HH:mm
  endTime?: string; // HH:mm
  location?: string;
  description?: string;
};

/**
 * Builds an iCalendar file. Times are "floating" (no time zone), so the appointment lands at
 * the salon's wall-clock time in whichever calendar opens it — the salon has no time zone on
 * record, and visitors book in the salon's local time.
 */
export function buildIcs(event: CalendarEvent) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const end = event.endTime ?? addMinutes(event.startTime, 60);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Salon SaaS//Salon MCP App//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${local(event.date, event.startTime)}`,
    `DTEND:${local(event.date, end)}`,
    `SUMMARY:${escape(event.title)}`,
    event.location ? `LOCATION:${escape(event.location)}` : "",
    event.description ? `DESCRIPTION:${escape(event.description)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

function local(date: string, time: string) {
  return `${date.replace(/-/g, "")}T${time.slice(0, 5).replace(":", "")}00`;
}

function addMinutes(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const total = Math.min((h ?? 0) * 60 + (m ?? 0) + minutes, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function escape(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** RFC 5545 lines are at most 75 octets; longer ones continue on lines starting with a space. */
function fold(line: string) {
  const parts: string[] = [];
  for (let rest = line; rest.length; rest = rest.slice(73)) parts.push(rest.slice(0, 73));
  return parts.join("\r\n ");
}
