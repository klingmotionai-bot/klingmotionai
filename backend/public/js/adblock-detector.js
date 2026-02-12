/**
 * AdBlock + DNS AdGuard detection for KlingMotionAI
 * Detects ad blockers via bait element and adsbygoogle fetch.
 */
(function () {
  "use strict";

  var detected = false;

  // 1) Bait element – many ad blockers hide .adsbox
  var bait = document.createElement("div");
  bait.className = "adsbox";
  bait.setAttribute("aria-hidden", "true");
  bait.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;";
  document.body.appendChild(bait);

  function isBaitHidden() {
    var style = window.getComputedStyle(bait);
    return bait.offsetHeight === 0 || bait.offsetWidth === 0 ||
           style.display === "none" || style.visibility === "hidden" || style.opacity === "0";
  }

  // 2) Fetch adsbygoogle.js – blocked by most ad blockers
  function checkFetch(cb) {
    fetch("https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js", {
      method: "GET",
      cache: "no-store"
    }).then(function () {
      cb(false);
    }).catch(function () {
      cb(true);
    });
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

  function hideModal() {
    var overlay = document.getElementById("adblock-modal-overlay");
    if (overlay) {
      overlay.classList.remove("adblock-modal--open");
      overlay.setAttribute("aria-hidden", "true");
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

    checkFetch(function (blocked) {
      if (blocked) {
        showModal();
      }
    });
  }

  // Build modal and wire events after DOM ready
  function init() {
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
