import base64
import datetime as dt
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

import subprocess

spec = importlib.util.spec_from_file_location("weekly_report", Path(__file__).with_name("weekly-report.py"))
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

PAGES = {
    "/": {"file": "index.html", "title": "Grow2Guide", "description": "x" * 100},
    "/guides/": {"file": "guides/index.html", "title": "T" * 70, "description": ""},
}


def sc(page, impressions, position, ctr, query=None):
    row = {"page": "https://www.grow2guide.com" + page, "impressions": impressions, "position": position,
           "ctr": ctr, "clicks": round(impressions * ctr)}
    if query:
        row["query"] = query
    return row


class Suggestions(unittest.TestCase):
    def whats(self, sugg, page):
        return [s["what"] for s in sugg if s["page"] == page]

    def test_low_ctr_page_gets_title_rewrite_with_current_title(self):
        sugg = mod.suggestions([], [sc("/", 120, 4.2, 0.01)], [], [], PAGES)
        low = [s for s in sugg if s["page"] == "/" and s["priority"] == 1]
        self.assertEqual(len(low), 1)
        self.assertIn("Rewrite the <title>", low[0]["what"])
        self.assertIn('"Grow2Guide"', low[0]["why"])
        self.assertEqual(low[0]["file"], "index.html")

    def test_good_ctr_or_deep_position_is_left_alone(self):
        sugg = mod.suggestions([], [sc("/", 120, 4.2, 0.08), sc("/guides/", 120, 30, 0.0)], [], [], PAGES)
        self.assertFalse(any("Rewrite" in s["what"] for s in sugg))

    def test_striking_distance_query_but_never_brand_queries(self):
        qp = [sc("/guides/", 40, 12.0, 0.0, "behavioral health policy manual"),
              sc("/", 40, 12.0, 0.0, "grow 2 guide")]
        sugg = mod.suggestions(qp, [], [], [], PAGES)
        hits = [s for s in sugg if "Add a section" in s["what"]]
        self.assertEqual(len(hits), 1)
        self.assertIn("behavioral health policy manual", hits[0]["what"])

    def test_landing_page_without_key_events(self):
        ga = [{"landingPage": "/guides/", "sessions": 40, "keyEvents": 0, "engagementRate": 0.5},
              {"landingPage": "/", "sessions": 40, "keyEvents": 3, "engagementRate": 0.5}]
        sugg = mod.suggestions([], [], ga, [{"eventName": "generate_lead", "eventCount": 3}], PAGES)
        self.assertTrue(any("next step" in w for w in self.whats(sugg, "/guides/")))
        self.assertFalse(any("next step" in w for w in self.whats(sugg, "/")))

    def test_flags_gtm_when_traffic_but_no_conversion_events(self):
        ga = [{"landingPage": "/", "sessions": 5, "keyEvents": 0, "engagementRate": 0.5}]
        sugg = mod.suggestions([], [], ga, [{"eventName": "whatsapp_click", "eventCount": 2}], PAGES)
        self.assertTrue(any("Check GTM" in s["what"] for s in sugg))
        sugg = mod.suggestions([], [], ga, [{"eventName": "newsletter_signup", "eventCount": 1}], PAGES)
        self.assertFalse(any("Check GTM" in s["what"] for s in sugg))

    def test_static_title_and_description_checks(self):
        sugg = mod.suggestions([], [sc("/", 5, 3, 0.2)], [], [], PAGES)
        guides = self.whats(sugg, "/guides/")
        self.assertTrue(any("Shorten the <title>" in w for w in guides))
        self.assertTrue(any("Add a meta description" in w for w in guides))
        self.assertTrue(any("Check indexing" in w for w in guides))
        self.assertFalse(any("Check indexing" in w for w in self.whats(sugg, "/")))

    def test_sorted_by_priority(self):
        sugg = mod.suggestions([], [sc("/", 120, 4.2, 0.01)], [], [], PAGES)
        self.assertEqual([s["priority"] for s in sugg], sorted(s["priority"] for s in sugg))


class Helpers(unittest.TestCase):
    def test_week_ranges_skip_search_console_lag(self):
        week, prev = mod.week_ranges(dt.date(2026, 11, 16))
        self.assertEqual(week, (dt.date(2026, 11, 7), dt.date(2026, 11, 13)))
        self.assertEqual(prev, (dt.date(2026, 10, 31), dt.date(2026, 11, 6)))

    def test_page_meta_reads_sitemap_pages(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / "faq").mkdir()
            (root / "sitemap.xml").write_text(
                "<urlset><url><loc>https://www.grow2guide.com/faq/</loc></url>"
                "<url><loc>https://www.grow2guide.com/missing/</loc></url></urlset>")
            (root / "faq" / "index.html").write_text(
                '<title>FAQ &amp; help</title><meta name="description" content="Answers" />')
            self.assertEqual(mod.page_meta(root), {"/faq/": {"file": "faq/index.html", "title": "FAQ & help", "description": "Answers"}})

    def test_access_token_signs_a_valid_jwt(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        key_file, pub_file = Path(tmp.name) / "k.pem", Path(tmp.name) / "p.pem"
        subprocess.run(["openssl", "genpkey", "-algorithm", "RSA", "-pkeyopt", "rsa_keygen_bits:2048",
                        "-out", str(key_file)], check=True, capture_output=True)
        subprocess.run(["openssl", "pkey", "-in", str(key_file), "-pubout", "-out", str(pub_file)],
                       check=True, capture_output=True)
        pem = key_file.read_text()
        sent = {}

        def fake_http(method, url, token=None, body=None, form=False):
            sent["assertion"] = dict(p.split("=", 1) for p in body.decode().split("&"))["assertion"]
            return {"access_token": "tok"}

        original, mod.http = mod.http, fake_http
        try:
            self.assertEqual(mod.access_token({"client_email": "sa@x.iam.gserviceaccount.com", "private_key": pem}, now=1000), "tok")
        finally:
            mod.http = original
        header, claims, sig = sent["assertion"].split(".")
        pad = lambda s: s + "=" * (-len(s) % 4)
        payload = json.loads(base64.urlsafe_b64decode(pad(claims)))
        self.assertEqual(payload["iss"], "sa@x.iam.gserviceaccount.com")
        self.assertEqual(payload["exp"], 4600)
        self.assertIn("webmasters.readonly", payload["scope"])
        sig_file = Path(tmp.name) / "sig"
        sig_file.write_bytes(base64.urlsafe_b64decode(pad(sig)))
        check = subprocess.run(["openssl", "dgst", "-sha256", "-verify", str(pub_file), "-signature", str(sig_file)],
                               input=(header + "." + claims).encode(), capture_output=True)
        self.assertEqual(check.returncode, 0, check.stdout + check.stderr)


if __name__ == "__main__":
    unittest.main()
