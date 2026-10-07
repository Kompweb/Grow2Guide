"""Create blog/<slug>/index.html from components/blog-post-template.html.

Usage: python3 scripts/new-post.py --slug S --title T [--seo-title ST] --description D --date YYYY-MM-DD < article.html
The article HTML (h2/h3/p/ul/ol/blockquote) is read from stdin. The template's
generic consultation aside is replaced with a call to action for /guides/.
"""
import argparse
import json
import math
import re
import sys
from datetime import date
from html import escape
from pathlib import Path

root = Path(__file__).resolve().parents[1]
ap = argparse.ArgumentParser()
ap.add_argument("--slug", required=True)
ap.add_argument("--title", required=True)
ap.add_argument("--seo-title", default=None, help="<title>/og:title text; defaults to --title")
ap.add_argument("--description", required=True)
ap.add_argument("--date", required=True)
args = ap.parse_args()

if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", args.slug):
    sys.exit("Slug must be lowercase letters, digits and single hyphens, e.g. my-first-post")
if not 120 <= len(args.description) <= 160:
    sys.exit(f"Description must be 120-160 characters, got {len(args.description)}")
article = sys.stdin.read().strip()
if not article:
    sys.exit("Article HTML is required on stdin")
target = root / "blog" / args.slug / "index.html"
if target.exists():
    sys.exit(f"{target.relative_to(root)} already exists")

seo_title = args.seo_title or args.title
d = date.fromisoformat(args.date)
display = f"{d:%B} {d.day}, {d.year}"
html = (root / "components/blog-post-template.html").read_text()
html = re.sub(r"<!--\n  Blog post template\..*?-->\n", "", html, count=1, flags=re.S)
def fill(text, title, description, seo_title):
    return text.replace("{{SEO_TITLE}}", seo_title).replace("{{TITLE}}", title).replace("{{DESCRIPTION}}", description)

def json_text(value):
    return json.dumps(value, ensure_ascii=False)[1:-1].replace("</", "<\\/")

# Inside the JSON-LD block values are JSON-escaped; everywhere else they are HTML-escaped.
html = re.sub(r'(<script type="application/ld\+json">)(.*?)(</script>)',
              lambda m: m.group(1) + fill(m.group(2), json_text(args.title), json_text(args.description), json_text(seo_title)) + m.group(3),
              html, flags=re.S)
html = fill(html, escape(args.title), escape(args.description), escape(seo_title))
read_min = max(1, math.ceil(len(re.sub(r"<[^>]+>", " ", article).split()) / 200))
html = html.replace("{{READ_MIN}}", str(read_min)).replace("{{SLUG}}", args.slug).replace("{{DATE_ISO}}", args.date).replace("{{DATE_DISPLAY}}", display)

placeholder = re.compile(r'<div class="prose-g2g">.*?</div>', re.S)
html, n = placeholder.subn(lambda _: '<div class="prose-g2g">\n' + article + "\n            </div>", html, count=1)
assert n == 1, "article block not found in template"

aside = re.compile(r'<aside class="mt-8.*?</aside>', re.S)
cta = """<aside class="mt-8 sm:mt-10 bg-[#EAF3EF] rounded-[20px] sm:rounded-[24px] p-5 sm:p-8 border border-[#0F766E]/10">
          <h2 class="text-xl sm:text-2xl font-bold tracking-tight mb-2">Want the full picture?</h2>
          <p class="text-[15px] sm:text-base text-[#5A6A63] leading-relaxed mb-5">Get both Grow2Guide PDF guides: the 69-topic Policy Inventory &amp; Learning Guide and the Supervisor &amp; Manager Toolkit. Bundle price $99. Unlocks instantly, plus a copy by email.</p>
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
