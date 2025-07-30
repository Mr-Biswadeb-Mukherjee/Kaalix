import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";

import API from "./APIs/APIs.js";
import authRouter from "./Modules/auth.js";
import { generateToken } from "./Utils/jwt.js";

dotenv.config();
console.log("🔐 JWT_SECRET loaded:", process.env.JWT_SECRET ? "✅ OK" : "❌ MISSING");

const app = express();
const PORT = process.env.PORT || 6000;

// 🛡️ Middleware
app.use(cors());
app.use(bodyParser.json());

app.use((req, res, next) => {
  res.generateToken = generateToken;
  next();
});

// 📦 Routes
app.use(API.system.auth.endpoint, authRouter);

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
