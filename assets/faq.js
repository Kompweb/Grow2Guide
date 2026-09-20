(function () {
  var input = document.getElementById('faq-search-input');
  var clearBtn = document.getElementById('faq-search-clear');
  var countEl = document.getElementById('faq-search-count');
  var noResults = document.getElementById('faq-no-results');
  var jumpNav = document.querySelector('.faq-jump');
  var groups = Array.from(document.querySelectorAll('.faq-group'));
  var items = Array.from(document.querySelectorAll('.faq-item'));
  if (!input || !items.length) return;

  items.forEach(function (item) {
    item.dataset.faqDefaultOpen = item.hasAttribute('open') ? '1' : '0';
  });

  function reset() {
    items.forEach(function (item) {
      item.classList.remove('faq-hidden');
      item.open = item.dataset.faqDefaultOpen === '1';
    });
    groups.forEach(function (g) { g.classList.remove('faq-hidden'); });
    if (jumpNav) jumpNav.classList.remove('is-searching');
    noResults.classList.remove('show');
    countEl.textContent = '';
    clearBtn.classList.remove('show');
  }

  function runSearch() {
    var q = input.value.trim().toLowerCase();
    clearBtn.classList.toggle('show', q.length > 0);
    if (!q) { reset(); return; }
    if (jumpNav) jumpNav.classList.add('is-searching');

    var matchCount = 0;
    groups.forEach(function (group) {
      var groupHasMatch = false;
      group.querySelectorAll('.faq-item').forEach(function (item) {
        var match = item.textContent.toLowerCase().indexOf(q) !== -1;
        item.classList.toggle('faq-hidden', !match);
        item.open = match;
        if (match) { groupHasMatch = true; matchCount++; }
      });
      group.classList.toggle('faq-hidden', !groupHasMatch);
    });

    noResults.classList.toggle('show', matchCount === 0);
    countEl.textContent = matchCount === 0 ? '' : matchCount + ' question' + (matchCount === 1 ? '' : 's') + ' found';
  }

  input.addEventListener('input', runSearch);
  clearBtn.addEventListener('click', function () {
    input.value = '';
    reset();
    input.focus();
  });
})();
