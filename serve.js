var express = require("express");
var path = require("path");

var app = express();
var PORT = 5173;
var ROOT = __dirname;

app.use(function (req, res, next) {
  if (req.path.indexOf("/backend") === 0) return res.status(404).send("Not found");
  next();
});
app.get("/sign-up", function (req, res) {
  res.sendFile(path.join(ROOT, "sign-up.html"));
});
app.get("/sign-in", function (req, res) {
  res.sendFile(path.join(ROOT, "sign-in.html"));
});
app.get("/auth/callback", function (req, res) {
  res.sendFile(path.join(ROOT, "auth-callback.html"));
});
app.use(express.static(ROOT, { index: "index.html" }));

app.use(function (req, res, next) {
  res.status(404).send("Not found");
});

app.listen(PORT, "0.0.0.0", function () {
  console.log("READY:http://localhost:" + PORT);
});
