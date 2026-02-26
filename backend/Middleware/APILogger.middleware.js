// File: Middleware/logger.middleware.js
import { LoggerContainer } from "../Logger/Logger.js"; // adjust path if needed

export default function requestLogger(req, res, next) {
  const start = process.hrtime();

  // Infer module name from URL
  let moduleName = "unknown";
  const url = req.originalUrl || "";

  if (url.startsWith("/public")) moduleName = "public";
  else if (url.startsWith("/protected")) moduleName = "protected";
  else if (url.startsWith("/admin")) moduleName = "admin";
  else moduleName = "misc";

  // Get logger instance for that module
  const logger = LoggerContainer.get(`router-${moduleName}`, {
    console: false,
    level: "info",
  });

  // When response finishes, record the log
  res.on("finish", () => {
    const [sec, nano] = process.hrtime(start);
    const duration = (sec * 1e3 + nano / 1e6).toFixed(2);

    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    };

    // Categorize log severity
    if (res.statusCode >= 500) logger.error(JSON.stringify(logData));
    else if (res.statusCode >= 400) logger.warn(JSON.stringify(logData));
    else logger.info(JSON.stringify(logData));
  });

  next();
}
