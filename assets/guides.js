(function () {
  // Push buy-click events to GTM's dataLayer so the offers can be compared in GTM.
  window.dataLayer = window.dataLayer || [];
  document.querySelectorAll("[data-offer]").forEach(function (el) {
    el.addEventListener("click", function () {
      window.dataLayer.push({ event: "guides_buy_click", offer: el.getAttribute("data-offer"), placement: el.id });
    });
  });
})();
