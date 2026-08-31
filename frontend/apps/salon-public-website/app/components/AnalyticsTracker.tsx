import { useEffect, useRef } from "react";
import { useLocation } from "react-router";
import { trackPageView, trackClick } from "../lib/analytics";

/**
 * Renders nothing — just wires up page-view and click tracking for the current tenant.
 * A no-op unless the salon has opted into the ANALYTICS feature (checked by the caller).
 */
export function AnalyticsTracker({ salonId, enabled }: { salonId: string; enabled: boolean }) {
  const location = useLocation();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || lastPath.current === location.pathname) return;
    lastPath.current = location.pathname;
    trackPageView(salonId, location.pathname);
  }, [enabled, salonId, location.pathname]);

  useEffect(() => {
    if (!enabled) return;
    function onClick(e: MouseEvent) {
      const target = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-track]");
      if (!target) return;
      trackClick(salonId, window.location.pathname, target.dataset.track!);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [enabled, salonId]);

  return null;
}
