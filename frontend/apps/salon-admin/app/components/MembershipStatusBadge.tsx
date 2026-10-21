import { useI18n } from "@salon/i18n";
import { MEMBERSHIP_STATUS_LABEL, MEMBERSHIP_STATUS_STYLE, fmtDate } from "~/lib/membership";
import type { MembershipStatus, MembershipSubscription } from "~/lib/types";

export function MembershipStatusBadge({ status }: { status: MembershipStatus }) {
  const { t: translateUi } = useI18n();
  return (
    <span className={`inline-flex items-center text-[0.65rem] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${MEMBERSHIP_STATUS_STYLE[status]}`}>
      {translateUi(MEMBERSHIP_STATUS_LABEL[status])}
    </span>
  );
}

type Translate = (s: string, v?: Record<string, string | number>) => string;

/** "Paid through 3 Dec", "Ends 3 Dec", "Expired 1 Nov" or "Ended 1 Nov" — where this member stands. */
export function renewalLine(m: MembershipSubscription, translateUi: Translate, locale: string) {
  if (m.status === "CANCELLED") return m.endedAt ? translateUi("Ended {date}", { date: fmtDate(m.endedAt, locale) }) : translateUi("Ended");
  if (m.status === "EXPIRED") return translateUi("Expired {date}", { date: fmtDate(m.endedAt ?? m.currentPeriodEnd, locale) });
  if (m.status === "PENDING_PAYMENT" || m.status === "INCOMPLETE") return "—";
  if (m.cancelAtPeriodEnd) return translateUi("Ends {date}", { date: fmtDate(m.currentPeriodEnd, locale) });
  return translateUi("Paid through {date}", { date: fmtDate(m.currentPeriodEnd, locale) });
}
