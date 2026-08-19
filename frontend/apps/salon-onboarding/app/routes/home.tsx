import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Building2, Users, ArrowRight, Cookie, Mail, Phone } from "lucide-react";
import { AppLogo } from "@salon/ui-shared";
import { CONTACT_EMAIL, SALON_DOMAIN } from "~/lib/config";

type CookieChoice = "all" | "essential";

function CookieBanner() {
  const [visible, setVisible] = useState(false);

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
    <div className="fixed bottom-0 inset-x-0 z-50 animate-[slide-up_0.3s_ease_both]">
      <div className="bg-white border-t border-stone-200 shadow-[0_-4px_24px_rgba(0,0,0,0.07)]">
        <div className="max-w-5xl mx-auto px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-5">

          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Cookie className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-stone-800 mb-0.5">We use cookies</p>
              <p className="text-xs text-stone-500 leading-relaxed">
                We use essential cookies to make our site work, and optional analytics cookies to understand how you use it.
                See our{" "}
                <a href="#" className="text-matcha-600 hover:underline">cookie policy</a>{" "}
                for details. You can change your preferences at any time.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 sm:flex-col lg:flex-row">
            <button
              onClick={() => save("essential")}
              className="flex-1 sm:flex-none text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 px-4 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
            >
              Essential only
            </button>
            <button
              onClick={() => save("all")}
              className="flex-1 sm:flex-none text-xs font-semibold bg-matcha-600 hover:bg-matcha-700 text-white px-5 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
            >
              Accept all cookies
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-[100dvh] bg-cream flex flex-col">

      <div className="px-5 pt-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <AppLogo size={24} textColor="#1c1917" />
          <div className="flex gap-3">
            <a href={`mailto:${CONTACT_EMAIL}`} className="flex items-center gap-1.5 text-[11px] text-stone-400 hover:text-stone-600 no-underline transition-colors">
              <Mail className="w-3 h-3 shrink-0" />
              <span className="hidden sm:inline">{CONTACT_EMAIL}</span>
            </a>
            <a href="tel:+4500000000" className="flex items-center gap-1.5 text-[11px] text-stone-400 hover:text-stone-600 no-underline transition-colors">
              <Phone className="w-3 h-3 shrink-0" />
              <span className="hidden sm:inline">+45 00 00 00 00</span>
            </a>
          </div>
        </div>
      </div>

      <main className="flex flex-col items-center px-5 pt-10 sm:pt-16 pb-8">
        <div className="w-full max-w-2xl">

          <div className="mb-7 sm:mb-10 text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-stone-900 tracking-tight leading-[1.1]">
              Book a visit.<br className="hidden sm:block" /> Or open your doors.
            </h1>
            <p className="text-stone-500 mt-4 text-base leading-relaxed max-w-sm mx-auto">
              One platform for salon owners and the customers who love them.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">

            <Link
              to="/new"
              className="group flex flex-col flex-1 bg-white border border-stone-200 rounded-2xl p-5 sm:p-8 no-underline transition-all duration-200 hover:border-matcha-400 hover:shadow-[0_0_0_4px_rgba(86,115,48,0.10)] hover:-translate-y-0.5"
            >
              <div className="w-12 h-12 rounded-2xl bg-matcha-50 border border-matcha-100 flex items-center justify-center mb-4 sm:mb-6 group-hover:bg-matcha-100 transition-colors">
                <Building2 className="w-6 h-6 text-matcha-600" />
              </div>
              <p className="text-2xl font-bold text-stone-900 mb-1">I'm an owner</p>
              <p className="text-sm text-stone-500 leading-relaxed flex-1">
                Register your salon, set up services and staff, and go live in minutes.
              </p>
              <div className="flex items-center gap-1.5 mt-5 sm:mt-8 text-sm font-semibold text-matcha-600 group-hover:gap-2.5 transition-all">
                Get started <ArrowRight className="w-4 h-4" />
              </div>
            </Link>

            <div className="flex flex-col flex-1 bg-white border border-stone-200 rounded-2xl p-5 sm:p-8 opacity-50 cursor-not-allowed select-none">
              <div className="w-12 h-12 rounded-2xl bg-stone-50 border border-stone-100 flex items-center justify-center mb-4 sm:mb-6">
                <Users className="w-6 h-6 text-stone-400" />
              </div>
              <p className="text-2xl font-bold text-stone-400 mb-1">I'm a customer</p>
              <p className="text-sm text-stone-400 leading-relaxed flex-1">
                Find a salon near you, browse services and prices, and book your next appointment.
              </p>
              <div className="flex items-center gap-1.5 mt-5 sm:mt-8 text-sm font-semibold text-stone-400">
                Coming soon
              </div>
            </div>

          </div>
        </div>
      </main>

      <footer className="px-5 pb-8">
        <div className="max-w-2xl mx-auto">
          <hr className="border-stone-200 mb-3" />
          <p className="text-right text-[11px] text-stone-400">
            © {new Date().getFullYear()} {SALON_DOMAIN} · All rights reserved.
          </p>
        </div>
      </footer>

      <CookieBanner />
    </div>
  );
}
