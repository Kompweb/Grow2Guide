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
    const contactsPath = "/audiences/" + encodeURIComponent(env.RESEND_AUDIENCE_ID) + "/contacts";

    // Resend's create-contact call is a full-replace upsert, not a merge: any field left out
    // of the body is reset to its default rather than left alone. So look the contact up
    // first. An already-unsubscribed contact is left alone — a repeat signup must never
    // undo someone's opt-out — and an existing first name is kept if this signup omits one.
    let existingFirstName = "";
    try {
      const lookup = await fetch("https://api.resend.com" + contactsPath + "/" + encodeURIComponent(email), {
        headers: { Authorization: "Bearer " + env.RESEND_API_KEY },
      });
      if (lookup.status === 200) {
        const existing = await lookup.json();
        if (existing.unsubscribed === true) return reply(200, { ok: true }, origin);
        if (typeof existing.first_name === "string") existingFirstName = existing.first_name;
      } else if (lookup.status !== 404) {
        console.error("Resend lookup responded " + lookup.status);
        return fail(502, "upstream_error", origin);
      }
    } catch (e) {
      console.error("Resend lookup failed");
      return fail(502, "upstream_error", origin);
    }

    const contact = { email };
    const nameToStore = firstName || existingFirstName;
    if (nameToStore) contact.first_name = nameToStore;

    try {
      const res = await fetch("https://api.resend.com" + contactsPath, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + env.RESEND_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(contact),
      });
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
