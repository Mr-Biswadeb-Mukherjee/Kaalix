import express from "express";
import cors from "cors";
// import helmet from "helmet";
import compression from "compression";

import {
  generateToken,
  verifyToken,
  revokeToken,
} from "../Utils/JWT.utils.js";

import publicRoutes from "./public.route.js";
import protectedRoutes from "./protected.route.js";
import Ratelimiter from "../Utils/ratelimiter.utils.js";
import requestLogger from "../Middleware/APILogger.middleware.js"; // <-- our global logger middleware

const app = express();

app.disable("x-powered-by");
app.use(cors());
// app.use(helmet()); // Secure headers
app.use(compression());
app.use(express.json());

// 🔹 Mount logger globally before all routes
app.use(requestLogger);

// Inject JWT helpers into res
app.use((req, res, next) => {
  res.generateToken = generateToken;
  res.verifyToken = verifyToken;
  res.revokeToken = revokeToken;
  next();
});

// Apply rate limiter
app.use(
  Ratelimiter({
    windowMs: 60 * 1000, // 1 min observation window
    burstWindowMs: 10 * 1000, // short burst window
    baseMax: 100, // steady limit
    baseBurst: 20, // burst limit
    penaltyDecayMs: 5 * 60 * 1000, // 5 min cool-down
    maxPenalty: 5, // penalty cap
  })
);

// Load routes
app.use(publicRoutes);
app.use(protectedRoutes);

// 🔹 Global error handler
app.use((err, req, res, _next) => {
  res.locals.errorReason = err?.message || "Unhandled server exception";
  res.locals.errorCode = err?.code || err?.name || "UNHANDLED_EXCEPTION";
  console.error("🔥 Global error caught:", err.stack || err);
  res.status(500).json({
    success: false,
    message: "Internal Server Error. Something went wrong on our end.",
  });
});

export default app;
