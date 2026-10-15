(function () {
  // Blog engagement events for GTM's dataLayer. Map them to GA4 in GTM:
  //   blog_cta_click      - guide/consultation link clicked (cta_placement: inline | end | other)
  //   blog_related_click  - "Keep reading" link clicked
  //   blog_card_click     - article card clicked on the blog index
  //   newsletter_signup   - signup succeeded (signup_placement: page | modal)
  window.dataLayer = window.dataLayer || [];

  function pageSlug(path) {
    var m = /^\/blog\/([a-z0-9-]+)\/?$/.exec(path || '');
    return m ? m[1] : 'blog-index';
  }

  // link: { pathname, text, zone }, zone is one of article | cta | related | card | other.
  function eventForLink(link, path) {
    var slug = pageSlug(path);
    var dest = link.pathname || '';
    if (link.zone === 'related') {
      return { event: 'blog_related_click', params: { post_slug: slug, destination_slug: pageSlug(dest) } };
    }
    if (link.zone === 'card') {
      return { event: 'blog_card_click', params: { destination_slug: pageSlug(dest) } };
    }
    var guides = /^\/guides\//.test(dest);
    var consultation = /^\/consultation\//.test(dest);
    if (!guides && !consultation) return null;
    var placement = link.zone === 'cta' ? 'end' : link.zone === 'article' ? 'inline' : 'other';
    return {
      event: 'blog_cta_click',
      params: {
        post_slug: slug,
        cta_placement: placement,
        cta_destination: guides ? 'guides' : 'consultation',
        link_text: String(link.text || '').replace(/\s+/g, ' ').trim().slice(0, 80)
      }
    };
  }

  function push(result) {
    if (!result) return;
    var payload = { event: result.event };
    for (var k in result.params) payload[k] = result.params[k];
    window.dataLayer.push(payload);
  }

  function zoneOf(a, path) {
    if (a.closest('[aria-labelledby="keep-reading-title"]')) return 'related';
    if (a.closest('aside')) return 'cta';
    if (a.closest('article')) return 'article';
    if (pageSlug(path) === 'blog-index' && a.closest('main') && /^\/blog\/[a-z0-9-]+\/?$/.test(a.pathname)) return 'card';
    return 'other';
  }

  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || a.hostname !== window.location.hostname) return;
    var path = window.location.pathname;
    push(eventForLink({ pathname: a.pathname, text: a.textContent, zone: zoneOf(a, path) }, path));
  }, true);

  // subscribe.js fires g2g:subscribed only after the signup succeeds; remember which form was submitted.
  var lastForm = null;
  document.addEventListener('submit', function (e) {
    if (e.target && e.target.matches && e.target.matches('[data-g2g-subscribe]')) lastForm = e.target;
  }, true);
  document.addEventListener('g2g:subscribed', function () {
    var placement = lastForm && lastForm.closest && lastForm.closest('#subscribe') ? 'page' : 'modal';
    push({ event: 'newsletter_signup', params: { post_slug: pageSlug(window.location.pathname), signup_placement: placement } });
  });

  window.g2gBlogEvents = { pageSlug: pageSlug, eventForLink: eventForLink };
})();
