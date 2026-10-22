import test from "node:test";
import assert from "node:assert/strict";
import { findCountry } from "../../../packages/ui-website/src/countryMatch.ts";

const countries = [
  { name: "Denmark", code: "DK", dialCode: "+45", currencyCode: "DKK", currencyName: null, currencySymbol: null },
  { name: "Sweden", code: "SE", dialCode: "+46", currencyCode: "SEK", currencyName: null, currencySymbol: null },
  { name: "United States", code: "US", dialCode: "+1", currencyCode: "USD", currencyName: null, currencySymbol: null },
];

test("a salon's country name selects its dialling code", () => {
  assert.equal(findCountry(countries, "Denmark")?.dialCode, "+45");
  assert.equal(findCountry(countries, "Sweden")?.dialCode, "+46");
});

test("ISO codes, case and stray whitespace still match", () => {
  assert.equal(findCountry(countries, "dk")?.name, "Denmark");
  assert.equal(findCountry(countries, "  sweden ")?.name, "Sweden");
});

test("an unknown or missing country leaves the default to the phone field's fallback", () => {
  for (const value of [undefined, null, "", "   ", "Atlantis"]) assert.equal(findCountry(countries, value), undefined);
  assert.equal(findCountry([], "Denmark"), undefined);
});
