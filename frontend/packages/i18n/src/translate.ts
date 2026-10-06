import type { Language } from "./languages.ts";
import { messages, normalizedMessages } from "./messages.ts";

export function translate(language: Language, message: string, values: Record<string, string | number> = {}): string {
  const key = message.trim();
  const value = (messages[key] ?? normalizedMessages[key.toLowerCase()])?.[language as Exclude<Language, "en">];
  const translated = language === "en" || !value ? message : message.replace(key, () => value);
  return translated.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
    Object.hasOwn(values, key) ? String(values[key]) : placeholder);
}
