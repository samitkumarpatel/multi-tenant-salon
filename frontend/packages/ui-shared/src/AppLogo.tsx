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
  const uid      = useId().replace(/:/g, "");
  const bgId     = `logo-bg-${uid}`;
  const bladeId  = `logo-blade-${uid}`;
  const goldId   = `logo-gold-${uid}`;
  const goldRimId= `logo-gold-rim-${uid}`;
  const shadowId = `logo-shadow-${uid}`;

  const rx = Math.round(size * 0.25);

  return (
    <div
      className={`inline-flex items-center gap-2 select-none ${className}`}
      role="img"
      aria-label={import.meta.env.VITE_SALON_DOMAIN ?? "salonsaas.org"}
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
          <defs>
            {/* Deep navy-to-slate background */}
            <linearGradient id={bgId} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
              <stop offset="0%"   stopColor="#0f1e35" />
              <stop offset="100%" stopColor="#07111e" />
            </linearGradient>

            {/* Platinum / brushed-steel blade */}
            <linearGradient id={bladeId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"   stopColor="#dde4ec" />
              <stop offset="40%"  stopColor="#ffffff" />
              <stop offset="100%" stopColor="#8fa3b8" />
            </linearGradient>

            {/* Warm gold for handles */}
            <linearGradient id={goldId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"   stopColor="#d4a853" />
              <stop offset="50%"  stopColor="#b8862a" />
              <stop offset="100%" stopColor="#7a5418" />
            </linearGradient>

            {/* Gold rim highlight */}
            <linearGradient id={goldRimId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"   stopColor="#f0c96a" />
              <stop offset="100%" stopColor="#c9922e" />
            </linearGradient>

            {/* Subtle drop shadow */}
            <filter id={shadowId} x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodColor="#000" floodOpacity="0.5" />
            </filter>
          </defs>

          {/* Background */}
          <rect width="32" height="32" rx="8" fill={`url(#${bgId})`} />

          {/* Subtle inner glow / vignette ring */}
          <rect width="32" height="32" rx="8" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />

          {/* Upper blade */}
          <line
            x1="7"  y1="7"
            x2="27" y2="22"
            stroke={`url(#${bladeId})`}
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          {/* Lower blade */}
          <line
            x1="7"  y1="25"
            x2="27" y2="10"
            stroke={`url(#${bladeId})`}
            strokeWidth="2.6"
            strokeLinecap="round"
          />

          {/* Pivot screw */}
          <circle cx="16.5" cy="16" r="2.4" fill="#c4d0dc" filter={`url(#${shadowId})`} />
          <circle cx="16.5" cy="16" r="1.1" fill="white" />

          {/* Upper handle — gold ring */}
          <circle cx="7" cy="7"  r="4.8" fill={`url(#${goldId})`}    filter={`url(#${shadowId})`} />
          <circle cx="7" cy="7"  r="3.0" fill="none" stroke={`url(#${goldRimId})`} strokeWidth="1.1" />
          <circle cx="7" cy="7"  r="1.2" fill={`url(#${goldRimId})`} />

          {/* Lower handle — gold ring */}
          <circle cx="7" cy="25" r="4.8" fill={`url(#${goldId})`}    filter={`url(#${shadowId})`} />
          <circle cx="7" cy="25" r="3.0" fill="none" stroke={`url(#${goldRimId})`} strokeWidth="1.1" />
          <circle cx="7" cy="25" r="1.2" fill={`url(#${goldRimId})`} />
        </svg>
      </span>

      {showText && (
        <span
          className="font-bold tracking-tight leading-none"
          style={{ fontSize: Math.round(size * 0.54), color: textColor }}
        >
          my
          <span style={{ fontWeight: 400, opacity: 0.45 }}>-</span>
          salon
        </span>
      )}
    </div>
  );
}
