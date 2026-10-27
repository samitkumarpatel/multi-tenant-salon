import { useI18n } from "@salon/i18n";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarCheck, Gift, Sparkles } from "lucide-react";
import { apiFetch, API_BASE } from "./api";
import { friendlyMessage } from "./apiError";
import { SiteHeader, SiteFooter } from "./SiteChrome";
import type { SalonPolicy } from "./SalonPolicyLinks";
import { contrastText, fontStack, isLightColor, loadGoogleFont } from "./theme";
import type { CustomerLoyalty, Salon, WebsiteTheme } from "./types";

export interface LoyaltyViewProps {
  salon: Salon;
  theme: WebsiteTheme;
  policies?: SalonPolicy[];
  getPagePath?: (page: string) => string;
  onNavigate?: (page: string | null) => void;
}

/** The salon's public loyalty page: how points are earned and what they buy. Nothing about any customer. */
export function LoyaltyView({ salon, theme, policies = [], getPagePath, onNavigate }: LoyaltyViewProps) {
  const { t: translateUi } = useI18n();
  const [rules, setRules] = useState<CustomerLoyalty | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { loadGoogleFont(theme.fontFamily); }, [theme.fontFamily]);
  useEffect(() => {
    let alive = true;
    apiFetch<CustomerLoyalty>(`${API_BASE}/api/salon/${salon.id}/loyalty`)
      .then((r) => alive && setRules(r)).catch((e) => alive && setError(friendlyMessage(e)));
    return () => { alive = false; };
  }, [salon.id]);

  const light = isLightColor(theme.heroBg);
  const text = theme.heroTextColor;
  const sub = light ? "#475569" : "#94A3B8";
  const card = light ? "#FFFFFF" : "rgba(255,255,255,0.06)";
  const border = light ? "rgba(15,23,42,0.1)" : "rgba(255,255,255,0.14)";
  const accentText = contrastText(theme.accentColor);
  const program = rules?.program;
  const go = (page: string | null) => (e: React.MouseEvent) => { if (onNavigate) { e.preventDefault(); onNavigate(page); } };
  const accountHref = getPagePath ? getPagePath("account") : "/account";
  const bookHref = getPagePath ? getPagePath("book") : "/book";

  return (
    <div className="min-h-[100dvh] flex flex-col" style={{ fontFamily: fontStack(theme.fontFamily), backgroundColor: theme.heroBg }}>
      <SiteHeader salon={salon} theme={theme} current="loyalty" onBack={() => onNavigate?.(null)} getPagePath={getPagePath}
        onNavigate={(page) => onNavigate?.(page)} />
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-5 py-12 sm:py-16">
          <div className="text-center mb-10">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ backgroundColor: `${theme.accentColor}22`, border: `1px solid ${theme.accentColor}44` }}>
              <Gift className="w-7 h-7" style={{ color: theme.accentColor }} />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: theme.accentColor }}>{translateUi("Every visit counts")}</p>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight" style={{ color: text }}>{translateUi("Loyalty")}</h1>
          </div>

          {error && <p role="alert" className="text-center text-sm text-red-600">{error}</p>}
          {!rules && !error && <p role="status" className="text-center text-sm" style={{ color: sub }}>{translateUi("Loading…")}</p>}

          {rules && !rules.enabled && (
            <p className="text-center text-sm" style={{ color: sub }}>{translateUi("{salon} hasn't opened its loyalty programme yet. Check back soon.", { salon: salon.name })}</p>
          )}

          {rules?.enabled && program && (
            <div className="flex flex-col gap-8">
              <section className="rounded-2xl p-5" style={{ backgroundColor: card, border: `1px solid ${border}` }}>
                <h2 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: text }}><Sparkles className="w-4 h-4" style={{ color: theme.accentColor }} />{translateUi("How it works")}</h2>
                <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1" style={{ color: sub }}>
                  <li>{translateUi("Earn {points} for every 1 you spend.", { points: `${program.pointsPerUnit} ${program.pointsPerUnit === 1 ? translateUi("point") : translateUi("points")}` })}</li>
                  {program.earnOnBookings && <li>{translateUi("Points are added when your appointment is completed.")}</li>}
                  {program.earnOnOrders && <li>{translateUi("Shop orders earn points too (not shipping).")}</li>}
                  {program.expiryMonths && <li>{translateUi("Points expire {months} months after you earn them.", { months: program.expiryMonths })}</li>}
                  <li>{translateUi("Sign in to your account to see your balance and redeem rewards.")}</li>
                </ul>
              </section>

              <section>
                <h2 className="text-sm font-bold mb-3" style={{ color: text }}>{translateUi("Rewards")}</h2>
                {rules.rewards.length === 0
                  ? <p className="text-sm" style={{ color: sub }}>{translateUi("Rewards will appear here soon.")}</p>
                  : <div className="grid gap-3 sm:grid-cols-2">
                      {rules.rewards.map((r) => (
                        <div key={r.id} className="rounded-2xl p-4 flex flex-col gap-1" style={{ backgroundColor: card, border: `1px solid ${border}` }}>
                          <p className="text-sm font-semibold" style={{ color: text }}>{r.name}</p>
                          {r.description && <p className="text-xs" style={{ color: sub }}>{r.description}</p>}
                          <p className="mt-auto pt-2 text-xs font-bold tabular-nums" style={{ color: theme.accentColor }}>{r.pointsCost} {translateUi("points")}</p>
                        </div>
                      ))}
                    </div>}
              </section>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <a href={accountHref} onClick={go("account")} className="inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-xl no-underline hover:opacity-90"
                  style={{ backgroundColor: theme.accentColor, color: accentText }}>{translateUi("See my points")} <ArrowRight className="w-4 h-4" /></a>
                {salon.features?.includes("BOOKING") && (
                  <a href={bookHref} onClick={go("book")} className="inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-xl no-underline hover:opacity-80 border"
                    style={{ color: text, borderColor: border }}><CalendarCheck className="w-4 h-4" />{translateUi("Book an appointment")}</a>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
      <SiteFooter salon={salon} theme={theme} current="loyalty" onBack={() => onNavigate?.(null)} getPagePath={getPagePath} policies={policies} />
    </div>
  );
}
