/* =====================================================================
   Grow2Guide Care & Workplace Competence Self-Assessment
   Scored in the browser. Answers, role and reflections never leave the page.
   Only if the visitor asks for their results by email are their email address
   and the ten percentages sent to the subscribe Worker (/results), which builds
   the email itself from this file. No storage, no cookies. Analytics events
   carry no answers, scores or email address.

   HOW TO EDIT LATER
   - Score ranges ........ edit BANDS
   - Question wording .... edit CATEGORIES[].questions
   - Category feedback ... edit CATEGORIES[].feedback (one line per score band)
   - Development tips .... edit CATEGORIES[].suggestionHigh / suggestionLow
   - Overall feedback .... edit DIMENSIONS[].feedback
   Question IDs are q1..q32 (q1-q16 Care, q17-q32 Workplace). Category IDs are cat1..cat8.
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- Response scale (same five options for every statement) ---------- */
  var SCALE = [
    { label: 'Never', score: 1 },
    { label: 'Rarely', score: 2 },
    { label: 'Sometimes', score: 3 },
    { label: 'Usually', score: 4 },
    { label: 'Always', score: 5 }
  ];

  /* ---------- Provisional score ranges (percent). Highest first. ----------
     Band is chosen from the ROUNDED percentage so what is shown always matches the label. */
  var BANDS = [
    { min: 80, key: 'frequent',     label: 'Frequently demonstrated' },
    { min: 60, key: 'generally',    label: 'Generally demonstrated' },
    { min: 40, key: 'inconsistent', label: 'Inconsistently demonstrated' },
    { min: 0,  key: 'priority',     label: 'Development priority' }
  ];

  /* Bands at or above this min get the "keep building" suggestion; below it, the "start here" suggestion. */
  var HIGH_SUGGESTION_MIN = 60;

  /* Shown under category and dimension feedback for the two lowest bands. */
  var ORG_NOTE = 'Your answers can also reflect your workplace. Consider whether workload, unclear expectations, training, supervision, or workplace culture are affecting this area.';

  /* ---------- Two dimensions ---------- */
  var DIMENSIONS = {
    care: {
      name: 'Care Competence',
      question: 'How do I show up for the people I serve?',
      feedback: {
        frequent:     'You describe frequently showing the care behaviors in this assessment: understanding, respect, boundaries, and intentional responses. Keep the habits that support this, especially during stressful periods.',
        generally:    'You describe generally showing these care behaviors. Look at the categories below to see which moments are harder for you, and choose one to strengthen.',
        inconsistent: 'You describe showing these care behaviors some of the time. That is common in demanding work. The category results below can help you pick one specific behavior to practice.',
        priority:     'You describe these care behaviors less often than you would like. That does not say anything about your worth or your commitment. It points to skills you can build, ideally with support from your supervisor or team.'
      }
    },
    workplace: {
      name: 'Workplace Competence',
      question: 'How do I show up as a professional?',
      feedback: {
        frequent:     'You describe frequently showing the workplace behaviors in this assessment: accountability, communication, openness to feedback, and responsibility. Keep sharing what works with others.',
        generally:    'You describe generally showing these workplace behaviors. The category results below show where some situations may still be harder, and which one to strengthen next.',
        inconsistent: 'You describe showing these workplace behaviors some of the time. Clear expectations, training, and supervision all affect this. The category results below can help you choose one behavior to practice.',
        priority:     'You describe these workplace behaviors less often than you would like. This is a place to grow, and it may also reflect unclear expectations, workload, or limited support. It is not a verdict on you as an employee.'
      }
    }
  };

  /* ---------- Eight categories, four questions each ---------- */
  var CATEGORIES = [
    {
      id: 'cat1', dimension: 'care', name: 'Empathy vs. Emotional Reactivity',
      questions: [
        'I try to understand another person’s perspective before responding.',
        'I remain respectful when a person I serve expresses anger or frustration toward me.',
        'I can recognize someone’s emotions without automatically taking responsibility for fixing them.',
        'I pause before reacting when a person’s behavior triggers frustration in me.'
      ],
      feedback: {
        frequent:     'You regularly try to understand another person’s perspective and stay respectful when emotions run high. Keep protecting the habits that make this possible.',
        generally:    'You usually respond with understanding and composure. The most stressful moments may still pull you toward a quicker, more reactive response.',
        inconsistent: 'How you respond varies from situation to situation, which is common under stress or heavy workloads. Noticing which moments pull you off course is a useful starting point.',
        priority:     'Staying understanding and steady under pressure is hard, especially with limited support or high demands. This is a good area to practice in small, specific steps.'
      },
      suggestionHigh: 'Describe one pause or reset habit that works for you to a newer colleague.',
      suggestionLow:  'Choose one situation that tends to frustrate you and practice one slow breath before you respond.'
    },
    {
      id: 'cat2', dimension: 'care', name: 'Person-Centered Care vs. Personal Judgment',
      questions: [
        'I respect a person’s choices even when they differ from what I would choose for myself.',
        'I remain curious when someone’s values, beliefs, or experiences differ from mine.',
        'I avoid making assumptions about a person based on their behavior, background, or history.',
        'I adapt my approach to an individual’s needs rather than expecting everyone to respond the same way.'
      ],
      feedback: {
        frequent:     'You respect people’s choices and stay curious about experiences different from your own. This supports trust and engagement.',
        generally:    'You generally respect people’s choices and stay open. Occasionally your own values or assumptions may shape how you read a situation.',
        inconsistent: 'Your openness to different choices and values varies. Noticing when an assumption shows up can help you respond with more curiosity.',
        priority:     'Setting aside personal views and assumptions is difficult and takes practice. Small habits, like asking before assuming, can help.'
      },
      suggestionHigh: 'Ask one person you serve what matters most to them and let that guide your next interaction.',
      suggestionLow:  'When you notice an assumption, ask one open question before deciding how to respond.'
    },
    {
      id: 'cat3', dimension: 'care', name: 'Professional Boundaries vs. Rescuing',
      questions: [
        'I maintain appropriate professional boundaries even when I feel especially connected to someone I serve.',
        'I can set limits without feeling that I have failed the person.',
        'I avoid making promises that exceed my role, authority, or control.',
        'I help people develop their own skills rather than routinely doing things they can reasonably do themselves.'
      ],
      feedback: {
        frequent:     'You keep clear boundaries even when you feel connected to someone, and you support people in building their own skills.',
        generally:    'You generally keep appropriate boundaries. There may be moments when wanting to help leads you to do more than your role allows.',
        inconsistent: 'Boundaries and the urge to rescue pull against each other for you at times. Clarifying where your role ends can help you care without overextending.',
        priority:     'Holding boundaries while caring deeply is one of the hardest parts of this work, and unclear roles or heavy workloads make it harder. Start by clarifying where your responsibilities end.'
      },
      suggestionHigh: 'Offer to talk with a colleague about how you set limits while staying warm.',
      suggestionLow:  'Write down where your role ends in one recurring situation, then check it with your supervisor.'
    },
    {
      id: 'cat4', dimension: 'care', name: 'Intentional Care vs. Reactive Care',
      questions: [
        'I consider what a person’s behavior may be communicating before deciding how to respond.',
        'I use appropriate de-escalation and other support strategies before reacting to challenging behavior.',
        'I adjust my approach when I recognize that a strategy is not working.',
        'I reflect on my own contribution when an interaction with a person I serve goes poorly.'
      ],
      feedback: {
        frequent:     'You look for what behavior may be communicating, use support strategies first, and adjust when something is not working.',
        generally:    'You usually respond with intention. Under pressure you may sometimes react before you have had time to think through your approach.',
        inconsistent: 'Your care is intentional in some moments and reactive in others. Slowing down to ask what a behavior may be communicating can help.',
        priority:     'Responding intentionally is difficult when you are stretched thin. Choosing one strategy to try consistently is a practical first step.'
      },
      suggestionHigh: 'After a hard interaction, spend two minutes noting what worked and what you would change.',
      suggestionLow:  'Pick one de-escalation strategy and use it first, every time, for the next two weeks.'
    },
    {
      id: 'cat5', dimension: 'workplace', name: 'Accountability vs. Good Intentions',
      questions: [
        'I acknowledge my mistakes without immediately blaming circumstances or other people.',
        'I follow through on commitments I make to colleagues and supervisors.',
        'When I miss an expectation or deadline, I communicate the issue and take steps to address it.',
        'I focus on resolving problems rather than only explaining why they happened.'
      ],
      feedback: {
        frequent:     'You own mistakes, follow through, and focus on fixing problems. Colleagues can count on you.',
        generally:    'You usually follow through and own your part. Occasionally an explanation may come before a solution.',
        inconsistent: 'Follow-through and ownership are uneven for you right now. Unclear expectations or a heavy workload may play a role, so it can help to name them.',
        priority:     'Keeping commitments and owning mistakes consistently is a development priority. Unclear expectations, workload, or limited support can contribute, so consider those too.'
      },
      suggestionHigh: 'Model a simple habit: say what went wrong, what you did about it, and what happens next.',
      suggestionLow:  'The next time you miss something, tell the person early and share one step you are taking to fix it.'
    },
    {
      id: 'cat6', dimension: 'workplace', name: 'Professional Communication vs. Workplace Conflict',
      questions: [
        'I address disagreements directly and respectfully with the appropriate person.',
        'I avoid gossiping about colleagues instead of addressing concerns constructively.',
        'I can disagree with a decision without becoming disrespectful toward the person who made it.',
        'I communicate concerns through appropriate channels rather than involving people who cannot help resolve them.'
      ],
      feedback: {
        frequent:     'You raise disagreements directly and respectfully, with the right person and through the right channels.',
        generally:    'You generally communicate professionally. In tense moments, venting or involving people who cannot help may still creep in.',
        inconsistent: 'How you handle disagreement varies. Choosing the right person and channel before you speak is a useful habit to build.',
        priority:     'Raising concerns directly and respectfully is hard, particularly in workplaces where channels are unclear. Practice with one concern at a time.'
      },
      suggestionHigh: 'Share how you decide who to bring a concern to, and why.',
      suggestionLow:  'Before venting about a concern, ask yourself who can actually help resolve it, then talk to that person.'
    },
    {
      id: 'cat7', dimension: 'workplace', name: 'Coachability vs. Defensiveness',
      questions: [
        'I listen to corrective feedback before explaining my perspective.',
        'I consider whether feedback contains useful information even when I disagree with part of it.',
        'I make observable changes when feedback identifies a valid area for improvement.',
        'I ask clarifying questions when expectations or feedback are unclear.'
      ],
      feedback: {
        frequent:     'You listen to feedback first, look for what is useful, and make changes others can see.',
        generally:    'You usually take feedback well. Now and then, explaining may come before listening.',
        inconsistent: 'Your response to feedback varies, which is normal when feedback feels unfair or unclear. Asking a clarifying question can keep the conversation useful.',
        priority:     'Receiving feedback is difficult for almost everyone, and more so when it is unclear or poorly delivered. Try listening fully before you respond.'
      },
      suggestionHigh: 'Ask a trusted colleague for feedback on one specific behavior.',
      suggestionLow:  'In your next feedback conversation, restate what you heard before you respond.'
    },
    {
      id: 'cat8', dimension: 'workplace', name: 'Professional Responsibility vs. Personal Preference',
      questions: [
        'I complete required responsibilities even when they are not my preferred tasks.',
        'I follow applicable policies and procedures while raising concerns through appropriate channels when needed.',
        'I complete required documentation and communicate important information within expected timeframes.',
        'I remain professional and cooperative when working with people whose styles differ from mine.'
      ],
      feedback: {
        frequent:     'You complete required tasks and documentation on time, follow policies, and stay cooperative with different working styles.',
        generally:    'You usually meet your responsibilities, even the ones you do not prefer. Some tasks or working styles may still be harder for you to take on.',
        inconsistent: 'Meeting responsibilities is uneven for you, especially for tasks you like less. Unclear expectations or too much on your plate may contribute.',
        priority:     'Keeping up with required tasks, policies, and documentation is a development priority. Clarifying expectations and workload with your supervisor is a good place to start.'
      },
      suggestionHigh: 'Share a system you use to keep documentation and deadlines on track.',
      suggestionLow:  'Choose one required task you tend to delay and set a fixed time for it each shift.'
    }
  ];

  var REFLECTION_QUESTIONS = [
    'Which statements were easiest for you to answer honestly?',
    'Which statements were most uncomfortable to answer?',
    'Did your Care Competence score differ from your Workplace Competence score? What might explain the difference?',
    'Which category best represents a current strength?',
    'Which category would benefit most from intentional development?',
    'Is any workplace barrier, such as unclear expectations, inadequate training, workload, or limited supervision, affecting your responses?',
    'What is one observable behavior you will work on over the next 30 days?'
  ];

  /* ---------- Build the flat question list with IDs q1..q32 ---------- */
  var QUESTIONS = [];
  CATEGORIES.forEach(function (cat) {
    cat.questionIds = [];
    cat.questions.forEach(function (text) {
      var n = QUESTIONS.length + 1;
      var id = 'q' + n;
      QUESTIONS.push({ id: id, number: n, text: text, category: cat.id, dimension: cat.dimension });
      cat.questionIds.push(id);
    });
  });

  /* ---------- Scoring (pure functions, no DOM) ---------- */
  // Percentage = (points - min) / (max - min) * 100, rounded to a whole number.
  // 4-question category: min 4, max 20. 16-question dimension: min 16, max 80.
  function toPercent(points, count) {
    var min = count * 1, max = count * 5;
    return Math.round(((points - min) / (max - min)) * 100);
  }
  function bandFor(pct) {
    for (var i = 0; i < BANDS.length; i++) { if (pct >= BANDS[i].min) return BANDS[i]; }
    return BANDS[BANDS.length - 1];
  }
  /* answers: { q1: 1..5, ... }  ->  results, or { unanswered: [numbers] } if anything is missing */
  function computeResults(answers) {
    var unanswered = QUESTIONS.filter(function (q) {
      var v = answers[q.id];
      return !(v >= 1 && v <= 5);
    }).map(function (q) { return q.number; });
    if (unanswered.length) return { complete: false, unanswered: unanswered };

    var dims = {};
    Object.keys(DIMENSIONS).forEach(function (k) { dims[k] = { points: 0, count: 0 }; });
    var cats = CATEGORIES.map(function (cat) {
      var points = 0;
      cat.questionIds.forEach(function (id) { points += Number(answers[id]); });
      dims[cat.dimension].points += points;
      dims[cat.dimension].count += cat.questionIds.length;
      var pct = toPercent(points, cat.questionIds.length);
      return { id: cat.id, name: cat.name, dimension: cat.dimension, points: points, pct: pct, band: bandFor(pct) };
    });
    Object.keys(dims).forEach(function (k) {
      dims[k].pct = toPercent(dims[k].points, dims[k].count);
      dims[k].band = bandFor(dims[k].pct);
    });
    return { complete: true, dimensions: dims, categories: cats };
  }

  /* ---------- Comparison text (describes patterns; never labels the person) ---------- */
  function compareText(res) {
    var care = res.dimensions.care.pct, work = res.dimensions.workplace.pct;
    var diff = care - work, parts = [];
    if (Math.abs(diff) < 10) {
      parts.push('Your Care Competence (' + care + '%) and Workplace Competence (' + work + '%) results are fairly close. Your self-reported behavior looks similar across how you care for people and how you work within your organization.');
    } else if (diff > 0) {
      parts.push('Your Care Competence (' + care + '%) is higher than your Workplace Competence (' + work + '%). You describe showing up for people more consistently than for workplace expectations. Unclear expectations, workload, training, or supervision can all affect workplace behaviors.');
    } else {
      parts.push('Your Workplace Competence (' + work + '%) is higher than your Care Competence (' + care + '%). You describe handling professional responsibilities more consistently than some care situations. Demanding or emotionally heavy moments can make care behaviors harder to sustain.');
    }
    var sorted = res.categories.slice().sort(function (a, b) { return b.pct - a.pct; });
    var top = sorted.slice(0, 2), low = sorted.slice(-2).reverse();
    parts.push('Relative strengths in your answers: ' + top.map(function (c) { return c.name + ' (' + c.pct + '%)'; }).join('; ') + '.');
    parts.push('Possible development priorities: ' + low.map(function (c) { return c.name + ' (' + c.pct + '%)'; }).join('; ') + '.');
    parts.push('These describe patterns in one set of self-reported answers. They are not a judgment of you as an employee or a caregiver.');
    return parts;
  }

  /* Development suggestion shown for a category at a given percentage (page and results email). */
  function suggestionFor(cat, pct) {
    return pct >= HIGH_SUGGESTION_MIN ? cat.suggestionHigh : cat.suggestionLow;
  }

  /* ---------- Next step: which guide cards to show for the optional role answer ---------- */
  function guidesForRole(role) {
    if (role === 'direct-care' || role === 'student') return ['guide', 'bundle'];
    if (role === 'supervisor') return ['supervisor', 'bundle'];
    return ['guide', 'supervisor', 'bundle'];
  }

  /* Expose for testing / reuse */
  var api = { QUESTIONS: QUESTIONS, CATEGORIES: CATEGORIES, DIMENSIONS: DIMENSIONS, BANDS: BANDS,
              computeResults: computeResults, toPercent: toPercent, bandFor: bandFor, compareText: compareText,
              guidesForRole: guidesForRole, suggestionFor: suggestionFor };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  if (typeof document === 'undefined') { return; }
  window.G2GAssessment = api;

  /* =====================================================================
     DOM / rendering
     ===================================================================== */
  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') e.className = attrs[k]; else e.setAttribute(k, attrs[k]);
    });
    if (text !== undefined) e.textContent = text;
    return e;
  }
  var $ = function (id) { return document.getElementById(id); };
  var form = $('assessment'), qWrap = $('questions'), errBox = $('error');
  /* Turn on once the subscribe Worker with POST /results is deployed. Off: the results page offers
     the newsletter sign-up (assets/subscribe.js) under Print instead of "email my results". */
  var RESULTS_EMAIL = false;
  var RESULTS_ENDPOINT = 'https://g2g-subscribe.grow2guide.workers.dev/results';
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var emailBox = $('email-box'), emailInput = $('results-email'), emailErr = $('results-email-error');
  var newsletterBox = $('results-newsletter'), sendBtn = $('send-results-btn'), emailStatus = $('email-status');
  var lastResults = null;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var scrollBehavior = reduceMotion ? 'auto' : 'smooth';

  function renderQuestions() {
    // Category names appear only in the results, not above the questions.
    var lastDim = null;
    QUESTIONS.forEach(function (q) {
      if (q.dimension !== lastDim) {
        var d = DIMENSIONS[q.dimension];
        qWrap.appendChild(el('h2', { class: 'part-title' }, (q.dimension === 'care' ? 'Part 1: ' : 'Part 2: ') + d.name));
        qWrap.appendChild(el('p', { class: 'part-sub' }, d.question));
        lastDim = q.dimension;
      }
      var fs = el('fieldset', { class: 'q', id: 'fs-' + q.id });
      fs.appendChild(el('legend', null, q.number + '. ' + q.text));
      var opts = el('div', { class: 'options' });
      SCALE.forEach(function (s) {
        var lab = el('label', { class: 'opt' });
        var inp = el('input', { type: 'radio', name: q.id, value: String(s.score), id: q.id + '-' + s.score });
        lab.appendChild(inp);
        lab.appendChild(el('span', null, s.label));
        opts.appendChild(lab);
      });
      fs.appendChild(opts);
      qWrap.appendChild(fs);
    });
  }

  function readAnswers() {
    var a = {};
    QUESTIONS.forEach(function (q) {
      var c = form.querySelector('input[name="' + q.id + '"]:checked');
      if (c) a[q.id] = Number(c.value);
    });
    return a;
  }
  /* Part shown in the progress bar: the last part heading that has scrolled up to the bar. */
  function currentPart() {
    var titles = qWrap.querySelectorAll('.part-title'), part = 1;
    var bar = form.querySelector('.progress-line').getBoundingClientRect().bottom;
    for (var i = 0; i < titles.length; i++) {
      if (titles[i].getBoundingClientRect().top <= bar + 40) part = i + 1;
    }
    return part;
  }
  function updateCount() {
    var n = Object.keys(readAnswers()).length;
    $('answered-count').textContent = 'Part ' + currentPart() + ' of 2 \u00b7 ' + n + ' of ' + QUESTIONS.length + ' answered';
    $('progress-fill').style.width = Math.round((n / QUESTIONS.length) * 100) + '%';
    $('next-unanswered').hidden = n === QUESTIONS.length;
  }
  function firstUnanswered() {
    var a = readAnswers();
    for (var i = 0; i < QUESTIONS.length; i++) { if (!a[QUESTIONS[i].id]) return QUESTIONS[i]; }
    return null;
  }
  function goToQuestion(q, focus) {
    var fs = $('fs-' + q.id);
    fs.scrollIntoView({ behavior: scrollBehavior, block: 'center' });
    if (focus) { var first = fs.querySelector('input'); if (first) first.focus({ preventScroll: true }); }
  }

  function barBlock(pct, label) {
    var bar = el('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100',
                          'aria-valuenow': String(pct), 'aria-label': label + ': ' + pct + ' percent' });
    var fill = el('div'); fill.style.width = pct + '%';
    bar.appendChild(fill);
    return bar;
  }
  function isLowBand(b) { return b.key === 'inconsistent' || b.key === 'priority'; }

  function renderNextStep(role) {
    var show = guidesForRole(role);
    var cards = document.querySelectorAll('#next-step-section [data-guide]');
    for (var i = 0; i < cards.length; i++) cards[i].hidden = show.indexOf(cards[i].getAttribute('data-guide')) === -1;
  }

  function renderResults(res) {
    var dimWrap = $('dimension-results'), catWrap = $('category-results'), cmp = $('comparison');
    dimWrap.textContent = ''; catWrap.textContent = ''; cmp.textContent = '';

    ['care', 'workplace'].forEach(function (k) {
      var d = DIMENSIONS[k], r = res.dimensions[k];
      var card = el('div', { class: 'card big' });
      card.appendChild(el('h3', null, d.name));
      var line = el('div');
      line.appendChild(el('span', { class: 'pct' }, r.pct + '%'));
      line.appendChild(el('span', { class: 'band' }, r.band.label));
      card.appendChild(line);
      card.appendChild(barBlock(r.pct, d.name));
      card.appendChild(el('p', null, d.feedback[r.band.key]));
      if (isLowBand(r.band)) card.appendChild(el('p', { class: 'org-note' }, ORG_NOTE));
      dimWrap.appendChild(card);
    });

    var byId = {}; CATEGORIES.forEach(function (c) { byId[c.id] = c; });
    res.categories.forEach(function (r) {
      var cat = byId[r.id];
      var card = el('div', { class: 'card cat-card' });
      card.appendChild(el('h3', null, cat.name + ' (' + DIMENSIONS[cat.dimension].name + ')'));
      var line = el('div');
      line.appendChild(el('span', { class: 'pct' }, r.pct + '%'));
      line.appendChild(el('span', { class: 'band' }, r.band.label));
      card.appendChild(line);
      card.appendChild(barBlock(r.pct, cat.name));
      card.appendChild(el('p', null, cat.feedback[r.band.key]));
      if (isLowBand(r.band)) card.appendChild(el('p', { class: 'org-note' }, ORG_NOTE));
      var tip = suggestionFor(cat, r.pct);
      var s = el('p', { class: 'suggest' });
      s.appendChild(el('strong', null, 'Development suggestion: '));
      s.appendChild(document.createTextNode(tip));
      card.appendChild(s);
      catWrap.appendChild(card);
    });

    compareText(res).forEach(function (t) { cmp.appendChild(el('p', null, t)); });

    var rq = $('reflection-questions');
    if (!rq.children.length) REFLECTION_QUESTIONS.forEach(function (t) { rq.appendChild(el('li', null, t)); });
  }

  function showErrors(unanswered) {
    QUESTIONS.forEach(function (q) {
      var fs = $('fs-' + q.id);
      fs.classList.toggle('unanswered', unanswered.indexOf(q.number) !== -1);
    });
    errBox.textContent = '';
    errBox.appendChild(el('strong', null, 'Please answer every question before viewing your results. '));
    errBox.appendChild(document.createTextNode('Unanswered: '));
    unanswered.forEach(function (n, i) {
      var a = el('a', { href: '#fs-q' + n }, 'Question ' + n);
      a.addEventListener('click', function (e) {
        e.preventDefault();
        goToQuestion(QUESTIONS[n - 1], true);
      });
      errBox.appendChild(a);
      if (i < unanswered.length - 1) errBox.appendChild(document.createTextNode(', '));
    });
    errBox.hidden = false;
    errBox.focus();
  }

  function resetAll() {
    form.reset();
    ['ref-strength', 'ref-development', 'ref-behavior', 'ref-progress', 'ref-date'].forEach(function (id) { $(id).value = ''; });
    QUESTIONS.forEach(function (q) {
      var fs = $('fs-' + q.id);
      fs.classList.remove('unanswered');
      fs.removeAttribute('data-advanced');
    });
    errBox.hidden = true;
    // Put the email box back at the end of the questions, empty.
    form.insertBefore(emailBox, errBox);
    emailInput.value = ''; newsletterBox.checked = false; $('results-website').value = '';
    showEmailError('');
    sendBtn.hidden = true; emailBox.hidden = !RESULTS_EMAIL;
    var nl = $('newsletter-box');
    nl.reset(); nl.hidden = true;
    nl.querySelector('[data-status]').textContent = '';
    setStatus('');
    lastResults = null;
    $('results').hidden = true;
    $('intro').hidden = false;
    form.hidden = false;
    updateCount();
    window.scrollTo(0, 0);
  }

  /* Never add answers, scores, role, reflection text or the email address to these events. */
  function track(event, extra) {
    window.dataLayer = window.dataLayer || [];
    var e = { event: event };
    if (extra) Object.keys(extra).forEach(function (k) { e[k] = extra[k]; });
    window.dataLayer.push(e);
  }

  /* ---------- Email my results ---------- */
  function showEmailError(msg) {
    emailErr.textContent = msg || '';
    emailErr.hidden = !msg;
    emailInput.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }
  /* Returns the trimmed address, '' when empty, or null after showing an error. */
  function checkedEmail(required) {
    var v = emailInput.value.trim();
    if (!v && !required) { showEmailError(''); return ''; }
    if (!v || v.length > 254 || !EMAIL_RE.test(v)) {
      showEmailError('Enter an email address like name@example.com.');
      emailInput.focus();
      return null;
    }
    showEmailError('');
    return v;
  }
  function setStatus(text, kind) {
    emailStatus.textContent = text;
    emailStatus.className = kind || '';
    emailStatus.hidden = !text;
  }
  /* On the results page the box sits under Print my results, with its own Send button. */
  function showEmailBoxInResults() {
    if (!RESULTS_EMAIL) { $('newsletter-box').hidden = false; return; }
    $('email-slot').appendChild(emailBox);
    sendBtn.hidden = false;
    emailBox.hidden = false;
  }
  function sendResults(email) {
    var newsletter = newsletterBox.checked;
    emailBox.hidden = true;
    setStatus('Sending your results to ' + email + '\u2026');
    fetch(RESULTS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        scores: {
          care: lastResults.dimensions.care.pct,
          workplace: lastResults.dimensions.workplace.pct,
          categories: lastResults.categories.map(function (c) { return c.pct; })
        },
        newsletter: newsletter,
        source: '/self-assessment/',
        website: $('results-website').value
      })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (body) {
        if (!r.ok || !body.ok) throw new Error(body.error || 'failed');
      });
    }).then(function () {
      setStatus('Sent to ' + email + '. Check your inbox.', 'ok');
      track('results_email_sent', { newsletter: newsletter });
    }).catch(function (err) {
      setStatus(err.message === 'invalid_email'
        ? 'That email address doesn\u2019t look right. Check it and try again.'
        : 'We couldn\u2019t send your results. Please try again in a minute.', 'err');
      showEmailBoxInResults();
    });
  }

  renderQuestions();
  updateCount();
  emailBox.hidden = !RESULTS_EMAIL;
  document.querySelector('[data-privacy="newsletter"]').hidden = RESULTS_EMAIL;
  document.querySelector('[data-privacy="results-email"]').hidden = !RESULTS_EMAIL;

  /* After a first answer given by tap or click, bring the next question into view.
     Keyboard users change answers with arrow keys, so they are never moved. */
  var lastPointer = 0;
  form.addEventListener('pointerdown', function () { lastPointer = Date.now(); });
  form.addEventListener('change', function (e) {
    var t = e.target;
    if (!/^q\d+$/.test(t.name) || Date.now() - lastPointer > 1500) return;
    var fs = $('fs-' + t.name);
    if (fs.getAttribute('data-advanced')) return;
    fs.setAttribute('data-advanced', '1');
    var idx = Number(t.name.slice(1));
    var next = idx < QUESTIONS.length ? QUESTIONS[idx] : null;
    var target = next ? $('fs-' + next.id) : $('fs-role');
    if (next && form.querySelector('input[name="' + next.id + '"]:checked')) return;
    window.setTimeout(function () { target.scrollIntoView({ behavior: scrollBehavior, block: 'center' }); }, 150);
  });

  var partTick = false;
  window.addEventListener('scroll', function () {
    if (partTick || form.hidden) return;
    partTick = true;
    window.requestAnimationFrame(function () { partTick = false; updateCount(); });
  }, { passive: true });

  $('next-unanswered').addEventListener('click', function () {
    var q = firstUnanswered();
    if (q) goToQuestion(q, true);
  });

  /* Same event the Guides page sends for its buy buttons. No role or score data. */
  var buyLinks = document.querySelectorAll('#next-step-section [data-offer]');
  for (var b = 0; b < buyLinks.length; b++) {
    buyLinks[b].addEventListener('click', function () {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: 'guides_buy_click', offer: this.getAttribute('data-offer'), placement: this.id });
    });
  }

  form.addEventListener('change', function () {
    updateCount();
    // clear the error highlight on a question as soon as it is answered
    QUESTIONS.forEach(function (q) {
      if (form.querySelector('input[name="' + q.id + '"]:checked')) $('fs-' + q.id).classList.remove('unanswered');
    });
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var res = computeResults(readAnswers());
    if (!res.complete) { showErrors(res.unanswered); return; }
    var email = checkedEmail(false);
    if (email === null) return;
    errBox.hidden = true;
    lastResults = res;
    renderResults(res);
    var role = form.querySelector('input[name="role"]:checked');
    renderNextStep(role ? role.value : 'skip');
    $('intro').hidden = true;
    form.hidden = true;
    $('results').hidden = false;
    $('results').focus();
    window.scrollTo(0, 0);
    track('assessment_complete');
    if (email) sendResults(email); else showEmailBoxInResults();
  });
  $('print-btn').addEventListener('click', function () { window.print(); });
  sendBtn.addEventListener('click', function () {
    var email = checkedEmail(true);
    if (email) sendResults(email);
  });
  emailInput.addEventListener('input', function () { showEmailError(''); });
  emailInput.addEventListener('keydown', function (e) {
    // Outside the form (results page) Enter would do nothing, so send instead.
    if (e.key === 'Enter' && !sendBtn.hidden) { e.preventDefault(); sendBtn.click(); }
  });
  $('retake-btn').addEventListener('click', resetAll);
})();
