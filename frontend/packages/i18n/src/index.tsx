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

export function LanguageSelector() {
  const { locale, policy, setLanguage, t } = useI18n();
  if (policy.enabled.length < 2) return null;
  return <div style={{ display: "flex", justifyContent: "flex-end", padding: "4px 16px", background: "#fff",
    color: "#334155", borderBottom: "1px solid #e2e8f0", fontFamily: "system-ui, sans-serif" }}>
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
      {t("Language")}
      <select aria-label={t("Language")} value={locale} onChange={(event) => setLanguage(event.target.value as Language)}
        style={{ minHeight: 36, maxWidth: 170, background: "#fff", color: "#334155", border: "1px solid #cbd5e1", borderRadius: 6, padding: "4px 8px" }}>
        {LANGUAGES.filter(({ code }) => policy.enabled.includes(code)).map(({ code, name }) =>
          <option key={code} value={code} lang={code}>{name}</option>)}
      </select>
    </label>
  </div>;
}
