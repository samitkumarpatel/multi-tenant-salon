import test from "node:test";
import assert from "node:assert/strict";
import { LANGUAGES, ALL_LANGUAGES, ENGLISH_POLICY, chooseLanguage, normalizeLanguage, normalizePolicy } from "../src/languages.ts";
import { translate } from "../src/translate.ts";
import { messages } from "../src/messages.ts";

test("all six languages are available for platform apps", () => {
  assert.deepEqual(ALL_LANGUAGES.enabled, ["en", "da", "sv", "nb", "fr", "de"]);
  assert.equal(normalizeLanguage("no-NO"), "nb");
  assert.equal(normalizeLanguage("sv-SE"), "sv");
  assert.equal(normalizeLanguage("da_DK"), "da");
  assert.equal(normalizeLanguage("es"), undefined);
});

test("explicit, saved, and browser choices never enable an unpublished language", () => {
  const policy = { enabled: ["da", "de"], defaultLanguage: "da" };
  assert.equal(chooseLanguage(policy, "fr", "sv", ["en", "de-DE"]), "de");
  assert.equal(chooseLanguage(policy, "fr", "sv", ["en"]), "da");
  assert.equal(chooseLanguage(policy, "de-DE", "da", ["da-DK"]), "de");
  assert.equal(chooseLanguage(policy, null, "de", ["da"]), "de");
  assert.equal(chooseLanguage(ENGLISH_POLICY, "de", "de", ["de"]), "en");
});

test("removing a previously saved language selects an enabled fallback", () => {
  assert.equal(chooseLanguage({ enabled: ["fr"], defaultLanguage: "fr" }, "da", "da"), "fr");
  assert.deepEqual(normalizePolicy({ enabled: [], defaultLanguage: "de" }), ENGLISH_POLICY);
  assert.deepEqual(normalizePolicy({ enabled: ["da", "da"], defaultLanguage: "de" }), { enabled: ["da"], defaultLanguage: "da" });
});

test("translations preserve interpolation values, spacing, and English fallback", () => {
  assert.equal(translate("da", "Save"), "Gem");
  assert.equal(translate("de", " Cancel "), " Abbrechen ");
  assert.equal(translate("fr", "Book at {name}", { name: "Anna's Salon <3>" }), "Réserver chez Anna's Salon <3>");
  assert.equal(translate("sv", "A missing message {count}", { count: 3 }), "A missing message 3");
  assert.equal(translate("en", "Save"), "Save");
});

test("every catalog entry supplies all five translations and preserves placeholders", () => {
  for (const [key, translations] of Object.entries(messages)) {
    const placeholders = (key.match(/\{\w+\}/g) ?? []).sort();
    for (const { code } of LANGUAGES.filter(({ code }) => code !== "en")) {
      assert.ok(translations[code]?.trim(), `${code}: ${key}`);
      assert.deepEqual((translations[code].match(/\{\w+\}/g) ?? []).sort(), placeholders, `${code}: ${key}`);
    }
  }
});
