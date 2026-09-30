import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = (await readFile(new URL("./worker.js.tftpl", import.meta.url), "utf8"))
  .replaceAll("${pages_host}", "salonsaas-public.pages.dev")
  .replaceAll("${zone_name}", "salonsaas.org")
  .replaceAll("${api_base_url}", "https://api.salonsaas.org")
  .replaceAll("${custom_domains_enabled}", "true");
const { default: worker } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));

test("platform subdomains preserve paths and bypass domain lookup", async (t) => {
  t.mock.method(globalThis, "fetch", async (request) => {
    assert.equal(request.url, "https://salonsaas-public.pages.dev/team?hello=world");
    assert.equal(request.headers.get("X-Forwarded-Host"), "alice.salonsaas.org");
    return new Response("website");
  });
  assert.equal(await (await worker.fetch(new Request("https://alice.salonsaas.org/team?hello=world"))).text(), "website");
});
test("active customer hostname serves Pages without exposing the origin", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (request) => {
    if (++calls === 1) {
      assert.equal(request, "https://api.salonsaas.org/api/salon/domain/resolve?hostname=www.alice.dk");
      return Response.json({ hostname: "www.alice.dk", salonId: "alice-id" });
    }
    return new Response(null, { status: 302, headers: { Location: "https://salonsaas-public.pages.dev/team" } });
  });
  const response = await worker.fetch(new Request("https://www.alice.dk/"));
  assert.equal(response.headers.get("location"), "https://www.alice.dk/team");
  assert.equal(calls, 2);
});
test("disconnected domain never serves cached Pages content or a query-selected salon", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 404 }));
  const response = await worker.fetch(new Request("https://www.alice.dk/?slug=bob"));
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(fetch.mock.callCount(), 1);
});
test("API outage fails closed", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { throw new Error("timeout"); });
  assert.equal((await worker.fetch(new Request("https://www.alice.dk/"))).status, 503);
});
test("wrong hostname mapping is rejected", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ hostname: "www.bob.dk", salonId: "bob-id" }));
  assert.equal((await worker.fetch(new Request("https://www.alice.dk/"))).status, 404);
});
test("resolve uses a redirect mode Cloudflare Workers support", async (t) => {
  // Workers accept only "follow" | "manual"; anything else (e.g. "error") throws at runtime,
  // which Node's fetch would not catch in these tests.
  let init;
  t.mock.method(globalThis, "fetch", async (_request, options) => {
    init ??= options;
    return Response.json({ hostname: "www.alice.dk", salonId: "alice-id" });
  });
  await worker.fetch(new Request("https://www.alice.dk/"));
  assert.ok(["follow", "manual"].includes(init.redirect), `unsupported redirect mode ${init.redirect}`);
  assert.equal(init.redirect, "manual");
});
test("a redirecting resolve response fails closed", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () =>
    new Response(null, { status: 302, headers: { Location: "https://evil.example/" } }));
  assert.equal((await worker.fetch(new Request("https://www.alice.dk/"))).status, 503);
  assert.equal(fetch.mock.callCount(), 1);
});
test("HTTP redirects preserve the tenant hostname and path", async () => {
  const response = await worker.fetch(new Request("http://alice.salonsaas.org/team"));
  assert.equal(response.status, 308);
  assert.equal(response.headers.get("location"), "https://alice.salonsaas.org/team");
});
