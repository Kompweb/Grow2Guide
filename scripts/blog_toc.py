"""Add ids to a post's h2 headings and build the "In this article" jump list.

Used by scripts/new-post.py for new posts. Run on its own to (re)build the list in
every existing post after you edit a heading:  python3 scripts/blog_toc.py
Safe to re-run: the list lives between <!-- toc:start --> and <!-- toc:end -->.
"""
import re
import sys
from html import escape
from pathlib import Path

PROSE = re.compile(r'(<div class="prose-g2g">)(.*?)(</div>\s*</div>\s*</article>)', re.S)
H2 = re.compile(r'<h2(?: id="[^"]*")?>(.*?)</h2>', re.S)
MARKERS = re.compile(r'<!-- toc:start -->.*?<!-- toc:end -->', re.S)


def slugify(text):
    text = re.sub(r"<[^>]+>", "", text).lower()
    text = re.sub(r"[’'“”\"]", "", text)
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-") or "section"


def add_ids(article):
    """Return (article with unique id on every h2, [(id, plain heading text), ...])."""
    seen, headings = set(), []

    def put_id(match):
        base = slugify(match.group(1))
        slug, n = base, 2
        while slug in seen:
            slug, n = f"{base}-{n}", n + 1
        seen.add(slug)
        headings.append((slug, re.sub(r"<[^>]+>", "", match.group(1)).strip()))
        return f'<h2 id="{slug}">{match.group(1)}</h2>'

    return H2.sub(put_id, article), headings


def toc_block(headings):
    if len(headings) < 3:
        return "<!-- toc:start --><!-- toc:end -->"
    items = "".join(f'<li><a href="#{slug}">{escape(text, quote=False)}</a></li>' for slug, text in headings)
    return ('<!-- toc:start -->\n'
            '            <details class="toc"><summary>In this article</summary>'
            f'<ol>{items}</ol></details>\n'
            '            <!-- toc:end -->')


def apply_to_page(html):
    """Add ids inside the post body and (re)build the list in the header."""
    m = PROSE.search(html)
    if not m:
        raise ValueError("article block not found")
    body, headings = add_ids(m.group(2))
    html = html[:m.start(2)] + body + html[m.end(2):]
    block = toc_block(headings)
    if MARKERS.search(html):
        html = MARKERS.sub(lambda _: block, html, count=1)
    else:
        html, n = re.subn(r'(</p>\s*)(</header>)', lambda x: x.group(1) + "  " + block + "\n          " + x.group(2), html, count=1)
        if n != 1:
            raise ValueError("header end not found")
    return html


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    for page in sorted((root / "blog").glob("*/index.html")):
        page.write_text(apply_to_page(page.read_text()))
        print("updated", page.relative_to(root))
