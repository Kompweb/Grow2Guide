// Same file the Self-Assessment page uses, so the results email always matches the page.
import assessment from "../../assets/self-assessment.js";

const ALLOWED_ORIGINS = new Set([
  "https://grow2guide.com",
  "https://www.grow2guide.com",
  "http://localhost:8000",
]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL = 254;

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
function resultsEmail(scores) {
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
    "We won't email you again. The free weekly newsletter is at https://grow2guide.substack.com if you want it.",
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

async function sendResults(data, env, origin) {
  if (!env.RESEND_API_KEY || !env.WELCOME_FROM) {
    console.error("Missing RESEND_API_KEY or WELCOME_FROM");
    return fail(500, "server_misconfigured", origin);
  }
  const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  if (!email || email.length > MAX_EMAIL || !EMAIL_RE.test(email)) return fail(400, "invalid_email", origin);
  const scores = readScores(data.scores);
  if (!scores) return fail(400, "invalid_scores", origin);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + env.RESEND_API_KEY,
        "Content-Type": "application/json",
        // Stops a quick double submit from sending the same results twice.
        "Idempotency-Key": "results/" + email + "/" + [scores.care, scores.workplace, ...scores.categories].join("-"),
      },
      body: JSON.stringify({
        from: env.WELCOME_FROM,
        to: [email],
        // Replies go to the inbox Sara reads; the sender stays on the Resend-verified domain.
        ...(env.REPLY_TO ? { reply_to: env.REPLY_TO } : {}),
        ...resultsEmail(scores),
      }),
    });
    if (!res.ok) {
      console.error("Resend results email responded " + res.status);
      return fail(502, "upstream_error", origin);
    }
  } catch (e) {
    console.error("Resend results email failed");
    return fail(502, "upstream_error", origin);
  }

  console.log(JSON.stringify({ event: "results_sent" }));
  return reply(200, { ok: true }, origin);
}

export default {
  async fetch(request, env) {
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

    if (new URL(request.url).pathname === "/results") return sendResults(data, env, origin);

    // The newsletter moved to Substack (grow2guide.substack.com). Old cached pages that still
    // post here get a clear error instead of being added to a list nobody sends from.
    return fail(410, "newsletter_moved", origin);
  },
};
