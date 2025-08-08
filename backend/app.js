import path from "path";
import { fileURLToPath } from "url";

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";

import API from "@amon/shared";
import authRouter from "./Modules/auth.js";
import logoutHandler from "./Modules/Logout.js";
import { generateToken, verifyToken, revokeToken } from "./Utils/JWT.js";
import AppKeyManager from "./Utils/APP_KEY.js"; // 🛡 HMAC-based rotating platform key
import authMiddleware from "./Middleware/authMiddleware.js";
import { generateCaptcha } from "./Modules/captcha.js";

// __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment
const PORT = 4000;
const NODE_ENV = "development";

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 🔑 Initialize the first platform key (HMAC-based)
AppKeyManager.generateKey();

// 🛡 Platform-level security middleware
app.use((req, res, next) => {
  const publicPaths = [
    API.system.auth.login.endpoint,
    API.system.auth.logout.endpoint,
    API.system.auth.captcha.endpoint,
  ];

  // Allow public paths without the app key
  if (publicPaths.includes(req.path)) return next();

  const incomingKey = req.headers["x-app-secret-key"];
  if (!incomingKey) {
    return res.status(401).json({ error: "Missing app secret key" });
  }

  // Check equality with active HMAC key
  if (incomingKey !== AppKeyManager._secret) {
    return res.status(403).json({ error: "Invalid or expired app secret key" });
  }

  // Rotate automatically if expired
  if (AppKeyManager.isExpired()) {
    AppKeyManager.rotate();
  }

  next();
});

// Inject JWT utils into res object
app.use((req, res, next) => {
  res.generateToken = generateToken;
  res.verifyToken = verifyToken;
  res.revokeToken = revokeToken;
  next();
});

// 🧠 CAPTCHA endpoint
app.get(API.system.auth.captcha.endpoint, (req, res) => {
  const { id, image } = generateCaptcha();
  res.status(200).json({ id, image });
});

// 🟢 Public routes
app.use(API.system.auth.login.endpoint, authRouter);
app.post(API.system.auth.logout.endpoint, logoutHandler);

// 🔐 Token verification endpoint (JWT-based)
app.post(
  API.system.auth.verify.endpoint,
  authMiddleware({ revoke: false }),
  (req, res) => {
    res.status(200).json({ message: "Token is valid", user: req.user });
  }
);

// 🔒 Protect all secure endpoints under API.system.protected.*
Object.values(API.system.protected).forEach(({ endpoint }) => {
  app.use(endpoint, authMiddleware);
});

// 🔥 Global error handler
app.use((err, req, res, next) => {
  console.error("🔥 Global error caught:", err.stack || err);
  res.status(500).json({
    success: false,
    message: "Internal Server Error. Something went wrong on our end.",
  });
});

// 🚀 Start the server
app.listen(PORT, () => {
  console.log(`🟢 Server running in ${NODE_ENV} mode at http://localhost:${PORT}`);
});
