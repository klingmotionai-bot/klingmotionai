/**
 * AdBlock + DNS AdGuard detection for KlingMotionAI
 * Detects: browser extensions, AdGuard DNS, uBlock, etc.
 */
(function () {
  "use strict";

  var detected = false;
  var bait = null;

  function isBaitHidden() {
    if (!bait || !bait.parentNode) return false;
    try {
      var style = window.getComputedStyle(bait);
      return !bait.offsetParent || bait.offsetHeight === 0 || bait.offsetWidth === 0 ||
             style.display === "none" || style.visibility === "hidden" || style.opacity === "0";
    } catch (e) { return false; }
  }

  // 2) Fetch + response validation – AdGuard DNS may block (reject) or return short block page
  function checkFetch(cb) {
    var url = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?t=" + Date.now();
    fetch(url, { method: "GET", cache: "no-store", credentials: "omit" })
      .then(function (res) {
        return res.text().then(function (text) {
          // Real adsbygoogle.js is 100KB+; block pages are tiny
          var blocked = text.length < 500 || (text.indexOf("google") === -1 && text.indexOf("adsbygoogle") === -1);
          cb(blocked);
        });
      })
      .catch(function () {
        cb(true);
      });
  }

  // 3) Image test – DNS blockers often block ad/tracking pixels
  function checkImage(cb) {
    var img = new Image();
    var done = false;
    function finish(blocked) {
      if (done) return;
      done = true;
      img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
      cb(blocked);
    }
    img.onerror = function () { finish(true); };
    img.onload = function () { finish(false); };
    img.src = "https://pagead2.googlesyndication.com/pagead/images/ad_choices_icon.png?t=" + Date.now();
    setTimeout(function () { finish(true); }, 5000);
  }

  function showModal() {
    if (detected) return;
    detected = true;

    var overlay = document.getElementById("adblock-modal-overlay");
    if (overlay) {
      overlay.classList.add("adblock-modal--open");
      overlay.setAttribute("aria-hidden", "false");
    }
  }

  function onReload() {
    window.location.reload();
  }

  function runDetection() {
    if (isBaitHidden()) {
      showModal();
      return;
    }

    var results = { fetch: null, image: null };
    function maybeShow() {
      if (results.fetch === true || results.image === true) showModal();
    }
    checkFetch(function (blocked) {
      results.fetch = blocked;
      maybeShow();
    });
    checkImage(function (blocked) {
      results.image = blocked;
      maybeShow();
    });
  }

  function init() {
    try {
      bait = document.createElement("div");
      bait.className = "adsbox";
      bait.setAttribute("aria-hidden", "true");
      bait.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;";
      document.body.appendChild(bait);

      var overlay = document.createElement("div");
      overlay.id = "adblock-modal-overlay";
      overlay.className = "adblock-modal-overlay";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-labelledby", "adblock-modal-title");
      overlay.setAttribute("aria-hidden", "true");

      overlay.innerHTML =
        '<div class="adblock-modal-backdrop" id="adblock-modal-backdrop"></div>' +
        '<div class="adblock-modal-card">' +
          '<h2 id="adblock-modal-title" class="adblock-modal-title">Ads are required to use KlingMotionAI</h2>' +
          '<div class="adblock-modal-actions">' +
            '<button type="button" class="btn btn-primary adblock-modal-btn" id="adblock-modal-reload">I disabled it – Reload</button>' +
          '</div>' +
        '</div>';

      document.body.appendChild(overlay);

      var reloadBtn = document.getElementById("adblock-modal-reload");
      var backdrop = document.getElementById("adblock-modal-backdrop");
      if (reloadBtn) reloadBtn.addEventListener("click", onReload);
      if (backdrop) backdrop.addEventListener("click", onReload);

      runDetection();
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
