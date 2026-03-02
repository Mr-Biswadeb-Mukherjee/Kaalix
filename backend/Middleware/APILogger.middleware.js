import crypto from "node:crypto";
import { LoggerContainer } from "../Logger/Logger.js";
import { getDatabase } from "../Connectors/DB.js";
import { createNotificationSafely } from "../Services/notification.service.js";

const monitorLogger = LoggerContainer.get("EndpointMonitor", {
  console: false,
  level: "debug",
});

const ROLLING_WINDOW_MS = 60 * 1000;
const SLOW_REQUEST_MS = 3000;
const ALERT_COOLDOWN_MS = 60 * 1000;
const STALE_ENDPOINT_MS = 15 * 60 * 1000;
const SUPER_ADMIN_CACHE_TTL_MS = 30 * 1000;
const MONITORING_TOP_ENDPOINTS = 3;

const endpointStats = new Map();

let cachedSuperAdminUserId = null;
let cachedSuperAdminFetchedAt = 0;

function pruneTimestamps(list, cutoff) {
  while (list.length > 0 && list[0] < cutoff) list.shift();
}

function toSafeText(value, maxLen = 300) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

function roundMetric(value, digits = 3) {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(digits));
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

function getOrCreateEndpointStat(endpointKey) {
  const now = Date.now();
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

  return stat;
}

function pruneEndpointStat(stat, cutoff) {
  pruneTimestamps(stat.requests, cutoff);
  pruneTimestamps(stat.errors, cutoff);
  pruneTimestamps(stat.throttled, cutoff);
  pruneTimestamps(stat.slow, cutoff);

  for (const [trackedIp, hits] of stat.ipEvents.entries()) {
    pruneTimestamps(hits, cutoff);
    if (hits.length === 0) stat.ipEvents.delete(trackedIp);
  }
}

function evaluateEndpointAlerts(stat, now) {
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
    slowCount,
    uniqueIpCount,
    errorRate,
    slowRate,
    alerts,
  };
}

async function getSuperAdminUserId() {
  const now = Date.now();
  if (cachedSuperAdminFetchedAt && now - cachedSuperAdminFetchedAt < SUPER_ADMIN_CACHE_TTL_MS) {
    return cachedSuperAdminUserId;
  }

  cachedSuperAdminFetchedAt = now;

  try {
    const db = await getDatabase();
    const [rows] = await db.execute(
      `SELECT user_id
       FROM users
       WHERE role = 'sa'
       LIMIT 1`
    );

    cachedSuperAdminUserId = rows[0]?.user_id || null;
    return cachedSuperAdminUserId;
  } catch {
    return cachedSuperAdminUserId;
  }
}

function mapAlertNotification(endpointKey, alert) {
  const metrics = alert?.metrics || {};

  if (alert?.type === "ddos_suspected") {
    return {
      type: "ops.ddos_suspected",
      severity: "critical",
      title: "DDoS Suspicion Detected",
      message: `${endpointKey}: burst traffic and heavy rate limiting observed in the last 60s.`,
      metadata: {
        endpoint: endpointKey,
        requestCount: metrics.requestCount,
        throttledCount: metrics.throttledCount,
        uniqueIpCount: metrics.uniqueIpCount,
      },
    };
  }

  if (alert?.type === "latency_degradation") {
    return {
      type: "ops.latency_degradation",
      severity: "warning",
      title: "Latency Degradation",
      message: `${endpointKey}: slow response ratio exceeded threshold in the last 60s.`,
      metadata: {
        endpoint: endpointKey,
        requestCount: metrics.requestCount,
        slowCount: metrics.slowCount,
        slowRate: metrics.slowRate,
        slowThresholdMs: metrics.slowThresholdMs,
      },
    };
  }

  return {
    type: "ops.endpoint_degradation",
    severity: "critical",
    title: "Endpoint Degradation Detected",
    message: `${endpointKey}: elevated 5xx error ratio observed in the last 60s.`,
    metadata: {
      endpoint: endpointKey,
      requestCount: metrics.requestCount,
      errorCount: metrics.errorCount,
      errorRate: metrics.errorRate,
    },
  };
}

async function notifyOperationalAlert(endpointKey, alert) {
  const superAdminUserId = await getSuperAdminUserId();
  if (!superAdminUserId) return;

  const payload = mapAlertNotification(endpointKey, alert);

  await createNotificationSafely({
    userId: superAdminUserId,
    actorUserId: null,
    ...payload,
  });
}

function computeAndTrackHealth(endpointKey, statusCode, ip, durationMs) {
  const now = Date.now();
  const cutoff = now - ROLLING_WINDOW_MS;

  const stat = getOrCreateEndpointStat(endpointKey);

  stat.lastSeenAt = now;
  stat.requests.push(now);
  if (statusCode >= 500) stat.errors.push(now);
  if (statusCode === 429) stat.throttled.push(now);
  if (durationMs >= SLOW_REQUEST_MS) stat.slow.push(now);

  const ipHits = stat.ipEvents.get(ip) || [];
  ipHits.push(now);
  pruneTimestamps(ipHits, cutoff);
  stat.ipEvents.set(ip, ipHits);

  pruneEndpointStat(stat, cutoff);

  return evaluateEndpointAlerts(stat, now);
}

function buildEndpointSummary(endpointKey, stat, cutoff) {
  pruneEndpointStat(stat, cutoff);

  const requestCount = stat.requests.length;
  const errorCount = stat.errors.length;
  const throttledCount = stat.throttled.length;
  const slowCount = stat.slow.length;

  if (requestCount === 0) {
    return null;
  }

  return {
    endpoint: endpointKey,
    requestCount,
    errorCount,
    throttledCount,
    slowCount,
    uniqueIpCount: stat.ipEvents.size,
    errorRate: requestCount > 0 ? errorCount / requestCount : 0,
    slowRate: requestCount > 0 ? slowCount / requestCount : 0,
  };
}

export function getMonitoringSnapshot() {
  const now = Date.now();
  const cutoff = now - ROLLING_WINDOW_MS;

  const endpointSummaries = [];
  let totalRequests = 0;
  let totalErrors = 0;
  let totalThrottled = 0;
  let totalSlow = 0;

  for (const [endpointKey, stat] of endpointStats.entries()) {
    if (stat.lastSeenAt < now - STALE_ENDPOINT_MS) {
      endpointStats.delete(endpointKey);
      continue;
    }

    const summary = buildEndpointSummary(endpointKey, stat, cutoff);
    if (!summary) continue;

    endpointSummaries.push(summary);
    totalRequests += summary.requestCount;
    totalErrors += summary.errorCount;
    totalThrottled += summary.throttledCount;
    totalSlow += summary.slowCount;
  }

  const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;
  const slowRate = totalRequests > 0 ? totalSlow / totalRequests : 0;
  const rps = totalRequests / (ROLLING_WINDOW_MS / 1000);

  const degradedEndpointCount = endpointSummaries.filter(
    (item) =>
      item.requestCount >= 15 && item.errorCount >= 8 && item.errorRate >= 0.4
  ).length;

  const suspectedDdosEndpointCount = endpointSummaries.filter(
    (item) =>
      item.requestCount >= 80 &&
      item.throttledCount >= 25 &&
      item.uniqueIpCount >= 8
  ).length;

  const latencyDegradedEndpointCount = endpointSummaries.filter(
    (item) =>
      item.requestCount >= 20 && item.slowCount >= 10 && item.slowRate >= 0.35
  ).length;

  const topFailingEndpoints = [...endpointSummaries]
    .filter((item) => item.errorCount > 0)
    .sort((a, b) => {
      if (b.errorRate !== a.errorRate) return b.errorRate - a.errorRate;
      return b.errorCount - a.errorCount;
    })
    .slice(0, MONITORING_TOP_ENDPOINTS)
    .map((item) => ({
      endpoint: item.endpoint,
      requestCount: item.requestCount,
      errorCount: item.errorCount,
      errorRate: roundMetric(item.errorRate),
    }));

  const topBusyEndpoints = [...endpointSummaries]
    .sort((a, b) => b.requestCount - a.requestCount)
    .slice(0, MONITORING_TOP_ENDPOINTS)
    .map((item) => ({
      endpoint: item.endpoint,
      requestCount: item.requestCount,
      slowRate: roundMetric(item.slowRate),
    }));

  return {
    windowMs: ROLLING_WINDOW_MS,
    updatedAt: new Date(now).toISOString(),
    totalRequests,
    totalErrors,
    totalThrottled,
    totalSlow,
    errorRate: roundMetric(errorRate),
    slowRate: roundMetric(slowRate),
    rps: roundMetric(rps, 2),
    activeEndpoints: endpointSummaries.length,
    degradedEndpointCount,
    suspectedDdosEndpointCount,
    latencyDegradedEndpointCount,
    topFailingEndpoints,
    topBusyEndpoints,
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

      void notifyOperationalAlert(endpointKey, alert);
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
