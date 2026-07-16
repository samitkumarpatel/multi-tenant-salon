import { ArrowLeft, ShoppingBag, BadgeCheck, Gift, CalendarCheck, type LucideIcon } from "lucide-react";
import { FONTS, contrastText, isLightColor } from "~/lib/theme";
import { SiteHeader, SiteFooter } from "~/components/SiteChrome";
import type { Saloon, WebsiteTheme } from "~/lib/types";

export const FEATURE_VIEWS: Record<string, { title: string; icon: LucideIcon; tagline: string; blurb: string }> = {
  shop: {
    title: "Shop",
    icon: ShoppingBag,
    tagline: "Salon-grade products, delivered",
    blurb: "Browse the products our stylists use and love — shampoos, styling, and care picked for you.",
  },
  membership: {
    title: "Membership",
    icon: BadgeCheck,
    tagline: "Your look, on subscription",
    blurb: "Join our membership for priority booking, member pricing, and exclusive perks every month.",
  },
  loyalty: {
    title: "Loyalty",
    icon: Gift,
    tagline: "Every visit counts",
    blurb: "Collect points with every appointment and purchase, and redeem them for treats and services.",
  },
};

function initials(name: string) {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export function FeatureView({
  saloon, theme, pageKey, bookUrl, onBack,
}: {
  saloon: Saloon;
  theme: WebsiteTheme;
  pageKey: string;
  bookUrl: string;
  onBack: () => void;
}) {
  const page = FEATURE_VIEWS[pageKey] ?? FEATURE_VIEWS.shop;
  const Icon = page.icon;
  const hasBooking = saloon.features?.includes("BOOKING");

  const fontStack = FONTS[theme.fontFamily]?.stack ?? FONTS.inter.stack;
  const accentText = contrastText(theme.accentColor);
  const heroLight = isLightColor(theme.heroBg);
  const sub = heroLight ? "#475569" : "#94A3B8";

  return (
    <div className="min-h-[100dvh] flex flex-col" style={{ fontFamily: fontStack, backgroundColor: theme.heroBg }}>
      {/* Header — same chrome as the saloon website (this page's link swapped for Back) */}
      <SiteHeader saloon={saloon} theme={theme} current={pageKey} onBack={onBack} />

      {/* Content */}
      <main className="flex-1 flex items-center">
        <div className="max-w-5xl mx-auto px-6 py-16 w-full text-center">
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center"
            style={{ backgroundColor: `${theme.accentColor}22`, border: `1px solid ${theme.accentColor}44` }}
          >
            <Icon className="w-8 h-8" style={{ color: theme.accentColor }} />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: theme.accentColor }}>
            {page.tagline}
          </p>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4" style={{ color: theme.heroTextColor }}>
            {page.title}
          </h1>
          <p className="text-sm sm:text-base max-w-md mx-auto leading-relaxed mb-3" style={{ color: sub }}>
            {page.blurb}
          </p>
          <p
            className="inline-block text-[11px] font-semibold uppercase tracking-widest px-3 py-1 rounded-full mb-8"
            style={{
              color: sub,
              backgroundColor: heroLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.08)",
            }}
          >
            Coming soon
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {hasBooking && (
              <a
                href={bookUrl}
                className="inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-xl no-underline hover:opacity-90 transition-opacity"
                style={{ backgroundColor: theme.accentColor, color: accentText }}
              >
                <CalendarCheck className="w-4 h-4" /> Book an appointment
              </a>
            )}
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-xl hover:opacity-70 transition-opacity border cursor-pointer"
              style={{
                color: theme.heroTextColor,
                borderColor: heroLight ? "rgba(15,23,42,0.15)" : "rgba(255,255,255,0.2)",
              }}
            >
              <ArrowLeft className="w-4 h-4" /> Back to {saloon.name}
            </button>
          </div>
        </div>
      </main>

      {/* Footer — same chrome as the saloon website */}
      <SiteFooter saloon={saloon} theme={theme} current={pageKey} onBack={onBack} />
    </div>
  );
}
