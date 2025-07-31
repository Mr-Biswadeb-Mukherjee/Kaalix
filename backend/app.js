import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";

import API from "./APIs/APIs.js";
import authRouter from "./Modules/auth.js";
import { generateToken, verifyToken } from "./Utils/jwt.js"; // ✅ import both


const app = express();
const PORT = process.env.PORT || 6000;

// 🛡️ Middleware
app.use(cors());
app.use(bodyParser.json());

// 🧩 Inject token utilities into response
app.use((req, res, next) => {
  res.generateToken = generateToken;
  res.verifyToken = verifyToken;
  next();
});

// 🔒 Optional: Global Auth Middleware (for all protected routes)
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Missing or invalid token" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const userData = verifyToken(token); // ✅ verify against current/previous secret
    req.user = userData;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: "Token expired or invalid" });
  }
};

// 🛣️ Public Routes
app.use(API.system.auth.endpoint, authRouter);

// 🔐 Example: Protected Route
app.get("/api/protected", authenticate, (req, res) => {
  res.json({ success: true, message: "You have access!", user: req.user });
});

// ❌ Global Error Handler
app.use((err, req, res, next) => {
  console.error("🔥 Global error caught:", err.stack || err);
  res.status(500).json({
    success: false,
    message: "Internal Server Error. Something went wrong on our end.",
  });
});

// 🚀 Boot
app.listen(PORT, () => {
  console.log(`🟢 Server running at http://localhost:${PORT}`);
});
