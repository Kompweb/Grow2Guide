# Newsletter

The newsletter is published on Substack: https://grow2guide.substack.com (moved from Resend in
November 2026). Write, schedule and send posts in Substack. Subscribers, unsubscribes and signup
sources live in the Substack dashboard.

## Signups on grow2guide.com

Every page's subscribe block and pop-up, and the Self-Assessment results page, hold Substack's
embedded form (`https://grow2guide.substack.com/embed`). The site never sees the email address.
See the root `README.md` (Newsletter signups) and `docs/analytics/README.md` for tracking.

## Moving the old Resend list to Substack (one time)

The Resend Audience holds everyone who subscribed on the site before the move.

1. Export it: `python3 scripts/export-subscribers.py --out subscribers.csv`
   (needs `RESEND_API_KEY` and `RESEND_AUDIENCE_ID` in your environment). Do not commit the file.
2. Delete every row where `unsubscribed` is `true`. Those people opted out and must not be imported.
3. Substack → Dashboard → Subscribers → Import. Upload the CSV.
4. Send one short note to the imported group: the newsletter now comes from Substack, one post
   every Wednesday, unsubscribe link at the bottom.
5. Delete `subscribers.csv`. Leave the Resend Audience as it is for a few weeks as a record,
   then delete it in Resend.

These people agreed to "Grow2Guide emails", so moving them to the same newsletter on another
platform stays within that consent.

## Old files

`issue-template.html` and `issues/2026-10-welcome.html` were for Resend Broadcasts. They are kept
for reference only; the welcome message now lives in Substack (Settings → Welcome email).
