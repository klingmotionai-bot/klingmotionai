var { spawn, exec } = require("child_process");
var http = require("http");
var path = require("path");

var root = __dirname;
var backendDir = path.join(root, "backend");

var backendProcess = spawn("node", ["server.js"], {
  cwd: backendDir,
  stdio: "inherit",
  shell: true
});

setTimeout(function () {
  var serverProcess = spawn("node", ["serve.js"], {
    cwd: root,
    stdio: ["ignore", "pipe", "inherit"]
  });

  var buffer = "";
  serverProcess.stdout.on("data", function (chunk) {
    buffer += chunk.toString();
    if (buffer.indexOf("READY:") !== -1) {
      var line = buffer.split("\n")[0];
      var url = line.replace("READY:", "").trim();
      waitThenOpen(url);
    }
  });

  function waitThenOpen(url) {
    var attempts = 0;
    var maxAttempts = 50;
    function check() {
      attempts++;
      var req = http.get(url, function (res) {
        req.destroy();
        var cmd = process.platform === "win32" ? "start \"\" " + url : process.platform === "darwin" ? "open " + JSON.stringify(url) : "xdg-open " + JSON.stringify(url);
        exec(cmd, function () {});
      });
      req.on("error", function () {
        req.destroy();
        if (attempts < maxAttempts) setTimeout(check, 200);
      });
      req.setTimeout(1000, function () {
        req.destroy();
        if (attempts < maxAttempts) setTimeout(check, 200);
      });
    }
    setTimeout(check, 100);
  }
}, 1500);
