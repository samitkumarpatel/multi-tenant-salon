import { useI18n } from "@salon/i18n";
import { useState } from "react";
import { SALON_DOMAIN, DOCS_URL } from "~/lib/config";
import { TERMS_TEXT, PRIVACY_TEXT } from "~/lib/legal";
import { LegalModal } from "./LegalModal";

export function SiteFooter() {
  const { t: translateUi } = useI18n();
  const [legal, setLegal] = useState<"terms" | "privacy" | null>(null);

  return (
    <footer className="mt-auto border-t border-stone-200 bg-white/70 px-5 py-4">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label={translateUi("Footer links")} className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs sm:justify-start">
          <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" className="text-stone-500 hover:text-stone-800 no-underline transition-colors">
            {translateUi("Documentation ")}
          </a>
          <button type="button" onClick={() => setLegal("terms")} className="text-stone-500 hover:text-stone-800 transition-colors cursor-pointer">
            {translateUi("Terms and Conditions ")}
          </button>
          <button type="button" onClick={() => setLegal("privacy")} className="text-stone-500 hover:text-stone-800 transition-colors cursor-pointer">
            {translateUi("Privacy Policy ")}
          </button>
        </nav>
        <span className="text-center text-[11px] text-stone-400 sm:shrink-0 sm:text-right">
          © {new Date().getFullYear()} {SALON_DOMAIN} · {translateUi("All rights reserved. ")}
        </span>
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
