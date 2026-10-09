(function () {
  var ITEM_LABELS = {
    guide: 'Thanks for buying the Behavioral Health Guide for employees - Why do we do it this way?',
    checklist: 'Thanks for buying the Supervisor Guide - How do I supervise employees effectively.',
    bundle: 'Thanks for buying the bundle — both PDF guides are on their way.'
  };

  function run() {
    var params = new URLSearchParams(window.location.search);
    var item = params.get('item');
    var line = document.getElementById('thankyou-item-line');
    if (line && item && ITEM_LABELS[item]) {
      line.textContent = ITEM_LABELS[item];
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
