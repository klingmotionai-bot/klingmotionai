/**
 * AdBlock detection for KlingMotionAI
 * NO auto-run on page load. Detection runs ONLY when user clicks Continue.
 */
(function () {
  "use strict";

  var DISMISSED_KEY = "adblockModalDismissed";
  var DETECTION_DELAY_MS = 400;
  var modalShownThisClick = false;
  var overlay = null;

  function isDismissed() {
    try {
      return sessionStorage.getItem(DISMISSED_KEY) === "1";
    } catch (e) { return false; }
  }

  function setDismissed() {
    try { sessionStorage.setItem(DISMISSED_KEY, "1"); } catch (e) {}
  }

  function ensureOverlay() {
    if (overlay && overlay.parentNode) return overlay;
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
          '<p class="adblock-modal-text" id="adblock-modal-title">please turn off the adblocker to generate your ai video for free</p>' +
          '<div class="adblock-modal-actions">' +
            '<button type="button" class="btn btn-primary adblock-modal-btn" id="adblock-modal-ok">OK, Got it</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(overlay);
      var okBtn = document.getElementById("adblock-modal-ok");
      var backdrop = document.getElementById("adblock-modal-backdrop");
      if (okBtn) okBtn.addEventListener("click", onOkClick);
      if (backdrop) backdrop.addEventListener("click", onOkClick);
      return overlay;
    } catch (e) {
      console.warn("[adblock-detector] ensureOverlay error:", e);
      return null;
    }
  }

  function showModal() {
    if (modalShownThisClick) return;
    modalShownThisClick = true;
    var el = ensureOverlay();
    if (el) {
      el.classList.add("adblock-modal--open");
      el.setAttribute("aria-hidden", "false");
    }
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

  /** Detect adblock via script load failure (adsbygoogle.js). */
  function detectAdblockAsync() {
    return new Promise(function (resolve) {
      var done = false;
      function finish(blocked) {
        if (done) return;
        done = true;
        resolve(blocked);
      }
      var script = document.createElement("script");
      script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?t=" + Date.now();
      script.onload = function () { finish(false); };
      script.onerror = function () { finish(true); };
      document.head.appendChild(script);
      setTimeout(function () { finish(false); }, 6000);
    });
  }

  function isMobileOrTablet() {
    if (typeof navigator === "undefined") return false;
    var ua = navigator.userAgent || "";
    if (/Mobile|Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Tablet|Samsung|Silk|Kindle/i.test(ua)) return true;
    if (typeof window !== "undefined" && window.innerWidth <= 900) return true;
    return false;
  }

  /**
   * Run adblock check. Call ONLY when user clicks Continue.
   * cb(blocked) – blocked=true if ads are blocked, false otherwise.
   */
  window.runAdblockCheck = function (cb) {
    if (typeof cb !== "function") return;
    modalShownThisClick = false;
    if (isDismissed()) {
      cb(false);
      return;
    }
    if (isMobileOrTablet()) {
      cb(false);
      return;
    }
    setTimeout(function () {
      detectAdblockAsync().then(function (blocked) {
        if (blocked) showModal();
        cb(blocked);
      });
    }, DETECTION_DELAY_MS);
  };
})();
