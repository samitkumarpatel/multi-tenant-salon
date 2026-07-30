import { Mail, Phone } from "lucide-react";
import { CONTACT_EMAIL } from "~/lib/config";

export function SiteFooter() {
  return (
    <footer className="px-5 pb-6 pt-2">
      <div className="max-w-2xl mx-auto">
        <hr className="border-stone-200 mb-3" />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-4">
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="flex items-center gap-1.5 text-[11px] text-stone-400 hover:text-stone-600 no-underline transition-colors"
            >
              <Mail className="w-3 h-3 shrink-0" /> {CONTACT_EMAIL}
            </a>
            <a
              href="tel:+4500000000"
              className="flex items-center gap-1.5 text-[11px] text-stone-400 hover:text-stone-600 no-underline transition-colors"
            >
              <Phone className="w-3 h-3 shrink-0" /> +45 00 00 00 00
            </a>
          </div>
          <p className="text-[11px] text-stone-400">
            © {new Date().getFullYear()} my-saloon · All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
