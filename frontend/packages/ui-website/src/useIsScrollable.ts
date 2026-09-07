import { useEffect, useState } from "react";

/**
 * True when the page currently has enough content to scroll vertically.
 * Used to hide "Back to top" affordances when the whole page fits on screen.
 * Defaults to `false` so nothing flashes on a non-scrolling page before hydration.
 */
export function useIsScrollable(): boolean {
  const [scrollable, setScrollable] = useState(false);

  useEffect(() => {
    const check = () => {
      const doc = document.documentElement;
      setScrollable(doc.scrollHeight - window.innerHeight > 1);
    };
    check();
    window.addEventListener("resize", check);
    const ro = new ResizeObserver(check);
    ro.observe(document.body);
    return () => {
      window.removeEventListener("resize", check);
      ro.disconnect();
    };
  }, []);

  return scrollable;
}
