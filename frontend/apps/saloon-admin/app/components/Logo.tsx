import { useState, useId } from "react";

interface AppLogoProps {
  size?: number;
  showText?: boolean;
  textColor?: string;
  className?: string;
}

export function AppLogo({
  size = 28,
  showText = true,
  textColor = "inherit",
  className = "",
}: AppLogoProps) {
  const [snipping, setSnipping] = useState(false);
  const uid = useId().replace(/:/g, "");
  const gradId = `logo-grad-${uid}`;

  const rx = Math.round(size * 0.25);

  return (
    <div
      className={`inline-flex items-center gap-2 select-none ${className}`}
      role="img"
      aria-label="my-saloon"
    >
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
          <rect width="32" height="32" rx="8" fill={`url(#${gradId})`} />
          <line x1="12" y1="9"  x2="26" y2="23" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="12" y1="23" x2="26" y2="9"  stroke="white" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="8" cy="9"  r="4" fill={`url(#${gradId})`} stroke="white" strokeWidth="1.8" />
          <circle cx="8" cy="23" r="4" fill={`url(#${gradId})`} stroke="white" strokeWidth="1.8" />
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
