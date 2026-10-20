import { h } from "./dom";
import { addDays, dateLabel, enumLabel, parseIso, timeLabel, todayIso, weekdayShort } from "./format";

/** One real date of opening (`week` in the explorer payload) — weekly hours with holidays applied. */
export type OpeningDay = {
  date: string;
  weekday: string;
  status: "OPEN" | "CLOSED_WEEKLY" | "CLOSED_HOLIDAY" | "CLOSED_SPECIAL" | "HOURS_NOT_SET";
  openTime?: string;
  closeTime?: string;
  reason?: string;
};
export type NextOpen = { date: string; weekday?: string; openTime?: string; closeTime?: string };
/** `today` on every app payload, computed on the salon's server clock. */
export type Today = {
  date: string;
  status: "OPEN_NOW" | "OPENS_LATER" | "CLOSED_FOR_TODAY" | "CLOSED_TODAY" | "HOURS_NOT_SET";
  closedBy?: string;
  openTime?: string;
  closeTime?: string;
  reason?: string;
  nextOpen?: NextOpen;
};
export type ClosureRange = { name: string; kind: "HOLIDAY" | "CLOSURE"; from: string; to: string };
export type WeeklyHours = { day: string; openTime?: string; closeTime?: string; closed?: boolean };

/** "Tomorrow at 9:00 AM" / "Friday 24 Oct at 9:00 AM" — relative to the salon's today. */
export function nextOpenText(next: NextOpen | undefined, today: string) {
  if (!next) return "";
  const days = Math.round((parseIso(next.date).getTime() - parseIso(today).getTime()) / 86_400_000);
  const when = days === 0 ? "today" : days === 1 ? "tomorrow" : dateLabel(next.date, days < 7 ? "long" : "short");
  return `${when}${next.openTime ? ` at ${timeLabel(next.openTime)}` : ""}`;
}

/** The one-line status every app header shows, e.g. "Open now · until 6:00 PM". */
export function todayText(today: Today) {
  switch (today.status) {
    case "OPEN_NOW": return { tone: "ok", label: "Open now", detail: today.closeTime ? `until ${timeLabel(today.closeTime)}` : "" };
    case "OPENS_LATER": return { tone: "warn", label: "Opens later today", detail: `at ${timeLabel(today.openTime)}` };
    case "CLOSED_FOR_TODAY": return { tone: "off", label: "Closed for today", detail: today.nextOpen ? `opens ${nextOpenText(today.nextOpen, today.date)}` : "" };
    case "CLOSED_TODAY": return {
      tone: today.closedBy === "CLOSED_WEEKLY" ? "off" : "warn",
      label: today.closedBy === "CLOSED_WEEKLY" ? "Closed today" : `Closed today · ${today.reason ?? "Holiday"}`,
      detail: today.nextOpen ? `reopens ${nextOpenText(today.nextOpen, today.date)}` : "",
    };
    default: return { tone: "off", label: "Opening hours not published", detail: "" };
  }
}

export function todayBadge(today: Today | undefined, onClick?: () => void) {
  if (!today) return null;
  const { tone, label, detail } = todayText(today);
  const content = [h("span", { class: `status-dot ${tone}`, "aria-hidden": "true" }), h("strong", null, label), detail ? h("span", null, detail) : null];
  return onClick
    ? h("button", { type: "button", class: `today-badge ${tone}`, onClick, "aria-label": `${label} ${detail}. See opening hours` }, content)
    : h("div", { class: `today-badge ${tone}` }, content);
}

function rangeText(range: ClosureRange) {
  return range.from === range.to ? dateLabel(range.from, "long") : `${dateLabel(range.from)} – ${dateLabel(range.to)}`;
}

function hoursText(day: OpeningDay) {
  if (day.status === "OPEN") return `${timeLabel(day.openTime)} – ${timeLabel(day.closeTime)}`;
  if (day.status === "HOURS_NOT_SET") return "—";
  return day.status === "CLOSED_WEEKLY" ? "Closed" : `Closed · ${day.reason ?? "Holiday"}`;
}

/**
 * The next seven real dates. Holiday and one-off closure rows are flagged so "Monday 9–6"
 * never shows on a bank holiday Monday.
 */
export function weekCard(week: OpeningDay[]) {
  if (!week.length) return null;
  if (week.every((d) => d.status === "HOURS_NOT_SET")) {
    return h("section", { class: "card" },
      h("h3", { class: "section-title" }, "Opening hours"),
      h("p", { class: "muted" }, "The salon hasn't published its opening hours yet — contact them to check."));
  }
  const today = todayIso();
  return h("section", { class: "card" },
    h("h3", { class: "section-title" }, "The next 7 days"),
    h("div", { class: "hours-list" }, week.map((day) => {
      const special = day.status === "CLOSED_HOLIDAY" || day.status === "CLOSED_SPECIAL";
      return h("div", { class: `hours-row${day.date === today ? " today" : ""}${special ? " special" : ""}` },
        h("span", { class: "hours-day" }, dateLabel(day.date, "short"), day.date === today ? h("span", { class: "tag" }, "Today") : null),
        h("span", { class: "hours-time" }, special ? h("span", { "aria-hidden": "true" }, day.status === "CLOSED_HOLIDAY" ? "🎉 " : "⚠️ ") : null, hoursText(day)));
    })));
}

/**
 * The next seven days at a glance for the salon home: weekday, date and a dot — open, closed,
 * or a holiday/closure (named in the tooltip and the row below). Tapping goes to the full hours.
 */
export function weekStrip(week: OpeningDay[], onOpen: () => void) {
  if (!week.length || week.every((d) => d.status === "HOURS_NOT_SET")) return null;
  const today = todayIso();
  const special = week.filter((d) => d.status === "CLOSED_HOLIDAY" || d.status === "CLOSED_SPECIAL");
  return h("section", { class: "card" },
    h("div", { class: "pane-head" },
      h("h3", { class: "section-title" }, "This week"),
      h("button", { type: "button", class: "link-button", onClick: onOpen }, "All hours")),
    h("div", { class: "week-strip", role: "list" }, week.slice(0, 7).map((day) => {
      const tone = day.status === "OPEN" ? "ok" : day.status === "CLOSED_WEEKLY" || day.status === "HOURS_NOT_SET" ? "off" : "warn";
      const label = `${dateLabel(day.date, "long")}: ${hoursText(day)}`;
      return h("button", { type: "button", role: "listitem", class: `week-strip-day${day.date === today ? " today" : ""}`, title: label, "aria-label": label, onClick: onOpen },
        h("span", { class: "day-chip-weekday" }, weekdayShort(day.date)),
        h("span", { class: "week-strip-num" }, String(parseIso(day.date).getDate())),
        h("span", { class: `status-dot ${tone}`, "aria-hidden": "true" }),
        h("span", { class: "week-strip-time" }, day.status === "OPEN" ? timeLabel(day.openTime).replace(/:00/, "") : tone === "warn" ? "Holiday" : "Closed"));
    })),
    special.length ? h("p", { class: "muted" }, special.map((d) => `${dateLabel(d.date)}: ${d.reason ?? "closed"}`).join(" · ")) : null);
}

export function closuresCard(ranges: ClosureRange[]) {
  if (!ranges.length) return null;
  return h("section", { class: "card" },
    h("h3", { class: "section-title" }, "Upcoming holidays & closures"),
    h("div", { class: "hours-list" }, ranges.map((range) => h("div", { class: "hours-row special" },
      h("span", { class: "hours-day" }, h("span", { "aria-hidden": "true" }, range.kind === "HOLIDAY" ? "🎉" : "⚠️"), range.name),
      h("span", { class: "hours-time" }, rangeText(range))))));
}

/** The regular weekly template, labelled as such so it isn't mistaken for this week's hours. */
export function weeklyCard(items: WeeklyHours[]) {
  if (!items.length) return null;
  return h("section", { class: "card" },
    h("h3", { class: "section-title" }, "Regular weekly hours"),
    h("div", { class: "hours-list" }, items.map((day) => h("div", { class: "hours-row" },
      h("span", { class: "hours-day" }, enumLabel(day.day)),
      h("span", { class: "hours-time" }, day.closed || !day.openTime ? "Closed" : `${timeLabel(day.openTime)} – ${timeLabel(day.closeTime)}`)))),
    h("p", { class: "muted" }, "Holidays and closures above take priority over these hours."));
}

/**
 * Salon-wide closures named in a booking calendar's days (holidays, one-off closures) — shown
 * under the calendar so the reason is visible on touch screens, not only in a tooltip.
 */
export function calendarClosures(days: { date: string; status: string; reason?: string }[]) {
  const named = days.filter((d) => d.status === "SALON_CLOSED" && d.reason && !/^The salon is closed on /.test(d.reason));
  if (!named.length) return null;
  const ranges: { from: string; to: string; reason: string }[] = [];
  for (const day of named) {
    const last = ranges[ranges.length - 1];
    if (last && last.reason === day.reason && addDays(last.to, 1) === day.date) last.to = day.date;
    else ranges.push({ from: day.date, to: day.date, reason: day.reason! });
  }
  return h("ul", { class: "closure-notes" }, ranges.map((r) => h("li", null,
    h("span", { "aria-hidden": "true" }, "🎉"),
    h("span", null, `${r.from === r.to ? dateLabel(r.from) : `${dateLabel(r.from)} – ${dateLabel(r.to)}`}: closed · ${r.reason}`))));
}

