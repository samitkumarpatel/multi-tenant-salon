import React from "react";
import { Scissors, Brush, Hand, Sparkles, Flame, HandHeart, Star } from "lucide-react";

// One glyph per ServiceCategory. Every ServiceItem carries a `category`, so this gives every
// service a consistent icon with no per-service configuration. lucide-react is already a
// dependency here; BEARD has no razor/beard glyph in the set, so it's a small inline mustache
// SVG that follows the same 24×24 / `currentColor` conventions as its lucide siblings.

const MustacheIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true" focusable="false">
    <path d="M12 12c-.73-1.2-2.03-2-3.5-2-1.2 0-2.3.48-3.11 1.27-.69.67-1.5 1.07-2.39 1.07-.6 0-1.19-.18-1.7-.5.8 2.4 3.02 4.13 5.7 4.13 2.02 0 3.8-.98 4.9-2.48l.1-.13.1.13c1.1 1.5 2.88 2.48 4.9 2.48 2.68 0 4.9-1.73 5.7-4.13-.51.32-1.1.5-1.7.5-.89 0-1.7-.4-2.39-1.07A4.43 4.43 0 0 0 15.5 10c-1.47 0-2.77.8-3.5 2Z" />
  </svg>
);

/** ServiceCategory enum value → icon component. */
export const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  HAIR: Scissors,
  MAKEUP: Brush,
  NAILS: Hand,
  SKIN_CARE: Sparkles,
  BEARD: MustacheIcon,
  MASSAGE: HandHeart,
  WAXING: Flame,
  OTHER: Star,
};

/** Renders the icon for a service category; unknown / missing values fall back to the OTHER glyph. */
export function CategoryIcon({ category, className }: { category?: string | null; className?: string }) {
  const Icon = (category && CATEGORY_ICON[category]) || Star;
  return <Icon className={className} />;
}
