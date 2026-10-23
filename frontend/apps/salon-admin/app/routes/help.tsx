import { useI18n } from "@salon/i18n";
import { Mail, Phone, MessageCircle, ExternalLink, BookOpen, Lightbulb, Bug, Shield } from "lucide-react";
import { InfoBar } from "@salon/ui-shared";
import { SUPPORT_EMAIL, helpUrl } from "~/lib/config";

const SUPPORT_PHONE = "+1 (800) 123-4567";

export default function Help() {
  const { t: translateUi, locale: uiLocale } = useI18n();
  return (
    <div className="space-y-6">

      <div className="space-y-2">
        <h1 className="text-xl font-bold text-slate-900">{translateUi("Help & Support")}</h1>
        <InfoBar id="help">
          {translateUi("Need assistance? Reach out to our support team — we typically respond within one business day. ")}</InfoBar>
      </div>

      <a
        href={helpUrl("", uiLocale)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-4 bg-white rounded-xl p-5 border border-matcha-200 shadow-sm hover:border-matcha-400 transition-colors no-underline group"
      >
        <span className="w-10 h-10 rounded-lg bg-matcha-50 border border-matcha-100 flex items-center justify-center shrink-0">
          <BookOpen className="w-5 h-5 text-matcha-600" aria-hidden="true" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-slate-900">{translateUi("Help Center")}</span>
          <span className="block text-xs text-slate-500 leading-relaxed">
            {translateUi("Step-by-step guides for setting up your salon, bookings, shop, memberships, payments and the front desk.")}
          </span>
        </span>
        <ExternalLink className="w-4 h-4 text-slate-300 shrink-0 group-hover:text-matcha-600 transition-colors" aria-hidden="true" />
      </a>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">

        {/* Email */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4 pb-2.5 border-b border-slate-100">
            <Mail className="w-3.5 h-3.5 text-matcha-600" />
            <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">{translateUi("Email Support")}</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed mb-4">
            {translateUi("For general questions, billing, or account-related issues send us an email and we'll get back to you promptly. ")}</p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-matcha-600 hover:text-matcha-700 no-underline hover:underline"
          >
            <Mail className="w-4 h-4" /> {SUPPORT_EMAIL}
          </a>
        </div>

        {/* Phone */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4 pb-2.5 border-b border-slate-100">
            <Phone className="w-3.5 h-3.5 text-matcha-600" />
            <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">{translateUi("Phone Support")}</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed mb-4">
            {translateUi("Available Monday – Friday, 9 AM – 6 PM (EST). For urgent issues affecting your live booking or public website. ")}</p>
          <a
            href={`tel:${SUPPORT_PHONE.replace(/\s|\(|\)|-/g, "")}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-matcha-600 hover:text-matcha-700 no-underline hover:underline"
          >
            <Phone className="w-4 h-4" /> {SUPPORT_PHONE}
          </a>
        </div>

        {/* Live chat placeholder */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4 pb-2.5 border-b border-slate-100">
            <MessageCircle className="w-3.5 h-3.5 text-matcha-600" />
            <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">{translateUi("Live Chat")}</span>
            <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-slate-300 border border-slate-200 rounded px-1">{translateUi("Soon")}</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            {translateUi("Real-time chat support is coming soon. In the meantime please use email or phone. ")}</p>
        </div>

      </div>

      {/* Quick links */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">{translateUi("Quick Links")}</p>
        </div>
        <div className="divide-y divide-slate-100">
          {[
            { icon: BookOpen,   label: "Help Center",          hint: "Setup guides and feature walkthroughs for owners and staff", href: helpUrl("", uiLocale) },
            { icon: Lightbulb, label: "Feature Requests",     hint: "Suggest new capabilities or vote on what we build next",   href: "#" },
            { icon: Bug,       label: "Report a Bug",         hint: "Found something broken? Let us know and we'll fix it fast", href: `mailto:${SUPPORT_EMAIL}?subject=Bug%20Report` },
            { icon: Shield,    label: "Security &amp; Privacy", hint: "Privacy policy, data handling, and security disclosures",  href: "#" },
          ].map(({ icon: Icon, label, hint, href }) => (
            <a
              key={label}
              href={href}
              {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors no-underline group"
            >
              <Icon className="w-4 h-4 text-slate-400 shrink-0 group-hover:text-matcha-600 transition-colors" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 group-hover:text-slate-900" dangerouslySetInnerHTML={{ __html: label }} />
                <p className="text-xs text-slate-400 truncate">{hint}</p>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-slate-300 shrink-0 group-hover:text-slate-400 transition-colors" />
            </a>
          ))}
        </div>
      </div>

    </div>
  );
}
