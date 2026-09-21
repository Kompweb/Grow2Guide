(function () {
  var STORAGE_KEY = 'g2g_lead';

  function read() {
    try {
      return JSON.parse(window.localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function write(field, value) {
    try {
      var lead = read();
      lead[field] = value;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lead));
    } catch (e) {
      // Storage unavailable (private mode, blocked, etc.) — fail silently.
    }
  }

  function wire() {
    var lead = read();
    document.querySelectorAll('[data-g2g-save]').forEach(function (el) {
      var field = el.getAttribute('data-g2g-save');
      if (!field) return;
      if (!el.value && lead[field]) el.value = lead[field];
      el.addEventListener('input', function () { write(field, el.value.trim()); });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
