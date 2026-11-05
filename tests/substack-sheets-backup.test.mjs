import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Load the Apps Script file and pull out its pure helpers.
const src = readFileSync(new URL("../newsletter/substack-sheets-backup.gs", import.meta.url), "utf8");
const gs = new Function(src + "\nreturn { toRow, eventType, subscriberEmail, HEADER, CONFIG };")();

test("finds the subscriber's address and skips Substack's and our own", () => {
  const body = "From Substack <no-reply@substack.com>\nTo grow2guide@gmail.com\n" +
    "Jane.Doe@Example.org just subscribed to Grow2Guide. Manage: https://grow2guide.substack.com/publish";
  assert.equal(gs.subscriberEmail(body), "jane.doe@example.org");
  assert.equal(gs.subscriberEmail("reply to support@email.substack.com or hello@substack.com"), "");
  assert.equal(gs.subscriberEmail("no address here"), "");
  assert.equal(gs.subscriberEmail("ends a sentence: sam@clinic.org."), "sam@clinic.org");
});

test("labels cancellations and unsubscribes, everything else is a subscribe", () => {
  assert.equal(gs.eventType("New free subscriber to Grow2Guide"), "subscribe");
  assert.equal(gs.eventType("Someone unsubscribed from Grow2Guide"), "unsubscribe");
  assert.equal(gs.eventType("A paid subscription was canceled"), "unsubscribe");
});

test("a row keeps the raw email and flags rows with no address for review", () => {
  const date = new Date("2026-11-05T12:00:00Z");
  const row = gs.toRow(date, "New subscriber", "Substack <no-reply@substack.com>", "m1", "jo@x.com subscribed");
  assert.equal(row.length, gs.HEADER.length);
  assert.deepEqual(row, [date, "subscribe", "jo@x.com", "", "New subscriber", "Substack <no-reply@substack.com>", "m1", "jo@x.com subscribed"]);
  const unknown = gs.toRow(date, "New subscriber", "Substack", "m2", "A reader subscribed");
  assert.equal(unknown[2], "");
  assert.equal(unknown[3], "yes");
});

test("very long emails are cut to fit one Sheets cell", () => {
  const row = gs.toRow(new Date(), "New subscriber", "Substack", "m3", "x".repeat(60000));
  assert.equal(row[7].length, gs.CONFIG.MAX_CELL_CHARS + " [cut]".length);
});
