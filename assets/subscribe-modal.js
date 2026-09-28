(function () {
  var STORE_KEY = 'g2g_subscribe_modal';
  var IDLE_MS = 45000;
  var MIN_EXIT_MS = 8000;
  var SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

  function parseState(raw) {
    var state = { subscribed: false, snoozedUntil: 0 };
    try {
      var data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        if (data.subscribed === true) state.subscribed = true;
        if (typeof data.snoozedUntil === 'number') state.snoozedUntil = data.snoozedUntil;
      }
    } catch (e) {
      // Missing or corrupt value: treat as a fresh visitor.
    }
    return state;
  }

  function canShow(state, now) {
    return !state.subscribed && now >= state.snoozedUntil;
  }

  window.g2gSubscribeModal = { canShow: canShow, parseState: parseState };

  var dialog = document.getElementById('subscribe-modal');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  var shownThisPage = false;
  var loadedAt = Date.now();
  var idleTimer = null;

  function load() {
    try {
      return parseState(window.localStorage.getItem(STORE_KEY));
    } catch (e) {
      return parseState(null);
    }
  }

  function save(state) {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) {
      // Storage unavailable: the modal still shows at most once per page load.
    }
  }

  function typingInField() {
    var el = document.activeElement;
    return !!el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !dialog.contains(el);
  }

  function anotherDialogOpen() {
    var menu = document.getElementById('mobile-menu');
    return !!menu && !menu.classList.contains('hidden');
  }

  function open() {
    if (shownThisPage || dialog.open) return;
    if (!canShow(load(), Date.now())) return;
    if (typingInField() || anotherDialogOpen()) {
      armIdle();
      return;
    }
    shownThisPage = true;
    dialog.showModal();
  }

  function armIdle() {
    window.clearTimeout(idleTimer);
    if (shownThisPage || document.hidden) return;
    idleTimer = window.setTimeout(open, IDLE_MS);
  }

  ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'].forEach(function (name) {
    document.addEventListener(name, armIdle, { passive: true });
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) window.clearTimeout(idleTimer);
    else armIdle();
  });

  // Exit intent: the pointer leaves through the top of the window (desktop only).
  document.addEventListener('mouseout', function (e) {
    if (e.relatedTarget || e.clientY > 0) return;
    if (Date.now() - loadedAt < MIN_EXIT_MS) return;
    open();
  });

  dialog.addEventListener('close', function () {
    var state = load();
    if (!state.subscribed) save({ subscribed: false, snoozedUntil: Date.now() + SNOOZE_MS });
  });

  dialog.addEventListener('click', function (e) {
    if (e.target === dialog) dialog.close();
  });

  dialog.querySelectorAll('[data-modal-close]').forEach(function (btn) {
    btn.addEventListener('click', function () { dialog.close(); });
  });

  document.addEventListener('g2g:subscribed', function () {
    save({ subscribed: true, snoozedUntil: 0 });
    if (dialog.open) window.setTimeout(function () { dialog.close(); }, 2500);
  });

  armIdle();
})();
