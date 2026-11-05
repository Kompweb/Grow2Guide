(function () {
  var ITEM_LABELS = {
    guide: 'Thanks for buying the Behavioral Health Guide for employees - Why do we do it this way?',
    checklist: 'Thanks for buying the Supervisor Guide - How do I supervise employees effectively.',
    bundle: 'Thanks for buying the bundle — both PDF guides are on their way.'
  };

  // Prices match the Stripe Payment Links on /guides/. Update both together.
  var PRODUCTS = {
    guide: { item_id: 'guide', item_name: 'Behavioral Health Guide for employees', price: 67 },
    checklist: { item_id: 'toolkit', item_name: 'Supervisor Guide', price: 67 },
    bundle: { item_id: 'bundle', item_name: 'Both PDF guides (bundle)', price: 99 }
  };

  // GTM → GA4 purchase. Sent once per browser tab per checkout, so a reload does not count twice.
  // Stripe's session_id is used as transaction_id when the Payment Link redirect includes it.
  function trackPurchase(item, sessionId) {
    var product = PRODUCTS[item];
    if (!product) return;
    var key = 'g2g_purchase_' + (sessionId || item);
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, '1');
    } catch (e) {}
    var ecommerce = {
      currency: 'USD',
      value: product.price,
      items: [{ item_id: product.item_id, item_name: product.item_name, price: product.price, quantity: 1 }]
    };
    if (sessionId) ecommerce.transaction_id = sessionId;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ ecommerce: null });
    window.dataLayer.push({ event: 'purchase', ecommerce: ecommerce });
  }

  function run() {
    var params = new URLSearchParams(window.location.search);
    var item = params.get('item');
    var line = document.getElementById('thankyou-item-line');
    if (line && item && ITEM_LABELS[item]) {
      line.textContent = ITEM_LABELS[item];
    }
    trackPurchase(item, params.get('session_id'));
  }

  window.g2gThankYou = { trackPurchase: trackPurchase };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
