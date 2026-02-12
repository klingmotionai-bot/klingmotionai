/**
 * Backend origin: same as page origin so session cookies are sent.
 * localhost/127.0.0.1 → use port 3080 (dev). Production (e.g. https://klingmotionai.com) → current origin.
 */
function getBackendOrigin() {
  if (typeof window === "undefined" || !window.location) return "http://localhost:3080";
  var host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return window.location.protocol + "//" + host + ":3080";
  }
  return window.location.origin;
}
var API_BASE_URL = getBackendOrigin();
var UPLOAD_ENDPOINT = getBackendOrigin() + "/upload";

/** All API requests must include credentials so the session cookie is sent. */
function apiFetch(url, options) {
  var opts = options || {};
  opts.credentials = opts.credentials || "include";
  return fetch(url, opts);
}

var UPLOAD_STATES = { IDLE: "idle", UPLOADING: "uploading", SUCCESS: "success", ERROR: "error" };

var uploadState = { character: UPLOAD_STATES.IDLE, video: UPLOAD_STATES.IDLE };
var uploadXhr = { character: null, video: null };
var createButtonLocked = false;

function getPageFromQuery() {
  var params = new URLSearchParams(window.location.search);
  var page = params.get("page");
  if (page === "signup" || page === "signin") return page;
  return "home";
}

function renderPage(page) {
  document.querySelectorAll(".page").forEach(function (el) {
    el.classList.remove("active");
  });
  var el = document.getElementById("page-" + page);
  if (el) el.classList.add("active");
  updateAuthUI();
}

function initRouter() {
  renderPage(getPageFromQuery());
  document.addEventListener("click", function (e) {
    var a = e.target.closest("a.router-link");
    if (!a || !a.href) return;
    var url = new URL(a.href);
    if (url.origin !== window.location.origin || url.pathname !== window.location.pathname) return;
    var page = url.searchParams.get("page");
    if (page !== "home" && page !== "signup" && page !== "signin") return;
    e.preventDefault();
    var query = "?page=" + page;
    if (window.location.search !== query) {
      history.pushState({ page: page }, "", query);
      renderPage(page);
    }
  });
  window.addEventListener("popstate", function (e) {
    var page = e.state && e.state.page ? e.state.page : getPageFromQuery();
    renderPage(page);
  });
}

/** Show active page immediately so content is visible (pages are hidden until .active). */
initRouter();
if (window.location.search.indexOf("page=") === -1) {
  history.replaceState({ page: "home" }, "", "?page=home");
} else {
  history.replaceState({ page: getPageFromQuery() }, "", window.location.search);
}

function setAvatar(imgEl, wrapEl, fallbackEl, avatarUrl, displayName) {
  var initial = (displayName || "?").charAt(0).toUpperCase();
  if (fallbackEl) fallbackEl.textContent = initial;
  if (!wrapEl) return;
  wrapEl.classList.remove("avatar--fallback");
  if (!imgEl) return;
  var url = typeof avatarUrl === "string" ? avatarUrl.trim() : "";
  imgEl.onerror = function () {
    wrapEl.classList.add("avatar--fallback");
  };
  if (url) {
    imgEl.src = url;
    imgEl.alt = displayName || "";
    imgEl.referrerPolicy = "no-referrer";
  } else {
    imgEl.src = "";
    imgEl.alt = "";
    wrapEl.classList.add("avatar--fallback");
  }
}

/** Auth state from backend only (no localStorage). Set by fetchAuthMe() on load and after login. */
var authState = { user: null };

function updateAuthUI() {
  var signUpBtn = document.getElementById("signUpBtn");
  var signInBtn = document.getElementById("signInBtn");
  var userMenu = document.getElementById("userMenu");
  var userMenuDropdown = document.getElementById("userMenuDropdown");
  var user = authState && authState.user;
  var hasUser = !!(user && (user.id || user.email));
  if (hasUser && user) {
    if (signUpBtn) {
      signUpBtn.setAttribute("hidden", "");
      signUpBtn.style.display = "none";
    }
    if (signInBtn) {
      signInBtn.setAttribute("hidden", "");
      signInBtn.style.display = "none";
    }
    if (userMenu) {
      userMenu.removeAttribute("hidden");
      userMenu.style.display = "";
      var hun = document.getElementById("header-user-name");
      if (hun) hun.textContent = user.name || user.email || "";
      setAvatar(
        document.getElementById("header-user-avatar"),
        document.getElementById("header-user-avatar-wrap"),
        document.getElementById("header-user-avatar-fallback"),
        user.avatar,
        user.name || user.email
      );
    }
    if (userMenuDropdown) {
      userMenuDropdown.removeAttribute("hidden");
      userMenuDropdown.style.display = "";
      var nameEl = document.getElementById("header-dropdown-name");
      if (nameEl) nameEl.textContent = user.name || user.email || "";
      setAvatar(
        document.getElementById("header-dropdown-avatar"),
        document.getElementById("header-dropdown-avatar-wrap"),
        document.getElementById("header-dropdown-avatar-fallback"),
        user.avatar,
        user.name || user.email
      );
    }
  } else {
    if (signUpBtn) {
      signUpBtn.removeAttribute("hidden");
      signUpBtn.style.display = "";
    }
    if (signInBtn) {
      signInBtn.removeAttribute("hidden");
      signInBtn.style.display = "";
    }
    if (userMenu) {
      userMenu.setAttribute("hidden", "");
      userMenu.style.display = "none";
    }
    if (userMenuDropdown) {
      userMenuDropdown.setAttribute("hidden", "");
      userMenuDropdown.style.display = "none";
    }
  }
}

/** Load auth from backend and update UI (no localStorage). Called after fetchAuthMe is defined. */
function loadAuthAndUpdateUI() {
  fetchAuthMe().then(function (auth) {
    authState.user = auth && auth.user ? auth.user : null;
    if (auth && auth.user && auth.user.offerCompleted !== undefined) {
      offerCompletedFromBackend = !!auth.user.offerCompleted;
    }
    updateAuthUI();
    updateCreateButtonUI();
  });
}

var headerLogoutBtn = document.getElementById("header-logout-btn");
if (headerLogoutBtn) {
  headerLogoutBtn.addEventListener("click", function () {
    window.location.href = getBackendOrigin() + "/auth/logout";
  });
}

document.querySelectorAll(".auth-form").forEach(function (form) {
  form.addEventListener("submit", function (e) {
    e.preventDefault();
  });
});

document.addEventListener("click", function (e) {
  var btn = e.target.closest(".auth-password-toggle");
  if (!btn) return;
  var wrap = btn.closest(".auth-password-wrap");
  if (!wrap) return;
  var input = wrap.querySelector(".auth-input-password");
  var showIcon = wrap.querySelector(".auth-password-show");
  var hideIcon = wrap.querySelector(".auth-password-hide");
  if (!input || !showIcon || !hideIcon) return;
  if (input.type === "password") {
    input.type = "text";
    showIcon.hidden = true;
    hideIcon.hidden = false;
  } else {
    input.type = "password";
    showIcon.hidden = false;
    hideIcon.hidden = true;
  }
});

var GOOGLE_AUTH_URL = getBackendOrigin() + "/auth/google";
document.addEventListener("click", function (e) {
  var btn = e.target.closest(".auth-google-btn");
  if (!btn || btn.classList.contains("auth-google-btn-loading")) return;
  e.preventDefault();
  btn.classList.add("auth-google-btn-loading");
  btn.disabled = true;
  btn.setAttribute("aria-busy", "true");
  window.location.href = GOOGLE_AUTH_URL;
});

syncCreateButton();
setUploadState("character", UPLOAD_STATES.IDLE);
setUploadState("video", UPLOAD_STATES.IDLE);

function setUploadState(slot, state, progressPercent) {
  if (state !== UPLOAD_STATES.IDLE && state !== UPLOAD_STATES.UPLOADING && state !== UPLOAD_STATES.SUCCESS && state !== UPLOAD_STATES.ERROR) return;
  uploadState[slot] = state;
  var isCharacter = slot === "character";
  var wrap = document.getElementById(isCharacter ? "character-progress-wrap" : "video-progress-wrap");
  var fill = document.getElementById(isCharacter ? "character-progress-fill" : "video-progress-fill");
  var pct = document.getElementById(isCharacter ? "character-progress-pct" : "video-progress-pct");
  var errorMsg = document.getElementById(isCharacter ? "character-error-msg" : "video-error-msg");
  var successCheck = document.getElementById(isCharacter ? "character-success-check" : "video-success-check");
  var container = document.getElementById(isCharacter ? "select-character" : "preview-area");
  if (!container) return;
  container.setAttribute("data-upload-state", state);
  container.classList.remove("uploading", "success", "error");
  if (wrap) {
    wrap.hidden = state !== UPLOAD_STATES.UPLOADING;
    wrap.setAttribute("aria-hidden", state !== UPLOAD_STATES.UPLOADING ? "true" : "false");
  }
  if (fill) fill.style.width = state === UPLOAD_STATES.UPLOADING && progressPercent != null ? progressPercent + "%" : "0%";
  if (pct) pct.textContent = state === UPLOAD_STATES.UPLOADING && progressPercent != null ? Math.round(progressPercent) + "%" : "0%";
  if (errorMsg) errorMsg.hidden = state !== UPLOAD_STATES.ERROR;
  if (successCheck) {
    successCheck.hidden = state !== UPLOAD_STATES.SUCCESS;
    successCheck.setAttribute("aria-hidden", state !== UPLOAD_STATES.SUCCESS ? "true" : "false");
  }
  if (state === UPLOAD_STATES.UPLOADING) container.classList.add("uploading");
  else if (state === UPLOAD_STATES.SUCCESS) container.classList.add("success");
  else if (state === UPLOAD_STATES.ERROR) container.classList.add("error");
  syncCreateButton();
}

function syncCreateButton() {
  var btn = document.getElementById("btn-create");
  if (!btn) return;
  var enabled = uploadState.character === UPLOAD_STATES.SUCCESS && uploadState.video === UPLOAD_STATES.SUCCESS;
  btn.disabled = !enabled;
  btn.classList.toggle("btn-create-ready", enabled);
}

function uploadWithProgress(fileOrBlob, slot, callbacks) {
  if (uploadXhr[slot]) {
    uploadXhr[slot].abort();
    uploadXhr[slot] = null;
  }
  var formData = new FormData();
  formData.append("file", fileOrBlob, fileOrBlob.name || "file");
  console.log("[upload] start slot:", slot, "endpoint:", UPLOAD_ENDPOINT);
  var xhr = new XMLHttpRequest();
  xhr.upload.addEventListener("progress", function (e) {
    if (!e.lengthComputable || uploadXhr[slot] !== xhr || uploadState[slot] !== UPLOAD_STATES.UPLOADING) return;
    var pct = (e.loaded / e.total) * 100;
    console.log("[upload] progress:", Math.round(pct) + "%");
    if (callbacks.onProgress) callbacks.onProgress(pct);
  });
  xhr.addEventListener("load", function () {
    if (uploadXhr[slot] !== xhr) return;
    console.log("[upload] response status:", xhr.status);
    console.log("[upload] response body:", xhr.responseText);
    uploadXhr[slot] = null;
    if (xhr.status !== 200) {
      if (callbacks.onError) callbacks.onError();
      return;
    }
    var data = null;
    try {
      if (xhr.responseText) data = JSON.parse(xhr.responseText);
    } catch (err) {
      console.log("[upload] parse error:", err);
    }
    if (data && data.success === true) {
      if (callbacks.onComplete) callbacks.onComplete();
      return;
    }
    if (callbacks.onError) callbacks.onError();
  });
  xhr.addEventListener("error", function () {
    if (uploadXhr[slot] !== xhr) return;
    uploadXhr[slot] = null;
    console.log("[upload] network error");
    if (callbacks.onError) callbacks.onError();
  });
  xhr.addEventListener("abort", function () {
    if (uploadXhr[slot] !== xhr) return;
    uploadXhr[slot] = null;
    console.log("[upload] aborted");
    if (callbacks.onError) callbacks.onError();
  });
  xhr.open("POST", UPLOAD_ENDPOINT);
  xhr.withCredentials = true;
  setUploadState(slot, UPLOAD_STATES.UPLOADING, 0);
  uploadXhr[slot] = xhr;
  xhr.send(formData);
  return xhr;
}

var headerMenuBtn = document.getElementById("header-menu-btn");
var headerDropdown = document.getElementById("header-dropdown");
if (headerMenuBtn && headerDropdown) {
  headerMenuBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    var isOpen = headerDropdown.classList.toggle("open");
    headerMenuBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    headerDropdown.setAttribute("aria-hidden", isOpen ? "false" : "true");
  });
  document.addEventListener("click", function (e) {
    if (!headerDropdown.classList.contains("open")) return;
    if (headerDropdown.contains(e.target) || headerMenuBtn.contains(e.target)) return;
    headerDropdown.classList.remove("open");
    headerMenuBtn.setAttribute("aria-expanded", "false");
    headerDropdown.setAttribute("aria-hidden", "true");
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (!headerDropdown.classList.contains("open")) return;
    headerDropdown.classList.remove("open");
    headerMenuBtn.setAttribute("aria-expanded", "false");
    headerDropdown.setAttribute("aria-hidden", "true");
  });
}

document.querySelectorAll(".option-toggles").forEach(function (group) {
  group.querySelectorAll(".option-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      group.querySelectorAll(".option-btn").forEach(function (b) {
        b.classList.remove("active");
      });
      btn.classList.add("active");
    });
  });
});

var modelTrigger = document.getElementById("model-trigger");
var modelDropdown = document.getElementById("model-dropdown");
if (modelTrigger && modelDropdown) {
  modelTrigger.addEventListener("click", function (e) {
    e.stopPropagation();
    var isOpen = modelDropdown.classList.toggle("open");
    modelTrigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });
  modelDropdown.querySelectorAll(".dropdown-item").forEach(function (item) {
    item.addEventListener("click", function (e) {
      e.stopPropagation();
      var title = item.getAttribute("data-title");
      modelDropdown.querySelectorAll(".dropdown-item").forEach(function (opt) {
        opt.classList.remove("selected");
        opt.setAttribute("aria-selected", "false");
        var oldCheck = opt.querySelector(".dropdown-item-check");
        if (oldCheck) opt.removeChild(oldCheck);
      });
      var check = document.createElement("span");
      check.className = "dropdown-item-check";
      check.setAttribute("aria-hidden", "true");
      item.appendChild(check);
      item.classList.add("selected");
      item.setAttribute("aria-selected", "true");
      document.querySelector(".model-trigger-name").textContent = title;
      modelDropdown.classList.remove("open");
      modelTrigger.setAttribute("aria-expanded", "false");
    });
  });
  document.addEventListener("click", function () {
    if (modelDropdown.classList.contains("open")) {
      modelDropdown.classList.remove("open");
      modelTrigger.setAttribute("aria-expanded", "false");
    }
  });
}

var qualityTrigger = document.getElementById("quality-trigger");
var qualityDropdown = document.getElementById("quality-dropdown");
var qualityTriggerValue = document.getElementById("quality-trigger-value");
if (qualityTrigger && qualityDropdown && qualityTriggerValue) {
  qualityTrigger.addEventListener("click", function (e) {
    e.stopPropagation();
    var isOpen = qualityDropdown.classList.toggle("open");
    qualityTrigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });
  qualityDropdown.querySelectorAll(".quality-item").forEach(function (item) {
    item.addEventListener("click", function (e) {
      e.stopPropagation();
      var title = item.getAttribute("data-title");
      qualityDropdown.querySelectorAll(".quality-item").forEach(function (opt) {
        opt.classList.remove("selected");
        opt.setAttribute("aria-selected", "false");
        var oldCheck = opt.querySelector(".quality-item-check");
        if (oldCheck) opt.removeChild(oldCheck);
      });
      var check = document.createElement("span");
      check.className = "quality-item-check";
      check.setAttribute("aria-hidden", "true");
      item.appendChild(check);
      item.classList.add("selected");
      item.setAttribute("aria-selected", "true");
      qualityTriggerValue.textContent = title;
      qualityDropdown.classList.remove("open");
      qualityTrigger.setAttribute("aria-expanded", "false");
    });
  });
  document.addEventListener("click", function () {
    if (qualityDropdown.classList.contains("open")) {
      qualityDropdown.classList.remove("open");
      qualityTrigger.setAttribute("aria-expanded", "false");
    }
  });
}

var inputImage = document.getElementById("input-image");
var inputVideo = document.getElementById("input-video");
var selectCharacter = document.getElementById("select-character");
var characterPreview = document.getElementById("character-preview");
var characterLabel = document.getElementById("character-label");
var btnSelectVideo = document.getElementById("btn-select-video");
var btnRecordVideo = document.getElementById("btn-record-video");
var previewArea = document.getElementById("preview-area");
var previewVideo = document.getElementById("preview-video");
var recordingLabel = document.getElementById("recording-label");

var EXAMPLE_CHARACTER_URL = "/example_character.jpg";
var EXAMPLE_MOTION_URL = "/example_motion.mp4";

var characterObjectURL = null;
var videoObjectURL = null;
var mediaStream = null;
var mediaRecorder = null;
var recordedChunks = [];

function revokeCharacterURL() {
  if (characterObjectURL) {
    URL.revokeObjectURL(characterObjectURL);
    characterObjectURL = null;
  }
}

function revokeVideoURL() {
  if (videoObjectURL) {
    URL.revokeObjectURL(videoObjectURL);
    videoObjectURL = null;
  }
}

var btnTryExample = document.getElementById("btn-try-example");
if (btnTryExample && characterPreview && characterLabel && previewVideo) {
  characterPreview.onerror = function () { console.warn("Example image failed to load"); };
  previewVideo.onerror = function () { console.warn("Example video failed to load"); };
  btnTryExample.addEventListener("click", function () {
    stopCameraStream();
    revokeCharacterURL();
    revokeVideoURL();
    characterPreview.src = EXAMPLE_CHARACTER_URL;
    characterPreview.alt = "Selected motion visual";
    characterLabel.textContent = "Change Motion Visual";
    previewVideo.srcObject = null;
    previewVideo.src = EXAMPLE_MOTION_URL;
    previewVideo.muted = true;
    previewVideo.loop = true;
    previewVideo.playsInline = true;
    previewVideo.play().catch(function () {});
    setUploadState("character", UPLOAD_STATES.SUCCESS);
    setUploadState("video", UPLOAD_STATES.SUCCESS);
  });
}

if (selectCharacter && inputImage && characterPreview) {
  function openImagePicker() {
    inputImage.value = "";
    inputImage.click();
  }
  selectCharacter.addEventListener("click", function (e) {
    e.preventDefault();
    openImagePicker();
  });
  selectCharacter.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openImagePicker();
    }
  });
  inputImage.addEventListener("change", function () {
    var file = inputImage.files && inputImage.files[0];
    if (!file || !file.type.startsWith("image/")) return;
    setUploadState("character", UPLOAD_STATES.IDLE);
    revokeCharacterURL();
    characterObjectURL = URL.createObjectURL(file);
    characterPreview.src = characterObjectURL;
    characterPreview.alt = "Selected motion visual";
    if (characterLabel) characterLabel.textContent = "Change Motion Visual";
    uploadWithProgress(file, "character", {
      onProgress: function (p) {
        setUploadState("character", UPLOAD_STATES.UPLOADING, p);
      },
      onComplete: function () {
        setUploadState("character", UPLOAD_STATES.SUCCESS);
      },
      onError: function () {
        setUploadState("character", UPLOAD_STATES.ERROR);
      }
    });
  });
}

if (btnSelectVideo && inputVideo && previewVideo) {
  btnSelectVideo.addEventListener("click", function () {
    inputVideo.value = "";
    inputVideo.click();
  });
  inputVideo.addEventListener("change", function () {
    var file = inputVideo.files && inputVideo.files[0];
    if (!file || !file.type.startsWith("video/")) return;
    setUploadState("video", UPLOAD_STATES.IDLE);
    stopCameraStream();
    revokeVideoURL();
    videoObjectURL = URL.createObjectURL(file);
    previewVideo.src = videoObjectURL;
    previewVideo.srcObject = null;
    previewVideo.muted = true;
    previewVideo.loop = true;
    previewVideo.playsInline = true;
    previewVideo.play().catch(function () {});
    uploadWithProgress(file, "video", {
      onProgress: function (p) {
        setUploadState("video", UPLOAD_STATES.UPLOADING, p);
      },
      onComplete: function () {
        setUploadState("video", UPLOAD_STATES.SUCCESS);
      },
      onError: function () {
        setUploadState("video", UPLOAD_STATES.ERROR);
      }
    });
  });
}

function stopCameraStream() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(function (track) {
      track.stop();
    });
    mediaStream = null;
  }
}

function setRecordingState(recording) {
  if (previewArea) previewArea.classList.toggle("recording", recording);
  if (recordingLabel) {
    recordingLabel.hidden = !recording;
      recordingLabel.textContent = "Recording...";
  }
  if (btnRecordVideo) {
    btnRecordVideo.classList.toggle("btn-record-recording", recording);
    btnRecordVideo.setAttribute("aria-pressed", recording ? "true" : "false");
  }
}

if (btnRecordVideo && previewVideo && previewArea) {
  btnRecordVideo.addEventListener("click", function () {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
      return;
    }
    if (mediaStream) return;
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then(function (stream) {
        mediaStream = stream;
        previewVideo.srcObject = stream;
        previewVideo.src = "";
        previewVideo.muted = true;
        previewVideo.loop = false;
        previewVideo.playsInline = true;
        previewVideo.play().catch(function () {});
        recordedChunks = [];
        var options = { mimeType: "video/webm;codecs=vp9" };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options = { mimeType: "video/webm" };
        }
        if (!MediaRecorder.isTypeSupported(options.mimeType)) options = {};
        mediaRecorder = new MediaRecorder(stream, options);
        mediaRecorder.ondataavailable = function (e) {
          if (e.data.size > 0) recordedChunks.push(e.data);
        };
        mediaRecorder.onstop = function () {
          mediaRecorder = null;
          stopCameraStream();
          setRecordingState(false);
          previewVideo.srcObject = null;
          if (recordedChunks.length === 0) return;
          var blob = new Blob(recordedChunks, { type: "video/webm" });
          revokeVideoURL();
          videoObjectURL = URL.createObjectURL(blob);
          previewVideo.src = videoObjectURL;
          previewVideo.muted = true;
          previewVideo.loop = false;
          previewVideo.play().catch(function () {});
          recordedChunks = [];
          setUploadState("video", UPLOAD_STATES.IDLE);
          uploadWithProgress(blob, "video", {
            onProgress: function (p) {
              setUploadState("video", UPLOAD_STATES.UPLOADING, p);
            },
            onComplete: function () {
              setUploadState("video", UPLOAD_STATES.SUCCESS);
            },
            onError: function () {
              setUploadState("video", UPLOAD_STATES.ERROR);
            }
          });
        };
        mediaRecorder.start();
        setRecordingState(true);
      })
      .catch(function () {
        if (recordingLabel) {
          recordingLabel.hidden = false;
          recordingLabel.textContent = "Camera access denied or unavailable.";
        }
      });
  });
}

if (previewVideo) {
  previewVideo.setAttribute("playsinline", "");
  previewVideo.muted = true;
  previewVideo.loop = true;
  previewVideo.play().catch(function () {});
}

function showAuthModal() {
  var modal = document.getElementById("auth-modal");
  var signupPanel = document.getElementById("auth-modal-signup-panel");
  var signinPanel = document.getElementById("auth-modal-signin-panel");
  if (modal) modal.setAttribute("aria-hidden", "false");
  if (signupPanel) { signupPanel.hidden = false; }
  if (signinPanel) { signinPanel.hidden = true; }
}

function hideAuthModal() {
  var modal = document.getElementById("auth-modal");
  if (modal) modal.setAttribute("aria-hidden", "true");
}

function initAuthModal() {
  var modal = document.getElementById("auth-modal");
  if (!modal) return;
  var overlay = document.getElementById("auth-modal-overlay");
  var closeBtn = document.getElementById("auth-modal-close");
  var switchToSignin = document.getElementById("auth-modal-switch-to-signin");
  var switchToSignup = document.getElementById("auth-modal-switch-to-signup");
  var signupPanel = document.getElementById("auth-modal-signup-panel");
  var signinPanel = document.getElementById("auth-modal-signin-panel");
  if (overlay) overlay.addEventListener("click", hideAuthModal);
  if (closeBtn) closeBtn.addEventListener("click", hideAuthModal);
  modal.querySelectorAll(".auth-modal-logo").forEach(function (btn) {
    btn.addEventListener("click", hideAuthModal);
  });
  if (switchToSignin) switchToSignin.addEventListener("click", function (e) {
    e.preventDefault();
    if (signupPanel) signupPanel.hidden = true;
    if (signinPanel) signinPanel.hidden = false;
  });
  if (switchToSignup) switchToSignup.addEventListener("click", function (e) {
    e.preventDefault();
    if (signinPanel) signinPanel.hidden = true;
    if (signupPanel) signupPanel.hidden = false;
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modal && modal.getAttribute("aria-hidden") === "false") {
      hideAuthModal();
    }
  });
}

initAuthModal();

/* ---------- Content Locker Modal (CPA flow: token + offer-complete redirect) ---------- */
/** Backend says user has completed offer (session.offerCompleted). Set when we fetch /auth/me. */
var offerCompletedFromBackend = false;

/** Fetch /auth/me with credentials; returns { user } or null. */
function fetchAuthMe() {
  return apiFetch(API_BASE_URL + "/auth/me")
    .then(function (r) { return r.json(); })
    .then(function (data) { return data && data.user ? data : null; });
}

/** Update Create button: show "✔ Complete" when backend says offer completed. */
function updateCreateButtonUI() {
  var btnText = document.getElementById("btn-create-text");
  var statusEl = document.getElementById("create-status-text");
  if (!btnText) return;
  if (offerCompletedFromBackend) {
    btnText.textContent = "✔ Complete";
    if (statusEl) statusEl.hidden = true;
  } else {
    btnText.textContent = "Create";
    if (statusEl) statusEl.hidden = true;
  }
}

function showCreateStatusCreating(show) {
  var statusEl = document.getElementById("create-status-text");
  if (statusEl) statusEl.hidden = !show;
}

var contentLockerOverlay = document.getElementById("content-locker-overlay");
var contentLockerStep1 = document.getElementById("content-locker-step1");
/** True after user clicked Continue and we called _Kx(); used to detect completion on focus. */
var contentLockerTriggered = false;

function openContentLockerModal() {
  if (!contentLockerOverlay) return;
  contentLockerTriggered = false;
  contentLockerOverlay.classList.add("content-locker-open");
  contentLockerOverlay.setAttribute("aria-hidden", "false");
  if (contentLockerStep1) contentLockerStep1.removeAttribute("hidden");
}

function closeContentLockerModal() {
  if (!contentLockerOverlay) return;
  contentLockerOverlay.classList.remove("content-locker-open");
  contentLockerOverlay.setAttribute("aria-hidden", "true");
  updateCreateButtonUI();
}

/** Trigger AdBlueMedia locker. Called every time user clicks Continue; no persistence. */
function triggerContentLocker() {
  if (typeof _Kx === "function") _Kx();
}

/** On window focus after locker was triggered (e.g. same-tab locker closed). Just close modal; completion is via redirect. */
function onContentLockerReturnFocus() {
  if (!contentLockerTriggered) return;
  contentLockerTriggered = false;
  closeContentLockerModal();
}

function initContentLockerModal() {
  var backdrop = document.getElementById("content-locker-backdrop");
  var btnContinue = document.getElementById("content-locker-continue");
  var btnCancel = document.getElementById("content-locker-cancel");

  if (backdrop) backdrop.addEventListener("click", closeContentLockerModal);
  if (btnCancel) btnCancel.addEventListener("click", closeContentLockerModal);
  if (btnContinue) {
    btnContinue.addEventListener("click", function () {
      contentLockerTriggered = true;
      triggerContentLocker();
    });
  }
  /** Inject CPA token into AdBlueMedia redirect URL so locker sends user to /offer-complete?token=TOKEN */
  window.setOfferCompleteRedirectUrl = function (token) {
    if (typeof token !== "string" || !token) return;
    window.IQhCu_gny_vXQLGc = window.IQhCu_gny_vXQLGc || {};
    window.IQhCu_gny_vXQLGc.redirectUrl = API_BASE_URL + "/offer-complete?token=" + encodeURIComponent(token);
  };
  window.addEventListener("focus", onContentLockerReturnFocus);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && contentLockerOverlay && contentLockerOverlay.classList.contains("content-locker-open")) {
      contentLockerTriggered = false;
      closeContentLockerModal();
    }
  });
}
initContentLockerModal();

/* ---------- Create button ---------- */
var btnCreate = document.getElementById("btn-create");
var btnCreateBurst = document.getElementById("btn-create-burst");
var btnCreateLoader = document.getElementById("btn-create-loader");
var btnCreateInner = btnCreate && btnCreate.querySelector(".btn-create-inner");
var btnCreateIcon = document.getElementById("btn-create-icon");

var CREATE_LOADER_DURATION_MS = 3000;
var createLoaderOverlayEl = document.getElementById("create-loader-overlay");

/** Show fullscreen loader for 3s, then hide smoothly and call callback (e.g. startCreateProcess). */
function showCreateLoaderOverlay(thenRun) {
  if (!createLoaderOverlayEl) {
    if (typeof thenRun === "function") thenRun();
    return;
  }
  createButtonLocked = true;
  if (btnCreate) btnCreate.disabled = true;
  document.body.classList.add("create-loader-active");
  createLoaderOverlayEl.classList.add("create-loader-overlay--visible");
  createLoaderOverlayEl.setAttribute("aria-hidden", "false");
  createLoaderOverlayEl.setAttribute("aria-busy", "true");

  setTimeout(function () {
    createLoaderOverlayEl.classList.add("create-loader-overlay--hiding");
    setTimeout(function () {
      createLoaderOverlayEl.classList.remove("create-loader-overlay--visible", "create-loader-overlay--hiding");
      createLoaderOverlayEl.setAttribute("aria-hidden", "true");
      createLoaderOverlayEl.setAttribute("aria-busy", "false");
      document.body.classList.remove("create-loader-active");
      createButtonLocked = false;
      if (btnCreate) btnCreate.disabled = !(uploadState.character === UPLOAD_STATES.SUCCESS && uploadState.video === UPLOAD_STATES.SUCCESS);
      if (typeof thenRun === "function") thenRun();
    }, 300);
  }, CREATE_LOADER_DURATION_MS);
}

/** Run the create animation/loading flow. Guarded so it only runs when button is enabled and not locked. */
function startCreateProcess() {
  if (!btnCreate || !btnCreateBurst || !btnCreateLoader) return;
  if (btnCreate.disabled || createButtonLocked) return;
  if (uploadState.character !== UPLOAD_STATES.SUCCESS || uploadState.video !== UPLOAD_STATES.SUCCESS) return;
  createButtonLocked = true;
  document.body.classList.add("create-busy");
  btnCreate.setAttribute("aria-busy", "true");
  btnCreate.classList.add("btn-create-press");
  if (btnCreateInner) btnCreateInner.classList.add("btn-create-inner-active");
  if (btnCreateIcon) btnCreateIcon.classList.add("btn-create-icon-active");
  setTimeout(function () {
    if (btnCreateBurst) btnCreateBurst.classList.add("btn-create-burst-visible");
  }, 80);
  setTimeout(function () {
    if (btnCreateBurst) btnCreateBurst.classList.remove("btn-create-burst-visible");
    if (btnCreateInner) btnCreateInner.classList.remove("btn-create-inner-active");
    if (btnCreateIcon) btnCreateIcon.classList.remove("btn-create-icon-active");
    btnCreate.classList.remove("btn-create-press");
    btnCreate.classList.add("btn-create-loading");
    if (btnCreateLoader) btnCreateLoader.hidden = false;
    if (btnCreateInner) btnCreateInner.style.visibility = "hidden";
    showCreateStatusCreating(true);
    setTimeout(function () {
      btnCreate.classList.remove("btn-create-loading");
      if (btnCreateLoader) btnCreateLoader.hidden = true;
      if (btnCreateInner) btnCreateInner.style.visibility = "";
      showCreateStatusCreating(false);
      btnCreate.setAttribute("aria-busy", "false");
      createButtonLocked = false;
      document.body.classList.remove("create-busy");
      updateCreateButtonUI();
    }, 1800);
  }, 400);
}

updateCreateButtonUI();

if (btnCreate && btnCreateBurst && btnCreateLoader) {
  btnCreate.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (btnCreate.disabled || createButtonLocked) return;
    if (uploadState.character !== UPLOAD_STATES.SUCCESS || uploadState.video !== UPLOAD_STATES.SUCCESS) return;

    fetchAuthMe()
      .then(function (auth) {
        if (!auth || !auth.user) {
          showAuthModal();
          return;
        }
        return apiFetch(API_BASE_URL + "/api/create-offer-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (!data || !data.token) {
              showAuthModal();
              return;
            }
            if (typeof window.setOfferCompleteRedirectUrl === "function") {
              window.setOfferCompleteRedirectUrl(data.token);
            }
            showCreateLoaderOverlay(openContentLockerModal);
          });
      })
      .catch(function () {
        showAuthModal();
      });
  });
}

/* ---------- CPA: sync auth from backend, handle offer_complete redirect, initial auth load ---------- */
(function () {
  var params = new URLSearchParams(window.location.search);
  if (params.get("offer_complete") === "1") {
    fetchAuthMe().then(function (auth) {
      if (auth && auth.user) {
        authState.user = auth.user;
        offerCompletedFromBackend = !!auth.user.offerCompleted;
        updateAuthUI();
        updateCreateButtonUI();
        showCreateLoaderOverlay(startCreateProcess);
      }
      var clean = new URLSearchParams(window.location.search);
      clean.delete("offer_complete");
      var q = clean.toString();
      var newUrl = window.location.pathname + (q ? "?" + q : "") + window.location.hash;
      history.replaceState({}, "", newUrl);
    });
    return;
  }
  loadAuthAndUpdateUI();
})();
