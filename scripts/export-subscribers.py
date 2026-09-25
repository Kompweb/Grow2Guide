"""Export the Resend newsletter audience to CSV.

Usage: RESEND_API_KEY=... RESEND_AUDIENCE_ID=... python3 scripts/export-subscribers.py [--out subscribers.csv]
"""
import csv
import json
import os
import sys
import urllib.request

HEADER = ["email", "first_name", "created_at", "unsubscribed"]


def contacts_to_rows(payload):
    rows = [HEADER[:]]
    for contact in payload.get("data") or []:
        rows.append([
            contact.get("email") or "",
            contact.get("first_name") or "",
            contact.get("created_at") or "",
            "true" if contact.get("unsubscribed") else "false",
        ])
    return rows


def fetch_contacts(api_key, audience_id):
    request = urllib.request.Request(
        "https://api.resend.com/audiences/" + audience_id + "/contacts",
        headers={
            "Authorization": "Bearer " + api_key,
            # Resend sits behind Cloudflare, which rejects the default Python user agent.
            "User-Agent": "grow2guide-export/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def main():
    api_key = os.environ.get("RESEND_API_KEY")
    audience_id = os.environ.get("RESEND_AUDIENCE_ID")
    if not api_key or not audience_id:
        raise SystemExit("Set RESEND_API_KEY and RESEND_AUDIENCE_ID in the environment.")
    rows = contacts_to_rows(fetch_contacts(api_key, audience_id))
    if "--out" in sys.argv:
        path = sys.argv[sys.argv.index("--out") + 1]
        with open(path, "w", newline="") as handle:
            csv.writer(handle).writerows(rows)
        print("Wrote " + str(len(rows) - 1) + " contacts to " + path)
    else:
        csv.writer(sys.stdout).writerows(rows)


if __name__ == "__main__":
    main()
