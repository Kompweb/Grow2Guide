# Analytics: site events → GTM → GA4

The site pushes events to GTM's `dataLayer` (container `GTM-WLRZD726`). GTM forwards them to GA4.
`gtm-ga4-events.json` is a GTM import file with every tag, trigger and variable below.

## Events

| dataLayer event | GA4 event | Parameters | Fired by | Where |
|---|---|---|---|---|
| `newsletter_signup` | `newsletter_signup` | `signup_placement` (page, modal) | `assets/subscribe.js`, after the Worker confirms | Every page with the form |
| `generate_lead` | `generate_lead` | `lead_type` (consultation, quiz_tier_1, quiz_tier_2), `form_method` (mailto) | `consultation.js`, `quiz-tier-1.js`, `quiz-tier-2.js` | /consultation/, /quiz/tier-1/, /quiz/tier-2/ |
| `purchase` | `purchase` | ecommerce: `value`, `currency`, `items`, `transaction_id` (Stripe `session_id` when present) | `assets/thank-you.js` | /thank-you/?item=… |
| `guides_buy_click` | `begin_checkout` | `offer` (guide, toolkit, bundle), `placement` (button id) | `assets/guides.js` | /guides/ |
| `whatsapp_click` | `whatsapp_click` | `whatsapp_location` | `assets/whatsapp.js` | Pages with the WhatsApp button |
| `blog_cta_click` | `blog_cta_click` | `post_slug`, `cta_placement`, `cta_destination`, `link_text` | `assets/blog-events.js` | Blog |
| `blog_related_click` | `blog_related_click` | `post_slug`, `destination_slug` | `assets/blog-events.js` | Blog posts |
| `blog_card_click` | `blog_card_click` | `destination_slug` | `assets/blog-events.js` | /blog/ |

Limits to keep in mind:
- `generate_lead` marks that the visitor pressed submit and their email app opened. It cannot
  tell whether they actually sent the email.
- `purchase` fires when the thank-you page loads with a known `item`. It is not verified
  against Stripe. Add `session_id={CHECKOUT_SESSION_ID}` to each Payment Link's redirect URL
  so GA4 gets a `transaction_id` and drops duplicates.
- Prices in `thank-you.js` must match the Stripe Payment Links ($67 / $67 / $99).

## 1. GTM: import the tags

1. GTM → Admin → **Import Container** → choose `gtm-ga4-events.json`.
2. Workspace: a new one (e.g. "GA4 events"). Option: **Merge** → **Rename conflicting tags,
   triggers and variables**. Never choose Overwrite; it deletes what is already there.
3. Variables → **GA4 Measurement ID** → replace `G-XXXXXXXXXX` with your GA4 ID
   (GA4 → Admin → Data streams → your web stream → Measurement ID).
4. If the container **already has** a Google tag / GA4 Configuration tag for this ID, delete
   the imported **GA4 - Google tag**. Two of them double-count every page view.
5. **Preview**, then test on the site (see "Check it works"). Then **Submit** → Publish.

## 2. GA4: make the events readable

1. **Key events** (Admin → Events, or Admin → Key events → New key event). Mark:
   `generate_lead`, `newsletter_signup`, `purchase`. They appear here up to 24 hours after
   they first fire; you can type the names in by hand before then.
2. **Custom dimensions** (Admin → Custom definitions → Create, scope **Event**). Without these
   the parameters are collected but cannot be shown in reports. Create one per parameter:
   `signup_placement`, `lead_type`, `offer`, `placement`, `whatsapp_location`, `post_slug`,
   `cta_placement`, `cta_destination`, `destination_slug`.
   Only data collected after a dimension is created shows up under it.

## 3. GA4: landing page view of the events

**Quick view (no setup):** Reports → Engagement → **Landing page**. The table shows sessions,
key events and revenue per landing page. Use the "Key events" column dropdown to pick one
event, e.g. `generate_lead`.

**Full view (Exploration):** Explore → Blank.
- Dimensions: **Landing page + query string**, **Event name**, **Session source / medium**
- Metrics: **Sessions**, **Event count**, **Key events**, **Total revenue**
- Technique: Free form. Rows: Landing page + query string. Columns: Event name.
  Values: Event count.
- Filter: Event name matches regex
  `newsletter_signup|generate_lead|purchase|begin_checkout|whatsapp_click|blog_cta_click`

This answers "which landing pages produce signups, leads and sales".

## Check it works

1. GTM **Preview**, then open the site in the debug window.
2. Do one of each: subscribe, start the consultation form and submit, click WhatsApp,
   click a guide "Buy" button.
3. In Tag Assistant, each action should show the matching dataLayer event with the
   **GA4 - …** tag under "Tags Fired".
4. GA4 → Admin → **DebugView** shows the events with their parameters within seconds.
   Standard reports take 24–48 hours.
