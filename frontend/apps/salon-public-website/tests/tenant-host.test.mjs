import test from "node:test";
import assert from "node:assert/strict";
import { tenantHost } from "../app/lib/tenant-host.ts";

test("existing platform subdomains resolve without accepting an override", () => {
  assert.deepEqual(tenantHost(new URL("https://alice.salonsaas.org/team?slug=bob"), "salonsaas.org"), { slug: "alice", customHostname: null });
});
test("customer domains require an explicit mapping, including www and multi-label suffixes", () => {
  for (const host of ["www.alice.dk", "salon.alice.co.uk", "alice.dk"]) {
    assert.deepEqual(tenantHost(new URL(`https://${host}/?slug=bob`), "salonsaas.org"), { slug: null, customHostname: host });
  }
});
test("reserved and nested platform hosts never select a salon", () => {
  for (const host of ["salonsaas.org", "www.salonsaas.org", "api.salonsaas.org", "customers.salonsaas.org", "one.two.salonsaas.org"]) {
    assert.deepEqual(tenantHost(new URL(`https://${host}/?slug=bob`), "salonsaas.org"), { slug: null, customHostname: null });
  }
});
test("localhost development still supports the slug parameter", () => {
  assert.deepEqual(tenantHost(new URL("http://localhost:5174/?slug=alice"), "salonsaas.org"), { slug: "alice", customHostname: null });
});
