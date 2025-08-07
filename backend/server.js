//server.js code for Production Environment

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

// Reconstruct __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const PORT = process.env.PORT || 4000;
const NODE_ENV = "production";

// Path to frontend/dist
const FRONTEND_DIST_PATH = path.join(__dirname, "../frontend/dist");

const app = express();

// Middlewares
app.use(cors());
app.use(bodyParser.json());

// Inject JWT utils into res
app.use((req, res, next) => {
  res.generateToken = generateToken;
  res.verifyToken = verifyToken;
  res.revokeToken = revokeToken;
  next();
});

// Serve static files from frontend/dist
app.use(express.static(FRONTEND_DIST_PATH));

// 🟢 Public Routes
app.use(API.system.auth.login.endpoint, authRouter);
app.post(API.system.auth.logout.endpoint, logoutHandler);
app.post(
  API.system.auth.verify.endpoint,
  authMiddleware({ revoke: false }),
  (req, res) => {
    res.status(200).json({ message: "Token is valid", user: req.user });
  }
);

// 🔒 Protected routes
Object.values(API.system.protected).forEach(({ endpoint }) => {
  app.use(endpoint, authMiddleware);
});

// 🌐 Serve index.html for unknown routes (SPA support)
app.get("/", (req, res) => {
  res.sendFile(path.join(FRONTEND_DIST_PATH, "index.html"));
});

// 🔥 Global error handler
app.use((err, req, res, next) => {
  console.error("🔥 Global error caught:", err.stack || err);
  res.status(500).json({
    success: false,
    message: "Internal Server Error. Something went wrong on our end.",
  });
});

// Start server
app.listen(PORT, () => {
  console.log(
    `🟢 Server running in ${NODE_ENV} mode at http://localhost:${PORT}`
  );
});
