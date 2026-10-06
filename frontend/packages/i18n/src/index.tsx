import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ALL_LANGUAGES, LANGUAGES, chooseLanguage, normalizePolicy } from "./languages";
import type { Language, LanguagePolicy } from "./languages";
import { translate } from "./translate";

export * from "./languages";
export { translate } from "./translate";

type I18n = {
  locale: Language;
  policy: LanguagePolicy;
  setLanguage: (language: Language) => void;
  t: (message: string, values?: Record<string, string | number>) => string;
  plural: (one: string, other: string, count: number) => string;
};

const Context = createContext<I18n>({ locale: "en", policy: ALL_LANGUAGES, setLanguage: () => {},
  t: (message, values) => translate("en", message, values),
  plural: (one, other, count) => translate("en", count === 1 ? one : other, { count }) });

export function I18nProvider({ children, policy = ALL_LANGUAGES, scope }: {
  children: ReactNode; policy?: LanguagePolicy; scope: string;
}) {
  const normalized = normalizePolicy(policy);
  const signature = JSON.stringify(normalized);
  const safePolicy = useMemo(() => normalized, [signature]);
  const storageKey = `salon:language:${scope}`;
  const [selection, setSelection] = useState<{ key: string; language: Language }>();
  const locale = selection?.key === storageKey && safePolicy.enabled.includes(selection.language)
    ? selection.language : safePolicy.defaultLanguage;

  // Resolve browser state after hydration, so static/SSR markup is deterministic.
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(storageKey); } catch { /* Storage may be disabled. */ }
    const language = chooseLanguage(safePolicy, new URLSearchParams(window.location.search).get("lang"), saved, navigator.languages);
    setSelection({ key: storageKey, language });
  }, [storageKey, safePolicy]);

  useEffect(() => { document.documentElement.lang = locale; }, [locale]);

  const value = useMemo<I18n>(() => ({
    locale, policy: safePolicy,
    t: (message, values) => translate(locale, message, values),
    plural: (one, other, count) => translate(locale, new Intl.PluralRules(locale).select(count) === "one" ? one : other, { count }),
    setLanguage(language) {
      if (!safePolicy.enabled.includes(language)) return;
      setSelection({ key: storageKey, language });
      try { localStorage.setItem(storageKey, language); } catch { /* Keep in-memory choice. */ }
      // Keep an explicit shared link consistent with the user's selection.
      const url = new URL(window.location.href);
      if (url.searchParams.has("lang")) {
        url.searchParams.set("lang", language);
        window.history.replaceState(window.history.state, "", url);
      }
    },
  }), [locale, safePolicy, storageKey]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useI18n() { return useContext(Context); }

export function Trans({ text, values }: { text: string; values?: Record<string, string | number> }) {
  return <>{useI18n().t(text, values)}</>;
}

export function LanguageSelector({ compact = false, floating = false }: { compact?: boolean; floating?: boolean }) {
  const { locale, policy, setLanguage, t } = useI18n();
  if (policy.enabled.length < 2) return null;
  if (compact) {
    const flags: Record<Language, string> = { en: "🇬🇧", da: "🇩🇰", sv: "🇸🇪", nb: "🇳🇴", fr: "🇫🇷", de: "🇩🇪" };
    const englishNames: Record<Language, string> = { en: "English", da: "Danish", sv: "Swedish", nb: "Norwegian", fr: "French", de: "German" };
    return <details style={{ position: floating ? "fixed" : "relative", top: floating ? 8 : undefined,
      right: floating ? 16 : undefined, zIndex: floating ? 1000 : undefined, display: "inline-block",
      width: "fit-content", fontFamily: "system-ui, sans-serif" }}>
      <summary aria-label={`${t("Language")}: ${englishNames[locale]}`} title={`${t("Language")}: ${englishNames[locale]}`}
        style={{ listStyle: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 36, padding: "0 8px",
          border: "1px solid #cbd5e1", borderRadius: 6, background: "#fff", color: "#334155", cursor: "pointer", fontSize: 13 }}>
        <span aria-hidden="true">{flags[locale]}</span><span>{locale.toUpperCase()}</span>
      </summary>
      <div
        style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 100, minWidth: 224, padding: 6,
          border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", boxShadow: "0 8px 24px rgba(15, 23, 42, .14)" }}>
        <p style={{ margin: 0, padding: "7px 9px 8px", color: "#64748b", fontSize: 11, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase" }}>
          {t("Display language")}
        </p>
        {LANGUAGES.filter(({ code }) => policy.enabled.includes(code)).map(({ code, name }) => {
          const selected = locale === code;
          return <button key={code} type="button" aria-pressed={selected}
            onClick={(event) => { setLanguage(code); event.currentTarget.closest("details")?.removeAttribute("open"); }}
            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 42, padding: "6px 9px",
              border: 0, borderRadius: 5, background: selected ? "#f1f5f9" : "transparent", color: "#334155",
              textAlign: "left", cursor: "pointer", fontSize: 13 }}>
            <span aria-hidden="true" style={{ fontSize: 15 }}>{flags[code]}</span>
            <span style={{ display: "flex", flex: 1, flexDirection: "column", gap: 1 }}>
              <span>{name}</span>
              {code !== "en" && <span style={{ color: "#94a3b8", fontSize: 11 }}>{englishNames[code]}</span>}
            </span>
            {selected && <span aria-hidden="true" style={{ color: "#567330", fontWeight: 700 }}>✓</span>}
          </button>;
        })}
      </div>
    </details>;
  }
  return <div style={{ display: "flex", justifyContent: "flex-end", padding: "4px 16px", background: "#fff",
    color: "#334155", borderBottom: "1px solid #e2e8f0", fontFamily: "system-ui, sans-serif" }}>
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
      {!compact && t("Language")}
      <select aria-label={t("Language")} value={locale} onChange={(event) => setLanguage(event.target.value as Language)}
        style={{ minHeight: 36, maxWidth: 170, background: "#fff", color: "#334155", border: "1px solid #cbd5e1", borderRadius: 6, padding: "4px 8px" }}>
        {LANGUAGES.filter(({ code }) => policy.enabled.includes(code)).map(({ code, name }) =>
          <option key={code} value={code} lang={code}>{name}</option>)}
      </select>
    </label>
  </div>;
}
