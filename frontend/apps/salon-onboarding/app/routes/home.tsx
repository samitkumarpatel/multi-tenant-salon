import { useI18n } from "@salon/i18n";
import { useState, useEffect, useRef } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  Cookie,
  Check,
  CalendarDays,
  Globe,
  Users,
  ArrowUpRight,
} from "lucide-react";
import { AppLogo } from "@salon/ui-shared";
import { ADMIN_APP_URL, SALON_DOMAIN } from "~/lib/config";
import { PRIVACY_TEXT } from "~/lib/legal";
import { LegalModal } from "~/components/LegalModal";
import { SiteFooter } from "~/components/SiteFooter";

type CookieChoice = "all" | "essential";

function CookieBanner() {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const [visible, setVisible] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(`${SALON_DOMAIN}:cookie-consent`)) {
      setVisible(true);
    }
  }, []);

  function save(choice: CookieChoice) {
    localStorage.setItem(`${SALON_DOMAIN}:cookie-consent`, choice);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <>
      <div className="fixed bottom-0 inset-x-0 z-50 animate-[slide-up_0.3s_ease_both]">
        <div className="bg-white border-t border-stone-200 shadow-[0_-4px_24px_rgba(0,0,0,0.07)]">
          <div className="max-w-5xl mx-auto px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <Cookie className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-stone-800 mb-0.5">
                  {translateUi("We use cookies")}
                </p>
                <p className="text-xs text-stone-500 leading-relaxed">
                  {translateUi(
                    "We use essential cookies to make our site work, and optional analytics cookies to understand how you use it. See our",
                  )}{" "}
                  <button
                    type="button"
                    onClick={() => setShowPolicy(true)}
                    className="text-matcha-600 hover:underline cursor-pointer"
                  >
                    {translateUi("cookie policy")}
                  </button>{" "}
                  {translateUi(
                    "for details. You can change your preferences at any time. ",
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 sm:flex-col lg:flex-row">
              <button
                onClick={() => save("essential")}
                className="flex-1 sm:flex-none text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 px-4 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
              >
                {translateUi("Essential only ")}
              </button>
              <button
                onClick={() => save("all")}
                className="flex-1 sm:flex-none text-xs font-semibold bg-matcha-600 hover:bg-matcha-700 text-white px-5 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
              >
                {translateUi("Accept all cookies ")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showPolicy && (
        <LegalModal
          title={translateUi("Privacy Policy")}
          text={PRIVACY_TEXT}
          onClose={() => setShowPolicy(false)}
        />
      )}
    </>
  );
}

const photoUrl = (id: string, width = 900) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`;
// Illustrative marketing preview figures, not live platform totals.
function PlatformNumbers() {
  const { t, locale } = useI18n();
  const section = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let started = false;
    let observer: IntersectionObserver | undefined;
    const finish = () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      setProgress(1);
    };
    const onMotionChange = () => {
      if (reducedMotion.matches) finish();
    };
    const start = () => {
      if (started) return;
      started = true;
      observer?.disconnect();
      if (reducedMotion.matches) {
        finish();
        return;
      }
      const startedAt = performance.now();
      const tick = (now: number) => {
        const elapsed = Math.min((now - startedAt) / 1800, 1);
        setProgress(1 - Math.pow(1 - elapsed, 3));
        if (elapsed < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };
    // Replay on every mount, once the totals become visible, including on mobile.
    if (reducedMotion.matches) finish();
    else {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) start();
        },
        { threshold: 0.25 },
      );
      if (section.current) observer.observe(section.current);
    }
    reducedMotion.addEventListener("change", onMotionChange);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      reducedMotion.removeEventListener("change", onMotionChange);
    };
  }, []);

  const numbers = [
    { label: "Salons onboarded", value: 120 },
    { label: "Bookings created", value: 183749 },
    { label: "Countries represented", value: 6 },
  ];
  return (
    <section
      ref={section}
      className="landing-stats"
      aria-label={t("Our community in numbers")}
    >
      <div>
        <p className="landing-eyebrow">{t("One platform. Many salons.")}</p>
        <p className="text-xs text-stone-500 mt-2">{t("Sample figures")}</p>
      </div>
      <dl className="landing-numbers">
        {numbers.map((item) => (
          <div key={item.label}>
            <dt>{t(item.label)}</dt>
            <dd>
              <span aria-hidden="true">
                {new Intl.NumberFormat(locale).format(
                  Math.round(item.value * progress),
                )}
              </span>
              <span className="sr-only">
                {new Intl.NumberFormat(locale).format(item.value)}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const features = [
  { name: "Your website", icon: Globe },
  { name: "Your bookings", icon: CalendarDays },
  { name: "Your team", icon: Users },
];

function OwnerPreview() {
  const { t } = useI18n();
  const [selected, setSelected] = useState(0);
  return (
    <div className="owner-preview">
      <div
        className="owner-preview-switch"
        role="group"
        aria-label={t("Explore salon features")}
      >
        {features.map(({ name, icon: Icon }, index) => (
          <button
            key={name}
            type="button"
            aria-pressed={selected === index}
            aria-controls="owner-preview-panel"
            onClick={() => setSelected(index)}
          >
            <Icon size={16} />
            <span>{t(name)}</span>
          </button>
        ))}
      </div>
      <div
        id="owner-preview-panel"
        className="owner-preview-panel"
        aria-live="polite"
      >
        <div className="owner-preview-label">
          <span>{t("Your salon")}</span>
          <span>{t("Example preview")}</span>
        </div>
        {selected === 0 && (
          <div className="owner-website-preview">
            <div>
              <span className="owner-studio">STUDIO & CO.</span>
              <h2>
                {t("Your style.")}
                <br />
                <em>{t("Beautifully online.")}</em>
              </h2>
              <span className="owner-mock-cta">
                {t("Services & appointments")} <ArrowUpRight size={13} />
              </span>
            </div>
            <img
              src={photoUrl("photo-1521590832167-7bcbfaa6381f", 450)}
              alt={t("Salon website preview with a bright studio interior")}
              width="450"
              height="550"
            />
          </div>
        )}
        {selected === 1 && (
          <div className="owner-calendar-preview">
            <h2>{t("A day at your salon")}</h2>
            {[
              ["09:00", "Cut & style", "45 min"],
              ["10:00", "Colour refresh", "90 min"],
              ["13:00", "Cut & style", "45 min"],
            ].map(([time, service, duration]) => (
              <div className="owner-appointment" key={time}>
                <time>{time}</time>
                <span>
                  <strong>{t(service)}</strong>
                  <small>{t(duration)}</small>
                </span>
                <Check size={16} />
              </div>
            ))}
          </div>
        )}
        {selected === 2 && (
          <div className="owner-team-preview">
            <h2>{t("Everyone, in sync.")}</h2>
            {[
              ["A", "Alex", "Stylist"],
              ["J", "Jamie", "Colourist"],
              ["S", "Sam", "Stylist"],
            ].map(([initial, name, role]) => (
              <div className="owner-team-member" key={name}>
                <span className="owner-avatar">{initial}</span>
                <span>
                  <strong>{name}</strong>
                  <small>{t(role)}</small>
                </span>
                <span className="owner-team-status">
                  {t("On the schedule")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const { t } = useI18n();
  return (
    <div className="landing min-h-[100dvh] bg-cream flex flex-col text-stone-900">
      <header className="landing-header">
        <Link to="/" aria-label={t("Home")}>
          <AppLogo size={28} textColor="#1c1917" />
        </Link>
        <nav aria-label={t("Main navigation")}>
          <Link to="/explore" className="owner-directory-link">
            {t("Explore salons")}
          </Link>
          <a href={ADMIN_APP_URL}>
            {t("Owner sign in")} <ArrowUpRight size={14} />
          </a>
        </nav>
      </header>
      <main>
        <section className="owner-hero">
          <div className="owner-copy">
            <p className="landing-eyebrow">
              <span className="landing-dot" />
              {t("For independent salons. Built around you.")}
            </p>
            <h1>
              {t("Your salon.")}
              <br />
              <em>{t("Your next chapter.")}</em>
            </h1>
            <p className="owner-intro">
              {t("Website. Bookings. Team. All in one place.")}
            </p>
            <Link to="/new" className="landing-primary">
              {t("Set up your salon")} <ArrowRight size={18} />
            </Link>
          </div>
          <div className="owner-gallery">
            <figure className="owner-gallery-main">
              <img
                src={photoUrl("photo-1560066984-138dadb4c035")}
                alt={t("A spacious salon with styling chairs and tall windows")}
                width="900"
                height="1100"
                fetchPriority="high"
              />
            </figure>
            <figure className="owner-gallery-detail">
              <img
                src={photoUrl("photo-1562322140-8baeececf3df", 450)}
                alt={t("A salon owner styling a customer's hair")}
                width="450"
                height="540"
              />
              <figcaption>{t("More time for your craft.")}</figcaption>
            </figure>
            <span className="owner-gallery-stamp">
              <Globe size={17} />
              {t("Your own salon website")}
            </span>
          </div>
          <OwnerPreview />
        </section>
        <PlatformNumbers />
        <section className="owner-invite">
          <h2>{t("Make it yours.")}</h2>
          <Link to="/new" className="landing-primary">
            {t("Set up your salon")} <ArrowRight size={18} />
          </Link>
        </section>
      </main>
      <SiteFooter />
      <CookieBanner />
    </div>
  );
}
