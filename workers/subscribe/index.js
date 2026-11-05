// Same file the Self-Assessment page uses, so the results email always matches the page.
import assessment from "../../assets/self-assessment.js";

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

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function welcomeEmail(firstName) {
  const greeting = firstName ? "Hi " + firstName + "," : "Hi,";
  const lines = [
    "Thanks for subscribing to Grow2Guide.",
    "You'll get practical guides for behavioral health professionals, sent occasionally. No daily emails.",
    "Every newsletter has an unsubscribe link at the bottom, so you can stop at any time.",
    "If you didn't sign up, you can ignore this email, or reply and we'll remove you.",
  ];
  const text = [greeting, ...lines, "The Grow2Guide team", "https://grow2guide.com"].join("\n\n");
  const html =
    "<p>" + escapeHtml(greeting) + "</p>" +
    lines.map((line) => "<p>" + escapeHtml(line) + "</p>").join("") +
    '<p>The Grow2Guide team<br><a href="https://grow2guide.com">grow2guide.com</a></p>';
  return { subject: "Welcome to Grow2Guide", text, html };
}

// Best effort: the signup is already stored, so a failed welcome email is logged, never surfaced.
async function sendWelcome(env, email, firstName) {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + env.RESEND_API_KEY,
        "Content-Type": "application/json",
        // Stops a quick double submit from sending two welcomes.
        "Idempotency-Key": "welcome/" + email,
      },
      body: JSON.stringify({ from: env.WELCOME_FROM, to: [email], ...welcomeEmail(firstName) }),
    });
    if (!res.ok) console.error("Resend welcome email responded " + res.status);
  } catch (e) {
    console.error("Resend welcome email failed");
  }
}

// The checkbox wording visitors agree to, copied into each backup row as the consent record.
const CONSENT_TEXT =
  "I agree to receive Grow2Guide emails and understand I can unsubscribe at any time.";

// Best effort backup of each signup to a Google Sheet via an Apps Script web app
// (see google-sheets-backup.gs). Resend stays the source of truth.
async function backupToSheet(env, row) {
  try {
    const res = await fetch(env.SHEETS_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: env.SHEETS_WEBHOOK_SECRET, ...row }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body || body.ok !== true) console.error("Sheets backup responded " + res.status);
  } catch (e) {
    console.error("Sheets backup failed");
  }
}

// Runs after the response when the runtime allows it, so the visitor never waits on extras.
async function inBackground(ctx, promise) {
  if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(promise);
  else await promise;
}

// Adds or refreshes a newsletter contact and records consent. Returns an error code, or null.
async function addContact(env, ctx, { email, firstName, source, consentText, welcome }) {
  const contactsPath = "/audiences/" + encodeURIComponent(env.RESEND_AUDIENCE_ID) + "/contacts";

  // Resend's create-contact call is a full-replace upsert, not a merge: any field left out
  // of the body is reset to its default rather than left alone. So look the contact up
  // first. An already-unsubscribed contact is left alone — a repeat signup must never
  // undo someone's opt-out — and an existing first name is kept if this signup omits one.
  let existingFirstName = "";
  let isNewContact = false;
  try {
    const lookup = await fetch("https://api.resend.com" + contactsPath + "/" + encodeURIComponent(email), {
      headers: { Authorization: "Bearer " + env.RESEND_API_KEY },
    });
    if (lookup.status === 200) {
      const existing = await lookup.json();
      if (existing.unsubscribed === true) return null;
      if (typeof existing.first_name === "string") existingFirstName = existing.first_name;
    } else if (lookup.status === 404) {
      isNewContact = true;
    } else {
      console.error("Resend lookup responded " + lookup.status);
      return "upstream_error";
    }
  } catch (e) {
    console.error("Resend lookup failed");
    return "upstream_error";
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
      return "upstream_error";
    }
  } catch (e) {
    console.error("Resend request failed");
    return "upstream_error";
  }

  // Welcome only brand-new contacts; repeat signups and opted-out addresses get nothing.
  if (welcome && isNewContact && env.WELCOME_FROM) {
    await inBackground(ctx, sendWelcome(env, email, nameToStore));
  }

  const consentAt = new Date().toISOString();
  if (env.SHEETS_WEBHOOK_URL && env.SHEETS_WEBHOOK_SECRET) {
    await inBackground(ctx, backupToSheet(env, {
      consentAt,
      email,
      firstName: nameToStore,
      source,
      newContact: isNewContact,
      consentText,
    }));
  }

  // Consent record. The email address is deliberately not logged.
  console.log(JSON.stringify({ event: "subscribed", source, consentAt }));
  return null;
}

// Wording of the newsletter box on the Self-Assessment page, kept as that signup's consent record.
const RESULTS_CONSENT_TEXT = "Also send me the newsletter and tips.";

// Scores arrive as whole percentages only. Names, labels and suggestions come from the
// assessment file, so this endpoint can never be used to send someone else's text.
function readScores(scores) {
  const pct = (n) => Number.isInteger(n) && n >= 0 && n <= 100;
  if (!scores || typeof scores !== "object") return null;
  const { care, workplace, categories } = scores;
  if (!pct(care) || !pct(workplace)) return null;
  if (!Array.isArray(categories) || categories.length !== assessment.CATEGORIES.length || !categories.every(pct)) return null;
  return { care, workplace, categories };
}

// DRAFT wording for Sara's approval. Scores only: no answers, role or reflection text.
function resultsEmail(scores, newsletter) {
  const band = (pct) => assessment.bandFor(pct).label;
  const intro = "Here are your results from the Care & Workplace Competence Self-Assessment.";
  const overall = [
    assessment.DIMENSIONS.care.name + ": " + scores.care + "% (" + band(scores.care) + ")",
    assessment.DIMENSIONS.workplace.name + ": " + scores.workplace + "% (" + band(scores.workplace) + ")",
  ];
  const cats = assessment.CATEGORIES.map((cat, i) => ({
    line: cat.name + ": " + scores.categories[i] + "% (" + band(scores.categories[i]) + ")",
    tip: "Development suggestion: " + assessment.suggestionFor(cat, scores.categories[i]),
  }));
  const notes = [
    "These results reflect your self-reported behavior over the past 30 days. They are not an objective or validated measure of professional competence.",
    "Only your scores were sent to us to create this email, not your answers.",
    newsletter
      ? "You also asked for the newsletter and tips. Every newsletter has an unsubscribe link at the bottom."
      : "We won't email you again unless you sign up for the newsletter.",
  ];
  const retake = "Retake the assessment any time: https://www.grow2guide.com/self-assessment/";

  const text = [
    intro,
    overall.join("\n"),
    "Your eight categories",
    cats.map((c) => c.line + "\n" + c.tip).join("\n\n"),
    ...notes,
    retake,
    "The Grow2Guide team",
  ].join("\n\n");
  const html =
    "<p>" + escapeHtml(intro) + "</p>" +
    "<p>" + overall.map((l) => "<strong>" + escapeHtml(l) + "</strong>").join("<br>") + "</p>" +
    "<p><strong>Your eight categories</strong></p>" +
    cats.map((c) => "<p>" + escapeHtml(c.line) + "<br>" + escapeHtml(c.tip) + "</p>").join("") +
    notes.map((n) => "<p>" + escapeHtml(n) + "</p>").join("") +
    '<p><a href="https://www.grow2guide.com/self-assessment/">Retake the assessment any time</a></p>' +
    "<p>The Grow2Guide team</p>";
  return { subject: "Your Self-Assessment results", text, html };
}

async function sendResults(data, env, ctx, origin) {
  if (!env.RESEND_API_KEY || !env.WELCOME_FROM) {
    console.error("Missing RESEND_API_KEY or WELCOME_FROM");
    return fail(500, "server_misconfigured", origin);
  }
  const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  if (!email || email.length > MAX_EMAIL || !EMAIL_RE.test(email)) return fail(400, "invalid_email", origin);
  const scores = readScores(data.scores);
  if (!scores) return fail(400, "invalid_scores", origin);
  const newsletter = data.newsletter === true;
  if (newsletter && !env.RESEND_AUDIENCE_ID) {
    console.error("Missing RESEND_AUDIENCE_ID");
    return fail(500, "server_misconfigured", origin);
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + env.RESEND_API_KEY,
        "Content-Type": "application/json",
        // Stops a quick double submit from sending the same results twice.
        "Idempotency-Key": "results/" + email + "/" + [scores.care, scores.workplace, ...scores.categories].join("-"),
      },
      body: JSON.stringify({ from: env.WELCOME_FROM, to: [email], ...resultsEmail(scores, newsletter) }),
    });
    if (!res.ok) {
      console.error("Resend results email responded " + res.status);
      return fail(502, "upstream_error", origin);
    }
  } catch (e) {
    console.error("Resend results email failed");
    return fail(502, "upstream_error", origin);
  }

  // The results are already on their way, so a failed newsletter signup is logged, not surfaced.
  // No separate welcome email: the results email confirms the signup.
  if (newsletter) {
    const source = typeof data.source === "string" ? data.source.slice(0, MAX_SOURCE) : "";
    const error = await addContact(env, ctx, { email, firstName: "", source, consentText: RESULTS_CONSENT_TEXT, welcome: false });
    if (error) console.error("Results newsletter signup failed: " + error);
  }

  console.log(JSON.stringify({ event: "results_sent", newsletter }));
  return reply(200, { ok: true }, origin);
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin");
    if (!origin || !ALLOWED_ORIGINS.has(origin)) return fail(403, "forbidden");
    if (request.method === "OPTIONS") return reply(204, null, origin);
    if (request.method !== "POST") return fail(405, "method_not_allowed", origin);

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

    if (new URL(request.url).pathname === "/results") return sendResults(data, env, ctx, origin);

    if (!env.RESEND_API_KEY || !env.RESEND_AUDIENCE_ID) {
      console.error("Missing RESEND_API_KEY or RESEND_AUDIENCE_ID");
      return fail(500, "server_misconfigured", origin);
    }

    if (data.consent !== true) return fail(400, "consent_required", origin);

    const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
    if (!email || email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
      return fail(400, "invalid_email", origin);
    }

    const firstName = typeof data.firstName === "string" ? data.firstName.trim().slice(0, MAX_NAME) : "";
    const source = typeof data.source === "string" ? data.source.slice(0, MAX_SOURCE) : "";
    const error = await addContact(env, ctx, { email, firstName, source, consentText: CONSENT_TEXT, welcome: true });
    if (error) return fail(502, error, origin);
    return reply(200, { ok: true }, origin);
  },
};
