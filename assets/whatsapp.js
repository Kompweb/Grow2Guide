/* WhatsApp click-to-chat: floating button + page-aware pre-filled messages.
   To switch to the business account, change NUMBER (digits only, with country code). */
(function () {
  "use strict";

  var NUMBER = "17023269916";
  var DEFAULT_MESSAGE = "Hi Sara, I found Grow2Guide and have a question.";
  var MESSAGES = {
    "/": "Hi Sara, I found Grow2Guide and have a question.",
    "/services/": "Hi Sara, I'm looking at your services and have a question.",
    "/consultation/": "Hi Sara, I'd like to book a consultation.",
    "/faq/": "Hi Sara, I read your FAQ and have a question.",
    "/handbook/": "Hi Sara, I have a question about the handbook.",
    "/handbook/programs/": "Hi Sara, I have a question about the handbook programs.",
    "/quiz/tier-1/": "Hi Sara, I'm taking the readiness quiz and have a question.",
    "/quiz/tier-2/": "Hi Sara, I'm taking the readiness quiz and have a question.",
    "/thank-you/": "Hi Sara, I just submitted a request and wanted to say hello."
  };

  function currentPath() {
    var path = window.location.pathname.replace(/index\.html$/, "");
    return path.slice(-1) === "/" ? path : path + "/";
  }

  function buildUrl() {
    var body = document.body;
    var message =
      (body && body.getAttribute("data-wa-message")) ||
      MESSAGES[currentPath()] ||
      DEFAULT_MESSAGE;
    return "https://wa.me/" + NUMBER + "?text=" + encodeURIComponent(message);
  }

  function track(location) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "whatsapp_click",
      whatsapp_location: location,
      page_path: currentPath()
    });
  }

  function decorate(link, location) {
    link.href = buildUrl();
    link.target = "_blank";
    link.rel = "noopener";
    link.addEventListener("click", function () {
      track(location);
    });
  }

  function injectStyles() {
    var style = document.createElement("style");
    style.textContent =
      ".g2g-wa{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:60;" +
      "display:flex;align-items:center;justify-content:center;width:62px;height:62px;border-radius:50%;" +
      "background:#25D366;color:#fff;box-shadow:0 6px 18px rgba(0,0,0,.25);transition:transform .15s ease}" +
      ".g2g-wa:hover{transform:scale(1.06)}" +
      ".g2g-wa:focus-visible{outline:3px solid #12201C;outline-offset:3px}" +
      ".g2g-wa svg{width:33px;height:33px;fill:currentColor}" +
      "@media (min-width:768px){.g2g-wa{right:24px;bottom:24px}}" +
      "@media (prefers-reduced-motion:reduce){.g2g-wa{transition:none}.g2g-wa:hover{transform:none}}";
    document.head.appendChild(style);
  }

  function injectButton() {
    var link = document.createElement("a");
    link.className = "g2g-wa";
    link.setAttribute("aria-label", "Chat with Sara on WhatsApp");
    link.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.85 9.85 0 0 0 12.04 2zm0 1.67c2.2 0 4.26.86 5.82 2.42a8.2 8.2 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.26-8.24zM8.53 7.33c-.16 0-.43.06-.66.31-.22.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74 1.98.85 2.38.68 2.81.64.43-.04 1.39-.57 1.58-1.12.2-.55.2-1.02.14-1.12-.06-.1-.22-.16-.47-.28-.25-.12-1.39-.69-1.6-.77-.22-.08-.37-.12-.53.12-.16.25-.6.77-.74.93-.14.16-.27.18-.51.06-.25-.12-1-.37-1.9-1.17-.7-.62-1.17-1.4-1.31-1.63-.14-.25-.01-.38.1-.5.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.53-1.29-.73-1.77-.19-.46-.39-.4-.53-.41h-.45z"/>' +
      "</svg>";
    decorate(link, "floating_button");
    document.body.appendChild(link);
  }

  function init() {
    injectStyles();
    injectButton();
    var links = document.querySelectorAll("[data-wa-link]");
    for (var i = 0; i < links.length; i++) {
      decorate(links[i], "inline_link");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
