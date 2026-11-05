import test from "node:test";
import assert from "node:assert/strict";
import worker from "./index.js";

const ORIGIN = "https://grow2guide.com";
const RESULTS_ENV = { RESEND_API_KEY: "re_test", WELCOME_FROM: "G2G <hello@grow2guide.com>" };
const scores = { care: 75, workplace: 38, categories: [75, 75, 75, 75, 38, 38, 38, 38] };
const results = { email: "Jane@Example.com", scores, source: "/self-assessment/", website: "" };

function req(path, body, { method = "POST", origin = ORIGIN, raw } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (origin) headers.Origin = origin;
  return new Request("https://g2g-subscribe.grow2guide.workers.dev" + path, {
    method,
    headers,
    body: method === "POST" ? (raw !== undefined ? raw : JSON.stringify(body)) : undefined,
  });
}
const resultsReq = (body, opts) => req("/results", body, opts);

// Records every outgoing request; Resend answers with `status`.
function stubResend(status = 200) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, method: (init && init.method) || "GET", init });
    return new Response(JSON.stringify({ id: "e_1" }), { status });
  };
  return calls;
}

// ---------- Newsletter signups moved to Substack (POST /) ----------

test("a newsletter signup gets 410 newsletter_moved and touches no list", async () => {
  const calls = stubResend();
  const res = await worker.fetch(
    req("/", { email: "jane@example.com", firstName: "Jane", consent: true, source: "/blog/", website: "" }),
    { ...RESULTS_ENV, RESEND_AUDIENCE_ID: "aud_123" }
  );
  assert.equal(res.status, 410);
  assert.deepEqual(await res.json(), { ok: false, error: "newsletter_moved" });
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assert.equal(calls.length, 0);
});

// ---------- Request checks shared by every path ----------

test("disallowed or missing origin is rejected without calling Resend", async () => {
  for (const origin of ["https://evil.example", null]) {
    const calls = stubResend();
    const res = await worker.fetch(resultsReq(results, { origin }), RESULTS_ENV);
    assert.equal(res.status, 403);
    assert.equal(calls.length, 0);
  }
});

test("OPTIONS preflight from an allowed origin returns 204 with CORS headers", async () => {
  const res = await worker.fetch(resultsReq(null, { method: "OPTIONS" }), RESULTS_ENV);
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assert.match(res.headers.get("Access-Control-Allow-Methods"), /POST/);
  assert.match(res.headers.get("Access-Control-Allow-Headers"), /Content-Type/);
});

test("GET is not allowed", async () => {
  const res = await worker.fetch(resultsReq(null, { method: "GET" }), RESULTS_ENV);
  assert.equal(res.status, 405);
});

test("non-object or invalid JSON bodies return 400 invalid_json", async () => {
  const calls = stubResend();
  for (const raw of ["{not json", "null", "[]", '"x"', "42"]) {
    const res = await worker.fetch(resultsReq(null, { raw }), RESULTS_ENV);
    assert.equal(res.status, 400, raw);
    assert.equal((await res.json()).error, "invalid_json");
  }
  assert.equal(calls.length, 0);
});

test("rate limiter rejection returns 429", async () => {
  const calls = stubResend();
  const env = { ...RESULTS_ENV, RATE_LIMITER: { limit: async () => ({ success: false }) } };
  const res = await worker.fetch(resultsReq(results), env);
  assert.equal(res.status, 429);
  assert.equal((await res.json()).error, "rate_limited");
  assert.equal(calls.length, 0);
});

// ---------- Self-Assessment results email (POST /results) ----------

const isEmail = (c) => c.url === "https://api.resend.com/emails";

test("results: sends one email built from the scores, and touches no contact list", async () => {
  const calls = stubResend();
  const res = await worker.fetch(resultsReq(results), RESULTS_ENV);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(calls.length, 1);
  assert.ok(isEmail(calls[0]));
  const sent = JSON.parse(calls[0].init.body);
  assert.deepEqual(sent.to, ["jane@example.com"]);
  assert.equal(sent.from, RESULTS_ENV.WELCOME_FROM);
  assert.equal(sent.subject, "Your Self-Assessment results");
  assert.match(sent.text, /Care Competence: 75% \(Generally demonstrated\)/);
  assert.match(sent.text, /Workplace Competence: 38% \(Development priority\)/);
  assert.match(sent.text, /Empathy vs\. Emotional Reactivity: 75% \(Generally demonstrated\)/);
  assert.match(sent.text, /Development suggestion: Pick one de-escalation strategy|Development suggestion: Describe one pause/);
  assert.match(sent.text, /We won't email you again\. The free weekly newsletter is at https:\/\/grow2guide\.substack\.com/);
  assert.equal(calls[0].init.headers["Idempotency-Key"], "results/jane@example.com/75-38-75-75-75-75-38-38-38-38");
});

test("results: an old page's newsletter flag signs nobody up", async () => {
  const calls = stubResend();
  const res = await worker.fetch(resultsReq({ ...results, newsletter: true }), { ...RESULTS_ENV, RESEND_AUDIENCE_ID: "aud_123" });
  assert.equal(res.status, 200);
  assert.equal(calls.length, 1);
  assert.ok(isEmail(calls[0]));
});

test("results: only whole percentages from 0 to 100 for all eight categories are accepted", async () => {
  const bad = [
    undefined,
    { ...scores, care: 75.5 },
    { ...scores, workplace: 101 },
    { ...scores, care: "75" },
    { ...scores, categories: scores.categories.slice(0, 7) },
    { ...scores, categories: [...scores.categories.slice(0, 7), "<b>buy now</b>"] },
  ];
  for (const s of bad) {
    const calls = stubResend();
    const res = await worker.fetch(resultsReq({ ...results, scores: s }), RESULTS_ENV);
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { ok: false, error: "invalid_scores" });
    assert.equal(calls.length, 0);
  }
});

test("results: extra text in the request never reaches the email", async () => {
  const calls = stubResend();
  await worker.fetch(resultsReq({ ...results, message: "Click here http://evil.example", scores: { ...scores, note: "spam" } }), RESULTS_ENV);
  const sent = JSON.parse(calls[0].init.body);
  assert.equal(/evil|spam/.test(sent.text + sent.html), false);
});

test("results: rejects a bad email, and pretends success to bots", async () => {
  let calls = stubResend();
  for (const email of ["", "nope", "a@b", undefined, 42, "x".repeat(250) + "@example.com"]) {
    const res = await worker.fetch(resultsReq({ ...results, email }), RESULTS_ENV);
    assert.equal(res.status, 400, String(email));
    assert.deepEqual(await res.json(), { ok: false, error: "invalid_email" });
  }
  assert.equal(calls.length, 0);
  calls = stubResend();
  const res = await worker.fetch(resultsReq({ ...results, website: "bot" }), RESULTS_ENV);
  assert.equal(res.status, 200);
  assert.equal(calls.length, 0);
});

test("results: a failed or unreachable send returns upstream_error", async () => {
  const calls = stubResend(500);
  let res = await worker.fetch(resultsReq(results), RESULTS_ENV);
  assert.equal(res.status, 502);
  assert.deepEqual(await res.json(), { ok: false, error: "upstream_error" });
  assert.equal(calls.length, 1);
  globalThis.fetch = async () => {
    throw new Error("network down");
  };
  res = await worker.fetch(resultsReq(results), RESULTS_ENV);
  assert.equal(res.status, 502);
});

test("results: without a sender address or key the Worker reports misconfiguration", async () => {
  for (const env of [{ RESEND_API_KEY: "re_test" }, { WELCOME_FROM: RESULTS_ENV.WELCOME_FROM }]) {
    const calls = stubResend();
    const res = await worker.fetch(resultsReq(results), env);
    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), { ok: false, error: "server_misconfigured" });
    assert.equal(calls.length, 0);
  }
});

test("results: replies go to REPLY_TO when it is set, and the field is left out when it is not", async () => {
  let calls = stubResend();
  await worker.fetch(resultsReq(results), { ...RESULTS_ENV, REPLY_TO: "grow2guide@gmail.com" });
  assert.equal(JSON.parse(calls[0].init.body).reply_to, "grow2guide@gmail.com");
  assert.equal(JSON.parse(calls[0].init.body).from, RESULTS_ENV.WELCOME_FROM);
  calls = stubResend();
  await worker.fetch(resultsReq(results), RESULTS_ENV);
  assert.equal("reply_to" in JSON.parse(calls[0].init.body), false);
});
