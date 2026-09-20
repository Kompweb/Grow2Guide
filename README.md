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
- `handbook/`: handbook pages; see [README.handbook.md](README.handbook.md).
- `terms/`, `privacy/`, `refunds/`: policy pages.
- `styles.css` and page-level `<style>` blocks: site styling.
- `assets/`: images, documents, and JavaScript.
- `archive/`: historical page snapshots.
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
- For forms, check validation and navigation between steps. Successful submission
  opens an email draft through the visitor's mail application.
- Check the browser console for errors and network requests for missing assets.
- With Node.js installed, check a changed script with `node --check assets/<file>.js`.
