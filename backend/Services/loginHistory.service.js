import crypto from "node:crypto";
import { getDatabase } from "../Connectors/DB.js";

const DEFAULT_HISTORY_LIMIT = 10;
const MAX_HISTORY_LIMIT = 10;

const normalizeString = (value) =>
  typeof value === "string" ? value.trim() : "";

const normalizeLimit = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_HISTORY_LIMIT;
  if (parsed < 1) return 1;
  if (parsed > MAX_HISTORY_LIMIT) return MAX_HISTORY_LIMIT;
  return parsed;
};

const normalizeIpAddress = (value) => {
  const raw = normalizeString(value);
  if (!raw) return null;
  const firstForwarded = raw.split(",")[0]?.trim() || raw;
  if (!firstForwarded) return null;
  return firstForwarded.slice(0, 64);
};

const normalizeUserAgent = (value) => {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  return normalized.slice(0, 512);
};

const normalizeTimestamp = (value) => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const buildLoginHistoryId = () =>
  `LGN-${crypto.randomUUID().replace(/-/g, "").slice(0, 24).toUpperCase()}`;

const isMissingLoginHistoryTableError = (err) =>
  err?.code === "ER_NO_SUCH_TABLE" ||
  (typeof err?.message === "string" &&
    err.message.toLowerCase().includes("login_history"));

export const recordLoginHistory = async ({
  userId,
  ipAddress = null,
  userAgent = null,
  loggedInAt = null,
}) => {
  const normalizedUserId = normalizeString(userId);
  if (!normalizedUserId) {
    const err = new Error("Login history user id is required.");
    err.code = "LOGIN_HISTORY_USER_ID_REQUIRED";
    err.status = 400;
    throw err;
  }

  const db = await getDatabase();
  const loginId = buildLoginHistoryId();
  const normalizedIp = normalizeIpAddress(ipAddress);
  const normalizedUserAgent = normalizeUserAgent(userAgent);
  const normalizedLoggedInAt = normalizeTimestamp(loggedInAt);

  if (normalizedLoggedInAt) {
    await db.execute(
      `INSERT INTO login_history
        (login_id, user_id, ip_address, user_agent, logged_in_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        loginId,
        normalizedUserId,
        normalizedIp,
        normalizedUserAgent,
        normalizedLoggedInAt,
      ]
    );
  } else {
    await db.execute(
      `INSERT INTO login_history
        (login_id, user_id, ip_address, user_agent)
       VALUES (?, ?, ?, ?)`,
      [loginId, normalizedUserId, normalizedIp, normalizedUserAgent]
    );
  }

  return loginId;
};

export const recordLoginHistorySafely = async (payload) => {
  try {
    return await recordLoginHistory(payload);
  } catch (err) {
    if (isMissingLoginHistoryTableError(err)) {
      console.warn("login_history table missing; skipping login history write.");
      return null;
    }
    console.error("Failed to record login history:", err.message || err);
    return null;
  }
};

export const fetchRecentLoginHistory = async ({ userId, limit = DEFAULT_HISTORY_LIMIT }) => {
  const normalizedUserId = normalizeString(userId);
  if (!normalizedUserId) return [];

  const db = await getDatabase();
  try {
    const [rows] = await db.execute(
      `SELECT
          login_id AS loginId,
          ip_address AS ipAddress,
          user_agent AS userAgent,
          logged_in_at AS loggedInAt
       FROM login_history
       WHERE user_id = ?
       ORDER BY logged_in_at DESC, id DESC
       LIMIT ?`,
      [normalizedUserId, normalizeLimit(limit)]
    );

    return rows.map((row) => ({
      loginId: row.loginId,
      ipAddress: row.ipAddress || null,
      userAgent: row.userAgent || null,
      loggedInAt: row.loggedInAt || null,
    }));
  } catch (err) {
    if (isMissingLoginHistoryTableError(err)) {
      return [];
    }
    throw err;
  }
};
