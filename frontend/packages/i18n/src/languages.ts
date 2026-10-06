export const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "da", name: "Dansk" },
  { code: "sv", name: "Svenska" },
  { code: "nb", name: "Norsk bokmål" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
] as const;

export type Language = typeof LANGUAGES[number]["code"];
export type LanguagePolicy = { enabled: Language[]; defaultLanguage: Language };
export type SalonLanguages = Record<"website" | "booking" | "dashboard", LanguagePolicy>;
export const ENGLISH_POLICY: LanguagePolicy = { enabled: ["en"], defaultLanguage: "en" };
export const ALL_LANGUAGES: LanguagePolicy = { enabled: LANGUAGES.map(({ code }) => code), defaultLanguage: "en" };

export function normalizeLanguage(value?: string | null): Language | undefined {
  const base = value?.trim().toLowerCase().split(/[-_]/)[0];
  const code = base === "no" ? "nb" : base;
  return LANGUAGES.find((language) => language.code === code)?.code;
}

export function normalizePolicy(value?: LanguagePolicy): LanguagePolicy {
  const enabled = [...new Set(value?.enabled?.filter((code) => LANGUAGES.some((language) => language.code === code)))];
  if (!enabled.length) return ENGLISH_POLICY;
  return { enabled, defaultLanguage: enabled.includes(value!.defaultLanguage) ? value!.defaultLanguage : enabled[0] };
}

/** Explicit choice, saved choice, browser preferences, then the salon's default. */
export function chooseLanguage(policy: LanguagePolicy, requested?: string | null, saved?: string | null,
  browserLanguages: readonly string[] = []): Language {
  const safe = normalizePolicy(policy);
  for (const candidate of [requested, saved, ...browserLanguages]) {
    const language = normalizeLanguage(candidate);
    if (language && safe.enabled.includes(language)) return language;
  }
  return safe.defaultLanguage;
}
