(function () {
  // The newsletter lives on Substack. Signups happen inside Substack's embedded form (an iframe),
  // so this page cannot see a completed signup: count those in Substack (Subscribers → source).
  // What the site can see, and sends to GTM → GA4:
  //   newsletter_form_view  — the form was at least half on screen (once per form per page load)
  //   newsletter_form_start — the visitor clicked or tapped into the form (once per form per page load)
  // Both carry signup_placement: page, modal or self_assessment (the box's data-placement).

  function placementOf(box) {
    return box.getAttribute('data-placement') || 'page';
  }

  function push(event, box) {
    var key = 'data-g2g-' + event;
    if (box.getAttribute(key)) return false;
    box.setAttribute(key, '1');
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: event, signup_placement: placementOf(box) });
    return true;
  }

  // Focus moving into an iframe blurs the page window; activeElement is then that iframe.
  function boxForActiveFrame(boxes, active) {
    if (!active || active.tagName !== 'IFRAME') return null;
    for (var i = 0; i < boxes.length; i++) {
      if (boxes[i].contains(active)) return boxes[i];
    }
    return null;
  }

  window.g2gSubscribe = { placementOf: placementOf, push: push, boxForActiveFrame: boxForActiveFrame };

  if (typeof document === 'undefined') return;
  var boxes = Array.prototype.slice.call(document.querySelectorAll('[data-g2g-substack]'));
  if (!boxes.length) return;

  if (typeof window.IntersectionObserver === 'function') {
    var observer = new window.IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          push('newsletter_form_view', entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    boxes.forEach(function (box) { observer.observe(box); });
  }

  window.addEventListener('blur', function () {
    // activeElement updates just after blur in some browsers.
    window.setTimeout(function () {
      var box = boxForActiveFrame(boxes, document.activeElement);
      if (box) push('newsletter_form_start', box);
    }, 0);
  });
})();
