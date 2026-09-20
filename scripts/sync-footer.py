"""Copy the shared footer into live pages; use --check to detect drift."""
from pathlib import Path
import re
import sys

root = Path(__file__).resolve().parents[1]
footer = (root / "components/footer.html").read_text().strip()
stylesheet = '  <link rel="stylesheet" href="/assets/footer.css" />'
check = "--check" in sys.argv
outdated = []
pages = sorted(root.rglob("index.html"))
for page in pages:
    if any(part in {"archive", "node_modules", ".git"} for part in page.relative_to(root).parts):
        continue
    original = page.read_text()
    updated, count = re.subn(r"<footer\b.*?</footer>", lambda _: footer, original, flags=re.S)
    if count != 1:
        raise SystemExit(f"Expected one footer in {page.relative_to(root)}, found {count}")
    if stylesheet not in updated:
        updated = updated.replace("</head>", stylesheet + "\n</head>", 1)
    if updated != original:
        outdated.append(str(page.relative_to(root)))
        if not check:
            page.write_text(updated)

if check and outdated:
    raise SystemExit("Footers need syncing: " + ", ".join(outdated))
print("Shared footers verified." if check else f"Updated {len(outdated)} pages.")
