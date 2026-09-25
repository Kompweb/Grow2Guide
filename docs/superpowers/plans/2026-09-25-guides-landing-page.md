# Guides Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a conversion-focused `/guides/` landing page for the two $67 PDF guides (bundle-led at $99) plus three launch blog posts that link to it.

**Architecture:** A static HTML page in the site's existing conventions (Tailwind CDN, GTM, shared footer synced by `scripts/sync-footer.py`). The approved design lives in `docs/superpowers/plans/guides-page-source.html`; a one-off builder converts it into `guides/index.html` and `assets/guides.js`. Blog posts are generated from `components/blog-post-template.html` by a small committed helper, `scripts/new-post.py`.

**Tech Stack:** Plain HTML/CSS/JS, Tailwind CDN, Python 3 (build helpers), Node (syntax check). No build step, no test runner (per AGENTS.md).

**Spec:** `docs/superpowers/specs/2026-09-25-guides-landing-page-design.md`. Approved preview: https://claude.ai/artifact/S4zyXCy7AXWx4v7oEfT6RA

## Global Constraints

- Stripe links, unchanged: guide `https://buy.stripe.com/cNibJ16HKgL75XgaSm4Ja02` ($67), toolkit `https://buy.stripe.com/bJecN57LO0M9gBU9Oi4Ja01` ($67), bundle `https://buy.stripe.com/6oU4gz3vyeCZ0CW2lQ4Ja00` ($99, "$134 separate", "Save $35").
- The second product is "Toolkit", never "Checklist". Card copy is second person.
- No invented page counts, statistics, testimonials or guarantees. Refund wording mirrors `refunds/index.html`.
- Keep the disclaimer: educational only, not legal advice, licensure not guaranteed.
- Site palette: paper `#F5F8F4`, mint `#EAF3EF` / `#D8F0EA`, teal `#0F766E` / `#0B5F59`, brown `#4B3021`, ink `#12201C`. Fonts: Playfair Display and Montserrat.
- Canonical origin `https://www.grow2guide.com`. New URLs: `/guides/` and `/blog/<slug>/`.
- Pages are 2-space indented, double-quoted; each live `index.html` has exactly one `<footer>` (the shared footer is synced in by `scripts/sync-footer.py`).
- Commits: short, imperative, scoped, ending with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. Only `git add` the paths named in each task.
- `services/index.html` already has the owner's uncommitted edits. Never stage it; Task 5 edits it but leaves that change uncommitted.

## Review Focus

- **Stripe links drift or get mixed up** (a button pointing at the wrong product or price): Task 1 asserts each URL's exact `href` count (guide 2, toolkit 2, bundle 4).
- **Layout breaks at 320-390px, or the fixed buy bar hides the footer:** Task 1 checks horizontal overflow and that the last footer link stays visible above the bar.
- **JavaScript blocked, or GTM/`dataLayer` absent:** the buy buttons are plain anchors and `guides.js` creates `dataLayer` if missing. Task 1 runs `guides.js` in Node against a stub DOM.
- **Placeholder text, wrong canonical or a sitemap entry with no page:** Tasks 2-5 grep for `{{`, compare canonical to path, and check every sitemap `<loc>` maps to a file.
- **Duplicate ids, dead `#anchors`, or unverified marketing claims** (for example "for every topic", "same work", "money-back"): Task 1 greps for banned phrases and checks anchors and ids.

---

### Task 1: Landing page

**Files:**
- Create: `guides/index.html`, `assets/guides.js`
- Already present (input): `docs/superpowers/plans/guides-page-source.html`
- Commit also: the spec and this plan.

**Interfaces:**
- Produces: the `/guides/` URL, and blog-card hrefs `/blog/policies-every-bht-case-manager-should-know/`, `/blog/first-time-supervisor-mistakes/`, `/blog/read-a-policy-manual/` (Tasks 2-4 must create exactly these slugs).
- Produces: `assets/guides.js` pushes `{event: "guides_buy_click", offer, placement}` for every `[data-offer]` click.

- [ ] **Step 1: Save the builder script**

Save this as `$TMPDIR/build_guides.py` (outside the repo; it is a one-off). It converts the approved preview source into the site page: it swaps in the site head (GTM, Tailwind, OG, JSON-LD), removes the preview-only footer and draft note, points blog cards at real URLs, renames `.sticky` to `.buy-bar` (Tailwind has a `.sticky` utility that would clash), makes links relative, moves the inline script to `assets/guides.js`, and drops two lines that claimed more than the product cards say.

```python
"""One-off: turn docs/superpowers/plans/guides-page-source.html into guides/index.html + assets/guides.js."""
import re, sys
from pathlib import Path

root = Path(sys.argv[1])
out = Path(sys.argv[2]) if len(sys.argv) > 2 else root
src = (root / "docs/superpowers/plans/guides-page-source.html").read_text()

def once(text, old, new):
    assert text.count(old) == 1, f"expected exactly one: {old[:60]!r} (found {text.count(old)})"
    return text.replace(old, new)

css = re.search(r"<style>(.*?)</style>", src, re.S).group(1)
body = src[src.index('<div class="wrap">'):]

# ---- CSS edits
css = re.sub(r"  footer \{[^\n]*\n  footer nav \{[^\n]*\n  footer nav a \{[^\n]*\n  footer nav a:hover \{[^\n]*\n", "", css)
css = re.sub(r"    footer \{ grid-template-columns[^\n]*\n", "", css)
css = re.sub(r"  \.draft-note \{[^\n]*\n", "", css)
css = once(css, "padding-inline: 16px; padding-block: 0 96px;", "padding-block: 0 76px;")
css = once(css, ".wrap { max-width: 1080px; margin-inline: auto; }", ".wrap { max-width: 1080px; margin-inline: auto; padding-inline: 16px; }")
css = once(css, "    body { padding-inline: 32px; }", "    .wrap { padding-inline: 32px; }")
css = css.replace("/* sticky buy bar */", "/* buy bar */").replace(".sticky", ".buy-bar")
css = css.replace("text-underline-offset: 3px;", "text-decoration: underline; text-underline-offset: 3px;")
assert "footer nav" not in css and "draft-note" not in css and "sticky" not in css
site_css = """
  /* shared footer and brand styles (same as other live pages) */
  .container-custom { max-width: 1120px; margin: 0 auto; padding: 0 24px; }
  .g2g-wordmark { margin: 0; font-family: "Playfair Display", Georgia, serif; font-size: clamp(22px, 2.5vw, 34px); font-weight: 600; line-height: 1; letter-spacing: -0.03em; color: #174d35; }
  .g2g-wordmark .g2g-number { color: #4b3021; }
  .g2g-logo-mark { width: 72px; height: 72px; object-fit: contain; }
  #footer-logo-link > span { align-items: stretch; text-align: center; }
  #footer-logo-link .g2g-wordmark { font-size: clamp(32px, 4.6vw, 44px); }
  #footer-logo-link .g2g-tagline { font-size: clamp(12px, 1.5vw, 14px); transform: scaleX(.9); }
  .g2g-tagline { margin-top: 2px; font-family: "Montserrat", Arial, sans-serif; font-size: 12px; font-weight: 500; letter-spacing: 0; text-transform: uppercase; color: #4b3021; }
"""

# ---- body edits
head_end = body.index("  <footer>")
foot_end = body.index("</footer>") + len("</footer>")
body = body[:head_end].rstrip() + "\n  </div>\n\n  <footer></footer>\n" + body[foot_end:]
# the original closing </div> for .wrap followed the old footer; remove that stray one
body = once(body, "  <footer></footer>\n\n</div>\n", "  <footer></footer>\n")
body = re.sub(r'\s*<p class="draft-note">.*?</p>', "", body)
body = once(body, "&rdquo; for every topic</li>", "&rdquo;</li>")
body = once(body, " These guides come from that same work.", "")
for old, slug in [("policies-bht-case-manager", "policies-every-bht-case-manager-should-know"),
                  ("first-time-supervisor", "first-time-supervisor-mistakes"),
                  ("read-policy-manual", "read-a-policy-manual")]:
    body = once(body, f'href="https://www.grow2guide.com/blog/" data-post="{old}"', f'href="/blog/{slug}/" data-post="{slug}"')
body = body.replace('class="sticky"', 'class="buy-bar"')
body = body.replace("https://www.grow2guide.com/", "/")
script = re.search(r"<script>(.*?)</script>", body, re.S).group(1)
body = re.sub(r"<script>.*?</script>", "", body, flags=re.S).rstrip() + "\n"
js = "\n".join(l[2:] if l.startswith("  ") else l for l in script.strip("\n").splitlines())
js = js.replace("// Draft preview: push buy-click events", "// Push buy-click events").replace(" so the offers can be compared in the live page.", " so the offers can be compared in GTM.")
js = "(function () {\n  " + js.replace("\n", "\n  ") + "\n})();\n"

TITLE = "Policy & Supervisor PDF Guides for Behavioral Health | Grow2Guide"
DESC = "Two practical PDF guides for behavioral health staff: a 69-topic policy inventory and a supervisor and manager toolkit. Bundle both for $99. Instant delivery."
faq = [
 ("How do I receive the PDF?", "After payment, your PDF unlocks instantly and a copy is sent to your email. If you don’t have it within 48 hours of confirmed payment, email us and we’ll resend it or resolve it promptly."),
 ("Which guide is right for me?", "If you’re a case manager, BHT or direct care staff who wants to understand how policies apply to you, start with the Policy Inventory & Learning Guide. If you’re stepping into, or already in, a supervisor or manager role, the Toolkit is the fit. Many people want both, which is what the $99 bundle covers."),
 ("Is this legal advice, or does it guarantee licensure?", "No. These are educational resources only, not legal advice, and licensure is not guaranteed. They help you understand and reflect; your organization’s own policies and your state’s requirements always come first."),
 ("What is your refund policy?", "Because files can be copied once delivered, refunds are reviewed case by case. Duplicate purchases and delivery failures are typically honored."),
 ("Can I get help for my whole team or organization?", "Yes. Grow2Guide also offers consulting for organizations. Request a consultation to talk through fit and scope."),
]
import json
def prod(name, desc, url, price):
    return {"@type": "Product", "name": name, "description": desc, "brand": {"@type": "Brand", "name": "Grow2Guide"},
            "offers": {"@type": "Offer", "url": url, "price": price, "priceCurrency": "USD", "availability": "https://schema.org/InStock"}}
graph = {"@context": "https://schema.org", "@graph": [
  prod("Behavioral Health Policy Inventory & Learning Guide", "A 69-topic policy inventory that shows how policies and systems apply to case managers, BHTs and direct care staff. PDF.", "https://buy.stripe.com/cNibJ16HKgL75XgaSm4Ja02", "67.00"),
  prod("Supervisor & Manager Toolkit and Reflection", "Real life scenarios, skills and tools for new and established supervisors and managers. PDF.", "https://buy.stripe.com/bJecN57LO0M9gBU9Oi4Ja01", "67.00"),
  prod("Grow2Guide Guides Bundle", "Both PDF guides: the Policy Inventory & Learning Guide and the Supervisor & Manager Toolkit and Reflection.", "https://buy.stripe.com/6oU4gz3vyeCZ0CW2lQ4Ja00", "99.00"),
  {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]},
]}
ld = json.dumps(graph, indent=2, ensure_ascii=False)
alt = "Grow2Guide — practical resources and real-world consulting for behavioral health organizations"

page = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <!-- Google Tag Manager -->
  <script>(function(w,d,s,l,i){{w[l]=w[l]||[];w[l].push({{"gtm.start":
  new Date().getTime(),event:"gtm.js"}});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!="dataLayer"?"&l="+l:"";j.async=true;j.src=
  "https://www.googletagmanager.com/gtm.js?id="+i+dl;f.parentNode.insertBefore(j,f);
  }})(window,document,"script","dataLayer","GTM-WLRZD726");</script>
  <!-- End Google Tag Manager -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap" rel="stylesheet">
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" type="image/png" sizes="64x64" href="/assets/favicon.png" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js"></script>
  <script src="/assets/mail-protect.js" defer></script>
  <script src="/assets/guides.js" defer></script>
  <title>{TITLE}</title>
  <meta name="description" content="{DESC}" />
  <link rel="canonical" href="https://www.grow2guide.com/guides/" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Grow2Guide" />
  <meta property="og:title" content="{TITLE}" />
  <meta property="og:description" content="{DESC}" />
  <meta property="og:url" content="https://www.grow2guide.com/guides/" />
  <meta property="og:image" content="https://www.grow2guide.com/assets/og-image.jpg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="{alt}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="https://www.grow2guide.com/assets/og-image.jpg" />
  <meta name="twitter:image:alt" content="{alt}" />
  <script type="application/ld+json">
{ld}
  </script>
  <style>{css.rstrip()}
{site_css}  </style>
  <link rel="stylesheet" href="/assets/footer.css" />
</head>
<body>
  <!-- Google Tag Manager (noscript) -->
  <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-WLRZD726"
  height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
  <!-- End Google Tag Manager (noscript) -->
  {body}</body>
</html>
"""
(out / "guides").mkdir(parents=True, exist_ok=True)
(out / "assets").mkdir(parents=True, exist_ok=True)
(out / "guides/index.html").write_text(page)
(out / "assets/guides.js").write_text(js)
print("desc length", len(DESC), "| page KB", len(page) // 1024)
```

- [ ] **Step 2: Run the builder from the repo root**

Run: `python3 "$TMPDIR/build_guides.py" .`
Expected: `desc length 158 | page KB 35` and new files `guides/index.html`, `assets/guides.js`.

- [ ] **Step 3: Sync the shared footer**

Run: `python3 scripts/sync-footer.py && python3 scripts/sync-footer.py --check`
Expected: `Updated 1 pages.` then `Shared footers verified.` If it says `Expected one footer`, the builder left zero or two `<footer>` tags: fix and rerun step 2 (delete `guides/` first).

- [ ] **Step 4: Static checks (they fail if any Review Focus item regresses)**

Run:
```bash
python3 - <<'EOF'
import re, json
h = open("guides/index.html").read()
urls = {"guide": "https://buy.stripe.com/cNibJ16HKgL75XgaSm4Ja02",
        "toolkit": "https://buy.stripe.com/bJecN57LO0M9gBU9Oi4Ja01",
        "bundle": "https://buy.stripe.com/6oU4gz3vyeCZ0CW2lQ4Ja00"}
counts = {k: h.count(f'href="{u}"') for k, u in urls.items()}
assert counts == {"guide": 2, "toolkit": 2, "bundle": 4}, counts
ids = re.findall(r'\bid="([^"]+)"', h)
assert len(ids) == len(set(ids)), "duplicate ids"
for anchor in ("guide-1", "guide-2", "guides"):
    assert f'id="{anchor}"' in h, anchor
for href in re.findall(r'href="#([^"]+)"', h):
    assert f'id="{href}"' in h, f"dead anchor #{href}"
assert h.count("<footer") == 1 and h.count("<h1") == 1
banned = re.findall(r"(?i)money-back|testimonial|for every topic|same work|Checklist|lorem", h)
assert not banned, banned
assert 'href="/blog/policies-every-bht-case-manager-should-know/"' in h
assert "{{" not in h and "data:image" not in h
json.loads(re.search(r'application/ld\+json">(.*?)</script>', h, re.S).group(1))
print("guides page static checks OK", counts)
EOF
node --check assets/guides.js && echo "guides.js syntax OK"
```
Expected: `guides page static checks OK {'guide': 2, 'toolkit': 2, 'bundle': 4}` and `guides.js syntax OK`.

- [ ] **Step 5: Run `guides.js` against a stub DOM (no browser needed)**

Save as `$TMPDIR/guides_js_test.js`, run from the repo root with `node "$TMPDIR/guides_js_test.js"`:

```js
const fs = require("fs");
const clicks = [];
const els = [{ id: "hero-bundle-cta", attrs: { "data-offer": "bundle" }, getAttribute(n) { return this.attrs[n]; }, addEventListener(t, f) { this.fn = f; } }];
global.document = { querySelectorAll: (sel) => (sel === "[data-offer]" ? els : []) };
global.window = {};
eval(fs.readFileSync("assets/guides.js", "utf8"));
els[0].fn();
const ev = window.dataLayer[0];
if (ev.event !== "guides_buy_click" || ev.offer !== "bundle" || ev.placement !== "hero-bundle-cta") throw new Error(JSON.stringify(ev));
console.log("guides.js OK", JSON.stringify(ev));
```
Expected: `guides.js OK {"event":"guides_buy_click","offer":"bundle","placement":"hero-bundle-cta"}`. This also proves the script creates `window.dataLayer` when GTM is blocked.

- [ ] **Step 6: Check it in a browser (desktop and mobile)**

Run in a second terminal from the repo root: `python3 -m http.server 8000`, then open `http://localhost:8000/guides/`.
Check, at 1280px and at 390px and 320px wide:
- No horizontal scroll: in the console, `document.documentElement.scrollWidth === document.documentElement.clientWidth` is `true`.
- Hero shows the headline, `$99` price line, the bundle button, and both cover mockups without overlapping the text.
- The fixed bundle bar is visible. Scroll to the bottom with `window.scrollTo({top: document.body.scrollHeight, behavior: "instant"})` (the page uses smooth scrolling, so a plain `scrollTo` measures mid-animation), then confirm the Refunds link's `getBoundingClientRect().bottom` is at or above the bar's `getBoundingClientRect().top`. If it is not, raise `body { padding-bottom }` above 76px.
- Read the browser devtools console by hand (the `use_browser` helper does not capture it); it must show no errors.
- The logo mark loads in the header and as a faint watermark in the "Who's behind it" card; the shared footer renders with its own logo.
- FAQ items open and close; `#guide-1` and `#guide-2` links jump to the product blocks.
- Console has no errors. Network has no 404 (blog card links will 404 until Tasks 2-4 exist; that is expected here).
- Click the hero bundle button: in the console, `dataLayer` contains a `guides_buy_click` entry with `offer: "bundle"`.

- [ ] **Step 7: Fix anything the browser check found, then rerun steps 4-5**

- [ ] **Step 8: Commit**

```bash
git add guides/index.html assets/guides.js docs/superpowers/plans/guides-page-source.html docs/superpowers/plans/2026-09-25-guides-landing-page.md docs/superpowers/specs/2026-09-25-guides-landing-page-design.md
git commit -m "Add guides landing page" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Post generator and first post

**Files:**
- Create: `scripts/new-post.py`, `blog/policies-every-bht-case-manager-should-know/index.html`

**Interfaces:**
- Produces: `python3 scripts/new-post.py --slug S --title T --description D --date YYYY-MM-DD < article.html`. It requires a 150-160 character description, refuses to overwrite an existing post, replaces the template's consultation aside with a `/guides/` call to action, and exits non-zero if any `{{` placeholder remains. Tasks 3 and 4 reuse it.

- [ ] **Step 1: Create `scripts/new-post.py`**

```python
"""Create blog/<slug>/index.html from components/blog-post-template.html.

Usage: python3 scripts/new-post.py --slug S --title T --description D --date YYYY-MM-DD < article.html
The article HTML (h2/h3/p/ul/ol/blockquote) is read from stdin. The template's
generic consultation aside is replaced with a call to action for /guides/.
"""
import argparse
import re
import sys
from datetime import date
from pathlib import Path

root = Path(__file__).resolve().parents[1]
ap = argparse.ArgumentParser()
ap.add_argument("--slug", required=True)
ap.add_argument("--title", required=True)
ap.add_argument("--description", required=True)
ap.add_argument("--date", required=True)
args = ap.parse_args()

if not 150 <= len(args.description) <= 160:
    sys.exit(f"Description must be 150-160 characters, got {len(args.description)}")
article = sys.stdin.read().strip()
if not article:
    sys.exit("Article HTML is required on stdin")
target = root / "blog" / args.slug / "index.html"
if target.exists():
    sys.exit(f"{target.relative_to(root)} already exists")

d = date.fromisoformat(args.date)
display = f"{d:%B} {d.day}, {d.year}"
html = (root / "components/blog-post-template.html").read_text()
html = re.sub(r"<!--\n  Blog post template\..*?-->\n", "", html, count=1, flags=re.S)
html = html.replace("{{TITLE}}", args.title).replace("{{DESCRIPTION}}", args.description)
html = html.replace("{{SLUG}}", args.slug).replace("{{DATE_ISO}}", args.date).replace("{{DATE_DISPLAY}}", display)

placeholder = re.compile(r'<div class="prose-g2g">.*?</div>', re.S)
html, n = placeholder.subn(lambda _: '<div class="prose-g2g">\n' + article + "\n            </div>", html, count=1)
assert n == 1, "article block not found in template"

aside = re.compile(r'<aside class="mt-12.*?</aside>', re.S)
cta = """<aside class="mt-12 bg-[#EAF3EF] rounded-[24px] p-8 lg:p-10 border border-[#0F766E]/10">
          <h2 class="text-2xl font-bold tracking-tight mb-3">Want the full picture?</h2>
          <p class="text-[#5A6A63] leading-relaxed mb-6">Get both Grow2Guide PDF guides: the 69-topic Policy Inventory &amp; Learning Guide and the Supervisor &amp; Manager Toolkit. Bundle price $99. Unlocks instantly, plus a copy by email.</p>
          <div class="flex flex-col sm:flex-row gap-3">
            <a href="/guides/" class="btn-active bg-[#4b3021] text-white h-[52px] px-8 flex items-center justify-center rounded-full font-bold hover:bg-[#3a2519] transition-all">See both guides &mdash; $99</a>
            <a href="/blog/" class="btn-active bg-white border border-[#0F766E]/30 text-[#0F766E] h-[52px] px-8 flex items-center justify-center rounded-full font-bold hover:bg-[#D8F0EA] transition-all">More articles</a>
          </div>
        </aside>"""
html, n = aside.subn(lambda _: cta, html, count=1)
assert n == 1, "aside not found in template"

if "{{" in html:
    sys.exit("Unreplaced placeholder left in output")
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(html)
print(f"Wrote {target.relative_to(root)}")
```

- [ ] **Step 2: Confirm the guard rails fail correctly**

Run: `echo '<p>x</p>' | python3 scripts/new-post.py --slug tmp-check --title T --description short --date 2026-09-25; echo "exit $?"`
Expected: `Description must be 150-160 characters, got 5` and a non-zero exit. Confirm `ls blog` shows no `tmp-check` folder.

- [ ] **Step 3: Generate post 1**

```bash
python3 scripts/new-post.py \
  --slug policies-every-bht-case-manager-should-know \
  --title "Policies Every BHT and Case Manager Should Know" \
  --description "A plain-language look at the policy areas that touch a BHT or case manager's daily work, and a simple way to tell which ones are really yours to follow." \
  --date 2026-09-25 <<'HTML'
<p>Most policy manuals feel like they were written for someone else. Yet as a behavioral health technician (BHT) or case manager, you are the person most likely to meet these policies in real time: at intake, during a crisis, while writing a note at the end of a long shift. Knowing the main policy areas makes those moments less stressful.</p>
<p>Every organization writes its own policies, and state and federal rules add to them. Treat this article as a map, not a rulebook. Your employer&rsquo;s manual and your supervisor have the final word.</p>
<h2>The policy areas that touch your day</h2>
<h3>1. Client rights and confidentiality</h3>
<p>Who may see client information, what you may share, and with whom. Privacy laws such as HIPAA shape this in many settings, and substance use records can carry extra protections. When you are unsure, ask before you share.</p>
<h3>2. Documentation</h3>
<p>What must be recorded, how soon, and in what format. Notes show that care happened and let the next person pick up where you left off.</p>
<h3>3. Incident and critical event reporting</h3>
<p>What counts as an incident, who you tell, how quickly, and what you write down. Small events are worth knowing how to report, not only serious ones.</p>
<h3>4. Abuse, neglect and mandatory reporting</h3>
<p>Many people in these roles have reporting duties, and the details vary by state and by role. Find out exactly what applies to you and who at your organization to contact.</p>
<h3>5. Crisis, safety and emergency procedures</h3>
<p>What to do when someone is in crisis, when there is a safety concern, or when the building needs to be evacuated. Know the steps before you need them.</p>
<h3>6. Professional boundaries and ethics</h3>
<p>Gifts, dual relationships, social media, and contact outside work hours. Boundaries protect clients and you.</p>
<h3>7. The scope of your role</h3>
<p>What you may do, and what belongs to a licensed clinician, a nurse or a supervisor. If a task is not clearly part of your role, ask first.</p>
<h3>8. Complaints and grievances</h3>
<p>How a client or family member raises a concern, and what you do when they do.</p>
<blockquote><p>Want all 69 topics laid out for you? The <a href="/guides/">Behavioral Health Policy Inventory &amp; Learning Guide</a> is built around one question: &ldquo;What does it have to do with me?&rdquo;</p></blockquote>
<h2>Three questions to find which policies are yours</h2>
<ol>
  <li><strong>Who is named?</strong> Look for your job title or a description of your duties.</li>
  <li><strong>What does it ask me to do, or not do?</strong> Underline the action words.</li>
  <li><strong>Why does it exist?</strong> Knowing the reason makes the rule easier to follow and to explain.</li>
</ol>
<p>Once you can answer those three for each area above, you already understand more of your manual than most new staff do. For a method you can use on any policy, read <a href="/blog/read-a-policy-manual/">How to Read a Policy Manual Without Getting Lost</a>.</p>
<p><em>This article is educational and not legal advice. Follow your organization&rsquo;s own policies and your state&rsquo;s requirements.</em></p>
HTML
```
Expected: `Wrote blog/policies-every-bht-case-manager-should-know/index.html`.

- [ ] **Step 4: Sync footer and check**

Run: `python3 scripts/sync-footer.py && python3 scripts/sync-footer.py --check`
Expected: `Updated 1 pages.` then `Shared footers verified.`

Run:
```bash
python3 - <<'EOF'
p = "blog/policies-every-bht-case-manager-should-know/index.html"
h = open(p).read()
assert "{{" not in h and "Write the article here" not in h and "Blog post template" not in h
assert 'href="https://www.grow2guide.com/blog/policies-every-bht-case-manager-should-know/"' in h
assert 'href="/guides/"' in h and h.count("<h1") == 1 and h.count("<footer") == 1
print("post 1 checks OK")
EOF
```
Expected: `post 1 checks OK`.

- [ ] **Step 5: Look at it**

With `python3 -m http.server 8000` running, open `http://localhost:8000/blog/policies-every-bht-case-manager-should-know/` at 1280px and 390px: headings, ordered list, blockquote and the closing call-to-action card render; the two `/guides/` links and the cross-link to `/blog/read-a-policy-manual/` are present (that last one 404s until Task 4); console is clean.

- [ ] **Step 6: Commit**

```bash
git add scripts/new-post.py blog/policies-every-bht-case-manager-should-know/index.html
git commit -m "Add post generator and BHT policies post" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Post 2, first-time supervisor mistakes

**Files:**
- Create: `blog/first-time-supervisor-mistakes/index.html`

**Interfaces:**
- Consumes: `scripts/new-post.py` from Task 2.

- [ ] **Step 1: Generate the post**

```bash
python3 scripts/new-post.py \
  --slug first-time-supervisor-mistakes \
  --title "First-Time Supervisor Mistakes, and What to Do Instead" \
  --description "New to supervising? Six common first-time supervisor mistakes, from avoiding hard talks to skipping check-ins, and the simple habits that work better instead." \
  --date 2026-09-25 <<'HTML'
<p>Becoming a supervisor is one of the fastest role changes in behavioral health. One day you are a peer; the next, you are the person others look to when something goes wrong. Nearly everyone stumbles a little. These six mistakes are common, and each has a simple fix.</p>
<h2>1. Trying to stay everyone&rsquo;s friend</h2>
<p>Warmth matters, but leading means sometimes saying things people would rather not hear.</p>
<p><strong>Instead:</strong> Be friendly and clear. Set expectations early, in the same words for everyone.</p>
<h2>2. Avoiding the hard conversation</h2>
<p>Small problems rarely stay small. Waiting makes the conversation harder for both of you.</p>
<p><strong>Instead:</strong> Talk soon and in private. Describe what you saw, not what you assume about the person, and end with an agreed next step.</p>
<h2>3. Doing the work yourself instead of delegating</h2>
<p>It feels faster, until you are the bottleneck and your team stops growing.</p>
<p><strong>Instead:</strong> Hand off a task with a clear outcome and a check-in point. Expect it to be done a little differently than you would do it.</p>
<blockquote><p>Facing these situations for real? The <a href="/guides/">Supervisor &amp; Manager Toolkit and Reflection</a> includes real life scenarios plus skills and tools for new and established supervisors.</p></blockquote>
<h2>4. Guessing what your team needs</h2>
<p>Without regular conversations, you fill the gaps with assumptions.</p>
<p><strong>Instead:</strong> Hold short, regular one-on-ones. Two questions go a long way: What is getting in the way? What would help this week?</p>
<h2>5. Enforcing policies you have not read closely</h2>
<p>Staff will bring you policy questions on day one, and a confident wrong answer costs more than an honest pause.</p>
<p><strong>Instead:</strong> Read the policies your team touches most. When you do not know, say &ldquo;Let me find out,&rdquo; and follow up. Our guide to <a href="/blog/read-a-policy-manual/">reading a policy manual</a> can help.</p>
<h2>6. Skipping your own reflection</h2>
<p>When every day is urgent, there is no time to ask whether you are becoming the supervisor you set out to be.</p>
<p><strong>Instead:</strong> After a hard day, take five minutes with three questions: What went well? What would I do differently? What do I need to learn next?</p>
<h2>Start with one</h2>
<p>You do not need to fix all six this week. Pick the one that felt most familiar, try the replacement for two weeks, and notice what changes.</p>
<p><em>This article is educational and not legal advice. Follow your organization&rsquo;s own policies and your state&rsquo;s requirements.</em></p>
HTML
```
Expected: `Wrote blog/first-time-supervisor-mistakes/index.html`.

- [ ] **Step 2: Sync footer and check**

Run: `python3 scripts/sync-footer.py && python3 scripts/sync-footer.py --check`
Expected: `Updated 1 pages.` then `Shared footers verified.`

Run:
```bash
python3 - <<'EOF'
p = "blog/first-time-supervisor-mistakes/index.html"
h = open(p).read()
assert "{{" not in h and "Write the article here" not in h
assert 'href="https://www.grow2guide.com/blog/first-time-supervisor-mistakes/"' in h
assert 'href="/guides/"' in h and h.count("<h1") == 1 and h.count("<footer") == 1
print("post 2 checks OK")
EOF
```
Expected: `post 2 checks OK`.

- [ ] **Step 3: Look at it** at 1280px and 390px on `http://localhost:8000/blog/first-time-supervisor-mistakes/`: six numbered headings, blockquote CTA, closing CTA card, clean console.

- [ ] **Step 4: Commit**

```bash
git add blog/first-time-supervisor-mistakes/index.html
git commit -m "Add first-time supervisor mistakes post" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Post 3, read a policy manual

**Files:**
- Create: `blog/read-a-policy-manual/index.html`

**Interfaces:**
- Consumes: `scripts/new-post.py` from Task 2.

- [ ] **Step 1: Generate the post**

```bash
python3 scripts/new-post.py \
  --slug read-a-policy-manual \
  --title "How to Read a Policy Manual Without Getting Lost" \
  --description "Policy manuals are long and written for the whole organization. Here is a simple way to find what applies to your role and turn it into questions worth asking." \
  --date 2026-09-25 <<'HTML'
<p>A policy manual can run to hundreds of pages, and nobody reads it front to back. Reading it on purpose, with a method, is a skill, and it is one you can learn in an afternoon.</p>
<h2>Before you start</h2>
<ul>
  <li><strong>Check the date and version.</strong> An old copy can be wrong in ways that matter.</li>
  <li><strong>Look at the table of contents and the definitions.</strong> They show how the manual is organized and what its words mean.</li>
  <li><strong>Know your role.</strong> You are reading to find what applies to you.</li>
</ul>
<h2>A five-step way to read any policy</h2>
<ol>
  <li><strong>Read the purpose and scope first.</strong> They say why the policy exists and who it covers.</li>
  <li><strong>Note the definitions.</strong> Words like &ldquo;incident,&rdquo; &ldquo;emergency&rdquo; and &ldquo;client&rdquo; often have a specific meaning in a policy.</li>
  <li><strong>Find the action words.</strong> &ldquo;Must&rdquo; and &ldquo;shall&rdquo; describe requirements; &ldquo;should&rdquo; and &ldquo;may&rdquo; leave room for judgment. Note who is responsible and by when.</li>
  <li><strong>Note what to document, and where.</strong> Many policies depend on a form or a record.</li>
  <li><strong>Write down your questions.</strong> Anything unclear becomes a question for your supervisor.</li>
</ol>
<blockquote><p>Prefer to start from a finished inventory? The <a href="/guides/">Behavioral Health Policy Inventory &amp; Learning Guide</a> covers 69 policy topics and asks what each one has to do with you.</p></blockquote>
<h2>Turn it into a one-page cheat sheet</h2>
<p>For each policy that touches your role, write a few lines you can glance at during a busy shift:</p>
<ul>
  <li>What triggers it?</li>
  <li>What do I do?</li>
  <li>Who do I tell, and how fast?</li>
  <li>What do I write down?</li>
</ul>
<h2>When the policy is unclear</h2>
<p>Ask your supervisor, and write down the answer and the date. If what the policy says and what people actually do do not match, raise it. Do not guess.</p>
<p>New to leading others? Read <a href="/blog/first-time-supervisor-mistakes/">First-Time Supervisor Mistakes, and What to Do Instead</a>.</p>
<p><em>This article is educational and not legal advice. Follow your organization&rsquo;s own policies and your state&rsquo;s requirements.</em></p>
HTML
```
Expected: `Wrote blog/read-a-policy-manual/index.html`.

- [ ] **Step 2: Sync footer and check**

Run: `python3 scripts/sync-footer.py && python3 scripts/sync-footer.py --check`
Expected: `Updated 1 pages.` then `Shared footers verified.`

Run:
```bash
python3 - <<'EOF'
p = "blog/read-a-policy-manual/index.html"
h = open(p).read()
assert "{{" not in h and "Write the article here" not in h
assert 'href="https://www.grow2guide.com/blog/read-a-policy-manual/"' in h
assert 'href="/guides/"' in h and h.count("<h1") == 1 and h.count("<footer") == 1
print("post 3 checks OK")
EOF
```
Expected: `post 3 checks OK`.

- [ ] **Step 3: Look at it** at 1280px and 390px on `http://localhost:8000/blog/read-a-policy-manual/`: bulleted and numbered lists, blockquote CTA, closing CTA card, clean console.

- [ ] **Step 4: Commit**

```bash
git add blog/read-a-policy-manual/index.html
git commit -m "Add reading a policy manual post" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Blog index, sitemap, services link, final check

**Files:**
- Modify: `blog/index.html`, `sitemap.xml`, `services/index.html` (leave this one uncommitted)

**Interfaces:**
- Consumes: the three post slugs from Tasks 2-4 and `/guides/` from Task 1.

- [ ] **Step 1: Save the index/sitemap editor**

Save as `$TMPDIR/index_edit.py`. It replaces the "coming soon" card with the three post cards (newest first) and adds `/guides/` plus the three post URLs to the sitemap.

```python
"""One-off: put the three launch posts on the blog index and add new URLs to the sitemap."""
import sys
from pathlib import Path

POSTS = [
    ("policies-every-bht-case-manager-should-know", "Policies Every BHT and Case Manager Should Know",
     "A plain-language look at the policy areas that touch your daily work, and a simple way to tell which ones are really yours."),
    ("first-time-supervisor-mistakes", "First-Time Supervisor Mistakes, and What to Do Instead",
     "Six common mistakes new supervisors make, and the simple habits that work better."),
    ("read-a-policy-manual", "How to Read a Policy Manual Without Getting Lost",
     "A simple way to find what applies to your role and turn it into questions worth asking."),
]
DATE_ISO, DATE_DISPLAY = "2026-09-25", "September 25, 2026"

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]

cards = ""
for slug, title, excerpt in POSTS:
    cards += f"""          <a href="/blog/{slug}/" class="group block bg-white rounded-[20px] p-8 card-shadow border border-[#0F766E]/5 hover:border-[#0F766E]/20 transition-colors">
            <p class="text-sm font-semibold text-[#5A6A63] mb-2"><time datetime="{DATE_ISO}">{DATE_DISPLAY}</time></p>
            <h2 class="text-2xl font-bold tracking-tight mb-3 group-hover:text-[#0F766E] transition-colors">{title}</h2>
            <p class="text-[#5A6A63] leading-relaxed mb-4">{excerpt}</p>
            <span class="text-[#0F766E] font-bold">Read article &rarr;</span>
          </a>
"""

blog = root / "blog/index.html"
s = blog.read_text()
start = s.index('<div id="post-empty"')
end = s.index("        </div>\n      </div>\n    </main>")
s = s[:start] + cards.lstrip() + s[end:]
blog.write_text(s)

sm = root / "sitemap.xml"
t = sm.read_text()
def loc(path):
    return f"  <url><loc>https://www.grow2guide.com{path}</loc></url>\n"
t = t.replace(loc("/services/"), loc("/services/") + loc("/guides/"), 1)
t = t.replace(loc("/blog/"), loc("/blog/") + "".join(loc(f"/blog/{slug}/") for slug, _, _ in POSTS), 1)
assert t.count("<url>") == 13, t.count("<url>")
sm.write_text(t)
print("blog index and sitemap updated")
```

- [ ] **Step 2: Run it from the repo root**

Run: `python3 "$TMPDIR/index_edit.py" . && grep -c 'id="post-empty"' blog/index.html; grep -c '<url>' sitemap.xml`
Expected: `blog index and sitemap updated`, then `0` and `13`.

- [ ] **Step 3: Add the link on the services products section**

Run:
```bash
python3 - <<'EOF'
p = "services/index.html"
s = open(p).read()
old = """              Downloadable resources for busy clinical managers and behavioral health professionals.
            </p>"""
new = """              Downloadable resources for busy clinical managers and behavioral health professionals.
              <a href="/guides/" class="block mt-3 text-[#0F766E] font-bold underline underline-offset-4">See what&rsquo;s inside &rarr;</a>
            </p>"""
assert s.count(old) == 1, s.count(old)
open(p, "w").write(s.replace(old, new))
print("services link added")
EOF
```
Expected: `services link added`. Do not `git add` this file: it already holds the owner's uncommitted edits. Tell the owner.

- [ ] **Step 4: Final site-wide checks**

Run:
```bash
python3 scripts/sync-footer.py --check
python3 - <<'EOF'
import re
from pathlib import Path
locs = re.findall(r"<loc>https://www.grow2guide.com(/[^<]*)</loc>", open("sitemap.xml").read())
missing = [l for l in locs if not (Path(l.strip("/") or ".") / "index.html").exists()]
assert not missing, missing
g = open("guides/index.html").read()
b = open("blog/index.html").read()
for slug in re.findall(r'href="(/blog/[^"]+/)"', g):
    assert Path(slug.strip("/") + "/index.html").exists(), slug
    assert f'href="{slug}"' in b, f"blog index missing {slug}"
print("sitemap, guides links and blog index consistent:", len(locs), "urls")
EOF
```
Expected: `Shared footers verified.` then `sitemap, guides links and blog index consistent: 13 urls`.

- [ ] **Step 5: Click through in a browser**

With the server running: `http://localhost:8000/guides/` and click each of the three blog cards, then each post's "See both guides" button back to `/guides/`. Open `http://localhost:8000/blog/` (three cards, correct dates) and `http://localhost:8000/services/#products` (new "See what's inside" link goes to `/guides/`). All links resolve with no 404s; console clean.

- [ ] **Step 6: Commit (without services)**

```bash
git add blog/index.html sitemap.xml
git commit -m "List launch posts on blog index and add guides URLs to sitemap" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
git status --short
```
Expected: `git status` still shows ` M services/index.html` (uncommitted).

- [ ] **Step 7: Hand back to the owner**

Report: what was built; that the three articles need their review before publishing (behavioral health content); that `services/index.html` contains a new one-line link plus their earlier uncommitted edits, and is left for them to commit; that nothing is pushed or deployed; and any browser-check finding that was not fixed.
