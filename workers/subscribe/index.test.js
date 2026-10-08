import test from "node:test";
import assert from "node:assert/strict";
import worker from "./index.js";

const ENV = { RESEND_API_KEY: "re_test", RESEND_AUDIENCE_ID: "aud_123" };
const ORIGIN = "https://grow2guide.com";
const valid = { email: "jane@example.com", firstName: "Jane", consent: true, source: "/blog/", website: "" };

function req(body, { method = "POST", origin = ORIGIN, raw } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (origin) headers.Origin = origin;
  return new Request("https://subscribe.grow2guide.com/", {
    method,
    headers,
    body: method === "POST" ? (raw !== undefined ? raw : JSON.stringify(body)) : undefined,
  });
}

// Resend's contact model: GET .../contacts/<email> looks a contact up (404 if none),
// POST .../contacts creates or fully replaces one. lookupStatus/lookupBody control the
// GET; createStatus controls the POST.
function stubResend({ lookupStatus = 404, lookupBody, createStatus = 200 } = {}) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const method = (init && init.method) || "GET";
    calls.push({ url, method, init });
    if (method === "GET") {
      return new Response(JSON.stringify(lookupBody || { message: "Contact not found" }), { status: lookupStatus });
    }
    return new Response(JSON.stringify({ id: "c_1" }), { status: createStatus });
  };
  return calls;
}

test("valid signup looks the contact up, then creates it, and returns ok", async () => {
  const calls = stubResend();
  const res = await worker.fetch(req({ ...valid, email: " Jane@Example.COM " }), ENV);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].url, "https://api.resend.com/audiences/aud_123/contacts/jane%40example.com");
  assert.equal(calls[1].method, "POST");
  assert.equal(calls[1].url, "https://api.resend.com/audiences/aud_123/contacts");
  assert.equal(calls[1].init.headers.Authorization, "Bearer re_test");
  assert.deepEqual(JSON.parse(calls[1].init.body), {
    email: "jane@example.com",
    first_name: "Jane",
  });
});

test("never sends the unsubscribed flag on create", async () => {
  const calls = stubResend();
  await worker.fetch(req(valid), ENV);
  const create = calls.find((c) => c.method === "POST");
  assert.equal("unsubscribed" in JSON.parse(create.init.body), false);
});

test("an already-unsubscribed contact is not re-subscribed by a repeat signup", async () => {
  const calls = stubResend({ lookupStatus: 200, lookupBody: { email: "jane@example.com", unsubscribed: true } });
  const res = await worker.fetch(req(valid), ENV);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "GET");
});

test("keeps the existing first name when a later signup omits it", async () => {
  const calls = stubResend({
    lookupStatus: 200,
    lookupBody: { email: "jane@example.com", unsubscribed: false, first_name: "Jane" },
  });
  const res = await worker.fetch(req({ ...valid, firstName: "" }), ENV);
  assert.equal(res.status, 200);
  const create = calls.find((c) => c.method === "POST");
  assert.deepEqual(JSON.parse(create.init.body), { email: "jane@example.com", first_name: "Jane" });
});

test("a new signup's name overrides the stored one when both are given", async () => {
  const calls = stubResend({
    lookupStatus: 200,
    lookupBody: { email: "jane@example.com", unsubscribed: false, first_name: "Old Name" },
  });
  await worker.fetch(req({ ...valid, firstName: "New Name" }), ENV);
  const create = calls.find((c) => c.method === "POST");
  assert.equal(JSON.parse(create.init.body).first_name, "New Name");
});

test("first name is optional and omitted when empty for a new contact", async () => {
  const calls = stubResend();
  const res = await worker.fetch(req({ ...valid, firstName: "  " }), ENV);
  assert.equal(res.status, 200);
  const create = calls.find((c) => c.method === "POST");
  assert.deepEqual(JSON.parse(create.init.body), { email: "jane@example.com" });
});

test("very long first name is truncated to 80 characters", async () => {
  const calls = stubResend();
  const res = await worker.fetch(req({ ...valid, firstName: "A".repeat(5000) }), ENV);
  assert.equal(res.status, 200);
  const create = calls.find((c) => c.method === "POST");
  assert.equal(JSON.parse(create.init.body).first_name.length, 80);
});

test("disallowed origin is rejected without calling Resend", async () => {
  const calls = stubResend();
  const res = await worker.fetch(req(valid, { origin: "https://evil.example" }), ENV);
  assert.equal(res.status, 403);
  assert.equal(calls.length, 0);
});

test("missing Origin header is rejected", async () => {
  const calls = stubResend();
  const res = await worker.fetch(req(valid, { origin: null }), ENV);
  assert.equal(res.status, 403);
  assert.equal(calls.length, 0);
});

test("OPTIONS preflight from an allowed origin returns 204 with CORS headers", async () => {
  const res = await worker.fetch(req(null, { method: "OPTIONS" }), ENV);
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assert.match(res.headers.get("Access-Control-Allow-Methods"), /POST/);
  assert.match(res.headers.get("Access-Control-Allow-Headers"), /Content-Type/);
});

test("GET is not allowed", async () => {
  const res = await worker.fetch(req(null, { method: "GET" }), ENV);
  assert.equal(res.status, 405);
});

test("invalid email returns 400 invalid_email", async () => {
  const calls = stubResend();
  for (const email of ["", "nope", "a@b", "a b@c.com", undefined, 42, "x".repeat(250) + "@example.com"]) {
    const res = await worker.fetch(req({ ...valid, email }), ENV);
    assert.equal(res.status, 400, String(email));
    assert.equal((await res.json()).error, "invalid_email");
  }
  assert.equal(calls.length, 0);
});

test("missing or false consent returns 400 consent_required", async () => {
  const calls = stubResend();
  for (const consent of [false, undefined, "true", 1]) {
    const res = await worker.fetch(req({ ...valid, consent }), ENV);
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, "consent_required");
  }
  assert.equal(calls.length, 0);
});

test("filled honeypot looks like success but stores nothing", async () => {
  const calls = stubResend();
  const res = await worker.fetch(req({ ...valid, website: "http://spam.example" }), ENV);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(calls.length, 0);
});

test("non-object or invalid JSON bodies return 400 invalid_json", async () => {
  const calls = stubResend();
  for (const raw of ["{not json", "null", "[]", '"x"', "42"]) {
    const res = await worker.fetch(req(null, { raw }), ENV);
    assert.equal(res.status, 400, raw);
    assert.equal((await res.json()).error, "invalid_json");
  }
  assert.equal(calls.length, 0);
});

test("Resend lookup error status returns 502 upstream_error without attempting create", async () => {
  const calls = stubResend({ lookupStatus: 500 });
  const res = await worker.fetch(req(valid), ENV);
  assert.equal(res.status, 502);
  assert.equal((await res.json()).error, "upstream_error");
  assert.equal(calls.length, 1);
});

test("Resend create error status returns 502 upstream_error", async () => {
  stubResend({ createStatus: 500 });
  const res = await worker.fetch(req(valid), ENV);
  assert.equal(res.status, 502);
  assert.equal((await res.json()).error, "upstream_error");
});

test("Resend network failure returns 502 upstream_error", async () => {
  globalThis.fetch = async () => {
    throw new Error("network down");
  };
  const res = await worker.fetch(req(valid), ENV);
  assert.equal(res.status, 502);
  assert.equal((await res.json()).error, "upstream_error");
});

test("missing secrets return 500 server_misconfigured", async () => {
  const calls = stubResend();
  const res = await worker.fetch(req(valid), {});
  assert.equal(res.status, 500);
  assert.equal((await res.json()).error, "server_misconfigured");
  assert.equal(calls.length, 0);
});

test("rate limiter rejection returns 429", async () => {
  const calls = stubResend();
  const env = { ...ENV, RATE_LIMITER: { limit: async () => ({ success: false }) } };
  const res = await worker.fetch(req(valid), env);
  assert.equal(res.status, 429);
  assert.equal((await res.json()).error, "rate_limited");
  assert.equal(calls.length, 0);
});

// Welcome email. Resend sends email via POST https://api.resend.com/emails.
const WELCOME_ENV = { ...ENV, WELCOME_FROM: "Grow2Guide <hello@grow2guide.com>" };
const isWelcome = (c) => c.url === "https://api.resend.com/emails";

test("a brand-new contact gets one welcome email after being stored", async () => {
  const calls = stubResend();
  const res = await worker.fetch(req({ ...valid, firstName: "<Jane>" }), WELCOME_ENV);
  assert.equal(res.status, 200);
  assert.equal(calls.length, 3);
  assert.equal(calls[1].url, "https://api.resend.com/audiences/aud_123/contacts");
  const welcome = calls[2];
  assert.ok(isWelcome(welcome));
  assert.equal(welcome.init.headers.Authorization, "Bearer re_test");
  assert.equal(welcome.init.headers["Idempotency-Key"], "welcome/jane@example.com");
  const body = JSON.parse(welcome.init.body);
  assert.equal(body.from, "Grow2Guide <hello@grow2guide.com>");
  assert.deepEqual(body.to, ["jane@example.com"]);
  assert.equal(body.subject, "Welcome to Grow2Guide");
  assert.match(body.text, /^Hi <Jane>,/);
  assert.match(body.html, /Hi &lt;Jane&gt;,/);
  assert.match(body.text, /unsubscribe/);
});

test("the welcome email greets without a name when none is given", async () => {
  const calls = stubResend();
  await worker.fetch(req({ ...valid, firstName: "" }), WELCOME_ENV);
  assert.match(JSON.parse(calls.find(isWelcome).init.body).text, /^Hi,/);
});

test("an existing subscribed contact signing up again gets no welcome email", async () => {
  const calls = stubResend({ lookupStatus: 200, lookupBody: { email: "jane@example.com", unsubscribed: false } });
  const res = await worker.fetch(req(valid), WELCOME_ENV);
  assert.equal(res.status, 200);
  assert.equal(calls.some(isWelcome), false);
});

test("an unsubscribed contact signing up again gets no welcome email", async () => {
  const calls = stubResend({ lookupStatus: 200, lookupBody: { email: "jane@example.com", unsubscribed: true } });
  await worker.fetch(req(valid), WELCOME_ENV);
  assert.equal(calls.some(isWelcome), false);
});

test("no welcome email is sent when WELCOME_FROM is not set", async () => {
  const calls = stubResend();
  await worker.fetch(req(valid), ENV);
  assert.equal(calls.some(isWelcome), false);
});

test("no welcome email is sent when storing the contact fails", async () => {
  const calls = stubResend({ createStatus: 500 });
  const res = await worker.fetch(req(valid), WELCOME_ENV);
  assert.equal(res.status, 502);
  assert.equal(calls.some(isWelcome), false);
});

test("a failed welcome email still returns ok to the visitor", async () => {
  globalThis.fetch = async (url, init) => {
    if (url === "https://api.resend.com/emails") throw new Error("network down");
    const method = (init && init.method) || "GET";
    return new Response("{}", { status: method === "GET" ? 404 : 200 });
  };
  const res = await worker.fetch(req(valid), WELCOME_ENV);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});

test("the welcome email is handed to ctx.waitUntil when the runtime provides it", async () => {
  const calls = stubResend();
  const pending = [];
  const res = await worker.fetch(req(valid), WELCOME_ENV, { waitUntil: (p) => pending.push(p) });
  assert.equal(res.status, 200);
  assert.equal(pending.length, 1);
  await pending[0];
  assert.equal(calls.filter(isWelcome).length, 1);
});
