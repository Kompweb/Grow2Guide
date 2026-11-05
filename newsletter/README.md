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

## Google Sheets backup (daily, automatic)

`substack-sheets-backup.gs` copies Substack's subscriber notification emails from
grow2guide@gmail.com into a private Google Sheet once a day. Each email becomes one raw row:
`received_at`, `event` (subscribe / unsubscribe), `subscriber_email`, `needs_review`, `subject`,
`from`, `gmail_message_id`, `raw_text`. Rows are only added, never changed. The first run also
backs up every notification already in the inbox.

The Sheet holds whatever Substack's emails contain. Signup source (site, Substack app,
recommendation) is usually not in them; check the Substack dashboard for that.

Setup (about 5 minutes, signed in as **grow2guide@gmail.com**):

1. Substack → Settings → notifications: turn on emails for new subscribers (and for
   unsubscribes or cancellations if offered). Without these there is nothing to back up.
2. Create a Google Sheet, for example "Grow2Guide – Substack subscribers backup". Keep it private.
3. In the Sheet: Extensions → Apps Script. Replace the code with `substack-sheets-backup.gs`, save.
4. Project Settings (gear icon): set the time zone to yours.
5. Back in the editor, choose `setup` in the function menu and press Run. Approve the Gmail and
   Sheets permissions when asked ("Google hasn't verified this app" → Advanced → Go to project:
   this is your own script).

`setup` creates the "Substack subscribers" tab, the Gmail label `g2g-backed-up`, and a daily
trigger around 6 am, then backs up everything so far. Check it:

- The tab has a header row, plus one row per Substack subscriber email found.
- Apps Script → Triggers shows one daily `backup` trigger.
- Apps Script → Executions shows "Backed up N notification(s)".

If `needs_review` says `yes`, the script saved the email but could not find the subscriber's
address in it; the full text is in `raw_text`. If a notification is missed entirely, open it in
Gmail, then add a word from its subject to `SEARCH_QUERY` at the top of the script.
Running `setup` again is safe: it replaces the trigger and never duplicates rows.

## Old files

`issue-template.html` and `issues/2026-10-welcome.html` were for Resend Broadcasts. They are kept
for reference only; the welcome message now lives in Substack (Settings → Welcome email).
