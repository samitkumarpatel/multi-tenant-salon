import test from "node:test";
import assert from "node:assert/strict";
import { feedbackHref } from "../../../packages/ui-website/src/feedbackHref.ts";
import { navigationSearch } from "../app/lib/navigation-search.ts";

test("footer entry replaces a previous stylist source while retaining tenant and language", () => {
  const url = new URL(feedbackHref("/feedback?slug=my-salon&lang=da&source=WEBSITE_STYLIST&staff=12"), "https://salon.test");
  assert.equal(url.searchParams.get("slug"), "my-salon");
  assert.equal(url.searchParams.get("lang"), "da");
  assert.deepEqual(url.searchParams.getAll("source"), ["WEBSITE_FOOTER"]);
  assert.equal(url.searchParams.has("staff"), false);
});

test("stylist entry selects the intended stylist and drops checkout credentials", () => {
  const url = new URL(feedbackHref("/feedback?source=NOTIFICATION&staff=1&renew=secret&session_id=secret&payment=success&reference=order", 42), "https://salon.test");
  assert.deepEqual([...url.searchParams.entries()], [["source", "WEBSITE_STYLIST"], ["staff", "42"]]);
});

test("navigating away clears feedback context", () => {
  assert.equal(navigationSearch("?slug=salon&source=WEBSITE_STYLIST&staff=42&lang=en"), "?slug=salon&lang=en");
});
