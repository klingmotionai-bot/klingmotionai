var GOOGLE_AUTH_URL = "http://localhost:3080/auth/google";
document.querySelectorAll(".auth-google-btn").forEach(function (btn) {
  btn.addEventListener("click", function () {
    if (btn.disabled || btn.classList.contains("auth-google-btn-loading")) return;
    btn.classList.add("auth-google-btn-loading");
    btn.disabled = true;
    window.location.href = GOOGLE_AUTH_URL;
  });
});

document.querySelectorAll(".auth-form").forEach(function (form) {
  form.addEventListener("submit", function (e) {
    e.preventDefault();
  });
});

document.querySelectorAll(".auth-password-toggle").forEach(function (btn) {
  btn.addEventListener("click", function () {
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
});
