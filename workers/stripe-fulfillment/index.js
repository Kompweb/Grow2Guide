const PRODUCTS = {
  "g2g-learning-guide": {
    title: "Behavioral Health Policy Inventory & Learning Guide",
    files: [
      {
        key: "pdf/Why_We_Do_It_This_Way_Guide_Updated.pdf",
        filename: "Behavioral Health Guide for employees - Why do we do it this way.pdf",
      },
      {
        key: "pdf/Why_We_Do_It_This_Way_Workbook_Updated.pdf",
        filename: "Behavioral health guide workbook - why do we do it this way.pdf",
      },
    ],
  },
  "g2g-supervisor-toolkit": {
    title: "Supervisor & Manager Toolkit and Reflection",
    files: [
      {
        key: "pdf/How_Do_I_Supervise_Employees_Effectively_Updated.pdf",
        filename: "Supervisor Guide - How do I supervise employees effectively.pdf",
      },
    ],
  },
  "g2g-bundle": {
    title: "Grow2Guide PDF Guides Bundle",
    files: [
      {
        key: "pdf/Why_We_Do_It_This_Way_Guide_Updated.pdf",
        filename: "Behavioral Health Guide for employees - Why do we do it this way.pdf",
      },
      {
        key: "pdf/Why_We_Do_It_This_Way_Workbook_Updated.pdf",
        filename: "Behavioral health guide workbook - why do we do it this way.pdf",
      },
      {
        key: "pdf/How_Do_I_Supervise_Employees_Effectively_Updated.pdf",
        filename: "Supervisor Guide - How do I supervise employees effectively.pdf",
      },
    ],
  },
};

const ACCEPTED_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);
const SIGNATURE_TOLERANCE_SECONDS = 300;
const encoder = new TextEncoder();

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function hexToBytes(hex) {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function constantTimeEqual(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i += 1) difference |= left[i] ^ right[i];
  return difference === 0;
}

async function verifyStripeSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;

  const fields = signatureHeader.split(",").map((part) => part.split("=", 2));
  const timestampText = fields.find(([key]) => key === "t")?.[1];
  const timestamp = Number(timestampText);
  if (!Number.isInteger(timestamp)) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const signatures = fields
    .filter(([key]) => key === "v1")
    .map(([, value]) => hexToBytes(value))
    .filter(Boolean);
  if (signatures.length === 0) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signedPayload = encoder.encode(`${timestampText}.${rawBody}`);
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, signedPayload));
  return signatures.some((signature) => constantTimeEqual(expected, signature));
}

function toBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

async function loadAttachments(assetFetcher, files) {
  return Promise.all(files.map(async (file) => {
    const response = await assetFetcher.fetch(`https://assets.local/${file.key}`);
    if (!response.ok) throw new Error(`Missing PDF asset: ${file.key}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { filename: file.filename, content: toBase64(bytes) };
  }));
}

async function sendPurchaseEmail(env, session, product) {
  const recipient = session.customer_details?.email || session.customer_email;
  if (!recipient) throw new Error("Checkout session has no customer email");

  const attachments = await loadAttachments(env.G2G_GUIDES_ASSETS, product.files);
  const name = session.customer_details?.name?.trim();
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hello,";
  const plainGreeting = name ? `Hi ${name},` : "Hello,";
  const subject = `Your ${product.title}`;
  const email = {
    from: env.G2G_FROM_EMAIL,
    to: [recipient],
    subject,
    text: `${plainGreeting}\n\nThanks for your purchase. Your ${product.title} PDF file${attachments.length === 1 ? " is" : "s are"} attached. If you have any trouble opening them, reply to this email or contact grow2guide@gmail.com.\n\nGrow2Guide`,
    html: `<p>${greeting}</p><p>Thanks for your purchase. Your ${escapeHtml(product.title)} PDF file${attachments.length === 1 ? " is" : "s are"} attached.</p><p>If you have any trouble opening them, reply to this email or contact <a href="mailto:grow2guide@gmail.com">grow2guide@gmail.com</a>.</p><p>Grow2Guide</p>`,
    attachments,
  };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `stripe-purchase/${session.id}`,
    },
    body: JSON.stringify(email),
  });

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    console.error(JSON.stringify({ event: "purchase_email_failed", status: response.status, detail, sessionId: session.id }));
    throw new Error("Resend rejected the purchase email");
  }

  const result = await response.json();
  return result.id;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json(200, { ok: true });
    }
    if (url.pathname !== "/stripe-webhook") return json(404, { ok: false, error: "not_found" });
    if (request.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });
    if (!env.STRIPE_WEBHOOK_SECRET || !env.RESEND_API_KEY || !env.G2G_FROM_EMAIL || !env.G2G_GUIDES_ASSETS) {
      console.error("Purchase fulfillment Worker is missing required configuration");
      return json(500, { ok: false, error: "server_misconfigured" });
    }

    const rawBody = await request.text();
    const signature = request.headers.get("Stripe-Signature");
    let validSignature = false;
    try {
      validSignature = await verifyStripeSignature(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch (error) {
      console.error("Stripe signature verification failed");
    }
    if (!validSignature) return json(400, { ok: false, error: "invalid_signature" });

    let event;
    try {
      event = JSON.parse(rawBody);
    } catch (error) {
      return json(400, { ok: false, error: "invalid_json" });
    }
    if (!event || typeof event.id !== "string" || typeof event.type !== "string") {
      return json(400, { ok: false, error: "invalid_event" });
    }
    if (event.livemode !== true) return json(400, { ok: false, error: "live_events_only" });
    if (!ACCEPTED_EVENTS.has(event.type)) return json(200, { received: true });

    const session = event.data?.object;
    if (!session || typeof session.id !== "string") return json(400, { ok: false, error: "invalid_session" });
    if (session.payment_status !== "paid") return json(200, { received: true, skipped: "payment_not_paid" });

    const sku = session.metadata?.sku;
    const product = PRODUCTS[sku];
    if (!product) {
      console.error(JSON.stringify({ event: "purchase_sku_unmapped", eventId: event.id, sessionId: session.id, sku: sku || "missing" }));
      return json(500, { ok: false, error: "unmapped_product" });
    }

    try {
      const emailId = await sendPurchaseEmail(env, session, product);
      console.log(JSON.stringify({ event: "purchase_email_sent", eventId: event.id, sessionId: session.id, sku, emailId }));
      return json(200, { received: true });
    } catch (error) {
      console.error(JSON.stringify({ event: "purchase_fulfillment_failed", eventId: event.id, sessionId: session.id, sku, reason: String(error?.message || error) }));
      return json(500, { ok: false, error: "fulfillment_failed" });
    }
  },
};
