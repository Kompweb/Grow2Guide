# Newsletter Subscribe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let visitors subscribe to a Grow2Guide newsletter from the static site (inline block plus a modal shown on exit intent or after a long pause), store them in a Resend Audience via a Cloudflare Worker, and provide newsletter data (schema, issue template, first issue, CSV export).

**Architecture:** A shared subscribe block (`components/subscribe-form.html`) is injected above the footer on eligible pages by an extended `scripts/sync-footer.py`. A second shared component (`components/subscribe-modal.html`) is a `<dialog>` opened by `assets/subscribe-modal.js` on desktop exit intent or after 45 seconds of inactivity. `assets/subscribe.js` validates and POSTs JSON to a Cloudflare Worker (`workers/subscribe/`), which holds the Resend API key and creates the contact in a Resend Audience. Newsletters are written as HTML in `newsletter/` and sent as Resend Broadcasts.

**Tech Stack:** Plain HTML/CSS/JS (Tailwind CDN already on every page), Cloudflare Workers (ES modules, `node:test` for tests, `wrangler` for deploy), Resend REST API, Python 3.9 stdlib for scripts.

**Spec:** `docs/superpowers/specs/2026-09-25-newsletter-subscribe-design.md`

## Global Constraints

- Site stays static on GitHub Pages: no build step, no npm install for the site itself.
- The Resend API key and audience ID never appear in site files or git; they are Worker secrets (`RESEND_API_KEY`, `RESEND_AUDIENCE_ID`).
- Worker allowed origins: `https://grow2guide.com`, `https://www.grow2guide.com`, `http://localhost:8000`.
- Code style: 2-space indent, double quotes and semicolons for JS in `workers/`; existing `assets/*.js` files use single quotes and `var`/IIFE, so `assets/subscribe.js` follows that style.
- Commit messages: short, imperative, ending with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Only `git add` the files named in each task. `services/index.html` and `docs/superpowers/specs/2026-09-25-guides-landing-page-design.md` have unrelated uncommitted changes; never stage them.
- Pages without the subscribe block or modal: `quiz/`, `consultation/`, `thank-you/` (transactional flows; a popup would interrupt a visitor mid-form).
- Modal timing (constants at the top of `assets/subscribe-modal.js`): idle trigger 45000 ms of no mouse, key, scroll, or touch activity; exit-intent ignored for the first 8000 ms after load; dismissal snoozes the modal for 14 days; a successful subscription suppresses it permanently; at most one showing per page load.

## Review Focus

- Email with surrounding whitespace or uppercase letters (`" Jane@Example.COM "`): stored trimmed and lowercased. Tested in Task 1.
- Very long first name (thousands of characters): truncated to 80, request still succeeds. Tested in Task 1.
- Request body that is valid JSON but not an object (`null`, `[]`, `"x"`): 400, not a crash. Tested in Task 1.
- Bot fills the honeypot: looks like success, nothing stored. Tested in Task 1.
- Resend is down or the fetch throws: visitor sees a retryable error and keeps what they typed. Tested in Task 1 (Worker returns 502) and Task 2 (client keeps values).
- Same email subscribing twice: success response both times. Verified manually in Task 1 Step 8 (Resend upserts contacts).
- Someone already subscribed (via the footer block or the modal) or who dismissed the modal recently must not see it again. Tested in Task 3 (`canShow`).
- Storage blocked (private mode): modal still shows at most once per page load and nothing throws. Tested in Task 3.
- Visitor is typing in a field or the tab is in the background when the idle timer fires: the modal waits instead of interrupting. Checked in Task 3 Step 9.
- Phones and tablets have no exit intent: only the idle trigger applies there. Checked in Task 3 Step 9.

---

### Task 1: Cloudflare Worker

**Files:**
- Create: `workers/subscribe/package.json`
- Create: `workers/subscribe/index.js`
- Create: `workers/subscribe/index.test.js`
- Create: `workers/subscribe/wrangler.toml`
- Create: `workers/subscribe/README.md`

**Interfaces:**
- Produces: HTTP `POST /` accepting JSON `{ email: string, firstName?: string, consent: true, source?: string, website?: string }`; responds `{ ok: true }` (200) or `{ ok: false, error: "<code>" }`. Error codes: `forbidden` 403, `method_not_allowed` 405, `rate_limited` 429, `invalid_json` 400, `consent_required` 400, `invalid_email` 400, `server_misconfigured` 500, `upstream_error` 502. CORS headers are returned for allowed origins. Task 2 depends on this contract.

- [ ] **Step 1: Create `workers/subscribe/package.json`**

```json
{
  "name": "g2g-subscribe-worker",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Write the failing tests in `workers/subscribe/index.test.js`**

```js
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
    unsubscribed: false,
  });
});

test("first name is optional and omitted when empty", async () => {
  const calls = stubResend();
  const res = await worker.fetch(req({ ...valid, firstName: "  " }), ENV);
  assert.equal(res.status, 200);
  assert.deepEqual(JSON.parse(calls[0].init.body), { email: "jane@example.com", unsubscribed: false });
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
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd workers/subscribe && node --test`
Expected: FAIL (`Cannot find module './index.js'` or similar).

- [ ] **Step 4: Implement `workers/subscribe/index.js`**

```js
const ALLOWED_ORIGINS = new Set([
  "https://grow2guide.com",
  "https://www.grow2guide.com",
  "http://localhost:8000",
]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL = 254;
const MAX_NAME = 80;
const MAX_SOURCE = 200;

function reply(status, body, origin) {
  const headers = { "Content-Type": "application/json" };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
    headers["Access-Control-Max-Age"] = "86400";
    headers["Vary"] = "Origin";
  }
  return new Response(body === null ? null : JSON.stringify(body), { status, headers });
}

function fail(status, error, origin) {
  return reply(status, { ok: false, error }, origin);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    if (!origin || !ALLOWED_ORIGINS.has(origin)) return fail(403, "forbidden");
    if (request.method === "OPTIONS") return reply(204, null, origin);
    if (request.method !== "POST") return fail(405, "method_not_allowed", origin);

    if (!env.RESEND_API_KEY || !env.RESEND_AUDIENCE_ID) {
      console.error("Missing RESEND_API_KEY or RESEND_AUDIENCE_ID");
      return fail(500, "server_misconfigured", origin);
    }

    if (env.RATE_LIMITER) {
      const key = request.headers.get("CF-Connecting-IP") || "unknown";
      const { success } = await env.RATE_LIMITER.limit({ key });
      if (!success) return fail(429, "rate_limited", origin);
    }

    let data;
    try {
      data = await request.json();
    } catch (e) {
      return fail(400, "invalid_json", origin);
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return fail(400, "invalid_json", origin);
    }

    // Honeypot: real visitors never fill this field. Pretend success so bots move on.
    if (typeof data.website === "string" && data.website.trim() !== "") {
      return reply(200, { ok: true }, origin);
    }

    if (data.consent !== true) return fail(400, "consent_required", origin);

    const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
    if (!email || email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
      return fail(400, "invalid_email", origin);
    }

    const firstName = typeof data.firstName === "string" ? data.firstName.trim().slice(0, MAX_NAME) : "";
    const source = typeof data.source === "string" ? data.source.slice(0, MAX_SOURCE) : "";

    const contact = { email, unsubscribed: false };
    if (firstName) contact.first_name = firstName;

    try {
      const res = await fetch(
        "https://api.resend.com/audiences/" + encodeURIComponent(env.RESEND_AUDIENCE_ID) + "/contacts",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + env.RESEND_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(contact),
        }
      );
      if (!res.ok) {
        console.error("Resend responded " + res.status);
        return fail(502, "upstream_error", origin);
      }
    } catch (e) {
      console.error("Resend request failed");
      return fail(502, "upstream_error", origin);
    }

    // Consent record. The email address is deliberately not logged.
    console.log(JSON.stringify({ event: "subscribed", source, consentAt: new Date().toISOString() }));
    return reply(200, { ok: true }, origin);
  },
};
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd workers/subscribe && node --test`
Expected: all tests PASS (16 passing, 0 failing).

- [ ] **Step 6: Create `workers/subscribe/wrangler.toml`**

```toml
name = "g2g-subscribe"
main = "index.js"
compatibility_date = "2026-09-01"

# Serves the Worker at https://subscribe.grow2guide.com (needs grow2guide.com DNS on Cloudflare).
# If the domain is not on Cloudflare, delete this block and use the workers.dev URL instead
# (see README.md).
routes = [{ pattern = "subscribe.grow2guide.com", custom_domain = true }]

# At most 5 signups per minute per IP.
[[unsafe.bindings]]
name = "RATE_LIMITER"
type = "ratelimit"
namespace_id = "1001"
simple = { limit = 5, period = 60 }
```

- [ ] **Step 7: Create `workers/subscribe/README.md`**

````markdown
# Subscribe Worker

Receives newsletter signups from grow2guide.com and adds them to a Resend Audience.
The Resend API key lives only in Cloudflare as a secret.

## Request contract

`POST /` with JSON `{ "email", "firstName"?, "consent": true, "source"?, "website"? }`.
Responds `{ "ok": true }` or `{ "ok": false, "error": "<code>" }`.
`website` is a honeypot: leave it empty.

## One-time setup

1. In Resend: verify your sending domain, create an Audience, copy its ID, create an API key.
2. In this folder:

```sh
npx wrangler login
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put RESEND_AUDIENCE_ID
npx wrangler deploy
```

3. If grow2guide.com is not on Cloudflare DNS, delete the `routes` line in `wrangler.toml`
   before deploying. Wrangler prints a `https://g2g-subscribe.<account>.workers.dev` URL;
   put that URL in `ENDPOINT` at the top of `assets/subscribe.js`.

## Local development and tests

```sh
npm test                      # unit tests, no network needed
npx wrangler dev              # local Worker on http://localhost:8787
```

For `wrangler dev`, create `.dev.vars` (git-ignored) with `RESEND_API_KEY=...` and
`RESEND_AUDIENCE_ID=...`, then:

```sh
curl -i -X POST http://localhost:8787/ \
  -H "Origin: http://localhost:8000" -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","firstName":"You","consent":true,"source":"/test/"}'
```

Consent records (source page and timestamp, no email) appear in `npx wrangler tail`.
````

- [ ] **Step 8: Verify against real Resend (skip if no Resend key yet; note it in the handoff)**

Run `.dev.vars` setup and `npx wrangler dev`, then run the curl from the README twice with the same email.
Expected: both return `{"ok":true}` with HTTP 200, and one contact appears in the Resend Audience. If Resend returns an error, check the current "Create Contact" docs at https://resend.com/docs/api-reference/contacts/create-contact and adjust the URL or body in `index.js` and the first test.

- [ ] **Step 9: Ignore local secrets and commit**

```bash
printf '.dev.vars\n.wrangler/\n' >> .gitignore
git add .gitignore workers/subscribe
git commit -m "Add newsletter subscribe Cloudflare Worker

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Subscribe form, client script, and page placement

**Files:**
- Create: `components/subscribe-form.html`
- Create: `assets/subscribe.js`
- Create: `tests/subscribe-client.test.mjs`
- Modify: `scripts/sync-footer.py` (whole file replaced below)
- Modify (via the sync script): every live `index.html` except `quiz/`, `consultation/`, `thank-you/`, plus `components/blog-post-template.html`

**Interfaces:**
- Consumes: Worker contract from Task 1 (`POST` JSON, `{ ok }` response).
- Produces: `window.g2gSubscribe = { validate(values) -> { email?, consent? }, buildPayload(values, source) -> object }`; `python3 scripts/sync-footer.py [--check]` now also keeps the subscribe block and `subscribe.js` script tag in sync.

- [ ] **Step 1: Write the failing client test `tests/subscribe-client.test.mjs`**

```js
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/subscribe-client.test.mjs`
Expected: FAIL (`ENOENT ... assets/subscribe.js`).

- [ ] **Step 3: Create `assets/subscribe.js`**

```js
(function () {
  var ENDPOINT = 'https://subscribe.grow2guide.com/';
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function validate(values) {
    var errors = {};
    if (!EMAIL_RE.test((values.email || '').trim())) errors.email = 'Enter a valid email address.';
    if (!values.consent) errors.consent = 'Please tick the box to subscribe.';
    return errors;
  }

  function buildPayload(values, source) {
    return {
      email: (values.email || '').trim(),
      firstName: (values.firstName || '').trim(),
      consent: true,
      source: source,
      website: values.website || ''
    };
  }

  window.g2gSubscribe = { validate: validate, buildPayload: buildPayload };

  function wire(form) {
    var status = form.querySelector('[data-status]');
    var button = form.querySelector('button[type="submit"]');

    function read() {
      return {
        email: form.elements['email'].value,
        firstName: form.elements['first_name'].value,
        consent: form.elements['consent'].checked,
        website: form.elements['website'].value
      };
    }

    function showErrors(errors) {
      form.querySelectorAll('[data-error]').forEach(function (el) {
        var message = errors[el.getAttribute('data-error')] || '';
        el.textContent = message;
        el.hidden = !message;
      });
    }

    function setStatus(message, ok) {
      status.textContent = message;
      status.style.color = ok ? '#0F766E' : '#B42318';
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var values = read();
      var errors = validate(values);
      showErrors(errors);
      setStatus('', true);
      if (Object.keys(errors).length) return;

      button.disabled = true;
      button.textContent = 'Subscribing…';

      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(values, window.location.pathname))
      })
        .then(function (res) {
          return res.json().then(
            function (body) { return res.ok && body.ok === true; },
            function () { return false; }
          );
        })
        .catch(function () { return false; })
        .then(function (ok) {
          button.disabled = false;
          button.textContent = 'Subscribe';
          if (ok) {
            form.reset();
            setStatus('Thanks! You are subscribed.', true);
            document.dispatchEvent(new CustomEvent('g2g:subscribed'));
          } else {
            // Leave the fields filled in so the visitor can retry.
            setStatus('Something went wrong. Please try again in a moment.', false);
          }
        });
    });
  }

  if (typeof document !== 'undefined') {
    document.querySelectorAll('form[data-g2g-subscribe]').forEach(wire);
  }
})();
```

- [ ] **Step 4: Run the client tests to verify they pass, and syntax-check**

Run: `node --test tests/subscribe-client.test.mjs && node --check assets/subscribe.js`
Expected: 4 tests PASS, no syntax errors.

- [ ] **Step 5: Create `components/subscribe-form.html`**

```html
<!-- subscribe:start -->
<section id="subscribe" aria-labelledby="subscribe-title" class="bg-[#F7FBF9] border-t border-[#0F766E]/12">
      <div class="container-custom max-w-3xl py-14 text-center">
        <h2 id="subscribe-title" class="text-2xl lg:text-3xl font-bold tracking-tight text-[#12201C] mb-3">Get new guides by email</h2>
        <p class="text-[#5A6A63] leading-relaxed mb-8">Practical guidance for behavioral health professionals, sent occasionally. Unsubscribe anytime.</p>
        <form data-g2g-subscribe novalidate class="text-left max-w-xl mx-auto">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label for="subscribe-first-name" class="block text-sm font-semibold text-[#12201C] mb-1">First name <span class="font-normal text-[#5A6A63]">(optional)</span></label>
              <input id="subscribe-first-name" name="first_name" type="text" autocomplete="given-name" maxlength="80" class="w-full h-[48px] px-4 rounded-xl border border-[#0F766E]/25 bg-white text-[#12201C] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/40" />
            </div>
            <div>
              <label for="subscribe-email" class="block text-sm font-semibold text-[#12201C] mb-1">Email</label>
              <input id="subscribe-email" name="email" type="email" autocomplete="email" inputmode="email" required class="w-full h-[48px] px-4 rounded-xl border border-[#0F766E]/25 bg-white text-[#12201C] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/40" />
              <p data-error="email" hidden class="text-sm mt-1" style="color:#B42318"></p>
            </div>
          </div>
          <div style="position:absolute;left:-9999px;" aria-hidden="true">
            <label>Website <input name="website" type="text" tabindex="-1" autocomplete="off" /></label>
          </div>
          <label class="flex items-start gap-3 text-sm text-[#5A6A63] leading-relaxed mb-1">
            <input name="consent" type="checkbox" class="mt-1 w-4 h-4 accent-[#0F766E]" />
            <span>I agree to receive Grow2Guide emails and understand I can unsubscribe at any time. See the <a href="/privacy/" class="text-[#0F766E] font-semibold underline">privacy page</a>.</span>
          </label>
          <p data-error="consent" hidden class="text-sm mb-3" style="color:#B42318"></p>
          <button type="submit" class="mt-4 w-full sm:w-auto bg-[#0F766E] text-white h-[52px] px-8 rounded-full font-bold hover:bg-[#0B5F59] transition-all disabled:opacity-60">Subscribe</button>
          <p data-status role="status" aria-live="polite" class="mt-3 text-sm font-semibold"></p>
        </form>
      </div>
    </section>
<!-- subscribe:end -->
```

- [ ] **Step 6: Replace `scripts/sync-footer.py`**

```python
"""Copy the shared footer and subscribe block into live pages; use --check to detect drift."""
from pathlib import Path
import re
import sys

root = Path(__file__).resolve().parents[1]
footer = (root / "components/footer.html").read_text().strip()
subscribe = (root / "components/subscribe-form.html").read_text().strip()
stylesheet = '  <link rel="stylesheet" href="/assets/footer.css" />'
subscribe_script = '  <script src="/assets/subscribe.js" defer></script>'
# Transactional flows keep a clean page without a newsletter prompt.
NO_SUBSCRIBE = {"quiz", "consultation", "thank-you"}
check = "--check" in sys.argv
outdated = []
pages = sorted(root.rglob("index.html")) + [root / "components/blog-post-template.html"]
for page in pages:
    rel = page.relative_to(root)
    if any(part in {"archive", "node_modules", ".git"} for part in rel.parts):
        continue
    original = page.read_text()
    updated, count = re.subn(r"<footer\b.*?</footer>", lambda _: footer, original, flags=re.S)
    if count != 1:
        raise SystemExit(f"Expected one footer in {rel}, found {count}")
    if stylesheet not in updated:
        updated = updated.replace("</head>", stylesheet + "\n</head>", 1)
    if rel.parts[0] not in NO_SUBSCRIBE:
        if "<!-- subscribe:start -->" in updated:
            updated = re.sub(
                r"<!-- subscribe:start -->.*?<!-- subscribe:end -->",
                lambda _: subscribe,
                updated,
                flags=re.S,
            )
        else:
            updated = updated.replace("<footer", subscribe + "\n    <footer", 1)
        if subscribe_script not in updated:
            updated = updated.replace("</head>", subscribe_script + "\n</head>", 1)
    if updated != original:
        outdated.append(str(rel))
        if not check:
            page.write_text(updated)

if check and outdated:
    raise SystemExit("Footers need syncing: " + ", ".join(outdated))
print("Shared footers verified." if check else f"Updated {len(outdated)} pages.")
```

- [ ] **Step 7: Run the sync, check idempotency, and inspect the result**

Run:
```bash
python3 scripts/sync-footer.py
python3 scripts/sync-footer.py --check
python3 scripts/sync-footer.py
git status --short
grep -c "subscribe:start" index.html blog/index.html faq/index.html services/index.html components/blog-post-template.html quiz/tier-1/index.html consultation/index.html thank-you/index.html
```
Expected: first run prints `Updated N pages.`; `--check` prints `Shared footers verified.`; third run prints `Updated 0 pages.`; grep shows `1` for the first five files and `0` for the last three. `git status` shows `services/index.html` was already modified before (it now also contains the subscribe block; that is expected, but see Step 10).

- [ ] **Step 8: Browser check**

Run `python3 -m http.server 8000` and open `http://localhost:8000/blog/` at mobile (375px) and desktop widths. Verify:
- Block sits above the footer, readable, no horizontal scroll.
- Empty submit shows both inline errors; a bad email shows the email error; nothing is sent (Network tab empty).
- With a valid email and the box ticked, the button shows "Subscribing…" and then the failure message (the production Worker is not deployed yet, or CORS blocks localhost) and the typed values remain. If the Worker is running via `wrangler dev`, temporarily set `ENDPOINT` to `http://localhost:8787/` to see the success message and the form reset, then revert it.
- No console errors on the page; the footer and mobile menu still work.

- [ ] **Step 9: Verify pages with no block**

Open `/quiz/tier-1/`, `/consultation/`, `/thank-you/`: no subscribe block, no console errors.

- [ ] **Step 10: Commit, keeping the unrelated `services/index.html` edits out of it**

`services/index.html` had uncommitted edits from before this task, so stage it interactively-free by committing everything else and handling it separately:

```bash
git add components/subscribe-form.html assets/subscribe.js tests/subscribe-client.test.mjs scripts/sync-footer.py \
  index.html blog/index.html faq/index.html handbook/index.html handbook/programs/index.html \
  privacy/index.html refunds/index.html terms/index.html components/blog-post-template.html
git commit -m "Add newsletter subscribe form and client script

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
git status --short   # services/index.html should still show as modified
```
Then tell the user `services/index.html` now also includes the subscribe block on top of their earlier uncommitted edits, and ask whether to commit it. Do not commit it without asking. If `git status` shows any other page changed by the sync that is not in the `git add` list above, add it to the commit.

---

### Task 3: Exit-intent and idle modal

**Files:**
- Create: `components/subscribe-modal.html`
- Create: `assets/subscribe-modal.js`
- Create: `tests/subscribe-modal.test.mjs`
- Modify: `scripts/sync-footer.py` (two small additions below)
- Modify (via the sync script): the same pages as Task 2

**Interfaces:**
- Consumes: `form[data-g2g-subscribe]` wiring and the `g2g:subscribed` document event from `assets/subscribe.js` (Task 2). The modal contains a second subscribe form, so `subscribe.js` handles validation and posting with no changes.
- Produces: `window.g2gSubscribeModal = { canShow(state, now) -> boolean, parseState(raw) -> { subscribed: boolean, snoozedUntil: number } }`; `<dialog id="subscribe-modal">` on eligible pages; localStorage key `g2g_subscribe_modal` holding `{ "subscribed": boolean, "snoozedUntil": number }`.

- [ ] **Step 1: Write the failing test `tests/subscribe-modal.test.mjs`**

```js
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/subscribe-modal.test.mjs`
Expected: FAIL (`ENOENT ... assets/subscribe-modal.js`).

- [ ] **Step 3: Create `assets/subscribe-modal.js`**

```js
(function () {
  var STORE_KEY = 'g2g_subscribe_modal';
  var IDLE_MS = 45000;
  var MIN_EXIT_MS = 8000;
  var SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

  function parseState(raw) {
    var state = { subscribed: false, snoozedUntil: 0 };
    try {
      var data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        if (data.subscribed === true) state.subscribed = true;
        if (typeof data.snoozedUntil === 'number') state.snoozedUntil = data.snoozedUntil;
      }
    } catch (e) {
      // Missing or corrupt value: treat as a fresh visitor.
    }
    return state;
  }

  function canShow(state, now) {
    return !state.subscribed && now >= state.snoozedUntil;
  }

  window.g2gSubscribeModal = { canShow: canShow, parseState: parseState };

  var dialog = document.getElementById('subscribe-modal');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  var shownThisPage = false;
  var loadedAt = Date.now();
  var idleTimer = null;

  function load() {
    try {
      return parseState(window.localStorage.getItem(STORE_KEY));
    } catch (e) {
      return parseState(null);
    }
  }

  function save(state) {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) {
      // Storage unavailable: the modal still shows at most once per page load.
    }
  }

  function typingInField() {
    var el = document.activeElement;
    return !!el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !dialog.contains(el);
  }

  function anotherDialogOpen() {
    var menu = document.getElementById('mobile-menu');
    return !!menu && !menu.classList.contains('hidden');
  }

  function open() {
    if (shownThisPage || dialog.open) return;
    if (!canShow(load(), Date.now())) return;
    if (typingInField() || anotherDialogOpen()) {
      armIdle();
      return;
    }
    shownThisPage = true;
    dialog.showModal();
  }

  function armIdle() {
    window.clearTimeout(idleTimer);
    if (shownThisPage || document.hidden) return;
    idleTimer = window.setTimeout(open, IDLE_MS);
  }

  ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'].forEach(function (name) {
    document.addEventListener(name, armIdle, { passive: true });
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) window.clearTimeout(idleTimer);
    else armIdle();
  });

  // Exit intent: the pointer leaves through the top of the window (desktop only).
  document.addEventListener('mouseout', function (e) {
    if (e.relatedTarget || e.clientY > 0) return;
    if (Date.now() - loadedAt < MIN_EXIT_MS) return;
    open();
  });

  dialog.addEventListener('close', function () {
    var state = load();
    if (!state.subscribed) save({ subscribed: false, snoozedUntil: Date.now() + SNOOZE_MS });
  });

  dialog.addEventListener('click', function (e) {
    if (e.target === dialog) dialog.close();
  });

  dialog.querySelectorAll('[data-modal-close]').forEach(function (btn) {
    btn.addEventListener('click', function () { dialog.close(); });
  });

  document.addEventListener('g2g:subscribed', function () {
    save({ subscribed: true, snoozedUntil: 0 });
    if (dialog.open) window.setTimeout(function () { dialog.close(); }, 2500);
  });

  armIdle();
})();
```

- [ ] **Step 4: Run tests and syntax check**

Run: `node --test tests/subscribe-modal.test.mjs tests/subscribe-client.test.mjs && node --check assets/subscribe-modal.js`
Expected: all tests PASS. (`subscribe-client` still passes: its stub `document` has no `dispatchEvent`, but that code only runs inside the submit handler.)

- [ ] **Step 5: Create `components/subscribe-modal.html`**

```html
<!-- subscribe-modal:start -->
<dialog id="subscribe-modal" aria-labelledby="subscribe-modal-title" class="rounded-[24px] p-0 w-[calc(100%-32px)] max-w-lg bg-white text-[#12201C] shadow-2xl backdrop:bg-black/50">
      <div class="relative p-8 sm:p-10">
        <button type="button" data-modal-close aria-label="Close" class="absolute top-3 right-3 w-11 h-11 flex items-center justify-center rounded-full text-[#5A6A63] hover:bg-[#D8F0EA] text-2xl leading-none">&times;</button>
        <h2 id="subscribe-modal-title" class="text-2xl font-bold tracking-tight mb-2 pr-8">Don&rsquo;t miss new guides</h2>
        <p class="text-[#5A6A63] leading-relaxed mb-6">Practical guidance for behavioral health professionals, sent occasionally. Unsubscribe anytime.</p>
        <form data-g2g-subscribe novalidate>
          <div class="grid grid-cols-1 gap-4 mb-4">
            <div>
              <label for="subscribe-modal-first-name" class="block text-sm font-semibold mb-1">First name <span class="font-normal text-[#5A6A63]">(optional)</span></label>
              <input id="subscribe-modal-first-name" name="first_name" type="text" autocomplete="given-name" maxlength="80" class="w-full h-[48px] px-4 rounded-xl border border-[#0F766E]/25 bg-white focus:outline-none focus:ring-2 focus:ring-[#0F766E]/40" />
            </div>
            <div>
              <label for="subscribe-modal-email" class="block text-sm font-semibold mb-1">Email</label>
              <input id="subscribe-modal-email" name="email" type="email" autocomplete="email" inputmode="email" required class="w-full h-[48px] px-4 rounded-xl border border-[#0F766E]/25 bg-white focus:outline-none focus:ring-2 focus:ring-[#0F766E]/40" />
              <p data-error="email" hidden class="text-sm mt-1" style="color:#B42318"></p>
            </div>
          </div>
          <div style="position:absolute;left:-9999px;" aria-hidden="true">
            <label>Website <input name="website" type="text" tabindex="-1" autocomplete="off" /></label>
          </div>
          <label class="flex items-start gap-3 text-sm text-[#5A6A63] leading-relaxed mb-1">
            <input name="consent" type="checkbox" class="mt-1 w-4 h-4 accent-[#0F766E]" />
            <span>I agree to receive Grow2Guide emails and understand I can unsubscribe at any time. See the <a href="/privacy/" class="text-[#0F766E] font-semibold underline">privacy page</a>.</span>
          </label>
          <p data-error="consent" hidden class="text-sm mb-3" style="color:#B42318"></p>
          <div class="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <button type="submit" class="bg-[#0F766E] text-white h-[52px] px-8 rounded-full font-bold hover:bg-[#0B5F59] transition-all disabled:opacity-60">Subscribe</button>
            <button type="button" data-modal-close class="h-[52px] px-4 font-semibold text-[#5A6A63] hover:text-[#0F766E]">No thanks</button>
          </div>
          <p data-status role="status" aria-live="polite" class="mt-3 text-sm font-semibold"></p>
        </form>
      </div>
    </dialog>
<!-- subscribe-modal:end -->
```

- [ ] **Step 6: Extend `scripts/sync-footer.py`**

Right after the `subscribe = ...` line add:
```python
modal = (root / "components/subscribe-modal.html").read_text().strip()
modal_script = '  <script src="/assets/subscribe-modal.js" defer></script>'
```
Inside the `if rel.parts[0] not in NO_SUBSCRIBE:` block, after the `subscribe_script` handling, add:
```python
        if "<!-- subscribe-modal:start -->" in updated:
            updated = re.sub(
                r"<!-- subscribe-modal:start -->.*?<!-- subscribe-modal:end -->",
                lambda _: modal,
                updated,
                flags=re.S,
            )
        else:
            updated = updated.replace("</body>", "    " + modal + "\n  </body>", 1)
        if modal_script not in updated:
            updated = updated.replace("</head>", modal_script + "\n</head>", 1)
```
The modal script tag is added after the `subscribe.js` tag, so deferred execution order is `subscribe.js` then `subscribe-modal.js`.

- [ ] **Step 7: Run the sync and check idempotency**

```bash
python3 scripts/sync-footer.py
python3 scripts/sync-footer.py --check
python3 scripts/sync-footer.py
grep -c "subscribe-modal:start" index.html blog/index.html components/blog-post-template.html quiz/tier-1/index.html consultation/index.html thank-you/index.html
grep -c 'id="subscribe-modal"' index.html
```
Expected: `Updated N pages.`, then `Shared footers verified.`, then `Updated 0 pages.`; grep shows `1` for the first three, `0` for the last three; the last grep prints `1` (one modal per page, no duplicate IDs).

- [ ] **Step 8: Update the client test-suite expectation and re-run everything so far**

Run: `node --test tests/ && (cd workers/subscribe && node --test)`
Expected: all PASS.

- [ ] **Step 9: Browser verification (`python3 -m http.server 8000`, open `http://localhost:8000/`)**

Clear `localStorage` first (`localStorage.removeItem('g2g_subscribe_modal')`), then check:
- Exit intent (desktop): wait 10 seconds, move the pointer out through the top edge of the window. The modal opens, focus is inside it, Escape closes it, focus returns to the page.
- Exit intent before 8 seconds does nothing.
- Idle: reload, do not touch the page for 45 seconds. The modal opens. Moving the mouse before 45 seconds restarts the countdown.
- Typing: reload, click into the footer email field and type, wait 45 seconds. The modal does not open over the typing.
- Background tab: reload, switch tabs for 60 seconds, come back. The modal does not appear until 45 seconds of activity-free time after returning.
- Dismissal: close with "No thanks", the X, the backdrop, and Escape (test each after clearing storage). It does not reappear on reload or on another page (localStorage `g2g_subscribe_modal` has a `snoozedUntil` about 14 days ahead).
- Subscribe from the modal with `wrangler dev` running and `ENDPOINT` temporarily pointed at it (revert afterwards): success message shows, the modal closes after about 2.5 seconds, and it never reappears (`subscribed: true`).
- Subscribing from the footer block also suppresses the modal on the next page load.
- Mobile width (375px, touch emulation): no exit intent fires; the idle trigger opens the modal; it fits the screen, buttons are at least 44px tall, and the page behind does not scroll.
- Private window or blocked storage: no console errors; the modal shows at most once per page load.
- `/quiz/tier-1/`, `/consultation/`, `/thank-you/`: no modal, no console errors.

- [ ] **Step 10: Commit**

```bash
git add components/subscribe-modal.html assets/subscribe-modal.js assets/subscribe.js tests/subscribe-modal.test.mjs scripts/sync-footer.py \
  index.html blog/index.html faq/index.html handbook/index.html handbook/programs/index.html \
  privacy/index.html refunds/index.html terms/index.html components/blog-post-template.html
git commit -m "Add exit-intent and idle subscribe modal

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
git status --short   # services/index.html stays uncommitted, see Task 2 Step 10
```
If `git status` shows any other page changed by the sync that is not in the `git add` list, add it.

---

### Task 4: Newsletter data and privacy notice

**Files:**
- Create: `newsletter/README.md`
- Create: `newsletter/issue-template.html`
- Create: `newsletter/issues/2026-10-welcome.html`
- Modify: `privacy/index.html` (add a section before `<h2>Contact</h2>`)

**Interfaces:**
- Consumes: subscriber fields from Task 1 (`email`, `first_name`, `unsubscribed`) and the consent log format `{ event, source, consentAt }`.
- Produces: `newsletter/README.md` documenting the schema and send workflow, which Task 5's export script references.

- [ ] **Step 1: Create `newsletter/README.md`**

````markdown
# Newsletter

Newsletters are written as HTML in this folder and sent from Resend as Broadcasts.

## Subscriber data

Stored in the Resend Audience, one contact per person:

| Field | Source | Notes |
|---|---|---|
| `email` | signup form | required, lowercased, trimmed |
| `first_name` | signup form | optional, max 80 characters |
| `unsubscribed` | Resend | set automatically when someone uses the unsubscribe link |
| `created_at` | Resend | signup time |

Consent record (not stored in Resend): each signup writes `{ "event": "subscribed", "source": "<page path>", "consentAt": "<ISO time>" }`
to the Worker log (`npx wrangler tail` in `workers/subscribe/`), without the email address.
The form's checkbox text is the consent wording: "I agree to receive Grow2Guide emails and understand I can unsubscribe at any time."

Export the list any time: `python3 scripts/export-subscribers.py --out subscribers.csv`
(needs `RESEND_API_KEY` and `RESEND_AUDIENCE_ID` in your environment). Do not commit exports.

## Writing and sending an issue

1. Copy `issue-template.html` to `issues/YYYY-MM-<slug>.html` and replace the content between the `CONTENT START` and `CONTENT END` comments.
2. In Resend: Broadcasts, create a broadcast, choose the Audience, paste the HTML.
3. Keep `{{{RESEND_UNSUBSCRIBE_URL}}}` in the footer; Resend requires an unsubscribe link and fills it in per recipient.
4. Send a test to yourself, check it on phone and desktop, then send.
5. Optionally publish the same content as a blog post (see the root `README.md`).

Merge tags used: `{{{FIRST_NAME|there}}}` (falls back to "there") and `{{{RESEND_UNSUBSCRIBE_URL}}}`.
If Resend's current docs use different tag syntax, update the template and the first issue.
````

- [ ] **Step 2: Create `newsletter/issue-template.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Grow2Guide</title>
</head>
<body style="margin:0;padding:0;background:#F3F6F2;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F6F2;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#FFFFFF;border-radius:20px;">
          <tr>
            <td style="padding:28px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:bold;color:#0F766E;">
              Grow 2 Guide
            </td>
          </tr>
          <!-- CONTENT START -->
          <tr>
            <td style="padding:8px 32px 24px 32px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#12201C;">
              <h1 style="margin:0 0 16px 0;font-size:26px;line-height:1.25;color:#12201C;">Issue title</h1>
              <p style="margin:0 0 16px 0;">Hi {{{FIRST_NAME|there}}},</p>
              <p style="margin:0 0 16px 0;">Body text goes here.</p>
              <p style="margin:24px 0;">
                <a href="https://grow2guide.com/" style="display:inline-block;background:#0F766E;color:#FFFFFF;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:999px;">Call to action</a>
              </p>
            </td>
          </tr>
          <!-- CONTENT END -->
          <tr>
            <td style="padding:20px 32px 28px 32px;border-top:1px solid #E1ECE8;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#5A6A63;">
              Educational resources only &mdash; not legal advice. Licensure is not guaranteed.<br />
              You are receiving this because you subscribed at grow2guide.com.
              <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#0F766E;">Unsubscribe</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

- [ ] **Step 3: Create `newsletter/issues/2026-10-welcome.html`**

Same file as the template with the content block filled in. Copy `issue-template.html` and replace everything between `CONTENT START` and `CONTENT END` with:

```html
          <!-- CONTENT START -->
          <tr>
            <td style="padding:8px 32px 24px 32px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#12201C;">
              <h1 style="margin:0 0 16px 0;font-size:26px;line-height:1.25;color:#12201C;">Welcome to Grow2Guide</h1>
              <p style="margin:0 0 16px 0;">Hi {{{FIRST_NAME|there}}},</p>
              <p style="margin:0 0 16px 0;">Thanks for subscribing. Grow2Guide offers practical resources and real-world consulting for behavioral health professionals and organizations.</p>
              <p style="margin:0 0 16px 0;">Here is what to expect: occasional emails with new guides from our blog, updates to our services, and practical tips. No spam, and you can unsubscribe at any time from the link at the bottom of every email.</p>
              <p style="margin:24px 0;">
                <a href="https://grow2guide.com/blog/" style="display:inline-block;background:#0F766E;color:#FFFFFF;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:999px;">Read the blog</a>
              </p>
              <p style="margin:0 0 16px 0;">Have a question? Reply to this email or <a href="https://grow2guide.com/consultation/" style="color:#0F766E;">request a consultation</a>.</p>
            </td>
          </tr>
          <!-- CONTENT END -->
```

Run: `diff newsletter/issue-template.html newsletter/issues/2026-10-welcome.html`
Expected: differences only inside the content block.

- [ ] **Step 4: Add the privacy section in `privacy/index.html`**

Insert immediately before `<h2>Contact</h2>`:

```html
          <h2>Newsletter</h2>
          <p>If you subscribe to our newsletter, we collect your email address and, if you give it, your first name. You can unsubscribe at any time using the link in every email. Subscriber details are stored with Resend, our email delivery provider, and are used only to send you Grow2Guide emails. To have your details removed, use the unsubscribe link or email us.</p>
```

Also change `Last updated: September 2026` only if today's month differs; it is September 2026, so leave it.

- [ ] **Step 5: Verify**

Run: `python3 scripts/sync-footer.py --check`
Expected: `Shared footers verified.` (privacy page footer untouched).
Open `http://localhost:8000/privacy/` and confirm the Newsletter section renders with matching style. Open `newsletter/issues/2026-10-welcome.html` in a browser at 375px and 700px widths: content readable, button visible, no horizontal scroll.

- [ ] **Step 6: Commit**

```bash
git add newsletter privacy/index.html
git commit -m "Add newsletter templates, subscriber schema, and privacy notice

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Subscriber export script and README

**Files:**
- Create: `scripts/export-subscribers.py`
- Create: `scripts/test_export_subscribers.py`
- Modify: `README.md` (Project structure and a new section)
- Modify: `.gitignore`

**Interfaces:**
- Consumes: env vars `RESEND_API_KEY`, `RESEND_AUDIENCE_ID`; Resend `GET /audiences/{id}/contacts` returning `{ "data": [ { "id", "email", "first_name", "last_name", "created_at", "unsubscribed" } ] }`.
- Produces: `contacts_to_rows(payload: dict) -> list[list[str]]` (header row first) and a CSV file or stdout output.

- [ ] **Step 1: Write the failing test `scripts/test_export_subscribers.py`**

```python
import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "export_subscribers", Path(__file__).with_name("export-subscribers.py")
)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class ContactsToRows(unittest.TestCase):
    def test_header_and_rows(self):
        payload = {
            "data": [
                {"email": "a@b.co", "first_name": "Ann", "created_at": "2026-09-25", "unsubscribed": False},
                {"email": "c@d.co", "first_name": None, "created_at": "2026-09-26", "unsubscribed": True},
            ]
        }
        self.assertEqual(
            mod.contacts_to_rows(payload),
            [
                ["email", "first_name", "created_at", "unsubscribed"],
                ["a@b.co", "Ann", "2026-09-25", "false"],
                ["c@d.co", "", "2026-09-26", "true"],
            ],
        )

    def test_empty_or_missing_data(self):
        header = [["email", "first_name", "created_at", "unsubscribed"]]
        self.assertEqual(mod.contacts_to_rows({"data": []}), header)
        self.assertEqual(mod.contacts_to_rows({}), header)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run to verify it fails**

Run: `python3 scripts/test_export_subscribers.py`
Expected: FAIL (`FileNotFoundError` for `export-subscribers.py`).

- [ ] **Step 3: Implement `scripts/export-subscribers.py`**

```python
"""Export the Resend newsletter audience to CSV.

Usage: RESEND_API_KEY=... RESEND_AUDIENCE_ID=... python3 scripts/export-subscribers.py [--out subscribers.csv]
"""
import csv
import json
import os
import sys
import urllib.request

HEADER = ["email", "first_name", "created_at", "unsubscribed"]


def contacts_to_rows(payload):
    rows = [HEADER[:]]
    for contact in payload.get("data") or []:
        rows.append([
            contact.get("email") or "",
            contact.get("first_name") or "",
            contact.get("created_at") or "",
            "true" if contact.get("unsubscribed") else "false",
        ])
    return rows


def fetch_contacts(api_key, audience_id):
    request = urllib.request.Request(
        "https://api.resend.com/audiences/" + audience_id + "/contacts",
        headers={
            "Authorization": "Bearer " + api_key,
            # Resend sits behind Cloudflare, which rejects the default Python user agent.
            "User-Agent": "grow2guide-export/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def main():
    api_key = os.environ.get("RESEND_API_KEY")
    audience_id = os.environ.get("RESEND_AUDIENCE_ID")
    if not api_key or not audience_id:
        raise SystemExit("Set RESEND_API_KEY and RESEND_AUDIENCE_ID in the environment.")
    rows = contacts_to_rows(fetch_contacts(api_key, audience_id))
    if "--out" in sys.argv:
        path = sys.argv[sys.argv.index("--out") + 1]
        with open(path, "w", newline="") as handle:
            csv.writer(handle).writerows(rows)
        print("Wrote " + str(len(rows) - 1) + " contacts to " + path)
    else:
        csv.writer(sys.stdout).writerows(rows)


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run to verify it passes**

Run: `python3 scripts/test_export_subscribers.py`
Expected: `Ran 2 tests ... OK`.
Also run `python3 scripts/export-subscribers.py` with no env vars. Expected: exits with `Set RESEND_API_KEY and RESEND_AUDIENCE_ID in the environment.`

- [ ] **Step 5: Ignore exports, update `README.md`**

Append to `.gitignore`:
```
subscribers*.csv
```

In `README.md`, add to the Project structure list:
```
- `newsletter/`: newsletter issue template, issues, and subscriber data notes; see `newsletter/README.md`.
- `workers/subscribe/`: Cloudflare Worker that stores newsletter signups in Resend; see its README for deploy steps.
```
Add a new section after "Adding a blog post":
```
## Newsletter signups

The subscribe block (`components/subscribe-form.html`) and the popup
(`components/subscribe-modal.html`, opened by `assets/subscribe-modal.js` on desktop exit
intent or after 45 seconds of inactivity) are copied into every page except `quiz/`,
`consultation/`, and `thank-you/` by `python3 scripts/sync-footer.py`, which also adds
`assets/subscribe.js` and `assets/subscribe-modal.js`. Edit a component, then re-run the script. The form posts to the Worker in `workers/subscribe/`.
Run the tests with `node --test tests/`,
`(cd workers/subscribe && npm test)`, and `python3 scripts/test_export_subscribers.py`.
```
Also update the "For forms" line in "Checking changes" to say the subscribe form posts to the Worker while the consultation and quiz forms still open an email draft.

- [ ] **Step 6: Run the full verification**

```bash
node --test tests/
(cd workers/subscribe && node --test)
python3 scripts/test_export_subscribers.py
node --check assets/subscribe.js && node --check workers/subscribe/index.js
python3 scripts/sync-footer.py --check
```
Expected: every command passes with no failures.

- [ ] **Step 7: Commit**

```bash
git add scripts/export-subscribers.py scripts/test_export_subscribers.py README.md .gitignore
git commit -m "Add subscriber CSV export and document newsletter setup

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Go-live checklist (owner actions, not code)

1. Resend: verify the sending domain, create an Audience, create an API key.
2. Cloudflare: `npx wrangler login`, set the two secrets, `npx wrangler deploy` (see `workers/subscribe/README.md`).
3. If not using `subscribe.grow2guide.com`, update `ENDPOINT` in `assets/subscribe.js` and re-deploy the site.
4. Subscribe with a real address from grow2guide.com and confirm the contact appears in Resend. Confirm the modal does not show again afterwards.
5. Send the welcome issue as a Broadcast to yourself first.
