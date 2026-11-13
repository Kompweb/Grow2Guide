"""Weekly Search Console + GA4 report with code suggestions for grow2guide.com.

Usage:
  GOOGLE_SERVICE_ACCOUNT_JSON='<key json or path to it>' [GA4_PROPERTY_ID=123456789] \
    python3 scripts/weekly-report.py [--out docs/reports/2026-11-16.md]

The service account needs Full or Restricted access in Search Console and Viewer in GA4.
GA4_PROPERTY_ID is found automatically when the service account sees exactly one property.
Search Console data lags about 3 days, so "this week" ends 3 days ago.
"""
import base64
import datetime as dt
import html
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://www.grow2guide.com/"
SCOPES = "https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/analytics.readonly"
TRACKED_EVENTS = ["newsletter_signup", "generate_lead", "purchase", "begin_checkout", "whatsapp_click", "blog_cta_click"]
BRAND = re.compile(r"grow\s*2\s*guide|grow\s*to\s*guide|growtoguide", re.I)

# Thresholds are set for a small, new site; raise them as traffic grows.
LOW_CTR = {"min_impressions": 30, "max_position": 10.0, "max_ctr": 0.02}
STRIKING = {"min_impressions": 15, "min_position": 8.0, "max_position": 20.0}
NO_CONVERSION_SESSIONS = 15
TITLE_MAX, DESC_MIN, DESC_MAX = 60, 70, 160


# ---------- auth and HTTP ----------

def load_key(raw):
    raw = raw.strip()
    return json.loads(raw if raw.startswith("{") else Path(raw).read_text())


def access_token(key, now=None):
    now = int(now or time.time())
    b64 = lambda b: base64.urlsafe_b64encode(b).rstrip(b"=").decode()
    header = b64(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
    claims = b64(json.dumps({
        "iss": key["client_email"], "scope": SCOPES, "aud": "https://oauth2.googleapis.com/token",
        "iat": now, "exp": now + 3600,
    }).encode())
    signature = rs256_sign(key["private_key"], (header + "." + claims).encode())
    body = urllib.parse.urlencode({
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion": header + "." + claims + "." + b64(signature),
    }).encode()
    return http("POST", "https://oauth2.googleapis.com/token", body=body, form=True)["access_token"]


def rs256_sign(private_key_pem, data):
    # openssl instead of a Python crypto library, so the script runs with no extra packages.
    with tempfile.NamedTemporaryFile("w", suffix=".pem") as f:
        f.write(private_key_pem)
        f.flush()
        return subprocess.run(["openssl", "dgst", "-sha256", "-sign", f.name], input=data,
                              capture_output=True, check=True).stdout


def http(method, url, token=None, body=None, form=False):
    headers = {"Content-Type": "application/x-www-form-urlencoded" if form else "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    if body is not None and not form:
        body = json.dumps(body).encode()
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.loads(response.read() or b"{}")
    except urllib.error.HTTPError as e:
        raise SystemExit(method + " " + url.split("?")[0] + " failed: " + str(e.code) + " " + e.read().decode()[:300])


# ---------- data ----------

def week_ranges(today):
    end = today - dt.timedelta(days=3)
    start = end - dt.timedelta(days=6)
    prev_end = start - dt.timedelta(days=1)
    return (start, end), (prev_end - dt.timedelta(days=6), prev_end)


def search_console(token, dims, start, end):
    url = ("https://searchconsole.googleapis.com/webmasters/v3/sites/"
           + urllib.parse.quote(SITE, safe="") + "/searchAnalytics/query")
    payload = http("POST", url, token, {
        "startDate": start.isoformat(), "endDate": end.isoformat(), "dimensions": dims, "rowLimit": 500,
    })
    return [dict(zip(dims, r["keys"]), clicks=r["clicks"], impressions=r["impressions"],
                 ctr=r["ctr"], position=r["position"]) for r in payload.get("rows", [])]


def ga4_property(token):
    if os.environ.get("GA4_PROPERTY_ID"):
        return os.environ["GA4_PROPERTY_ID"]
    summaries = http("GET", "https://analyticsadmin.googleapis.com/v1beta/accountSummaries", token)
    props = [p for a in summaries.get("accountSummaries", []) for p in a.get("propertySummaries", [])]
    if len(props) != 1:
        names = ", ".join(p["property"] + " (" + p.get("displayName", "") + ")" for p in props) or "none"
        raise SystemExit("Set GA4_PROPERTY_ID. Properties visible to the service account: " + names)
    return props[0]["property"].split("/")[1]


def ga4_report(token, prop, body):
    payload = http("POST", "https://analyticsdata.googleapis.com/v1beta/properties/" + prop + ":runReport", token, body)
    dims = [d["name"] for d in payload.get("dimensionHeaders", [])]
    mets = [m["name"] for m in payload.get("metricHeaders", [])]
    rows = []
    for r in payload.get("rows", []):
        row = {d: v["value"] for d, v in zip(dims, r["dimensionValues"])}
        row.update({m: float(v["value"]) for m, v in zip(mets, r["metricValues"])})
        rows.append(row)
    return rows


def ga4_landing_pages(token, prop, start, end):
    return ga4_report(token, prop, {
        "dateRanges": [{"startDate": start.isoformat(), "endDate": end.isoformat()}],
        "dimensions": [{"name": "landingPage"}],
        "metrics": [{"name": "sessions"}, {"name": "keyEvents"}, {"name": "engagementRate"}],
        "limit": 200,
    })


def ga4_events(token, prop, start, end):
    return ga4_report(token, prop, {
        "dateRanges": [{"startDate": start.isoformat(), "endDate": end.isoformat()}],
        "dimensions": [{"name": "eventName"}],
        "metrics": [{"name": "eventCount"}],
        "dimensionFilter": {"filter": {"fieldName": "eventName", "inListFilter": {"values": TRACKED_EVENTS}}},
    })


# ---------- local pages ----------

def page_meta(root=ROOT):
    """Map URL path -> {file, title, description, noindex} for every page in the sitemap."""
    sitemap = (root / "sitemap.xml").read_text()
    pages = {}
    for loc in re.findall(r"<loc>([^<]+)</loc>", sitemap):
        path = urllib.parse.urlparse(loc).path or "/"
        file = root / path.lstrip("/") / "index.html"
        if not file.exists():
            continue
        text = file.read_text()
        title = re.search(r"<title>(.*?)</title>", text, re.S)
        desc = re.search(r'<meta\s+name="description"\s+content="([^"]*)"', text)
        pages[path] = {
            "file": str(file.relative_to(root)),
            "title": html.unescape(title.group(1).strip()) if title else "",
            "description": html.unescape(desc.group(1).strip()) if desc else "",
        }
    return pages


def url_path(url):
    return urllib.parse.urlparse(url).path or "/"


# ---------- suggestions ----------

def suggestions(query_pages, sc_pages, ga_pages, events, pages):
    out = []

    def add(priority, page, what, why):
        out.append({"priority": priority, "page": page, "file": pages.get(page, {}).get("file", ""),
                    "what": what, "why": why})

    for row in sc_pages:
        path = url_path(row["page"])
        if (row["impressions"] >= LOW_CTR["min_impressions"] and row["position"] <= LOW_CTR["max_position"]
                and row["ctr"] < LOW_CTR["max_ctr"]):
            title = pages.get(path, {}).get("title", "")
            add(1, path, "Rewrite the <title> and meta description to match what searchers want",
                "%d impressions at position %.1f but %.1f%% CTR. Current title: \"%s\""
                % (row["impressions"], row["position"], row["ctr"] * 100, title))

    for row in query_pages:
        if BRAND.search(row["query"]):
            continue
        if (row["impressions"] >= STRIKING["min_impressions"]
                and STRIKING["min_position"] <= row["position"] <= STRIKING["max_position"]):
            add(2, url_path(row["page"]),
                "Add a section that answers \"%s\" (use the phrase in an <h2>) and link to this page from related posts" % row["query"],
                "Ranks %.1f for \"%s\" with %d impressions; page 1 is within reach"
                % (row["position"], row["query"], row["impressions"]))

    for row in ga_pages:
        path = row["landingPage"] or "/"
        if row["sessions"] >= NO_CONVERSION_SESSIONS and row["keyEvents"] == 0:
            add(2, path, "Add or move up a clear next step (newsletter form, guide link or consultation button)",
                "%d sessions landed here and none completed a key event" % row["sessions"])

    counts = {r["eventName"]: r["eventCount"] for r in events}
    if ga_pages and not any(counts.get(e) for e in ("newsletter_signup", "generate_lead", "purchase")):
        add(1, "(site-wide)", "Check GTM: no newsletter_signup, generate_lead or purchase events reached GA4",
            "The site pushes these to the dataLayer; a GTM tag must forward them (docs/analytics/README.md)")

    seen = {url_path(r["page"]) for r in sc_pages}
    for path, meta in pages.items():
        if len(meta["title"]) > TITLE_MAX:
            add(3, path, "Shorten the <title> to %d characters or fewer" % TITLE_MAX,
                "It is %d characters; Google cuts it off in results" % len(meta["title"]))
        if not meta["description"]:
            add(2, path, "Add a meta description", "Google writes its own snippet when there is none")
        elif not DESC_MIN <= len(meta["description"]) <= DESC_MAX:
            add(3, path, "Make the meta description %d-%d characters" % (DESC_MIN, DESC_MAX),
                "It is %d characters" % len(meta["description"]))
        if sc_pages and path not in seen:
            add(3, path, "Check indexing in Search Console (URL Inspection)", "No search impressions this week")

    out.sort(key=lambda s: (s["priority"], s["page"]))
    return out


# ---------- report ----------

def pct_change(now, before):
    if not before:
        return "new" if now else "-"
    return "%+.0f%%" % ((now - before) / before * 100)


def totals(rows):
    clicks = sum(r["clicks"] for r in rows)
    impressions = sum(r["impressions"] for r in rows)
    return clicks, impressions


def render(week, prev, sc_q, sc_q_prev, sc_pages, ga_pages, events, sugg):
    (start, end) = week
    clicks, impressions = totals(sc_q)
    p_clicks, p_impressions = totals(sc_q_prev)
    lines = [
        "# Weekly search & analytics report: %s to %s" % (start, end), "",
        "| | This week | Previous week | Change |", "|---|---|---|---|",
        "| Search clicks | %d | %d | %s |" % (clicks, p_clicks, pct_change(clicks, p_clicks)),
        "| Search impressions | %d | %d | %s |" % (impressions, p_impressions, pct_change(impressions, p_impressions)),
        "", "## Top search queries", "", "| Query | Clicks | Impressions | CTR | Position |", "|---|---|---|---|---|",
    ]
    for r in sorted(sc_q, key=lambda r: -r["impressions"])[:15]:
        lines.append("| %s | %d | %d | %.1f%% | %.1f |" % (r["query"], r["clicks"], r["impressions"], r["ctr"] * 100, r["position"]))
    lines += ["", "## Landing pages (GA4)", "", "| Landing page | Sessions | Key events | Engagement |", "|---|---|---|---|"]
    for r in sorted(ga_pages, key=lambda r: -r["sessions"])[:15]:
        lines.append("| %s | %d | %d | %.0f%% |" % (r["landingPage"] or "/", r["sessions"], r["keyEvents"], r["engagementRate"] * 100))
    lines += ["", "## Tracked events (GA4)", "", "| Event | Count |", "|---|---|"]
    counts = {r["eventName"]: int(r["eventCount"]) for r in events}
    lines += ["| %s | %d |" % (e, counts.get(e, 0)) for e in TRACKED_EVENTS]
    lines += ["", "## Suggested code changes", ""]
    if not sugg:
        lines.append("No changes suggested this week.")
    for s in sugg:
        lines.append("- **P%d %s** (`%s`): %s. _%s_" % (s["priority"], s["page"], s["file"] or "n/a", s["what"], s["why"]))
    return "\n".join(lines) + "\n"


def main(argv):
    out = argv[argv.index("--out") + 1] if "--out" in argv else None
    raw = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
    if not raw:
        raise SystemExit("GOOGLE_SERVICE_ACCOUNT_JSON is not set (see the docstring at the top of this file).")
    token = access_token(load_key(raw))
    week, prev = week_ranges(dt.date.today())
    sc_q = search_console(token, ["query"], *week)
    sc_q_prev = search_console(token, ["query"], *prev)
    query_pages = search_console(token, ["query", "page"], *week)
    sc_pages = search_console(token, ["page"], *week)
    prop = ga4_property(token)
    ga_pages = ga4_landing_pages(token, prop, *week)
    events = ga4_events(token, prop, *week)
    report = render(week, prev, sc_q, sc_q_prev, sc_pages, ga_pages, events,
                    suggestions(query_pages, sc_pages, ga_pages, events, page_meta()))
    if out:
        Path(out).parent.mkdir(parents=True, exist_ok=True)
        Path(out).write_text(report)
    print(report)


if __name__ == "__main__":
    main(sys.argv[1:])
