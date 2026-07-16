import type { WebsiteTheme } from "~/lib/types";

// ── Default theme ─────────────────────────────────────────────────────────────

export const DEFAULT_THEME: WebsiteTheme = {
  heroBg: "#0F172A",
  heroTextColor: "#FFFFFF",
  accentColor: "#F59E0B",
  fontFamily: "inter",
  logoBgColor: "#F59E0B",
};

// ── Fonts ─────────────────────────────────────────────────────────────────────

export const FONTS: Record<string, { label: string; stack: string; google?: string }> = {
  inter:      { label: "Modern",     stack: "'Inter', system-ui, sans-serif",          google: "Inter:wght@400;600;700;900" },
  playfair:   { label: "Elegant",    stack: "'Playfair Display', Georgia, serif",      google: "Playfair+Display:wght@400;700;900" },
  raleway:    { label: "Raleway",    stack: "'Raleway', system-ui, sans-serif",        google: "Raleway:wght@400;600;700" },
  lato:       { label: "Friendly",   stack: "'Lato', system-ui, sans-serif",           google: "Lato:wght@400;700;900" },
  poppins:    { label: "Rounded",    stack: "'Poppins', system-ui, sans-serif",        google: "Poppins:wght@400;600;700;900" },
  montserrat: { label: "Chic",       stack: "'Montserrat', system-ui, sans-serif",     google: "Montserrat:wght@400;600;700;900" },
  lora:       { label: "Editorial",  stack: "'Lora', Georgia, serif",                  google: "Lora:wght@400;600;700" },
  cormorant:  { label: "Luxury",     stack: "'Cormorant Garamond', Georgia, serif",    google: "Cormorant+Garamond:wght@400;600;700" },
  oswald:     { label: "Bold",       stack: "'Oswald', system-ui, sans-serif",         google: "Oswald:wght@400;600;700" },
  dancing:    { label: "Script",     stack: "'Dancing Script', cursive",               google: "Dancing+Script:wght@400;700" },
  nunito:     { label: "Soft",       stack: "'Nunito', system-ui, sans-serif",         google: "Nunito:wght@400;700;900" },
  merriweather: { label: "Classic serif", stack: "'Merriweather', Georgia, serif",     google: "Merriweather:wght@400;700;900" },
  system:     { label: "System",     stack: "system-ui, -apple-system, sans-serif",    google: undefined },
  georgia:    { label: "Classic",    stack: "Georgia, 'Times New Roman', serif",       google: undefined },
};

export function loadGoogleFont(fontId: string) {
  const font = FONTS[fontId];
  if (!font?.google) return;
  const linkId = `gfont-${fontId}`;
  if (document.getElementById(linkId)) return;
  const link = document.createElement("link");
  link.id = linkId;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`;
  document.head.appendChild(link);
}

// ── Contrast helpers ──────────────────────────────────────────────────────────

/** WCAG relative luminance of a #rrggbb color (0 = black, 1 = white) */
export function relLuminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex?.trim() ?? "");
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const chan = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan((n >> 16) & 255) + 0.7152 * chan((n >> 8) & 255) + 0.0722 * chan(n & 255);
}

export const isLightColor = (hex: string) => relLuminance(hex) > 0.45;

/** Best readable text color (near-black or white) for a given background */
export const contrastText = (bg: string) => (isLightColor(bg) ? "#0F172A" : "#FFFFFF");
