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

// Wires subscribe.js to a fake form, submits it, and returns what reached the dataLayer.
async function submitFakeForm({ inModal, ok }) {
  const listeners = {};
  const field = (value) => ({ value });
  const form = {
    elements: { email: field("a@b.co"), first_name: field(""), consent: { checked: true }, website: field("") },
    querySelector: (sel) => (sel === "[data-status]" ? { style: {} } : { disabled: false }),
    querySelectorAll: () => [],
    addEventListener: (type, fn) => { listeners[type] = fn; },
    closest: (sel) => (sel === "#subscribe-modal" && inModal ? {} : null),
    reset() {},
  };
  const win = { location: { pathname: "/faq/" } };
  const doc = { querySelectorAll: () => [form], dispatchEvent() {} };
  globalThis.CustomEvent = class { constructor(type) { this.type = type; } };
  globalThis.fetch = async () => new Response(JSON.stringify({ ok }), { status: ok ? 200 : 502 });
  new Function("window", "document", src)(win, doc);
  listeners.submit({ preventDefault() {} });
  await new Promise((r) => setTimeout(r, 10));
  return win.dataLayer || [];
}

test("a successful signup pushes newsletter_signup on any page, with its placement", async () => {
  assert.deepEqual(await submitFakeForm({ inModal: false, ok: true }), [{ event: "newsletter_signup", signup_placement: "page" }]);
  assert.deepEqual(await submitFakeForm({ inModal: true, ok: true }), [{ event: "newsletter_signup", signup_placement: "modal" }]);
});

test("a failed signup pushes nothing", async () => {
  assert.deepEqual(await submitFakeForm({ inModal: false, ok: false }), []);
});
