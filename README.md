# Grow2Guide

Static website served by GitHub Pages. Pages use plain HTML, CSS, and JavaScript;
there is no build step or package installation.

## Local preview

Run from the repository root:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`. Serve the root directory so absolute asset paths
and links work on nested pages.

## Project structure

- `index.html`: home page.
- `services/`, `consultation/`, `faq/`: service information and inquiries.
- `quiz/tier-1/`, `quiz/tier-2/`: multi-step inquiry forms.
- `self-assessment/`: Care & Workplace Competence Self-Assessment. Scored in the browser by `assets/self-assessment.js`; answers never leave the page.
- `blog/`: blog index and one folder per post; see [Adding a blog post](#adding-a-blog-post).
- `handbook/`: handbook pages; see [README.handbook.md](README.handbook.md).
- `newsletter/`: the newsletter is on Substack (grow2guide.substack.com), with a daily Google Sheets backup script; see `newsletter/README.md`.
- `workers/subscribe/`: Cloudflare Worker that sends Self-Assessment results emails through Resend; see its README.
- `terms/`, `privacy/`, `refunds/`: policy pages.
- `styles.css` and page-level `<style>` blocks: site styling.
- `assets/`: images, documents, and JavaScript.
- `archive/`: historical page snapshots.
- `sitemap.xml` and `robots.txt`: search-engine crawl hints.
- `CNAME` and `.nojekyll`: GitHub Pages hosting configuration.

## JavaScript

Live pages load shared scripts with `defer`, in this order:

1. `assets/mail-protect.js`: email links and the `window.g2gMail` helper.
2. `assets/mobile-menu.js`: menu toggling, icons, and expanded state.
3. `assets/nav-scroll.js`: navigation visibility, Escape, and outside-click handling.

Pages with additional interactions then load their own script: `home.js`,
`services.js`, `faq.js`, `consultation.js`, or `quiz-tier-1.js` / `quiz-tier-2.js`.
Keep shared menu behavior in `mobile-menu.js` so all pages stay consistent.

Tailwind CSS and Iconify load from CDNs, and fonts load from Google Fonts.
An internet connection is needed for those assets during local preview.

## Checking changes

The shared footer lives in `components/footer.html`, with shared styling in
`assets/footer.css`. After editing the footer template, run
`python3 scripts/sync-footer.py` to update every live page. Run
`python3 scripts/sync-footer.py --check` to verify they match. Footers remain
in the static HTML and work without JavaScript. Archived snapshots are excluded.

- Preview the affected pages at mobile and desktop widths.
- Check menu opening, closing, link clicks, Escape, and outside clicks.
- For the consultation and quiz forms, check validation and navigation between steps.
  Successful submission opens an email draft through the visitor's mail application.
  The newsletter sign-up is Substack's embedded form (see below).
- Check the browser console for errors and network requests for missing assets.
- With Node.js installed, check a changed script with `node --check assets/<file>.js`.

## Adding a blog post

Each post goes out on Substack first. The site version follows 1–2 weeks later and is written
for search: its own title and search phrase, longer and more step-by-step, with an FAQ. Do not
copy the Substack text word for word, or the two copies compete in search.

1. `mkdir blog/<slug>` and copy `components/blog-post-template.html` to
   `blog/<slug>/index.html`.
2. Link to the Substack post from the site version ("First published in the Grow2Guide newsletter").
3. Replace the `{{PLACEHOLDER}}` values (title, description, slug, dates) and write
   the article inside `<div class="prose-g2g">`.
4. Add a card to `blog/index.html` (newest first, card markup is in the comment
   there) and delete the "First articles coming soon" card.
5. Add the post URL to `sitemap.xml`.
6. Run `python3 scripts/sync-footer.py`.
7. Add a line matched to the post in `LINES` in `scripts/assessment_cta.py`, then run it. New posts
   already get the Self-Assessment card with the default line from the template.

## Newsletter signups

The subscribe block (`components/subscribe-form.html`) and the popup
(`components/subscribe-modal.html`, opened by `assets/subscribe-modal.js` on desktop exit
intent or after 45 seconds of inactivity) are copied into every page except `quiz/`,
`consultation/`, and `thank-you/` by `python3 scripts/sync-footer.py`, which also adds
`assets/subscribe.js` and `assets/subscribe-modal.js`. Edit a component, then re-run the script.
Both hold Substack's embedded form (`grow2guide.substack.com/embed`), so signups go straight to
Substack. `assets/subscribe.js` only reports `newsletter_form_view` and `newsletter_form_start` to GTM;
see `docs/analytics/README.md`.
Run every test with `node --test` from the repo root, and `python3 scripts/test_export_subscribers.py`.
