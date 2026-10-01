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

3. grow2guide.com's DNS is on Wix (ns2/ns3.wixdns.net), not Cloudflare, so the Worker is
   deployed at `https://g2g-subscribe.grow2guide.workers.dev` (`workers_dev = true` in
   `wrangler.toml`), which is already set as `ENDPOINT` in `assets/subscribe.js`. A brand new
   `workers.dev` subdomain can take a minute or two for Cloudflare's edge to serve TLS for —
   confirmed live 2026-10-01. If grow2guide.com's DNS ever moves to Cloudflare, switch
   `wrangler.toml` back to the `routes` custom-domain block and update `ENDPOINT`.

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

Consent records (source page and timestamp, no email) appear in `npx wrangler tail` and, with
`[observability]` enabled in `wrangler.toml`, in the Worker's Logs in the Cloudflare dashboard.
Cloudflare limits how long logs are kept, so copy them out if you need a long-term record.

Before the first deploy, run `npx wrangler deploy --dry-run` to validate `wrangler.toml`.
If the `RATE_LIMITER` binding is missing the Worker still accepts signups but without rate limiting.

Re-subscribing: Resend's create-contact call is a full-replace upsert, not a merge, so the Worker
looks a contact up before writing. An address that already unsubscribed is left alone by a repeat
signup, and an existing first name is kept if the repeat signup does not provide one. Verified
against the live Resend API — see git history for `workers/subscribe/index.js`.
