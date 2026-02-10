var spawn = require("child_process").spawn;
var http = require("http");
var { exec } = require("child_process");
var path = require("path");

var root = __dirname;
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

serverProcess.on("error", function (err) {
  console.error(err);
  process.exit(1);
});

function waitThenOpen(url) {
  var parsed = new URL(url);
  var port = parsed.port;
  var attempts = 0;
  var maxAttempts = 50;

  function check() {
    attempts++;
    var req = http.get(url, function (res) {
      req.destroy();
      openBrowser(url);
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

function openBrowser(url) {
  var cmd = process.platform === "win32" ? "start \"\" " + url : process.platform === "darwin" ? "open " + JSON.stringify(url) : "xdg-open " + JSON.stringify(url);
  exec(cmd, function () {});
}
