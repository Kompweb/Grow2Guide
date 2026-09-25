"""Copy the shared footer and subscribe block into live pages; use --check to detect drift."""
from pathlib import Path
import re
import sys

root = Path(__file__).resolve().parents[1]
footer = (root / "components/footer.html").read_text().strip()
subscribe = (root / "components/subscribe-form.html").read_text().strip()
stylesheet = '  <link rel="stylesheet" href="/assets/footer.css" />'
subscribe_script = '  <script src="/assets/subscribe.js" defer></script>'
# Transactional flows keep a clean page without a newsletter prompt.
NO_SUBSCRIBE = {"quiz", "consultation", "thank-you"}
check = "--check" in sys.argv
outdated = []
pages = sorted(root.rglob("index.html")) + [root / "components/blog-post-template.html"]
for page in pages:
    rel = page.relative_to(root)
    if any(part in {"archive", "node_modules", ".git"} for part in rel.parts):
        continue
    original = page.read_text()
    updated, count = re.subn(r"<footer\b.*?</footer>", lambda _: footer, original, flags=re.S)
    if count != 1:
        raise SystemExit(f"Expected one footer in {rel}, found {count}")
    if stylesheet not in updated:
        updated = updated.replace("</head>", stylesheet + "\n</head>", 1)
    if rel.parts[0] not in NO_SUBSCRIBE:
        if "<!-- subscribe:start -->" in updated:
            updated = re.sub(
                r"<!-- subscribe:start -->.*?<!-- subscribe:end -->",
                lambda _: subscribe,
                updated,
                flags=re.S,
            )
        else:
            updated = updated.replace("<footer", subscribe + "\n    <footer", 1)
        if subscribe_script not in updated:
            updated = updated.replace("</head>", subscribe_script + "\n</head>", 1)
    if updated != original:
        outdated.append(str(rel))
        if not check:
            page.write_text(updated)

if check and outdated:
    raise SystemExit("Footers need syncing: " + ", ".join(outdated))
print("Shared footers verified." if check else f"Updated {len(outdated)} pages.")
