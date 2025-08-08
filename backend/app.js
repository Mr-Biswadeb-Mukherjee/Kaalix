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

// Reconstruct __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment
const PORT = 6000;
const NODE_ENV = "development";

const app = express();

app.use(cors());
app.use(bodyParser.json());

// Inject JWT utils into res object
app.use((req, res, next) => {
  res.generateToken = generateToken;
  res.verifyToken = verifyToken;
  res.revokeToken = revokeToken;
  next();
});

// 🧠 Custom CAPTCHA Blob Route
app.get(API.system.auth.captcha.endpoint, (req, res) => {
  const { id, image } = generateCaptcha();
  res.status(200).json({ id, image }); // image is base64
});

// 🟢 Public Routes
app.use(API.system.auth.login.endpoint, authRouter);
app.post(API.system.auth.logout.endpoint, logoutHandler);

// 🔐 Token verification route
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
  console.log(`🟢 Server running in ${NODE_ENV} mode at http://localhost:${PORT}`);
});
