import { useState } from "react";
import { useI18n } from "@salon/i18n";
import { X } from "lucide-react";

export interface SalonPolicy {
  key: string;
  title: string;
  enabled: boolean;
  website: boolean;
  booking: boolean;
  source: "DEFAULT" | "CUSTOM";
  defaultLanguage: string;
  translations: Record<string, string>;
}

const POLICY_LABELS: Record<string, Record<string, string>> = {
  privacy: { en: "Privacy Policy", da: "Privatlivspolitik", sv: "Integritetspolicy", nb: "Personvernerklæring", fr: "Politique de confidentialité", de: "Datenschutzerklärung" },
  cookies: { en: "Cookie Policy", da: "Cookiepolitik", sv: "Cookiepolicy", nb: "Informasjonskapsler", fr: "Politique relative aux cookies", de: "Cookie-Richtlinie" },
  terms: { en: "Terms and Conditions", da: "Vilkår og betingelser", sv: "Villkor", nb: "Vilkår og betingelser", fr: "Conditions générales", de: "Allgemeine Geschäftsbedingungen" },
  booking: { en: "Booking Policy", da: "Bookingpolitik", sv: "Bokningspolicy", nb: "Bestillingsregler", fr: "Politique de réservation", de: "Buchungsrichtlinie" },
  refunds: { en: "Refund Policy", da: "Refusionspolitik", sv: "Återbetalningspolicy", nb: "Refusjonspolicy", fr: "Politique de remboursement", de: "Rückerstattungsrichtlinie" },
  sales: { en: "Sales Policy", da: "Salgspolitik", sv: "Försäljningspolicy", nb: "Salgsvilkår", fr: "Politique de vente", de: "Verkaufsrichtlinie" },
};

export function SalonPolicyLinks({ policies = [], color = "#64748B", salonName }: { policies?: SalonPolicy[]; color?: string; salonName?: string }) {
  const { locale, t } = useI18n();
  const [active, setActive] = useState<SalonPolicy | null>(null);
  const localeCode = locale.split(/[-_]/)[0];
  const body = active?.translations[localeCode] || active?.translations[active?.defaultLanguage ?? "en"] || "";
  if (!policies.length) return null;
  return <>
    <nav aria-label={t("Salon policies")} className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {policies.map((policy) => <button key={policy.key} type="button" onClick={() => setActive(policy)} className="text-[11px] underline underline-offset-2 hover:opacity-75" style={{ color }}>
        {t(POLICY_LABELS[policy.key]?.[localeCode] ?? policy.title)}
      </button>)}
    </nav>
    {active && <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setActive(null); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="salon-policy-title" className="flex max-h-[min(80dvh,680px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white text-slate-900 shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-7">
          <div><h2 id="salon-policy-title" className="text-lg font-semibold">{t(POLICY_LABELS[active.key]?.[localeCode] ?? active.title)}</h2>{salonName && <p className="mt-1 text-xs text-slate-500">{salonName}</p>}</div>
          <button type="button" aria-label={t("Close")} onClick={() => setActive(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </header>
        <div className="overflow-y-auto px-5 py-5 text-sm leading-7 text-slate-700 sm:px-7" lang={active.translations[localeCode] ? localeCode : active.defaultLanguage} style={{ whiteSpace: "pre-wrap" }}>{body}</div>
      </section>
    </div>}
  </>;
}
