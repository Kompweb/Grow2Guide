// Google Apps Script web app that backs up newsletter signups to the Sheet it is attached to.
// Setup steps are in README.md ("Google Sheets backup").
//
// Project Settings → Script properties: set WEBHOOK_SECRET to the same value as the Worker's
// SHEETS_WEBHOOK_SECRET. Requests without it are ignored.

var SHEET_NAME = 'Signups';
var HEADERS = ['Consent at (UTC)', 'Email', 'First name', 'Source page', 'New contact', 'Consent text'];

function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return respond({ ok: false, error: 'invalid_json' });
  }

  var secret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
  if (!secret || data.secret !== secret) return respond({ ok: false, error: 'forbidden' });

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getSheet();
    sheet.appendRow([
      clean(data.consentAt),
      clean(data.email),
      clean(data.firstName),
      clean(data.source),
      data.newContact === true ? 'yes' : 'no',
      clean(data.consentText)
    ]);
  } finally {
    lock.releaseLock();
  }
  return respond({ ok: true });
}

function getSheet() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = book.getSheetByName(SHEET_NAME) || book.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Stores everything as text and stops a value like "=HYPERLINK(...)" from running as a formula.
function clean(value) {
  var text = typeof value === 'string' ? value.slice(0, 300) : '';
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function respond(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
