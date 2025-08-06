import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";

import API from "@amon/shared";
import authRouter from "./Modules/auth.js";
import logoutHandler from "./Modules/Logout.js";
// import other routers like dashboardRouter, modulesRouter, etc.

import {
  generateToken,
  verifyToken,
  revokeToken,
} from "./Utils/JWT.js";

import authMiddleware from "./Middleware/authMiddleware.js";

const app = express();
const PORT = process.env.PORT || 6000;
const NODE_ENV = process.env.NODE_ENV || "development";

app.use(cors());
app.use(bodyParser.json());

// Inject JWT utils into res
app.use((req, res, next) => {
  res.generateToken = generateToken;
  res.verifyToken = verifyToken;
  res.revokeToken = revokeToken;
  next();
});

// 🟢 Public Routes (defined before middleware)
app.use(API.system.auth.login.endpoint, authRouter);
app.post(API.system.auth.logout.endpoint, logoutHandler);
app.post(API.system.auth.verify.endpoint, authMiddleware({ revoke: false }), (req, res) => {
  res.status(200).json({ message: "Token is valid", user: req.user });
});
// 🔒 Dynamically protect all routes listed under BAPI.system.protected
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

app.listen(PORT, () => {
  console.log(`🟢 Server running in ${NODE_ENV} mode at http://localhost:${PORT}`);
});
