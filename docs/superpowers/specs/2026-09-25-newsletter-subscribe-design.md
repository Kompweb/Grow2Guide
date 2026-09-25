# Newsletter Subscriber Form and Newsletter Data — Design

Date: 2026-09-25

## Goal

Let visitors join a Grow2Guide newsletter list from the site, store subscribers in
Resend, and give the team a starting structure for writing and sending newsletters.

## Constraints

- The site is static (GitHub Pages, plain HTML/CSS/JS, no build step). It stays there.
- The Resend API key must never reach the browser, so a small server-side endpoint is required.
- Existing forms only open a mailto draft; this is the first form that stores data.
- Must match site styling, work on mobile and desktop, and work without JS breaking the page.

## Decisions

- Subscriber storage and sending: **Resend** (Audiences, Contacts, Broadcasts).
- Signup endpoint: **Cloudflare Worker**, kept in this repo under `workers/subscribe/`.
- Newsletter data: subscriber schema, issue template, first issue draft, CSV export script.

## Components

### 1. Subscribe form component
- `components/subscribe-form.html`: shared markup, synced into pages the same way the
  footer is (extend `scripts/sync-footer.py` or add a sibling script with `--check` support).
- Placement: footer area or blog area, plus a block on `blog/index.html` and `index.html`.
- Fields: email (required), first name (optional), consent checkbox (required),
  honeypot (hidden), source page (hidden, from `location.pathname`).
- Consent text states what they are signing up for and links to `/privacy/`.

### 2. Client script
- `assets/subscribe.js`, loaded with `defer` after the shared scripts.
- Validates email and consent, posts JSON to the Worker URL, shows inline
  success/error/loading states, disables the button while sending.
- Does not store anything in localStorage beyond what `lead-storage.js` already does.

### 3. Cloudflare Worker (`workers/subscribe/`)
- Files: `index.js`, `wrangler.toml`, `README.md` (deploy steps).
- Accepts `POST` JSON only; `OPTIONS` handled for CORS. Allowed origins:
  `https://grow2guide.com` and `https://www.grow2guide.com` (plus localhost for dev).
- Validates email format and length, trims name, rejects if honeypot is filled or consent is false.
- Creates the contact in the Resend Audience via API using secret `RESEND_API_KEY`
  and env var `RESEND_AUDIENCE_ID`.
- Already-subscribed emails return the same success response (no enumeration).
- Basic rate limiting per IP.
- Returns `{ ok: true }` or `{ ok: false, error }` with appropriate status codes.
- Secrets are set with `wrangler secret put`; nothing secret is committed.

### 4. Subscriber data
- Stored in Resend per contact: email, first name, unsubscribed status.
- Source page and consent timestamp are recorded in Worker logs (Resend has limited custom fields).
- Schema documented in `newsletter/README.md`.
- Unsubscribe link is added by Resend to every Broadcast.
- `scripts/export-subscribers.py`: exports the audience to CSV using the Resend API
  and a local `RESEND_API_KEY` environment variable.

### 5. Newsletter content structure
- `newsletter/issue-template.html`: brand-styled, email-safe HTML (inline styles, table layout).
- `newsletter/issues/2026-XX-first-issue.md` or `.html`: first draft issue.
- Workflow in `newsletter/README.md`: write issue, paste into a Resend Broadcast, send test, send.

### 6. Exit-intent and idle modal
- `components/subscribe-modal.html`: a `<dialog>` containing the same subscribe form, synced
  into pages like the inline block; `assets/subscribe-modal.js` opens it.
- Triggers: desktop exit intent (pointer leaves through the top of the window, ignored for
  the first 8 seconds), or 45 seconds without mouse, key, scroll or touch activity
  (the only trigger on phones and tablets).
- Restraint: at most once per page load; dismissal snoozes it for 14 days; a successful
  signup (from the modal or the inline block) suppresses it permanently; it waits while
  the visitor is typing in a field or the tab is hidden. State lives in localStorage
  (`g2g_subscribe_modal`) and everything degrades safely if storage is blocked.
- Excluded from `quiz/`, `consultation/` and `thank-you/` so it never interrupts a form in progress.
- Accessible: native dialog focus handling, Escape and backdrop click close it, close button is 44px.

### 7. Privacy page
- Add a short section to `privacy/index.html`: what is collected, Resend as processor,
  how to unsubscribe, contact for removal.

## Error handling
- Invalid input: inline message next to the field, no request sent.
- Network or Worker failure: generic "Something went wrong, please try again" message;
  form data is kept so the visitor can retry.
- Resend API failure: Worker returns 502, logs the upstream status without the key.

## Verification (no test runner exists)
- `node --check` on `assets/subscribe.js` and `workers/subscribe/index.js`.
- Run `wrangler dev` and exercise the Worker with curl: valid signup, invalid email,
  missing consent, honeypot filled, disallowed origin, duplicate email.
- Preview the site locally and check the form at mobile and desktop widths.
- Confirm the contact appears in the Resend Audience.
- Run the footer/component sync check.

## Out of scope
- Interest segmentation, double opt-in, automated newsletters from blog posts,
  analytics dashboards. These can be added later.

## Setup needed from the owner
- Resend account, verified sending domain, and an Audience (provides the audience ID).
- Cloudflare account for deploying the Worker and setting secrets.
