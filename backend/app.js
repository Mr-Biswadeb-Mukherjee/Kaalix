// server.js

import path from "path";
import { fileURLToPath } from "url";

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";

import API from "@amon/shared";
import authRouter from "./Modules/auth.js";
import logoutHandler from "./Modules/Logout.js";
import {
  generateToken,
  verifyToken,
  revokeToken,
} from "./Utils/JWT.js";

import authMiddleware from "./Middleware/authMiddleware.js";
import { generateCaptcha } from "./Modules/captcha.js";
import getSystemStats from "./Modules/status.js";
import { ChangePassword } from "./Modules/changepass.js";

// Reconstruct __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment
const PORT = 4000;
const NODE_ENV = "development";

const app = express();

app.use(cors());
app.use(express.json());

// Inject JWT utils into res object
app.use((req, res, next) => {
  res.generateToken = generateToken;
  res.verifyToken = verifyToken;
  res.revokeToken = revokeToken;
  next();
});

// 🧠 CAPTCHA Route (Public)
app.get(API.system.public.captcha.endpoint, (req, res) => {
  const { id, image } = generateCaptcha();
  res.status(200).json({ id, image }); // image is base64
});

// 🟢 Public Routes
app.use(API.system.public.login.endpoint, authRouter);
app.post(API.system.public.logout.endpoint, authMiddleware({ revoke: true }), logoutHandler);

// 🔐 Token verification route (read-only check, no revoke)
app.post(
  API.system.public.verify.endpoint,
  authMiddleware({ revoke: false }),
  (req, res) => {
    res.status(200).json({ message: "Token is valid", user: req.user });
  }
);

// 🔒 Protect all secure endpoints under API.system.protected.*
Object.entries(API.system.protected).forEach(([key, { method, endpoint }]) => {
  if (key === "status") {
    // Special case: system status handler
    app[method.toLowerCase()](endpoint, authMiddleware({ revoke: false }), (req, res) => {
      const stats = getSystemStats();
      res.status(200).json({ success: true, stats });
    });
  } else if (key === "changepass") {
    // Special case: Change password
    app[method.toLowerCase()](endpoint, authMiddleware({ revoke: true }), ChangePassword);
  } else {
    // Default: all protected routes require token but don't revoke it
    app.use(endpoint, authMiddleware({ revoke: false }));
  }
});

// 🔥 Global Error Handler
app.use((err, req, res, next) => {
  console.error("🔥 Global error caught:", err.stack || err);
  res.status(500).json({
    success: false,
    message: "Internal Server Error. Something went wrong on our end.",
  });
});

// 🚀 Start the server
app.listen(PORT, () => {
  console.log(
    `🟢 Server running in ${NODE_ENV} mode at http://localhost:${PORT}`
  );
});
