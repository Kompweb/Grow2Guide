# Guides Landing Page: Design Spec

Date: 2026-09-25
Approved preview: https://claude.ai/artifact/S4zyXCy7AXWx4v7oEfT6RA (version 2)

## Goal

Convert visitors into buyers of the two $67 PDF guides, with the $99 bundle as the primary offer. Traffic comes from Instagram/Facebook, email, WhatsApp and DMs, newsletters, QR codes and print, and Google/blog search. The page must work cold, on mobile, and from a short URL.

## Scope

In scope:
1. New page `guides/index.html`, served at `/guides/`.
2. Three launch blog posts under `blog/<slug>/index.html`, each ending in a CTA to `/guides/`.
3. Blog index, sitemap and internal-link updates.

Out of scope: a new checkout, email capture or lead magnet, testimonials, a money-back guarantee, and any change to the three Stripe links.

## Offer (source of truth: `services/index.html` products section)

| Item | Price | Stripe link |
|---|---|---|
| Behavioral Health Policy Inventory & Learning Guide (PDF 1, Foundations) | $67 | `https://buy.stripe.com/cNibJ16HKgL75XgaSm4Ja02` |
| Supervisor & Manager Toolkit and Reflection (PDF 2, Readiness) | $67 | `https://buy.stripe.com/bJecN57LO0M9gBU9Oi4Ja01` |
| Bundle of both | $99 (vs $134 separate, saves $35) | `https://buy.stripe.com/6oU4gz3vyeCZ0CW2lQ4Ja00` |

Copy rules:
- The second product is labelled "Toolkit", not "Checklist" (the current services page says "Buy Checklist"). Card copy is written in the second person.
- Facts used: 69 policy topic inventory; "What does it have to do with me?"; real life scenarios; skills and tools; unlocks instantly plus a copy by email; PDF not received within 48 hours means resend.
- No invented page counts, statistics, testimonials or guarantees. The refund wording mirrors `refunds/index.html` (case by case; duplicates and delivery failures typically honored).
- Keep the footer disclaimer: educational only, not legal advice, licensure not guaranteed.

## Page structure

1. **Slim header:** logo mark plus wordmark, and a "Questions?" link to `/faq/`. No full nav, to keep focus on the buy action.
2. **Hero:** headline "Know which policies apply to *you*. Lead with confidence." with a lead paragraph, $99 price line ("$134 separate", "Save $35"), primary bundle button, secondary single-guide links, audience chips, and CSS cover mockups (no image files).
3. **Problem strip:** four pains (policy relevance, doing it right, new supervisor, continued growth).
4. **Two product blocks:** contents, who each is for, single-guide button.
5. **Bundle block:** price comparison and bundle button.
6. **How it works and trust:** secure checkout, instant unlock, support and refund link; a short "who's behind it" card with a logo watermark.
7. **Blog section:** three article cards.
8. **FAQ (5 questions):** delivery, which guide, legal/licensure disclaimer, refunds, team/organization help. Marked up as FAQPage schema.
9. **Final call to action** and legal footer.
10. **Sticky bottom bar** with the bundle button on every viewport.

## Design system

Reuse the site's system: paper `#F5F8F4`, mint `#EAF3EF`/`#D8F0EA`, teal `#0F766E`/`#0B5F59`, brown `#4B3021`, ink `#12201C`. Playfair Display for headings, Montserrat for labels and body. Primary buttons are brown. The logo is `/assets/logo-mark.png` in the header and footer.

## Implementation notes

- Follow existing page conventions: Tailwind CDN, Iconify, GTM snippet, `assets/mail-protect.js`, `assets/footer.css`, and the shared footer synced via `python3 scripts/sync-footer.py`.
- The page uses its own slim header instead of the full nav, but reuses the shared footer block.
- Buy buttons push `guides_buy_click` to `dataLayer`, with `offer` (bundle, guide, toolkit) and `placement` (button id). Use one small `assets/guides.js`.
- SEO: unique title and meta description, canonical `https://www.grow2guide.com/guides/`, Open Graph and Twitter tags matching existing pages (reuse `assets/og-image.jpg`), and JSON-LD for `Product` (two products plus an Offer for the bundle) and `FAQPage`.
- Add `/guides/` to `sitemap.xml`. Add a "Guides" link to the nav and footer only if you approve it; by default, link from the services page products section and the blog.
- UTM parameters need no special handling because the page is static and links out to Stripe.

## Blog

Built from `components/blog-post-template.html`, one folder per post. Each post links to `/guides/` mid-article and ends with a CTA block. The blog index gets three cards (replacing the "coming soon" card).

| Slug | Title | Audience |
|---|---|---|
| `policies-every-bht-case-manager-should-know` | Policies every BHT and case manager should know | Case managers, BHTs |
| `first-time-supervisor-mistakes` | First-time supervisor mistakes, and what to do instead | New supervisors |
| `read-a-policy-manual` | How to read a policy manual without getting lost | Everyone |

Content rules: general educational guidance only; no legal, clinical or licensure claims; no statistics unless verified. All three are flagged for your review before publishing. The landing page's blog cards link to these real URLs (the preview links to `/blog/`).

## Verification

Per AGENTS.md:
- Serve locally with `python3 -m http.server 8000` and check `/guides/` and the three posts at desktop and mobile widths.
- Check that all three Stripe links, the sticky bar, FAQ details, blog links and the logo load, and that the console shows no errors and no missing assets.
- Run `python3 scripts/sync-footer.py --check`.
- Confirm the `guides_buy_click` events appear in `dataLayer`.

## Open items

- Confirm the final blog post topics and review the drafts.
- Decide whether to add a "Guides" nav/footer link.
- Optional later: replace CSS cover mockups with real cover images, and add real testimonials when available.
