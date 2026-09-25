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

Consent records (source page and timestamp, no email) appear in `npx wrangler tail` and, with
`[observability]` enabled in `wrangler.toml`, in the Worker's Logs in the Cloudflare dashboard.
Cloudflare limits how long logs are kept, so copy them out if you need a long-term record.

Before the first deploy, run `npx wrangler deploy --dry-run` to validate `wrangler.toml`.
If the `RATE_LIMITER` binding is missing the Worker still accepts signups but without rate limiting.

Re-subscribing: the Worker never sends the `unsubscribed` flag, so a repeat signup with an address
that already unsubscribed does not re-subscribe it.
