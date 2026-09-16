''(function () {
  function address() {
    var user = ['g', 'r', 'o', 'w', '2', 'g', 'u', 'i', 'd', 'e'];
    var host = ['g', 'm', 'a', 'i', 'l', '.', 'c', 'o', 'm'];
    return user.join('') + '@' + host.join('');
  }

  function mailto(query) {
    return 'mailto:' + address() + (query ? '?' + query : '');
  }

  window.g2gMail = { address: address, mailto: mailto };

  function wire() {
    document.querySelectorAll('[data-g2g-mailto]').forEach(function (el) {
      var href = mailto(el.getAttribute('data-g2g-mailto') || '');
      if (el.tagName === 'FORM') {
        el.setAttribute('action', href);
      } else {
        el.setAttribute('href', href);
      }
    });

    document.querySelectorAll('[data-g2g-email-text]').forEach(function (el) {
      el.textContent = address();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
