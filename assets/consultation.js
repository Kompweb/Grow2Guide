(function () {
  const form = document.getElementById('consult-form');

  function val(name) {
    const el = form.querySelector('[name="' + name + '"]');
    return el ? el.value.trim() : '';
  }
  function checkedVal(name) {
    const el = form.querySelector('[name="' + name + '"]:checked');
    return el ? el.value : '';
  }
  function checkedList(name) {
    return [...form.querySelectorAll('[name="' + name + '"]:checked')].map(el => el.value);
  }
  function clearErrors() {
    form.querySelectorAll('.err').forEach(e => e.style.display = 'none');
  }
  function showError(name) {
    const err = form.querySelector('.err[data-for="' + name + '"]');
    if (err) err.style.display = 'block';
  }

  function validate() {
    clearErrors();
    let ok = true;
    ['org-name', 'contact-name', 'email', 'phone', 'org-type', 'describe', 'accomplish'].forEach(name => {
      if (!val(name)) { showError(name); ok = false; }
    });
    if (!val('state')) { showError('state'); ok = false; }
    return ok;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) {
      form.querySelector('.err[style*="block"]')?.closest('div')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const help = checkedList('help');
    const helpOther = val('help-other');
    if (helpOther) help.push('Other: ' + helpOther);

    const lines = [
      'Grow2Guide Consultation Request',
      '',
      '1. Organization Name: ' + val('org-name'),
      '2. Contact Name & Title: ' + val('contact-name'),
      "3. Email: " + val('email') + "\n   Phone: " + val('phone'),
      '4. State: ' + val('state'),
      '5. Type of Organization/Program: ' + val('org-type'),
      '6. What are you looking for help with: ' + (help.length ? help.join(', ') : '(none selected)'),
      '',
      '7. Currently working on / challenges:',
      val('describe'),
      '',
      '8. What do you currently have in place: ' + (checkedVal('in-place') || '(not answered)'),
      '',
      '9. Goals for consultation:',
      val('accomplish'),
      '',
      '10. Deadline / timeframe: ' + (val('timeframe') || '(none)'),
      '',
      'Anything else: ' + (val('anything-else') || '(none)'),
      '',
      'Submitted from grow2guide.com/consultation/'
    ];

    const subject = encodeURIComponent('Consultation Request — ' + val('org-name'));
    const body = encodeURIComponent(lines.join('\n'));
    window.location.href = window.g2gMail.mailto('subject=' + subject + '&body=' + body);
  });
})();
