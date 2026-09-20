(function () {
  const TOTAL = 5;
  const names = ['Role', 'Focus', 'Setting', 'Goals', 'Contact'];
  let step = 0;
  const form = document.getElementById('quiz-form');
  const steps = [...form.querySelectorAll('.quiz-step')];
  const bar = document.getElementById('progress-bar');
  const stepLabel = document.getElementById('step-label');
  const stepName = document.getElementById('step-name');
  const btnBack = document.getElementById('btn-back');
  const btnNext = document.getElementById('btn-next');
  const btnNextLabel = document.getElementById('btn-next-label');

  function showStep(i) {
    steps.forEach((el, idx) => el.classList.toggle('active', idx === i));
    step = i;
    bar.style.width = ((i + 1) / TOTAL * 100) + '%';
    stepLabel.textContent = 'Step ' + (i + 1) + ' of ' + TOTAL;
    stepName.textContent = names[i];
    btnBack.disabled = i === 0;
    btnNextLabel.textContent = i === TOTAL - 1 ? 'Submit via email' : 'Continue';
    form.querySelectorAll('.err').forEach(e => e.style.display = 'none');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function val(name) {
    const el = form.querySelector('[name="' + name + '"]:checked');
    return el ? el.value : '';
  }
  function text(name) {
    const el = form.querySelector('[name="' + name + '"]');
    return el ? el.value.trim() : '';
  }

  function validate() {
    form.querySelectorAll('.err').forEach(e => e.style.display = 'none');
    if (step === 0 && !val('role')) { form.querySelector('[data-for=role]').style.display = 'block'; return false; }
    if (step === 1 && !val('focus')) { form.querySelector('[data-for=focus]').style.display = 'block'; return false; }
    if (step === 2 && !val('setting')) { form.querySelector('[data-for=setting]').style.display = 'block'; return false; }
    if (step === 3 && !val('goal')) { form.querySelector('[data-for=goal]').style.display = 'block'; return false; }
    if (step === 4) {
      const name = text('name');
      const email = text('email');
      if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        form.querySelector('[data-for=contact]').style.display = 'block';
        return false;
      }
    }
    return true;
  }

  function submitMailto() {
    const lines = [
      'Tier 1 Foundations — Intake Quiz',
      '',
      'Role: ' + val('role'),
      'Focus: ' + val('focus'),
      'Setting: ' + val('setting'),
      'Goal: ' + val('goal'),
      'Notes: ' + (text('notes') || '(none)'),
      '',
      'Name: ' + text('name'),
      'Email: ' + text('email'),
      'Organization: ' + (text('organization') || '(none)'),
      'Phone: ' + (text('phone') || '(none)'),
      'Preferred window: ' + (text('window') || '(none)'),
      'Message: ' + (text('message') || '(none)'),
      '',
      'Submitted from grow2guide.com/quiz/tier-1/'
    ];
    const subject = encodeURIComponent('Tier 1 Intake Quiz — ' + text('name'));
    const body = encodeURIComponent(lines.join('\n'));
    window.location.href = window.g2gMail.mailto('subject=' + subject + '&body=' + body);
  }

  btnBack.addEventListener('click', () => { if (step > 0) showStep(step - 1); });
  btnNext.addEventListener('click', () => {
    if (!validate()) return;
    if (step < TOTAL - 1) showStep(step + 1);
    else submitMailto();
  });
  form.addEventListener('submit', (e) => { e.preventDefault(); btnNext.click(); });
  showStep(0);
})();
