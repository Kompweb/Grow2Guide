# Subscribe Worker

Sends Self-Assessment results emails through Resend. The Resend API key lives only in Cloudflare
as a secret.

Newsletter signups moved to Substack in November 2026 (see `newsletter/README.md`). `POST /` now
answers `410 { "ok": false, "error": "newsletter_moved" }` so an old cached page fails clearly
instead of adding people to a list nobody sends from.

## Request contract

`POST /results` (Self-Assessment page) with JSON
`{ "email", "scores": { "care", "workplace", "categories": [8 numbers] }, "source"?, "website"? }`
emails the visitor their results from `WELCOME_FROM`. Scores must be whole numbers from 0 to 100;
category names, labels and suggestions come from `assets/self-assessment.js`, so no visitor text
is ever put in the email. It never adds anyone to a contact list. `website` is a honeypot: leave it
empty. The workflow redeploys when `assets/self-assessment.js` changes, so the email always matches
the page.

## One-time setup

1. In Resend: verify your sending domain and create an API key.
2. In this folder:

```sh
npx wrangler login
npx wrangler secret put RESEND_API_KEY
npx wrangler deploy
```

3. grow2guide.com's DNS is on Wix (ns2/ns3.wixdns.net), not Cloudflare, so the Worker is
   deployed at `https://g2g-subscribe.grow2guide.workers.dev` (`workers_dev = true` in
   `wrangler.toml`), which is already set as `RESULTS_ENDPOINT` in `assets/self-assessment.js`. A brand new
   `workers.dev` subdomain can take a minute or two for Cloudflare's edge to serve TLS for —
   confirmed live 2026-10-01. If grow2guide.com's DNS ever moves to Cloudflare, switch
   `wrangler.toml` back to the `routes` custom-domain block and update `RESULTS_ENDPOINT`.
4. Set `WELCOME_FROM` in `wrangler.toml` to a sender on your Resend-verified domain. The results
   email is sent from it.

## Local development and tests

```sh
npm test                      # unit tests, no network needed
npx wrangler dev              # local Worker on http://localhost:8787
```

For `wrangler dev`, create `.dev.vars` (git-ignored) with `RESEND_API_KEY=...`, then:

```sh
curl -i -X POST http://localhost:8787/results \
  -H "Origin: http://localhost:8000" -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","scores":{"care":75,"workplace":60,"categories":[75,75,75,75,60,60,60,60]}}'
```

Before the first deploy, run `npx wrangler deploy --dry-run` to validate `wrangler.toml`.
If the `RATE_LIMITER` binding is missing the Worker still works but without rate limiting.

Old secrets: `RESEND_AUDIENCE_ID`, `SHEETS_WEBHOOK_URL` and `SHEETS_WEBHOOK_SECRET` are no longer
read. Remove them with `npx wrangler secret delete <NAME>` once the Resend list has been moved.
