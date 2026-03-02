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
import {
  defaultErrorCode,
  defaultErrorMessage,
  defaultErrorTitle,
  normalizeHttpStatus,
} from "../Utils/httpErrors.utils.js";

const app = express();

app.disable("x-powered-by");
app.use(cors());
// app.use(helmet()); // Secure headers
app.use(compression());
app.use(express.json());

// Normalize all error responses into a stable payload contract.
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (payload = {}) => {
    if (res.statusCode < 400 || !payload || typeof payload !== "object" || Array.isArray(payload)) {
      return originalJson(payload);
    }

    const status = normalizeHttpStatus(res.statusCode);
    const code =
      typeof payload.code === "string" && payload.code.trim()
        ? payload.code.trim()
        : defaultErrorCode(status);
    const title =
      typeof payload.title === "string" && payload.title.trim()
        ? payload.title.trim()
        : defaultErrorTitle(status);
    const message =
      typeof payload.message === "string" && payload.message.trim()
        ? payload.message
        : defaultErrorMessage(status);

    return originalJson({
      ...payload,
      // Keep normalized contract values authoritative.
      success: false,
      status,
      code,
      title,
      message,
    });
  };

  next();
});

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

// Unknown API route
app.use((req, res, next) => {
  if (!req.originalUrl.startsWith("/api/")) {
    return next();
  }
  res.locals.errorReason = `route_not_found:${req.method}:${req.originalUrl}`;
  res.locals.errorCode = "ROUTE_NOT_FOUND";
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    code: "ROUTE_NOT_FOUND",
  });
});

// 🔹 Global error handler
app.use((err, req, res, next) => {
  void next;
  const status = normalizeHttpStatus(err?.status || err?.statusCode);
  const message =
    typeof err?.message === "string" && err.message.trim()
      ? err.message
      : defaultErrorMessage(status);
  const code =
    typeof err?.code === "string" && err.code.trim()
      ? err.code
      : typeof err?.name === "string" && err.name.trim()
        ? err.name
        : defaultErrorCode(status);
  const title =
    typeof err?.title === "string" && err.title.trim()
      ? err.title
      : defaultErrorTitle(status);

  res.locals.errorReason = message;
  res.locals.errorCode = code;
  console.error("🔥 Global error caught:", err.stack || err);
  res.status(status).json({
    title,
    message,
    code,
  });
});

export default app;
