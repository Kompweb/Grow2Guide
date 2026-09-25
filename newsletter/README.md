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
to the Worker log (Workers Logs in the Cloudflare dashboard, or `npx wrangler tail` in `workers/subscribe/`),
without the email address. Cloudflare limits how long logs are kept, so copy them out if you need a long-term consent record.
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
