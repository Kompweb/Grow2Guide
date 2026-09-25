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

function stubResend(status = 200) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ id: "c_1" }), { status });
  };
  return calls;
}

test("valid signup creates a Resend contact and returns ok", async () => {
  const calls = stubResend();
  const res = await worker.fetch(req({ ...valid, email: " Jane@Example.COM " }), ENV);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.resend.com/audiences/aud_123/contacts");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers.Authorization, "Bearer re_test");
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    email: "jane@example.com",
    first_name: "Jane",
  });
});

test("never sends the unsubscribed flag, so a repeat signup cannot re-subscribe someone who opted out", async () => {
  const calls = stubResend();
  await worker.fetch(req(valid), ENV);
  assert.equal("unsubscribed" in JSON.parse(calls[0].init.body), false);
});

test("first name is optional and omitted when empty", async () => {
  const calls = stubResend();
  const res = await worker.fetch(req({ ...valid, firstName: "  " }), ENV);
  assert.equal(res.status, 200);
  assert.deepEqual(JSON.parse(calls[0].init.body), { email: "jane@example.com" });
});

test("very long first name is truncated to 80 characters", async () => {
  const calls = stubResend();
  const res = await worker.fetch(req({ ...valid, firstName: "A".repeat(5000) }), ENV);
  assert.equal(res.status, 200);
  assert.equal(JSON.parse(calls[0].init.body).first_name.length, 80);
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

test("Resend error status returns 502 upstream_error", async () => {
  stubResend(500);
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
