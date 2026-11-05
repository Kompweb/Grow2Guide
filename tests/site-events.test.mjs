import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL("../assets/" + f, import.meta.url), "utf8");

function storage() {
  const data = {};
  return { getItem: (k) => data[k] || null, setItem: (k, v) => { data[k] = v; } };
}

function loadThankYou(search) {
  const win = { location: { search }, sessionStorage: storage() };
  const doc = { readyState: "complete", getElementById: () => null };
  globalThis.URLSearchParams = URLSearchParams;
  new Function("window", "document", read("thank-you.js"))(win, doc);
  return win;
}

test("thank-you page sends one GA4 purchase with value, items and Stripe session id", () => {
  const win = loadThankYou("?item=bundle&session_id=cs_test_123");
  assert.deepEqual(win.dataLayer, [
    { ecommerce: null },
    {
      event: "purchase",
      ecommerce: {
        currency: "USD",
        value: 99,
        transaction_id: "cs_test_123",
        items: [{ item_id: "bundle", item_name: "Both PDF guides (bundle)", price: 99, quantity: 1 }],
      },
    },
  ]);
  win.g2gThankYou.trackPurchase("bundle", "cs_test_123");
  assert.equal(win.dataLayer.length, 2, "a reload in the same tab must not send it again");
});

test("thank-you page without a known item sends nothing", () => {
  assert.equal(loadThankYou("").dataLayer, undefined);
  assert.equal(loadThankYou("?item=unknown").dataLayer, undefined);
});

test("purchase works without a session id and uses the right price per guide", () => {
  const win = loadThankYou("?item=checklist");
  const p = win.dataLayer[1].ecommerce;
  assert.equal(p.value, 67);
  assert.equal(p.items[0].item_id, "toolkit");
  assert.equal("transaction_id" in p, false);
});

for (const [file, leadType] of [["consultation.js", "consultation"], ["quiz-tier-1.js", "quiz_tier_1"], ["quiz-tier-2.js", "quiz_tier_2"]]) {
  test(`${file} pushes generate_lead (${leadType}) before opening the email app`, () => {
    const src = read(file);
    const push = src.indexOf(`event: 'generate_lead', lead_type: '${leadType}'`);
    const mailto = src.indexOf("g2gMail.mailto", push);
    assert.ok(push > 0, "generate_lead push is present");
    assert.ok(mailto > push, "push happens before the mailto navigation");
  });
}
