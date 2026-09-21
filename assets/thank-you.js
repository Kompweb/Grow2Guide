(function () {
  var ITEM_LABELS = {
    guide: 'Thanks for buying the Behavioral Health Policy Inventory & Learning Guide.',
    checklist: 'Thanks for buying the Supervisor & Manager toolkit and reflection guide.',
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
