"""Insert or refresh the "Keep reading" block on every blog post.

Usage: python3 scripts/related_posts.py
Edit RELATED to change which posts link to which. Titles and blurbs are read from
the cards in blog/index.html, so the index stays the single source of truth.
The block lives between <!-- related:start --> and <!-- related:end --> and is
placed right after the closing </aside> of the post's call to action. Re-running
replaces the block instead of adding a second one.
"""
import re
from html import escape
from pathlib import Path

root = Path(__file__).resolve().parents[1]

RELATED = {
    "do-i-hate-my-job-or-am-i-in-the-wrong-place": [
        "when-to-take-a-break-from-behavioral-health",
        "the-2-am-replay-after-a-hard-shift",
        "maybe-you-dont-want-to-be-a-supervisor",
    ],
    "i-didnt-know-wont-protect-you": [
        "late-to-work-nobody-said-a-word",
        "client-was-aggressive-is-not-a-note",
        "do-i-hate-my-job-or-am-i-in-the-wrong-place",
    ],
    "late-to-work-nobody-said-a-word": [
        "i-didnt-know-wont-protect-you",
        "maybe-you-dont-want-to-be-a-supervisor",
        "client-was-aggressive-is-not-a-note",
    ],
    "maybe-you-dont-want-to-be-a-supervisor": [
        "late-to-work-nobody-said-a-word",
        "client-was-aggressive-is-not-a-note",
        "do-i-hate-my-job-or-am-i-in-the-wrong-place",
    ],
    "the-2-am-replay-after-a-hard-shift": [
        "when-to-take-a-break-from-behavioral-health",
        "do-i-hate-my-job-or-am-i-in-the-wrong-place",
        "client-was-aggressive-is-not-a-note",
    ],
    "client-was-aggressive-is-not-a-note": [
        "i-didnt-know-wont-protect-you",
        "maybe-you-dont-want-to-be-a-supervisor",
        "late-to-work-nobody-said-a-word",
    ],
    "when-to-take-a-break-from-behavioral-health": [
        "the-2-am-replay-after-a-hard-shift",
        "do-i-hate-my-job-or-am-i-in-the-wrong-place",
        "maybe-you-dont-want-to-be-a-supervisor",
    ],
}

index = (root / "blog/index.html").read_text(encoding="utf-8")
cards = {}
for m in re.finditer(r'<a href="/blog/([a-z0-9-]+)/"[^>]*>(.*?)</a>', index, re.S):
    slug, body = m.group(1), m.group(2)
    h2 = re.search(r"<h2[^>]*>(.*?)</h2>", body, re.S)
    p = re.search(r'<p class="text-\[15px\][^>]*>(.*?)</p>', body, re.S)
    if h2 and p:
        cards[slug] = (h2.group(1).strip(), p.group(1).strip())

def block(slug):
    items = []
    for other in RELATED[slug]:
        title, blurb = cards[other]
        items.append(
            f'            <a href="/blog/{other}/" class="group block bg-white rounded-[20px] p-5 border border-[#0F766E]/10 hover:border-[#0F766E]/30 transition-colors">\n'
            f'              <h3 class="text-lg font-bold tracking-tight leading-snug mb-2 text-[#12201C] group-hover:text-[#0F766E] transition-colors">{title}</h3>\n'
            f'              <p class="text-[15px] text-[#5A6A63] leading-relaxed mb-3">{blurb}</p>\n'
            f'              <span class="text-[#0F766E] font-bold">Read article &rarr;</span>\n'
            f'            </a>'
        )
    return (
        "        <!-- related:start -->\n"
        '        <section class="mt-8 sm:mt-10" aria-labelledby="keep-reading-title">\n'
        '          <h2 id="keep-reading-title" class="text-xl sm:text-2xl font-bold tracking-tight text-[#12201C] mb-4">Keep reading</h2>\n'
        '          <div class="grid grid-cols-1 gap-4">\n'
        + "\n".join(items) + "\n"
        "          </div>\n"
        "        </section>\n"
        "        <!-- related:end -->\n"
    )

for slug in RELATED:
    path = root / "blog" / slug / "index.html"
    html = path.read_text(encoding="utf-8")
    html = re.sub(r"[ \t]*<!-- related:start -->.*?<!-- related:end -->\n", "", html, flags=re.S)
    anchor = "        </aside>\n"
    if html.count(anchor) != 1:
        raise SystemExit(f"{slug}: expected exactly one </aside> anchor, found {html.count(anchor)}")
    html = html.replace(anchor, anchor + block(slug), 1)
    path.write_text(html, encoding="utf-8")
    print("updated", slug)
