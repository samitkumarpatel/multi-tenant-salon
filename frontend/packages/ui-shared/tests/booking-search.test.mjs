import test from "node:test";
import assert from "node:assert/strict";
import { searchBookings } from "../src/bookingSearch.ts";

const bookings = [
  { id: 42, customerName: "Zoë Smith", customerEmail: "zoe@example.test", customerPhone: "+45 12 34 56 78", appointmentDate: "2026-11-02", startTime: "10:00" },
  { id: 4, customerName: "Alex Jensen", customerEmail: "alex@example.test", customerPhone: "+45 98 76 54 32", appointmentDate: "2026-11-01", startTime: "09:00" },
  { id: 43, customerName: "Zoë Green", customerEmail: "green@example.test", customerPhone: null, appointmentDate: "2026-11-03", startTime: "14:00" },
];

test("typing progressively finds names without waiting for a submitted query", () => {
  assert.deepEqual(searchBookings(bookings, "z").results.map(b => b.id), [43, 42]);
  assert.deepEqual(searchBookings(bookings, "zoe sm").results.map(b => b.id), [42]);
  assert.equal(searchBookings(bookings, "unmatched").total, 0);
  assert.deepEqual(searchBookings(bookings, "").results, []);
});

test("booking number, email and formatted phone searches keep exact identifiers", () => {
  assert.deepEqual(searchBookings(bookings, "#42").results.map(b => b.id), [42]);
  assert.deepEqual(searchBookings(bookings, "4").results.map(b => b.id), [4]);
  assert.deepEqual(searchBookings(bookings, "zoe@").results.map(b => b.id), [42]);
  assert.deepEqual(searchBookings(bookings, "+45 12 34").results.map(b => b.id), [42]);
  assert.equal(searchBookings(bookings, "#999").total, 0);
});

test("result limits retain the full match count and never mutate the source list", () => {
  const original = [...bookings];
  const result = searchBookings(bookings, "zoe", 1);
  assert.equal(result.total, 2);
  assert.equal(result.results.length, 1);
  assert.deepEqual(bookings, original);
});
