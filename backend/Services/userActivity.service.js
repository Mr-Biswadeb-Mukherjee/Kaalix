import crypto from "node:crypto";
import { getDatabase } from "../Connectors/DB.js";

const DEFAULT_ACTIVITY_LIMIT = 20;
const MAX_ACTIVITY_LIMIT = 50;

export const USER_ACTIVITY_TYPES = Object.freeze({
  LOGIN_SUCCESS: "auth.login_success",
  LOGOUT_SUCCESS: "auth.logout_success",
  PASSWORD_CHANGED: "security.password_changed",
  MFA_ENABLED: "security.mfa_enabled",
  MFA_DISABLED: "security.mfa_disabled",
  INTEL_SEARCH_SUCCESS: "intel.search_success",
  INTEL_SEARCH_FAILED: "intel.search_failed",
});

const normalizeString = (value) =>
  typeof value === "string" ? value.trim() : "";

const normalizeLimit = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_ACTIVITY_LIMIT;
  if (parsed < 1) return 1;
  if (parsed > MAX_ACTIVITY_LIMIT) return MAX_ACTIVITY_LIMIT;
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

const serializeMetadata = (metadata) => {
  if (metadata === null || typeof metadata === "undefined") return null;
  if (typeof metadata === "string") {
    const trimmed = metadata.trim();
    return trimmed || null;
  }
  try {
    return JSON.stringify(metadata);
  } catch {
    return null;
  }
};

const parseMetadata = (metadataJson) => {
  if (typeof metadataJson === "string") {
    const trimmed = metadataJson.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  if (metadataJson && typeof metadataJson === "object") {
    return metadataJson;
  }

  return null;
};

const buildActivityId = () =>
  `ACT-${crypto.randomUUID().replace(/-/g, "").slice(0, 24).toUpperCase()}`;

const isMissingUserActivityTableError = (err) =>
  err?.code === "ER_NO_SUCH_TABLE" ||
  (typeof err?.message === "string" &&
    err.message.toLowerCase().includes("user_activity_logs"));

export const recordUserActivity = async ({
  userId,
  activityType,
  title,
  description = null,
  ipAddress = null,
  userAgent = null,
  metadata = null,
  occurredAt = null,
}) => {
  const normalizedUserId = normalizeString(userId);
  const normalizedActivityType = normalizeString(activityType).toLowerCase();
  const normalizedTitle = normalizeString(title);

  if (!normalizedUserId) {
    const err = new Error("Activity user id is required.");
    err.code = "ACTIVITY_USER_ID_REQUIRED";
    err.status = 400;
    throw err;
  }
  if (!normalizedActivityType) {
    const err = new Error("Activity type is required.");
    err.code = "ACTIVITY_TYPE_REQUIRED";
    err.status = 400;
    throw err;
  }
  if (!normalizedTitle) {
    const err = new Error("Activity title is required.");
    err.code = "ACTIVITY_TITLE_REQUIRED";
    err.status = 400;
    throw err;
  }

  const db = await getDatabase();
  const activityId = buildActivityId();
  const normalizedDescription = normalizeString(description) || null;
  const normalizedIp = normalizeIpAddress(ipAddress);
  const normalizedAgent = normalizeUserAgent(userAgent);
  const serializedMetadata = serializeMetadata(metadata);
  const normalizedOccurredAt = normalizeTimestamp(occurredAt);

  if (normalizedOccurredAt) {
    await db.execute(
      `INSERT INTO user_activity_logs
        (activity_id, user_id, activity_type, title, description, ip_address, user_agent, metadata_json, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        activityId,
        normalizedUserId,
        normalizedActivityType,
        normalizedTitle.slice(0, 255),
        normalizedDescription ? normalizedDescription.slice(0, 1000) : null,
        normalizedIp,
        normalizedAgent,
        serializedMetadata,
        normalizedOccurredAt,
      ]
    );
  } else {
    await db.execute(
      `INSERT INTO user_activity_logs
        (activity_id, user_id, activity_type, title, description, ip_address, user_agent, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        activityId,
        normalizedUserId,
        normalizedActivityType,
        normalizedTitle.slice(0, 255),
        normalizedDescription ? normalizedDescription.slice(0, 1000) : null,
        normalizedIp,
        normalizedAgent,
        serializedMetadata,
      ]
    );
  }

  return activityId;
};

export const recordUserActivitySafely = async (payload) => {
  try {
    return await recordUserActivity(payload);
  } catch (err) {
    if (isMissingUserActivityTableError(err)) {
      console.warn("user_activity_logs table missing; skipping activity write.");
      return null;
    }
    console.error("Failed to record user activity:", err.message || err);
    return null;
  }
};

export const fetchRecentUserActivity = async ({ userId, limit = DEFAULT_ACTIVITY_LIMIT }) => {
  const normalizedUserId = normalizeString(userId);
  if (!normalizedUserId) return [];

  const db = await getDatabase();
  try {
    const [rows] = await db.execute(
      `SELECT
          activity_id AS activityId,
          activity_type AS activityType,
          title AS title,
          description AS description,
          ip_address AS ipAddress,
          user_agent AS userAgent,
          metadata_json AS metadataJson,
          occurred_at AS occurredAt
       FROM user_activity_logs
       WHERE user_id = ?
       ORDER BY occurred_at DESC, id DESC
       LIMIT ?`,
      [normalizedUserId, normalizeLimit(limit)]
    );

    return rows.map((row) => ({
      activityId: row.activityId,
      activityType: row.activityType,
      title: row.title,
      description: row.description || null,
      ipAddress: row.ipAddress || null,
      userAgent: row.userAgent || null,
      metadata: parseMetadata(row.metadataJson),
      occurredAt: row.occurredAt || null,
    }));
  } catch (err) {
    if (isMissingUserActivityTableError(err)) {
      return [];
    }
    throw err;
  }
};
