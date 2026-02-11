console.log("[server] starting...");
process.on("uncaughtException", function (err) {
  console.error("[server] uncaughtException:", err.message);
  console.error(err.stack);
});
process.on("unhandledRejection", function (reason, p) {
  console.error("[server] unhandledRejection:", reason);
});
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
require("dotenv").config({ path: path.join(__dirname, ".env") });
console.log("[server] env loaded");
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const multer = require("multer");

const app = express();

/** In-memory store for CPA offer tokens. Key = token string, value = { userId, used, createdAt }. */
const offerTokens = new Map();
const PORT = process.env.PORT || 3080;
const UPLOAD_DIR = path.join(__dirname, "uploads");
const MAX_FILE_SIZE = 100 * 1024 * 1024;
/** When serving frontend from backend, use same origin so session cookies work. */
const FRONTEND_ROOT = path.join(__dirname, "..");
/**
 * Public URL of the app. Set via FRONTEND_URL, or on Railway use RAILWAY_STATIC_URL / RAILWAY_PUBLIC_DOMAIN, or:
 * - NODE_ENV !== "production" → http://localhost:PORT
 * - NODE_ENV === "production" → https://klingmotionai.com
 */
var FRONTEND_URL = process.env.FRONTEND_URL;
if (!FRONTEND_URL && process.env.RAILWAY_STATIC_URL) FRONTEND_URL = process.env.RAILWAY_STATIC_URL;
if (!FRONTEND_URL && process.env.RAILWAY_PUBLIC_DOMAIN) FRONTEND_URL = "https://" + process.env.RAILWAY_PUBLIC_DOMAIN;
if (!FRONTEND_URL) FRONTEND_URL = process.env.NODE_ENV === "production" ? "https://klingmotionai.com" : "http://localhost:" + PORT;
const IS_PRODUCTION = process.env.NODE_ENV === "production";
console.log("[server] PORT=" + PORT + " FRONTEND_URL=" + FRONTEND_URL);

var hasGoogleAuth = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
if (!hasGoogleAuth) {
  console.warn("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET; OAuth will be disabled.");
}

app.set("trust proxy", 1);

var sessionOpts = {
  secret: process.env.SESSION_SECRET || "klingmotionai-dev-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: IS_PRODUCTION,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: "lax"
  }
};
console.log("[server] session configured (memory store)");
app.use(session(sessionOpts));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function (user, done) {
  done(null, user);
});
passport.deserializeUser(function (obj, done) {
  done(null, obj);
});

app.use(
  cors({
    origin: function (origin, callback) {
      var allowed = [FRONTEND_URL];
      if (FRONTEND_URL.indexOf("localhost") !== -1) {
        allowed.push(FRONTEND_URL.replace("localhost", "127.0.0.1"));
      }
      if (!origin || allowed.indexOf(origin) !== -1) {
        callback(null, origin || allowed[0]);
      } else {
        callback(null, allowed[0]);
      }
    },
    methods: ["POST", "GET", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    credentials: true
  })
);

app.get("/health", function (req, res) {
  res.status(200).send("OK");
});

if (hasGoogleAuth) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: FRONTEND_URL + "/auth/google/callback"
      },
      function (accessToken, refreshToken, profile, done) {
        return done(null, profile);
      }
    )
  );
}

app.get("/auth/google", function (req, res, next) {
  if (!hasGoogleAuth) return res.status(503).send("OAuth not configured");
  return passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
});

app.get("/auth/google/callback", function (req, res, next) {
  if (!hasGoogleAuth) return res.status(503).send("OAuth not configured");
  passport.authenticate("google", function (err, profile, info) {
    if (err) return next(err);
    if (!profile) {
      return res.redirect(FRONTEND_URL + "/?page=signin&error=google_denied");
    }
    const email = profile.emails && profile.emails[0] ? profile.emails[0].value : "";
    const avatar = profile.photos && profile.photos[0] ? profile.photos[0].value : "";
    const user = {
      id: profile.id,
      name: profile.displayName || "",
      email: email,
      avatar: avatar,
      provider: "google"
    };
    req.login(user, function (err) {
      if (err) return next(err);
      res.redirect(FRONTEND_URL + "/auth/callback");
    });
  })(req, res, next);
});

app.get("/auth/me", function (req, res) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ user: null });
  }
  var u = req.user;
  var safe = {
    id: u && u.id,
    name: u && u.name,
    email: u && u.email,
    avatar: u && u.avatar,
    provider: u && u.provider,
    offerCompleted: !!(req.session && req.session.offerCompleted)
  };
  res.json({ user: safe });
});

app.get("/auth/logout", function (req, res) {
  req.logout(function (err) {
    if (err) return res.redirect(FRONTEND_URL + "/");
    res.redirect(FRONTEND_URL + "/");
  });
});

/** Token validity: 15 minutes. Prevents reuse of old links. */
const OFFER_TOKEN_TTL_MS = 15 * 60 * 1000;

/**
 * GET /offer-complete (and /api/offer-complete) — AdBlueMedia MUST redirect only here.
 * Validates: logged-in session, one-time token, token not expired, token belongs to this user.
 * Rejects: no session, offer already used, link reused by another account, expired token.
 */
function handleOfferComplete(req, res) {
  const token = req.query.token;
  const errorUrl = FRONTEND_URL + "/?offer_error=1";

  if (!token || typeof token !== "string") {
    return res.redirect(errorUrl);
  }
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.redirect(errorUrl);
  }
  const userId = req.user && req.user.id;
  if (!userId) {
    return res.redirect(errorUrl);
  }

  const record = offerTokens.get(token);
  if (!record) {
    return res.redirect(errorUrl);
  }
  if (record.used) {
    return res.redirect(errorUrl);
  }
  if (record.userId !== userId) {
    return res.redirect(errorUrl);
  }
  const now = Date.now();
  if (now - record.createdAt > OFFER_TOKEN_TTL_MS) {
    return res.redirect(errorUrl);
  }

  record.used = true;
  req.session.offerCompleted = true;
  req.session.save(function (err) {
    if (err) return res.redirect(errorUrl);
    res.redirect(FRONTEND_URL + "/?offer_complete=1");
  });
}

app.get("/offer-complete", handleOfferComplete);
app.get("/api/offer-complete", handleOfferComplete);

/** POST /api/create-offer-token — Create a one-time CPA offer token. Requires logged-in user. */
app.post("/api/create-offer-token", function (req, res) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  const userId = req.user && req.user.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  const token = crypto.randomBytes(32).toString("hex");
  const createdAt = new Date();
  offerTokens.set(token, {
    userId,
    used: false,
    createdAt: createdAt.getTime()
  });
  res.status(200).json({ token });
});

app.use(express.json());
app.use("/uploads", express.static(UPLOAD_DIR));

/** OAuth callback page (same origin so session cookie is present). */
app.get("/auth/callback", function (req, res) {
  res.sendFile(path.join(FRONTEND_ROOT, "auth-callback.html"));
});
/** Serve the app for GET / so user sees the frontend, not "Backend running". */
const INDEX_HTML = path.resolve(FRONTEND_ROOT, "index.html");
app.get("/", function (req, res) {
  res.sendFile(INDEX_HTML, function (err) {
    if (err) {
      console.error("[GET /] sendFile failed:", INDEX_HTML, err.message);
      if (!res.headersSent) res.status(500).send("Could not load app. Check that index.html exists at project root.");
    }
  });
});
/** Do not serve backend or node_modules from static. */
app.use(function (req, res, next) {
  if (req.path.indexOf("/backend") === 0 || req.path.indexOf("/node_modules") === 0) {
    return res.status(404).send("Not found");
  }
  next();
});
/** Serve frontend from project root so app and API are same origin; session cookies then work. */
app.use(express.static(FRONTEND_ROOT));

try {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} catch (e) {
  console.warn("[server] upload dir mkdir failed:", e.message);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || "";
    const base = path.basename(file.originalname, ext) || "file";
    const safe = base.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
    cb(null, safe + "-" + Date.now() + ext);
  }
});
const fileFilter = function (req, file, cb) {
  const type = (file.mimetype || "").toLowerCase();
  const ok = type.startsWith("image/") || type.startsWith("video/");
  if (ok) cb(null, true);
  else cb(new Error("Only image and video files are allowed"), false);
};
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE }
});

app.get("/upload", function (req, res) {
  res
    .status(200)
    .type("html")
    .send(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Upload API</title></head><body><h1>Upload API</h1><p>POST to this URL with a <code>file</code> field to upload. Used by the frontend at <a href="' +
        FRONTEND_URL +
        '">' +
        FRONTEND_URL +
        "</a>.</p></body></html>"
    );
});

app.post(
  "/upload",
  function (req, res, next) {
    console.log("[upload] method:", req.method);
    next();
  },
  upload.single("file"),
  function (req, res) {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "NO_FILE_RECEIVED" });
    }
    const base = FRONTEND_URL.replace(/\/$/, "");
    const fileUrl = base + "/uploads/" + encodeURIComponent(req.file.filename);
    res.json({ success: true, fileUrl: fileUrl });
  }
);

app.use(function (err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ success: false, error: "File too large" });
    }
  }
  res.status(400).json({ success: false, error: err.message || "Upload failed" });
});

console.log("[server] binding to port " + PORT + "...");
const server = app.listen(PORT, "0.0.0.0", function () {
  console.log("Backend running on " + FRONTEND_URL + " (port " + PORT + ")");
});
server.on("error", function (err) {
  if (err.code === "EADDRINUSE") {
    console.error("Port " + PORT + " is already in use. Stop the other process or set PORT in .env.");
    process.exit(1);
  }
  console.error("[server] server error:", err.message);
});

process.on("beforeExit", function (code) {
  console.error("[server] beforeExit code=" + code);
});
