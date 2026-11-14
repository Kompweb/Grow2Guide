/**
 * Grow2Guide: copy marketing images from the live site into Google Drive > Grow2Guide Marketing,
 * one folder per blog post, then list every file (with its link) in the "Grow2Guide asset index"
 * Sheet so Notion can link each file. Run importAll() at script.google.com while signed in as
 * grow2guide@gmail.com. Safe to re-run: files already in a folder are skipped; the index is rebuilt.
 */
var SITE = 'https://www.grow2guide.com/';
var INDEX_SHEET = '10JcQaVl6MYR80n8jZ44r1sftIik5Xgx_zT6b5iF4OTI';
var EMBLEMS = '1rPyUTLb-Js9Cml4i2PNqOFaEwuhA-Q0q';
var POSTS = [
  // [slug, slides, post folder id]
  ['i-didnt-know-wont-protect-you', 8, '1If0bXYu-znsQNlEBPhslPe0F8uATFDDb'],
  ['client-was-aggressive-is-not-a-note', 8, '1OE3uB0fC3rAltMZV2iACSAL6Ra5a0g4S'],
  ['do-i-hate-my-job-or-am-i-in-the-wrong-place', 7, '1IWmiqB_ozL_UaWTJDaRpsH1FNc_Et8dD'],
  ['late-to-work-nobody-said-a-word', 8, '1fixaq8crw8rPHul481vXPmpTtyvdeXfW'],
  ['maybe-you-dont-want-to-be-a-supervisor', 7, '1YCQQqYRBpcjv7FCNs53B6GfyXRNJRoDe'],
  ['the-2-am-replay-after-a-hard-shift', 7, '1Fypb-SXvjxsl_f5HZt02Vt6G0lRtIfUL'],
  ['when-to-take-a-break-from-behavioral-health', 8, '1haNlXsrxGo6LnDXdiADNRqUK4iaAndX1']
];

function importAll() {
  var done = 0, skipped = 0, failed = [];
  function copy(path, folderId, name) {
    var folder = DriveApp.getFolderById(folderId);
    if (folder.getFilesByName(name).hasNext()) { skipped++; return; }
    var res = UrlFetchApp.fetch(SITE + path, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) { failed.push(path + ' (' + res.getResponseCode() + ')'); return; }
    folder.createFile(res.getBlob().setName(name)); done++;
  }
  POSTS.forEach(function (p) {
    for (var i = 1; i <= p[1]; i++) copy('marketing/instagram/' + p[0] + '/slide-' + i + '.jpg', p[2], 'slide-' + i + '.jpg');
    copy('assets/substack/' + p[0] + '.jpg', p[2], 'substack-cover.jpg');
    copy('assets/og/' + p[0] + '.jpg', p[2], 'site-cover.jpg');
  });
  ['policy-lantern', 'policy-key', 'record', 'career', 'clock'].forEach(function (e) {
    copy('assets/emblems/' + e + '.jpg', EMBLEMS, e + '.jpg');
  });
  var rows = buildIndex();
  console.log('Copied ' + done + ', already there ' + skipped + ', failed ' + failed.length +
    (failed.length ? ': ' + failed.join(', ') : '') + '. Index rows: ' + rows + '.');
}

function typeOf(name) {
  if (/^slide-\d+/.test(name)) return 'Instagram slide';
  if (name === 'substack-cover.jpg') return 'Substack cover';
  if (name === 'site-cover.jpg') return 'Site cover';
  if (/^Caption/.test(name)) return 'Instagram caption';
  return 'Other';
}

function buildIndex() {
  var rows = [['Post', 'Type', 'Slide', 'File', 'Link', 'File ID']];
  POSTS.forEach(function (p) {
    var it = DriveApp.getFolderById(p[2]).getFiles();
    while (it.hasNext()) {
      var f = it.next(), n = f.getName(), m = n.match(/^slide-(\d+)/);
      rows.push([p[0], typeOf(n), m ? Number(m[1]) : '', n, f.getUrl(), f.getId()]);
    }
  });
  var e = DriveApp.getFolderById(EMBLEMS).getFiles();
  while (e.hasNext()) { var f = e.next(); rows.push(['(all posts)', 'Emblem', '', f.getName(), f.getUrl(), f.getId()]); }
  var head = rows.shift();
  rows.sort(function (a, b) { return (a[0] + a[1] + ('0' + a[2]).slice(-2)).localeCompare(b[0] + b[1] + ('0' + b[2]).slice(-2)); });
  rows.unshift(head);
  var sh = SpreadsheetApp.openById(INDEX_SHEET).getSheets()[0];
  sh.clear(); sh.getRange(1, 1, rows.length, rows[0].length).setValues(rows); sh.setFrozenRows(1);
  return rows.length - 1;
}
