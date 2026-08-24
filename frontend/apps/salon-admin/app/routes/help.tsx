import { Mail, Phone, MessageCircle, ExternalLink, BookOpen, Lightbulb, Bug, Shield } from "lucide-react";
import { InfoBar } from "@salon/ui-shared";
import { SUPPORT_EMAIL } from "~/lib/config";

const SUPPORT_PHONE = "+1 (800) 123-4567";

export default function Help() {
  return (
    <div className="space-y-6">

      <div className="space-y-2">
        <h1 className="text-xl font-bold text-slate-900">Help &amp; Support</h1>
        <InfoBar id="help">
          Need assistance? Reach out to our support team — we typically respond within one business day.
        </InfoBar>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">

        {/* Email */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4 pb-2.5 border-b border-slate-100">
            <Mail className="w-3.5 h-3.5 text-matcha-600" />
            <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">Email Support</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed mb-4">
            For general questions, billing, or account-related issues send us an email and we'll get back to you promptly.
          </p>
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
            <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">Phone Support</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed mb-4">
            Available Monday – Friday, 9 AM – 6 PM (EST). For urgent issues affecting your live booking or public website.
          </p>
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
            <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">Live Chat</span>
            <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-slate-300 border border-slate-200 rounded px-1">Soon</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Real-time chat support is coming soon. In the meantime please use email or phone.
          </p>
        </div>

      </div>

      {/* Quick links */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">Quick Links</p>
        </div>
        <div className="divide-y divide-slate-100">
          {[
            { icon: BookOpen,   label: "Documentation",        hint: "Setup guides, feature walkthroughs, and API reference",   href: "#" },
            { icon: Lightbulb, label: "Feature Requests",     hint: "Suggest new capabilities or vote on what we build next",   href: "#" },
            { icon: Bug,       label: "Report a Bug",         hint: "Found something broken? Let us know and we'll fix it fast", href: `mailto:${SUPPORT_EMAIL}?subject=Bug%20Report` },
            { icon: Shield,    label: "Security &amp; Privacy", hint: "Privacy policy, data handling, and security disclosures",  href: "#" },
          ].map(({ icon: Icon, label, hint, href }) => (
            <a
              key={label}
              href={href}
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
