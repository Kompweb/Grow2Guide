"""Render a 1200x630 share card (assets/og/<slug>.jpg) for a blog post.

Usage:
  python3 scripts/og_image.py --slug S --title T --minutes N   # one card
  python3 scripts/og_image.py --all                            # every post, from its H1 and "N min read"
  python3 scripts/og_image.py --only S                         # one existing post

Renders components/og-card.html in headless Chrome (needs internet for the Google fonts)
and saves an optimized JPEG. Set CHROME_BIN if Chrome is not in a standard location.
"""
import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
from html import escape, unescape
from pathlib import Path

from PIL import Image

root = Path(__file__).resolve().parents[1]
CARD = root / "components/og-card.html"
OUT = root / "assets/og"
SIZE = (1200, 630)


def find_chrome():
    for candidate in (os.environ.get("CHROME_BIN"),
                      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
                      shutil.which("google-chrome"), shutil.which("chromium"), shutil.which("chromium-browser")):
        if candidate and Path(candidate).exists():
            return candidate
    raise SystemExit("Chrome not found. Install it or set CHROME_BIN to its path.")


def render(slug, title, minutes):
    """Write assets/og/<slug>.jpg and return its path. `title` is plain text."""
    html = CARD.read_text()
    html = (html.replace("{{TITLE}}", escape(title))
                .replace("{{META}}", escape(f"By Sara Tudor · {minutes} min read"))
                .replace("{{LOGO_URL}}", (root / "assets/logo-mark.png").as_uri()))
    assert "{{" not in html
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        page, png = Path(tmp) / "card.html", Path(tmp) / "card.png"
        page.write_text(html)
        subprocess.run([find_chrome(), "--headless=new", "--disable-gpu", "--hide-scrollbars", "--virtual-time-budget=15000",
                        f"--window-size={SIZE[0]},{SIZE[1]}", f"--screenshot={png}", page.as_uri()],
                       check=True, timeout=90, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if not png.exists():
            raise SystemExit(f"Chrome did not produce a screenshot for {slug}")
        img = Image.open(png).convert("RGB")
        if img.size != SIZE:
            img = img.crop((0, 0, *SIZE)) if img.size[0] >= SIZE[0] and img.size[1] >= SIZE[1] else img.resize(SIZE)
        target = OUT / f"{slug}.jpg"
        img.save(target, "JPEG", quality=86, optimize=True, progressive=True)
    return target


def post_info(slug):
    page = (root / "blog" / slug / "index.html").read_text()
    h1 = re.search(r'<h1[^>]*>(.*?)</h1>', page, re.S).group(1)
    minutes = re.search(r'(\d+) min read', page).group(1)
    return unescape(re.sub(r"<[^>]+>", "", h1)).strip(), minutes


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--slug")
    ap.add_argument("--title")
    ap.add_argument("--minutes")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--only")
    a = ap.parse_args()
    if a.all or a.only:
        slugs = [a.only] if a.only else sorted(p.parent.name for p in (root / "blog").glob("*/index.html") if p.parent.name != "blog")
        for slug in slugs:
            title, minutes = post_info(slug)
            print("wrote", render(slug, title, minutes).relative_to(root))
    elif a.slug and a.title and a.minutes:
        print("wrote", render(a.slug, a.title, a.minutes).relative_to(root))
    else:
        sys.exit("Give --all, --only SLUG, or --slug/--title/--minutes")
