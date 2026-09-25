(function () {
  var links = Array.from(document.querySelectorAll('.services-subnav a[href^="#"]'));
  var sections = links.map(function (link) {
    return document.querySelector(link.getAttribute('href'));
  }).filter(Boolean);
  if (!links.length || !sections.length) return;

  var ticking = false;

  function updateActiveSection() {
    var marker = window.scrollY + 190;
    var activeId = '';

    sections.forEach(function (section) {
      if (section.offsetTop <= marker) activeId = section.id;
    });

    links.forEach(function (link) {
      var active = link.getAttribute('href') === '#' + activeId;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });

    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(updateActiveSection);
  }, { passive: true });

  links.forEach(function (link) {
    link.addEventListener('click', function () {
      links.forEach(function (item) {
        item.classList.remove('is-active');
        item.removeAttribute('aria-current');
      });
      link.classList.add('is-active');
      link.setAttribute('aria-current', 'location');
    });
  });

  updateActiveSection();
})();

(function () {
  var mq = window.matchMedia('(min-width: 768px)');
  var panels = document.querySelectorAll('.tier-more');
  function sync() {
    panels.forEach(function (panel) { panel.open = mq.matches; });
  }
  sync();
  if (mq.addEventListener) { mq.addEventListener('change', sync); }
  else if (mq.addListener) { mq.addListener(sync); }
})();
