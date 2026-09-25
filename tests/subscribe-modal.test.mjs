import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../assets/subscribe-modal.js", import.meta.url), "utf8");
const win = {};
new Function("window", "document", src)(win, { getElementById: () => null });
const { canShow, parseState } = win.g2gSubscribeModal;

test("parseState handles missing, garbage, and partial storage", () => {
  const empty = { subscribed: false, snoozedUntil: 0 };
  assert.deepEqual(parseState(null), empty);
  assert.deepEqual(parseState(""), empty);
  assert.deepEqual(parseState("{not json"), empty);
  assert.deepEqual(parseState("42"), empty);
  assert.deepEqual(parseState('{"subscribed":"yes","snoozedUntil":"soon"}'), empty);
  assert.deepEqual(parseState('{"subscribed":true,"snoozedUntil":123}'), { subscribed: true, snoozedUntil: 123 });
});

test("canShow is true for a fresh visitor", () => {
  assert.equal(canShow({ subscribed: false, snoozedUntil: 0 }, 1000), true);
});

test("canShow is false for subscribers, forever", () => {
  assert.equal(canShow({ subscribed: true, snoozedUntil: 0 }, 1e15), false);
});

test("canShow is false while snoozed and true once the snooze ends", () => {
  assert.equal(canShow({ subscribed: false, snoozedUntil: 5000 }, 4999), false);
  assert.equal(canShow({ subscribed: false, snoozedUntil: 5000 }, 5000), true);
});
