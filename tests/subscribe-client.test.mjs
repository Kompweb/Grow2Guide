import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../assets/subscribe.js", import.meta.url), "utf8");
const win = {};
new Function("window", "document", src)(win, { querySelectorAll: () => [] });
const { validate, buildPayload } = win.g2gSubscribe;

test("validate accepts a good email with consent", () => {
  assert.deepEqual(validate({ email: " jane@example.com ", consent: true }), {});
});

test("validate flags bad emails and missing consent", () => {
  assert.equal(validate({ email: "", consent: true }).email.length > 0, true);
  assert.equal(validate({ email: "nope", consent: true }).email.length > 0, true);
  assert.equal(validate({ email: "a@b.co", consent: false }).consent.length > 0, true);
  assert.deepEqual(Object.keys(validate({})).sort(), ["consent", "email"]);
});

test("buildPayload trims fields and always sets consent true", () => {
  assert.deepEqual(
    buildPayload({ email: " a@b.co ", firstName: " Jane ", consent: true, website: "" }, "/blog/"),
    { email: "a@b.co", firstName: "Jane", consent: true, source: "/blog/", website: "" }
  );
});

test("buildPayload passes the honeypot value through", () => {
  assert.equal(buildPayload({ email: "a@b.co", website: "spam" }, "/").website, "spam");
});
