import test from "node:test";
import assert from "node:assert/strict";
import { navigationSearch } from "../app/lib/navigation-search.ts";

test("leaving a checkout return does not carry its result into home or another feature", () => {
  for (const outcome of ["success", "cancel"]) {
    const search = navigationSearch(`?payment=${outcome}&reference=2&session_id=cs_test_example`);
    assert.equal(`/${search}`, "/");
    assert.equal(`/membership${search}`, "/membership");
    assert.equal(`/shop${search}`, "/shop");
  }
});

test("navigation preserves tenant and language parameters but never renewal credentials", () => {
  const search = navigationSearch("?slug=bb&lang=da&renew=private-token&payment=success&session_id=one&session_id=two&reference=2");
  assert.equal(search, "?slug=bb&lang=da");
});

test("normal navigation has no trailing question mark", () => {
  assert.equal(navigationSearch(""), "");
  assert.equal(navigationSearch("?renew=private-token"), "");
});
