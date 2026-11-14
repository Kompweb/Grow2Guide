/**
 * One-time (re-runnable) copy of Grow2Guide marketing images from the live site into
 * Google Drive > Grow2Guide Marketing. Run importAll() once from script.google.com while
 * signed in as grow2guide@gmail.com. Files already in a folder are skipped.
 */
var SITE = 'https://www.grow2guide.com/';
var POSTS = [
  // [slug, number of slides, Instagram post folder id]
  ['i-didnt-know-wont-protect-you', 8, '1If0bXYu-znsQNlEBPhslPe0F8uATFDDb'],
  ['client-was-aggressive-is-not-a-note', 8, '1OE3uB0fC3rAltMZV2iACSAL6Ra5a0g4S'],
  ['do-i-hate-my-job-or-am-i-in-the-wrong-place', 7, '1IWmiqB_ozL_UaWTJDaRpsH1FNc_Et8dD'],
  ['late-to-work-nobody-said-a-word', 8, '1fixaq8crw8rPHul481vXPmpTtyvdeXfW'],
  ['maybe-you-dont-want-to-be-a-supervisor', 7, '1YCQQqYRBpcjv7FCNs53B6GfyXRNJRoDe'],
  ['the-2-am-replay-after-a-hard-shift', 7, '1Fypb-SXvjxsl_f5HZt02Vt6G0lRtIfUL'],
  ['when-to-take-a-break-from-behavioral-health', 8, '1haNlXsrxGo6LnDXdiADNRqUK4iaAndX1']
];
var SUBSTACK_COVERS = '1ohSbvzx75JvZRf1zvsGfxQYPccJ_dUva';
var SITE_COVERS = '1aGzDFKHGq3qc4XxftooQjpYKqTizOLo2';
var EMBLEMS = '1rPyUTLb-Js9Cml4i2PNqOFaEwuhA-Q0q';

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
    copy('assets/substack/' + p[0] + '.jpg', SUBSTACK_COVERS, p[0] + '.jpg');
    copy('assets/og/' + p[0] + '.jpg', SITE_COVERS, p[0] + '.jpg');
  });
  ['policy-lantern', 'policy-key', 'record', 'career', 'clock'].forEach(function (e) {
    copy('assets/emblems/' + e + '.jpg', EMBLEMS, e + '.jpg');
  });
  console.log('Copied ' + done + ', already there ' + skipped + ', failed ' + failed.length + (failed.length ? ': ' + failed.join(', ') : ''));
}
