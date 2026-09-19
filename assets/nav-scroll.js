(function () {
  'use strict';

  var nav = document.querySelector('nav.glass-nav');
  if (!nav) return;

  var mobileMenu = document.getElementById('mobile-menu');
  var mobileMenuButton = document.getElementById('mobile-menu-btn');
  var secondaryNav = document.querySelector('.services-subnav');
  var lastY = Math.max(window.scrollY, 0);
  var ticking = false;
  var navHidden = false;
  var hideAfter = 120;
  var directionThreshold = 2;

  nav.style.transition = 'transform 0.3s ease';
  nav.style.willChange = 'transform';
  if (secondaryNav) secondaryNav.style.transition = 'top 0.3s ease';

  function menuIsOpen() {
    if (mobileMenuButton && mobileMenuButton.getAttribute('aria-expanded') === 'true') {
      return true;
    }
    return mobileMenu && !mobileMenu.classList.contains('hidden');
  }

  function showNav() {
    navHidden = false;
    nav.style.transform = 'translateY(0)';
    if (secondaryNav) secondaryNav.style.top = nav.offsetHeight + 'px';
  }

  function hideNav() {
    navHidden = true;
    nav.style.transform = 'translateY(-100%)';
    if (secondaryNav) secondaryNav.style.top = '0px';
  }

  function updateNav() {
    var y = Math.max(window.scrollY, 0);
    var change = y - lastY;

    if (menuIsOpen() || y <= hideAfter) {
      showNav();
    } else if (change > directionThreshold) {
      hideNav();
    } else if (change < -directionThreshold) {
      showNav();
    }

    lastY = y;
    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(updateNav);
  }, { passive: true });

  if (mobileMenuButton) {
    mobileMenuButton.addEventListener('click', function () {
      window.requestAnimationFrame(function () {
        if (menuIsOpen()) showNav();
      });
    });

    new MutationObserver(function () {
      if (menuIsOpen()) showNav();
    }).observe(mobileMenuButton, { attributes: true, attributeFilter: ['aria-expanded'] });
  }

  document.addEventListener('pointerdown', function (event) {
    if (!mobileMenuButton || !menuIsOpen()) return;
    if (!window.matchMedia('(max-width: 1023px)').matches) return;
    if (nav.contains(event.target)) return;

    mobileMenuButton.click();
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape' || !mobileMenuButton || !menuIsOpen()) return;
    mobileMenuButton.click();
    mobileMenuButton.focus();
  });

  window.addEventListener('pageshow', function () {
    lastY = Math.max(window.scrollY, 0);
    showNav();
  });

  window.addEventListener('resize', function () {
    if (secondaryNav) secondaryNav.style.top = navHidden ? '0px' : nav.offsetHeight + 'px';
  }, { passive: true });

  showNav();
})();
