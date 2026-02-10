const express = require("express");
const router = express.Router();

router.get("/google", (req, res) => {
  res.status(200).send("Auth route OK");
});

module.exports = router;
