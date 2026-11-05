/**
 * Grow2Guide: daily raw backup of Substack subscriber notifications into Google Sheets.
 *
 * Runs inside grow2guide@gmail.com (the inbox Substack notifies) as a script bound to the
 * backup Sheet. Setup steps: newsletter/README.md ("Google Sheets backup").
 *
 * Each matching Substack email becomes one row, saved raw (subject, sender, full text) so
 * nothing is lost if Substack changes its wording. Rows are never edited or deleted.
 * Duplicates are prevented by the Gmail message ID column; processed threads also get the
 * Gmail label below, so a person can see what has been backed up.
 */

var CONFIG = {
  SHEET_NAME: 'Substack subscribers',
  LABEL: 'g2g-backed-up',
  // Substack notification emails about subscribers. Widen this if a notification is missed.
  SEARCH_QUERY: 'from:substack.com subject:(subscriber OR subscribed OR subscription OR unsubscribed)',
  // Addresses that appear in every notification and are never the subscriber.
  IGNORE_EMAILS: ['grow2guide@gmail.com'],
  IGNORE_DOMAINS: ['substack.com', 'substackcdn.com', 'substack-post-media.s3.amazonaws.com'],
  RUN_HOUR: 6,               // daily run, in the script's time zone (Project Settings)
  THREADS_PER_RUN: 300,      // keeps each run well inside Apps Script's 6-minute limit
  MAX_CELL_CHARS: 45000      // Sheets allows 50,000 characters per cell
};

var HEADER = ['received_at', 'event', 'subscriber_email', 'needs_review', 'subject', 'from', 'gmail_message_id', 'raw_text'];

/** Run once by hand: creates the sheet, the label and the daily trigger, then backs up everything so far. */
function setup() {
  sheet_();
  label_();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'backup') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('backup').timeBased().everyDays(1).atHour(CONFIG.RUN_HOUR).create();
  backup();
}

/** The daily job. Safe to run by hand any time; it never writes the same email twice. */
function backup() {
  var sheet = sheet_();
  var label = label_();
  var seen = seenIds_(sheet);
  var query = CONFIG.SEARCH_QUERY + ' -label:' + CONFIG.LABEL;
  var rows = [];
  var done = [];
  var start = 0;

  while (start < CONFIG.THREADS_PER_RUN) {
    var threads = GmailApp.search(query, start, Math.min(100, CONFIG.THREADS_PER_RUN - start));
    if (!threads.length) break;
    threads.forEach(function (thread) {
      thread.getMessages().forEach(function (msg) {
        var id = msg.getId();
        if (seen[id]) return;
        seen[id] = true;
        rows.push(toRow(msg.getDate(), msg.getSubject(), msg.getFrom(), id, msg.getPlainBody()));
      });
      done.push(thread);
    });
    start += threads.length;
  }

  // Oldest first, so the sheet reads in date order.
  rows.sort(function (a, b) { return a[0] - b[0]; });
  if (rows.length) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, HEADER.length).setValues(rows);
  // Label only after the rows are saved: a failed run is retried in full the next day.
  for (var i = 0; i < done.length; i += 100) label.addToThreads(done.slice(i, i + 100));
  console.log('Backed up ' + rows.length + ' notification(s) from ' + done.length + ' thread(s).');
}

/* ---------- Pure helpers (also tested in tests/substack-sheets-backup.test.mjs) ---------- */

function toRow(date, subject, from, id, body) {
  var text = String(body || '');
  var email = subscriberEmail(subject + '\n' + text);
  return [
    date,
    eventType(subject),
    email,
    email ? '' : 'yes',
    subject,
    from,
    id,
    text.length > CONFIG.MAX_CELL_CHARS ? text.slice(0, CONFIG.MAX_CELL_CHARS) + ' [cut]' : text
  ];
}

/** "unsubscribe" for cancellations and unsubscribes, otherwise "subscribe". */
function eventType(subject) {
  return /unsubscri|cancel/i.test(String(subject || '')) ? 'unsubscribe' : 'subscribe';
}

/** First email address in the text that is not Substack's or ours; '' if none. */
function subscriberEmail(text) {
  var found = String(text || '').match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
  for (var i = 0; i < found.length; i++) {
    var email = found[i].toLowerCase().replace(/\.+$/, '');
    var domain = email.split('@')[1];
    if (CONFIG.IGNORE_EMAILS.indexOf(email) !== -1) continue;
    if (CONFIG.IGNORE_DOMAINS.some(function (d) { return domain === d || domain.slice(-d.length - 1) === '.' + d; })) continue;
    return email;
  }
  return '';
}

/* ---------- Sheet and label ---------- */

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME) || ss.insertSheet(CONFIG.SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADER);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function label_() {
  return GmailApp.getUserLabelByName(CONFIG.LABEL) || GmailApp.createLabel(CONFIG.LABEL);
}

function seenIds_(sheet) {
  var seen = {};
  var last = sheet.getLastRow();
  if (last < 2) return seen;
  var col = HEADER.indexOf('gmail_message_id') + 1;
  sheet.getRange(2, col, last - 1, 1).getValues().forEach(function (r) { if (r[0]) seen[r[0]] = true; });
  return seen;
}
