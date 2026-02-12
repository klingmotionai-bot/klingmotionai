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

  function onReload() {
    window.location.reload();
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
  window.runAdblockCheck = function (cb) {
    if (typeof cb !== "function") return;
    if (isDismissed()) {
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
          '<h2 id="adblock-modal-title" class="adblock-modal-title">Please turn off the adblocker to generate your AI video for free</h2>' +
          '<div class="adblock-modal-actions">' +
            '<button type="button" class="btn btn-primary adblock-modal-btn" id="adblock-modal-reload">I disabled it – Reload</button>' +
          '</div>' +
        '</div>';

      document.body.appendChild(overlay);

      var reloadBtn = document.getElementById("adblock-modal-reload");
      var backdrop = document.getElementById("adblock-modal-backdrop");

      if (reloadBtn) reloadBtn.addEventListener("click", onReload);
      if (backdrop) {
        backdrop.addEventListener("click", function () {
          hideModal();
          setDismissed();
        });
      }
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
