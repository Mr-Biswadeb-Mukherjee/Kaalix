// File: Middleware/autoLogger.middleware.js
import { LoggerContainer } from "../Logger/Logger.js";

const logger = LoggerContainer.get("HTTP", { console: true, level: "info" });

export default function autoLogger(req, res, next) {
  const start = process.hrtime.bigint();
  const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";

  logger.http(`→ ${req.method} ${req.originalUrl} | from ${ip}`);

  res.on("finish", () => {
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1_000_000;
    const status = res.statusCode;
    const userId = req.user?.user_id || "guest";

    const level =
      status >= 500 ? "error" :
      status >= 400 ? "warn" :
      "info";

    logger.log(
      level,
      `← ${req.method} ${req.originalUrl} | ${status} | user:${userId} | ${duration.toFixed(2)}ms`
    );
  });

  res.on("error", (err) => {
    logger.error(`❌ Response error in ${req.method} ${req.originalUrl}: ${err.message}`);
  });

  next();
}
