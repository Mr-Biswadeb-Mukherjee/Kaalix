// 🟢 Load environment variables before anything else
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";

import BAPI from "./BAPIs/BAPIs.js";
import authRouter from "./Modules/auth.js";
import logoutHandler from "./Modules/Logout.js";
import authMiddleware from "./Middleware/authmiddleware.js";

import {
  generateToken,
  verifyToken,
  revokeToken
} from "./Utils/JWT.js";

const app = express();
const PORT = process.env.PORT || 6000;
const NODE_ENV = process.env.NODE_ENV || "development";

// 🛡️ Global Middleware
app.use(cors());
app.use(bodyParser.json());

// 🔐 Inject token utilities into response
app.use((req, res, next) => {
  res.generateToken = generateToken;
  res.verifyToken = verifyToken;
  res.revokeToken = revokeToken;
  next();
});

// 🛣️ Route Mounts
app.use(BAPI.system.auth.endpoint, authMiddleware, authRouter);

// 🔓 Logout Route
app.post(BAPI.system.Logout.endpoint, logoutHandler);

// ❌ Global Error Handler
app.use((err, req, res, next) => {
  console.error("🔥 Global error caught:", err.stack || err);
  res.status(500).json({
    success: false,
    message: "Internal Server Error. Something went wrong on our end.",
  });
});

// 🚀 Start Server
app.listen(PORT, () => {
  console.log(`🟢 Server running in ${NODE_ENV} mode at http://localhost:${PORT}`);
});
