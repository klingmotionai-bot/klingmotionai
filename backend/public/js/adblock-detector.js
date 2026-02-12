/**
 * AdBlock detection for KlingMotionAI
 * Runs ONLY when user clicks Continue. No auto-run on page load.
 */
(function () {
  "use strict";

  var DISMISSED_KEY = "adblockModalDismissed";
  var DETECTION_DELAY_MS = 400;
  var modalShown = false;
  var overlay = null;

  function isDismissed() {
    try {
      return sessionStorage.getItem(DISMISSED_KEY) === "1";
    } catch (e) { return false; }
  }

  function setDismissed() {
    try { sessionStorage.setItem(DISMISSED_KEY, "1"); } catch (e) {}
  }

  function showModal() {
    if (modalShown || !overlay) return;
    modalShown = true;
    overlay.classList.add("adblock-modal--open");
    overlay.setAttribute("aria-hidden", "false");
  }

  function hideModal() {
    if (!overlay) return;
    overlay.classList.remove("adblock-modal--open");
    overlay.setAttribute("aria-hidden", "true");
  }

  function onOkClick() {
    hideModal();
    setDismissed();
    try {
      window.dispatchEvent(new CustomEvent("adblockModalDismissed"));
    } catch (e) {}
  }

  /** Use no-cors fetch: only check if request succeeds. Avoids CORS false positives. */
  function checkAdblockAsync() {
    return new Promise(function (resolve) {
      var done = false;
      function finish(blocked) {
        if (done) return;
        done = true;
        resolve(blocked);
      }
      var url = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?t=" + Date.now();
      fetch(url, { method: "GET", mode: "no-cors", cache: "no-store", credentials: "omit" })
        .then(function () { finish(false); })
        .catch(function () { finish(true); });
      setTimeout(function () { finish(false); }, 6000);
    });
  }

  /**
   * Run adblock check. Call when Continue is clicked.
   * cb(blocked) – blocked=true if ads are blocked, false otherwise.
   */
  function isMobileOrTablet() {
    if (typeof navigator === "undefined" && typeof window === "undefined") return false;
    var ua = (navigator && navigator.userAgent) || "";
    if (/Mobile|Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Tablet|Samsung|Silk|Kindle/i.test(ua)) return true;
    if (typeof window !== "undefined" && window.innerWidth <= 900) return true;
    return false;
  }

  window.runAdblockCheck = function (cb) {
    if (typeof cb !== "function") return;
    if (isDismissed()) {
      cb(false);
      return;
    }
    if (isMobileOrTablet()) {
      cb(false);
      return;
    }
    setTimeout(function () {
      checkAdblockAsync().then(function (blocked) {
        if (blocked) showModal();
        cb(blocked);
      });
    }, DETECTION_DELAY_MS);
  };

  function init() {
    try {
      overlay = document.createElement("div");
      overlay.id = "adblock-modal-overlay";
      overlay.className = "adblock-modal-overlay";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-labelledby", "adblock-modal-title");
      overlay.setAttribute("aria-hidden", "true");

      overlay.innerHTML =
        '<div class="adblock-modal-backdrop" id="adblock-modal-backdrop"></div>' +
        '<div class="adblock-modal-card">' +
          '<h2 id="adblock-modal-title" class="adblock-modal-title">Ad blocker detected</h2>' +
          '<p class="adblock-modal-text">To use KlingMotionAI for free, please disable your ad blocker for this site.</p>' +
          '<ul class="adblock-modal-steps">' +
            '<li><strong>Browser extensions:</strong> Click the extension icon (e.g. uBlock, AdBlock) and pause or disable for this site.</li>' +
            '<li><strong>AdGuard DNS:</strong> Go to your device or router settings and change DNS back to automatic, or add this site to the allowlist.</li>' +
            '<li><strong>Built-in blocker:</strong> Check your browser settings (e.g. Brave, Opera) and turn off ad blocking for klingmotionai.com</li>' +
          '</ul>' +
          '<div class="adblock-modal-actions">' +
            '<button type="button" class="btn btn-primary adblock-modal-btn" id="adblock-modal-ok">OK, Got it</button>' +
          '</div>' +
        '</div>';

      document.body.appendChild(overlay);

      var okBtn = document.getElementById("adblock-modal-ok");
      var backdrop = document.getElementById("adblock-modal-backdrop");

      if (okBtn) okBtn.addEventListener("click", onOkClick);
      if (backdrop) backdrop.addEventListener("click", onOkClick);
    } catch (e) {
      console.warn("[adblock-detector] init error:", e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
