# Stripe purchase fulfillment

This Worker sends the purchased Grow2Guide PDFs as email attachments through Resend.
It is separate from `workers/subscribe/`, which handles newsletter consent and audience
contacts only. To keep Cloudflare at $0, the PDFs are uploaded as Worker static assets
from the local `output/` folder. The Worker runs before asset routing and returns 404 for
public asset requests; only its internal asset binding reads the PDFs for paid orders.
Do not commit `output/` into the GitHub Pages site.

## Product-to-file mapping

| Stripe payment-link SKU | Email attachments |
|---|---|
| `g2g-learning-guide` (PDF 1 - Employees) | Behavioral Health Guide for employees + Behavioral health guide workbook |
| `g2g-supervisor-toolkit` (PDF 2 - Supervisors) | Supervisor Guide - How do I supervise employees effectively |
| `g2g-bundle` | All three updated PDFs |

The SKU is read from `checkout.session.metadata.sku`. Stripe copies Payment Link metadata
to Checkout Sessions, so keep each live Payment Link's `sku` metadata aligned with the
product mapping above.

## One-time setup

1. Keep the three updated PDFs in `output/pdf/`. Wrangler uploads them with the Worker
   from the configured asset directory. Cloudflare documents static asset storage and
   requests as free and unlimited; requests that invoke Worker code use the Free plan's
   daily quota. No R2 subscription or bucket is needed.

2. Set the Worker secrets and sender address. Resend shows `grow2guide.com` as verified;
   use `Grow2Guide <guides@grow2guide.com>` for `G2G_FROM_EMAIL`:

   ```sh
   npx wrangler secret put STRIPE_WEBHOOK_SECRET
   npx wrangler secret put RESEND_API_KEY
   npx wrangler secret put G2G_FROM_EMAIL
   ```

3. Deploy from this directory:

   ```sh
   npx wrangler deploy
   ```

4. In the live Stripe account, create a webhook endpoint at
   `https://g2g-stripe-fulfillment.grow2guide-b7c.workers.dev/stripe-webhook` for:

   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`

   Save the endpoint's signing secret as `STRIPE_WEBHOOK_SECRET` in Cloudflare, then
   redeploy if you added it after deployment.

## Delivery safeguards

- Verifies Stripe's timestamped HMAC signature against the raw request body.
- Sends only for live Checkout Sessions with `payment_status=paid`.
- Uses the Payment Link SKU to select attachments; unknown SKUs fail visibly for retry
  rather than sending the wrong files.
- Sends through Resend with a checkout-session idempotency key to reduce duplicate
  emails when Stripe retries webhook delivery.
- Does not add purchasers to the newsletter audience.
- Does not expose the PDF asset URLs; direct public requests are answered by the Worker
  with 404, while fulfillment reads the files through the private asset binding.
- Logs event/session IDs and outcome only; it does not log the buyer's email address.

The existing Stripe success-page redirect is not used as proof of payment. Stripe's
webhook is the fulfillment trigger.
