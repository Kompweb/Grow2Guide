/* Counts clicks on links to the Self-Assessment: GTM → GA4 assessment_cta_click.
   placement comes from data-assessment-cta (blog_end, home_fit, nav, guides_band, footer).
   Loaded on every page by scripts/sync-footer.py. */
(function () {
  if (typeof document === 'undefined') return;
  document.addEventListener('click', function (e) {
    var link = e.target && e.target.closest ? e.target.closest('[data-assessment-cta]') : null;
    if (!link) return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'assessment_cta_click',
      placement: link.getAttribute('data-assessment-cta'),
      page_path: window.location.pathname
    });
  });
})();
