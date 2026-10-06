import { useI18n } from "@salon/i18n";
import { useState } from "react";
import { Mail } from "lucide-react";
import { CONTACT_EMAIL, SALON_DOMAIN, ADMIN_APP_URL, DOCS_URL } from "~/lib/config";
import { TERMS_TEXT, PRIVACY_TEXT } from "~/lib/legal";
import { LegalModal } from "./LegalModal";

export function SiteFooter() {
  const { t: translateUi, locale: uiLocale } = useI18n();
  const [legal, setLegal] = useState<"terms" | "privacy" | null>(null);

  return (
    <footer className="px-5 pb-6 pt-2">
      <div className="max-w-2xl mx-auto">
        <hr className="border-stone-200 mb-3" />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="flex items-center gap-1.5 text-[11px] text-stone-400 hover:text-stone-600 no-underline transition-colors"
            >
              <Mail className="w-3 h-3 shrink-0" /> {CONTACT_EMAIL}
            </a>
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-stone-400 hover:text-stone-600 no-underline transition-colors"
            >
              {translateUi("Docs ")}</a>
            <button
              type="button"
              onClick={() => setLegal("terms")}
              className="text-[11px] text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
            >
              {translateUi("Terms ")}</button>
            <button
              type="button"
              onClick={() => setLegal("privacy")}
              className="text-[11px] text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
            >
              {translateUi("Privacy ")}</button>
            <a
              href={ADMIN_APP_URL}
              className="text-[11px] text-stone-400 hover:text-stone-600 no-underline transition-colors"
            >
              {translateUi("Already have a salon? Sign in ")}</a>
          </div>
          <p className="text-[11px] text-stone-400">
            © {new Date().getFullYear()} {SALON_DOMAIN} {translateUi("· All rights reserved. ")}</p>
        </div>
      </div>

      {legal && (
        <LegalModal
          title={legal === "terms" ? translateUi("Terms and Conditions") : translateUi("Privacy Policy")}
          text={legal === "terms" ? TERMS_TEXT : PRIVACY_TEXT}
          onClose={() => setLegal(null)}
        />
      )}
    </footer>
  );
}
