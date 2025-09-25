import express from "express";
import cors from "cors";
//import helmet from "helmet";
import compression from "compression";

import {
  generateToken,
  verifyToken,
  revokeToken,
} from "../Utils/JWT.utils.js";

import publicRoutes from "./public.route.js"
import protectedRoutes from "./protected.route.js";
import Ratelimiter from "../Utils/ratelimiter.utils.js"; 

const app = express();

app.disable("x-powered-by");
app.use(cors());
//app.use(helmet());             // Secure headers
app.use(compression());        // Gzip compression
app.use(express.json());

// Inject JWT helpers into res
app.use((req, res, next) => {
  res.generateToken = generateToken;
  res.verifyToken = verifyToken;
  res.revokeToken = revokeToken;
  next();
});

app.use(Ratelimiter({
  windowMs: 60 * 1000,        // 1 min observation window
  burstWindowMs: 10 * 1000,   // short burst window
  baseMax: 100,               // starting steady limit
  baseBurst: 20,              // starting burst limit
  penaltyDecayMs: 5 * 60 * 1000, // penalty cools down in 5min
  maxPenalty: 5,              // cap penalties
}));

// Load routes
app.use(publicRoutes);
app.use(protectedRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error("🔥 Global error caught:", err.stack || err);
  res.status(500).json({
    success: false,
    message: "Internal Server Error. Something went wrong on our end.",
  });
});

export default app;
