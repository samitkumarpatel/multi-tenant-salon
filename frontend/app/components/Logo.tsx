import { useState, useId } from "react";

interface AppLogoProps {
  /** Icon size in px (box is square) */
  size?: number;
  /** Show the "my-saloon" wordmark next to the icon */
  showText?: boolean;
  /** CSS color for the wordmark — defaults to "inherit" */
  textColor?: string;
  /** Extra className on the root element */
  className?: string;
}

/**
 * Platform logo for "my-saloon".
 * Click or hover → scissors snip animation.
 */
export function AppLogo({
  size = 28,
  showText = true,
  textColor = "inherit",
  className = "",
}: AppLogoProps) {
  const [snipping, setSnipping] = useState(false);
  const uid = useId().replace(/:/g, "");
  const gradId = `logo-grad-${uid}`;

  const rx = Math.round(size * 0.25); // border-radius proportional to size

  return (
    <div
      className={`inline-flex items-center gap-2 select-none ${className}`}
      role="img"
      aria-label="my-saloon"
    >
      {/* ── Icon ── */}
      <span
        className={`logo-snip shrink-0 ${snipping ? "is-snipping" : ""}`}
        style={{ width: size, height: size }}
        onMouseEnter={() => { if (!snipping) setSnipping(true); }}
        onAnimationEnd={() => setSnipping(false)}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          style={{ display: "block", borderRadius: rx }}
        >
          {/* Background */}
          <rect width="32" height="32" rx="8" fill={`url(#${gradId})`} />

          {/* Blade 1: top-handle → bottom-right tip */}
          <line
            x1="12" y1="9" x2="26" y2="23"
            stroke="white" strokeWidth="2.2" strokeLinecap="round"
          />
          {/* Blade 2: bottom-handle → top-right tip */}
          <line
            x1="12" y1="23" x2="26" y2="9"
            stroke="white" strokeWidth="2.2" strokeLinecap="round"
          />

          {/* Handle ring 1 — gradient fill masks the blade start */}
          <circle
            cx="8" cy="9" r="4"
            fill={`url(#${gradId})`} stroke="white" strokeWidth="1.8"
          />
          {/* Handle ring 2 */}
          <circle
            cx="8" cy="23" r="4"
            fill={`url(#${gradId})`} stroke="white" strokeWidth="1.8"
          />

          {/* Pivot screw at blade crossing (~19, 16) */}
          <circle cx="19" cy="16" r="3"   fill={`url(#${gradId})`} />
          <circle cx="19" cy="16" r="1.4" fill="white" />

          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
              <stop offset="0%"   stopColor="#4ade80" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
          </defs>
        </svg>
      </span>

      {/* ── Wordmark ── */}
      {showText && (
        <span
          className="font-bold tracking-tight leading-none"
          style={{ fontSize: Math.round(size * 0.54), color: textColor }}
        >
          my
          <span style={{ fontWeight: 400, opacity: 0.45 }}>-</span>
          saloon
        </span>
      )}
    </div>
  );
}
