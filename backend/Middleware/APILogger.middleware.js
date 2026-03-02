import crypto from "node:crypto";
import { LoggerContainer } from "../Logger/Logger.js";

const monitorLogger = LoggerContainer.get("EndpointMonitor", {
  console: false,
  level: "debug",
});

const ROLLING_WINDOW_MS = 60 * 1000;
const SLOW_REQUEST_MS = 3000;
const ALERT_COOLDOWN_MS = 60 * 1000;
const STALE_ENDPOINT_MS = 15 * 60 * 1000;

const endpointStats = new Map();

function pruneTimestamps(list, cutoff) {
  while (list.length > 0 && list[0] < cutoff) list.shift();
}

function toSafeText(value, maxLen = 300) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

function getEndpointPath(req) {
  const source = req.originalUrl || req.url || "unknown";
  const pathOnly = source.split("?")[0] || "unknown";
  return `${req.method} ${pathOnly}`;
}

function getClientIp(req) {
  if (req.ip) return req.ip;
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return String(forwarded[0]).split(",")[0].trim();
  }
  return "unknown";
}

function computeAndTrackHealth(endpointKey, statusCode, ip, durationMs) {
  const now = Date.now();
  const cutoff = now - ROLLING_WINDOW_MS;

  let stat = endpointStats.get(endpointKey);
  if (!stat) {
    stat = {
      requests: [],
      errors: [],
      throttled: [],
      slow: [],
      ipEvents: new Map(),
      lastSeenAt: now,
      lastDowntimeAlertAt: 0,
      lastDdosAlertAt: 0,
      lastLatencyAlertAt: 0,
    };
    endpointStats.set(endpointKey, stat);
  }

  stat.lastSeenAt = now;
  stat.requests.push(now);
  if (statusCode >= 500) stat.errors.push(now);
  if (statusCode === 429) stat.throttled.push(now);
  if (durationMs >= SLOW_REQUEST_MS) stat.slow.push(now);

  const ipHits = stat.ipEvents.get(ip) || [];
  ipHits.push(now);
  pruneTimestamps(ipHits, cutoff);
  stat.ipEvents.set(ip, ipHits);

  pruneTimestamps(stat.requests, cutoff);
  pruneTimestamps(stat.errors, cutoff);
  pruneTimestamps(stat.throttled, cutoff);
  pruneTimestamps(stat.slow, cutoff);

  for (const [trackedIp, hits] of stat.ipEvents.entries()) {
    pruneTimestamps(hits, cutoff);
    if (hits.length === 0) stat.ipEvents.delete(trackedIp);
  }

  const requestCount = stat.requests.length;
  const errorCount = stat.errors.length;
  const throttledCount = stat.throttled.length;
  const slowCount = stat.slow.length;
  const uniqueIpCount = stat.ipEvents.size;
  const errorRate = requestCount > 0 ? errorCount / requestCount : 0;
  const slowRate = requestCount > 0 ? slowCount / requestCount : 0;

  const alerts = [];

  if (
    requestCount >= 15 &&
    errorCount >= 8 &&
    errorRate >= 0.4 &&
    now - stat.lastDowntimeAlertAt >= ALERT_COOLDOWN_MS
  ) {
    stat.lastDowntimeAlertAt = now;
    alerts.push({
      type: "endpoint_degradation",
      reason: "high_5xx_rate_in_rolling_window",
      metrics: { requestCount, errorCount, errorRate },
    });
  }

  if (
    requestCount >= 80 &&
    throttledCount >= 25 &&
    uniqueIpCount >= 8 &&
    now - stat.lastDdosAlertAt >= ALERT_COOLDOWN_MS
  ) {
    stat.lastDdosAlertAt = now;
    alerts.push({
      type: "ddos_suspected",
      reason: "high_traffic_with_mass_rate_limited_requests",
      metrics: { requestCount, throttledCount, uniqueIpCount },
    });
  }

  if (
    requestCount >= 20 &&
    slowCount >= 10 &&
    slowRate >= 0.35 &&
    now - stat.lastLatencyAlertAt >= ALERT_COOLDOWN_MS
  ) {
    stat.lastLatencyAlertAt = now;
    alerts.push({
      type: "latency_degradation",
      reason: "slow_response_rate_above_threshold",
      metrics: { requestCount, slowCount, slowRate, slowThresholdMs: SLOW_REQUEST_MS },
    });
  }

  return {
    requestCount,
    errorCount,
    throttledCount,
    uniqueIpCount,
    errorRate,
    slowRate,
    alerts,
  };
}

const cleanupTimer = setInterval(() => {
  const cutoff = Date.now() - STALE_ENDPOINT_MS;
  for (const [endpointKey, stat] of endpointStats.entries()) {
    if (stat.lastSeenAt < cutoff) endpointStats.delete(endpointKey);
  }
}, 5 * 60 * 1000);

if (typeof cleanupTimer.unref === "function") cleanupTimer.unref();

function writeRequestLog(logger, logData) {
  const serialized = JSON.stringify(logData);
  if (logData.status >= 500) {
    logger.error(serialized);
    return;
  }
  if (logData.status === 429) {
    logger.alert(serialized);
    return;
  }
  if (logData.status >= 400 || logData.durationMs >= SLOW_REQUEST_MS) {
    logger.warn(serialized);
    return;
  }
  logger.info(serialized);
}

export default function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();
  const requestId = toSafeText(req.headers["x-request-id"] || crypto.randomUUID(), 128);
  const endpointKey = getEndpointPath(req);
  const ip = getClientIp(req);

  res.locals.requestId = requestId;
  if (!res.getHeader("x-request-id")) {
    res.setHeader("x-request-id", requestId);
  }

  let finished = false;

  res.on("finish", () => {
    finished = true;
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const status = Number(res.statusCode) || 0;
    const reasonFromHandler = toSafeText(res.locals.errorReason, 500);
    const reasonFromCode = status >= 500
      ? toSafeText(res.statusMessage || "Internal server failure", 200)
      : "";
    const reason = reasonFromHandler || reasonFromCode;

    const health = computeAndTrackHealth(endpointKey, status, ip, durationMs);
    const baseLog = {
      requestId,
      method: req.method,
      endpoint: endpointKey,
      status,
      durationMs: Number(durationMs.toFixed(2)),
      ip,
      userId: req.user?.user_id || null,
      userAgent: toSafeText(req.headers["user-agent"], 300),
      responseBytes: Number(res.getHeader("content-length")) || 0,
      errorCode: toSafeText(res.locals.errorCode, 100) || undefined,
      reason: reason || undefined,
      health: {
        windowMs: ROLLING_WINDOW_MS,
        requestCount: health.requestCount,
        errorCount: health.errorCount,
        throttledCount: health.throttledCount,
        uniqueIpCount: health.uniqueIpCount,
        errorRate: Number(health.errorRate.toFixed(3)),
        slowRate: Number(health.slowRate.toFixed(3)),
      },
    };

    writeRequestLog(monitorLogger, baseLog);

    for (const alert of health.alerts) {
      monitorLogger.critical(
        JSON.stringify({
          requestId,
          endpoint: endpointKey,
          signalType: alert.type,
          reason: alert.reason,
          metrics: alert.metrics,
        })
      );
    }
  });

  res.on("close", () => {
    if (finished) return;
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    monitorLogger.warn(
      JSON.stringify({
        requestId,
        method: req.method,
        endpoint: endpointKey,
        status: Number(res.statusCode) || 0,
        durationMs: Number(durationMs.toFixed(2)),
        ip,
        reason: "connection_closed_before_response_complete",
      })
    );
  });

  next();
}
