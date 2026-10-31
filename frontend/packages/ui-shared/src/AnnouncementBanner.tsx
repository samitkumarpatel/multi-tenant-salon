import { useEffect, useState } from "react";
import { useI18n } from "@salon/i18n";
import { API_BASE } from "@salon/ui-website";
import { AlertTriangle, Info, OctagonAlert, X } from "lucide-react";

type PlatformAnnouncement = {
  id: number; title: string; message: string; severity: "INFO" | "WARNING" | "CRITICAL";
  linkUrl: string | null; linkLabel: string | null;
};

const styles = {
  INFO: { box: "border-blue-100 bg-blue-50 text-blue-900", icon: Info },
  WARNING: { box: "border-amber-200 bg-amber-50 text-amber-900", icon: AlertTriangle },
  CRITICAL: { box: "border-red-200 bg-red-50 text-red-900", icon: OctagonAlert },
} as const;

const key = (id: number) => `announcement-dismissed:${id}`;
function wasDismissed(id: number) { try { return localStorage.getItem(key(id)) === "1"; } catch { return false; } }

/**
 * Platform notices written by the super admin. Anonymous fetch, so it works on sign-in pages too.
 * `owners` adds the notices meant for salon owners; every app shows the ones meant for all apps.
 * A failed fetch shows nothing — a notice must never get in the way of the app.
 */
export function AnnouncementBanner({ owners = false }: { owners?: boolean }) {
  const { t } = useI18n();
  const [items, setItems] = useState<PlatformAnnouncement[]>([]);
  const [, hide] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE}/api/public/announcements${owners ? "?audience=SALON_OWNERS" : ""}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : []))
      .then((next: PlatformAnnouncement[]) => setItems(Array.isArray(next) ? next : []))
      .catch(() => {});
    return () => controller.abort();
  }, [owners]);

  const visible = items.filter((item) => item.severity === "CRITICAL" || !wasDismissed(item.id));
  if (!visible.length) return null;

  return <div role="region" aria-label={t("Announcements")} className="space-y-px">
    {visible.map((item) => {
      const { box, icon: Icon } = styles[item.severity] ?? styles.INFO;
      return <div key={item.id} role={item.severity === "CRITICAL" ? "alert" : "status"}
        className={`relative flex items-start gap-3 border-b px-4 py-2.5 text-sm leading-relaxed ${box} ${item.severity === "CRITICAL" ? "" : "pr-10"}`}>
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p className="min-w-0 whitespace-pre-line break-words"><strong className="font-semibold">{item.title}</strong> {item.message}
          {item.linkUrl && <> <a href={item.linkUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">{item.linkLabel || t("Learn more")}</a></>}</p>
        {item.severity !== "CRITICAL" && <button type="button" aria-label={t("Dismiss")}
          onClick={() => { try { localStorage.setItem(key(item.id), "1"); } catch {} hide((n) => n + 1); }}
          className="absolute right-3 top-2.5 cursor-pointer opacity-60 hover:opacity-100"><X className="size-3.5" /></button>}
      </div>;
    })}
  </div>;
}
