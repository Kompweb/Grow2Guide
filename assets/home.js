(function () {
  var cards = document.querySelectorAll('.reveal-card');
  if (!cards.length) return;

  if (!('IntersectionObserver' in window)) {
    cards.forEach(function (card) { card.classList.add('is-visible'); });
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

  cards.forEach(function (card) { observer.observe(card); });
})();
