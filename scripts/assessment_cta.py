"""Insert or refresh the Self-Assessment card on every blog post and the post template.

Usage: python3 scripts/assessment_cta.py
Edit LINES to change the sentence matched to each post (DEFAULT is used for any post not
listed, and for the template, so new posts get the card too). The card lives between
<!-- assessment-cta:start --> and <!-- assessment-cta:end --> right after </article>.
Re-running replaces the card instead of adding a second one.
Clicks are counted by assets/assessment-cta.js (assessment_cta_click, placement blog_end).
"""
import re
from html import escape
from pathlib import Path

root = Path(__file__).resolve().parents[1]

# DRAFT wording, pending Sara's approval.
DEFAULT = "The free Self-Assessment looks at how you care for people and how you work with your team. See where you stand."
LINES = {
    "client-was-aggressive-is-not-a-note": "Writing down what happened, and responding to hard behavior with a plan, are habits the free Self-Assessment looks at. See how yours hold up.",
    "i-didnt-know-wont-protect-you": "Following policy, even the parts you would rather skip, is one of the habits the free Self-Assessment looks at. See where you stand.",
    "late-to-work-nobody-said-a-word": "Owning the small stuff before someone else has to is one of the habits the free Self-Assessment looks at. See where you stand.",
    "the-2-am-replay-after-a-hard-shift": "Staying steady when someone's behavior gets to you is one of the habits the free Self-Assessment looks at. See where you stand.",
    "do-i-hate-my-job-or-am-i-in-the-wrong-place": "Not sure if it is you or the place? The free Self-Assessment scores how you care for people and how you work within your agency separately.",
    "when-to-take-a-break-from-behavioral-health": "Before you decide, take an honest look at how you are doing at work. The free Self-Assessment shows your strengths and what is getting harder.",
    "maybe-you-dont-want-to-be-a-supervisor": "Taking feedback and handling disagreement are two of the habits the free Self-Assessment looks at. See where you stand before you decide.",
}

BLOCK = re.compile(r"\n?[ \t]*<!-- assessment-cta:start -->.*?<!-- assessment-cta:end -->", re.S)


def card(line):
    return f"""
        <!-- assessment-cta:start -->
        <aside class="mt-8 sm:mt-10 bg-white rounded-[20px] sm:rounded-[24px] p-5 sm:p-8 border-2 border-[#0F766E]/25" aria-labelledby="assessment-cta-title">
          <p class="text-[12px] font-bold tracking-[0.06em] uppercase text-[#0F766E] mb-1">Free self-assessment</p>
          <h2 id="assessment-cta-title" class="text-xl sm:text-2xl font-bold tracking-tight mb-2">See where you stand</h2>
          <p class="text-[15px] sm:text-base text-[#5A6A63] leading-relaxed mb-2">{escape(line)}</p>
          <p class="text-sm text-[#5A6A63] mb-5">32 questions. Private: your answers stay on your device.</p>
          <a href="/self-assessment/" data-assessment-cta="blog_end" class="btn-active inline-flex bg-[#0F766E] text-white h-[52px] px-8 items-center justify-center rounded-full font-bold hover:bg-[#0B5F59] transition-all">Take the Self-Assessment &rarr;</a>
        </aside>
        <!-- assessment-cta:end -->"""


pages = [(p, p.parent.name) for p in sorted((root / "blog").glob("*/index.html"))]
pages.append((root / "components/blog-post-template.html", None))
for page, slug in pages:
    html = page.read_text()
    html = BLOCK.sub("", html)
    if html.count("</article>") != 1:
        raise SystemExit(f"Expected one </article> in {page.relative_to(root)}")
    html = html.replace("</article>", "</article>" + card(LINES.get(slug, DEFAULT)), 1)
    page.write_text(html)
    print("updated", page.relative_to(root))
