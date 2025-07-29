import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";

import API from "./APIs/APIs.js"; // centralized API config
import authRouter from "./Modules/auth.js";
import { generateToken } from "./Utils/jwt.js"; // still global

dotenv.config();

const app = express();
const PORT = process.env.PORT || 6000;

// ─────────────────────────────────────
// 🛡️ Middleware Setup
// ─────────────────────────────────────
app.use(cors());
app.use(bodyParser.json());

// 🔐 Inject token generation into response
app.use((req, res, next) => {
  res.generateToken = generateToken;
  next();
});

// ─────────────────────────────────────
// 📦 Mount Routes via Centralized API Config
// ─────────────────────────────────────
app.use(API.system.auth.endpoint, authRouter);

// ─────────────────────────────────────
// 🚀 Server Boot
// ─────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🟢 Server running at http://localhost:${PORT}`);
});
