(function () {
  var ENDPOINT = 'https://subscribe.grow2guide.com/';
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function validate(values) {
    var errors = {};
    if (!EMAIL_RE.test((values.email || '').trim())) errors.email = 'Enter a valid email address.';
    if (!values.consent) errors.consent = 'Please tick the box to subscribe.';
    return errors;
  }

  function buildPayload(values, source) {
    return {
      email: (values.email || '').trim(),
      firstName: (values.firstName || '').trim(),
      consent: true,
      source: source,
      website: values.website || ''
    };
  }

  window.g2gSubscribe = { validate: validate, buildPayload: buildPayload };

  function wire(form) {
    var status = form.querySelector('[data-status]');
    var button = form.querySelector('button[type="submit"]');

    function read() {
      return {
        email: form.elements['email'].value,
        firstName: form.elements['first_name'].value,
        consent: form.elements['consent'].checked,
        website: form.elements['website'].value
      };
    }

    function showErrors(errors) {
      form.querySelectorAll('[data-error]').forEach(function (el) {
        var message = errors[el.getAttribute('data-error')] || '';
        el.textContent = message;
        el.hidden = !message;
      });
    }

    function setStatus(message, ok) {
      status.textContent = message;
      status.style.color = ok ? '#0F766E' : '#B42318';
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var values = read();
      var errors = validate(values);
      showErrors(errors);
      setStatus('', true);
      if (Object.keys(errors).length) return;

      button.disabled = true;
      button.textContent = 'Subscribing…';

      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(values, window.location.pathname))
      })
        .then(function (res) {
          return res.json().then(
            function (body) { return res.ok && body.ok === true; },
            function () { return false; }
          );
        })
        .catch(function () { return false; })
        .then(function (ok) {
          button.disabled = false;
          button.textContent = 'Subscribe';
          if (ok) {
            form.reset();
            setStatus('Thanks! You are subscribed.', true);
            document.dispatchEvent(new CustomEvent('g2g:subscribed'));
          } else {
            // Leave the fields filled in so the visitor can retry.
            setStatus('Something went wrong. Please try again in a moment.', false);
          }
        });
    });
  }

  if (typeof document !== 'undefined') {
    document.querySelectorAll('form[data-g2g-subscribe]').forEach(wire);
  }
})();
