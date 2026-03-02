import crypto from "node:crypto";
import { getDatabase } from "../Connectors/DB.js";
import { emitNotificationsChanged } from "../Realtime/realtime.bus.js";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

const SEVERITIES = new Set(["info", "success", "warning", "critical"]);
const USER_ROLES = Object.freeze({
  SA: "sa",
  ADMIN: "admin",
});

export const NOTIFICATION_RBAC_SCOPES = Object.freeze({
  SELF: "self",
  SELF_AND_SUPER_ADMINS: "self_and_super_admins",
  SUPER_ADMINS_ONLY: "super_admins_only",
});
const allowedRbacScopes = new Set(Object.values(NOTIFICATION_RBAC_SCOPES));

const normalizeString = (value) =>
  typeof value === "string" ? value.trim() : "";

const normalizeSeverity = (value) => {
  const normalized = normalizeString(value).toLowerCase();
  return SEVERITIES.has(normalized) ? normalized : "info";
};

const normalizeLimit = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  if (parsed < 1) return 1;
  if (parsed > MAX_LIMIT) return MAX_LIMIT;
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
  if (typeof metadataJson !== "string" || !metadataJson.trim()) return null;
  try {
    return JSON.parse(metadataJson);
  } catch {
    return null;
  }
};

const buildNotificationId = () =>
  `NTF-${crypto.randomUUID().replace(/-/g, "").slice(0, 24).toUpperCase()}`;

const normalizeUserIdList = (value) => {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => normalizeString(item))
        .filter(Boolean)
    )
  );
};

const normalizeType = (value) => {
  const normalized = normalizeString(value).toLowerCase();
  return normalized || "system";
};

const normalizeRole = (value) => {
  const normalized = normalizeString(value).toLowerCase();
  if (normalized === "super_admin") return USER_ROLES.SA;
  return normalized;
};

const normalizeRbacScope = (value) => {
  const normalized = normalizeString(value).toLowerCase();
  if (!allowedRbacScopes.has(normalized)) {
    return NOTIFICATION_RBAC_SCOPES.SELF;
  }
  return normalized;
};

const listActiveUserIdsByRole = async (role) => {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) return [];

  const db = await getDatabase();
  const [rows] = await db.execute(
    `SELECT user_id AS userId
     FROM users
     WHERE role = ?
       AND COALESCE(account_status, 'active') = 'active'`,
    [normalizedRole]
  );

  return normalizeUserIdList(rows.map((row) => row.userId));
};

const resolveRbacRecipientUserIds = async ({ actorUserId, rbacScope }) => {
  const normalizedActorUserId = normalizeString(actorUserId);
  const scope = normalizeRbacScope(rbacScope);
  const recipients = new Set();

  if (
    scope === NOTIFICATION_RBAC_SCOPES.SELF ||
    scope === NOTIFICATION_RBAC_SCOPES.SELF_AND_SUPER_ADMINS
  ) {
    if (normalizedActorUserId) {
      recipients.add(normalizedActorUserId);
    }
  }

  if (
    scope === NOTIFICATION_RBAC_SCOPES.SUPER_ADMINS_ONLY ||
    scope === NOTIFICATION_RBAC_SCOPES.SELF_AND_SUPER_ADMINS
  ) {
    const superAdminUserIds = await listActiveUserIdsByRole(USER_ROLES.SA);
    for (const userId of superAdminUserIds) {
      recipients.add(userId);
    }
  }

  return Array.from(recipients);
};

export const resolveLoginNotificationScope = (actorRole) => {
  const normalizedRole = normalizeRole(actorRole);
  return normalizedRole === USER_ROLES.ADMIN
    ? NOTIFICATION_RBAC_SCOPES.SELF_AND_SUPER_ADMINS
    : NOTIFICATION_RBAC_SCOPES.SELF;
};

const mapNotificationRow = (row) => ({
  notificationId: row.notificationId,
  type: row.type,
  severity: row.severity,
  title: row.title,
  message: row.message,
  isRead: Number(row.isRead) === 1,
  createdAt: row.createdAt,
  readAt: row.readAt,
  actorUserId: row.actorUserId || null,
  metadata: parseMetadata(row.metadataJson),
});

const isMissingNotificationTableError = (err) =>
  err?.code === "ER_NO_SUCH_TABLE" ||
  (typeof err?.message === "string" &&
    err.message.toLowerCase().includes("notifications"));

export const createNotification = async ({
  userId,
  actorUserId = null,
  type = "system",
  severity = "info",
  title,
  message,
  metadata = null,
}) => {
  const normalizedUserId = normalizeString(userId);
  const normalizedActorUserId = normalizeString(actorUserId) || null;
  const normalizedTitle = normalizeString(title);
  const normalizedMessage = normalizeString(message);

  if (!normalizedUserId) {
    const err = new Error("Notification user id is required.");
    err.code = "NOTIFICATION_USER_ID_REQUIRED";
    err.status = 400;
    throw err;
  }
  if (!normalizedTitle) {
    const err = new Error("Notification title is required.");
    err.code = "NOTIFICATION_TITLE_REQUIRED";
    err.status = 400;
    throw err;
  }
  if (!normalizedMessage) {
    const err = new Error("Notification message is required.");
    err.code = "NOTIFICATION_MESSAGE_REQUIRED";
    err.status = 400;
    throw err;
  }

  const db = await getDatabase();
  const notificationId = buildNotificationId();

  await db.execute(
    `INSERT INTO notifications
      (notification_id, user_id, actor_user_id, type, severity, title, message, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      notificationId,
      normalizedUserId,
      normalizedActorUserId,
      normalizeType(type),
      normalizeSeverity(severity),
      normalizedTitle.slice(0, 255),
      normalizedMessage.slice(0, 1000),
      serializeMetadata(metadata),
    ]
  );

  emitNotificationsChanged(normalizedUserId);

  return notificationId;
};

export const createNotificationsForUsers = async ({
  userIds,
  actorUserId = null,
  type = "system",
  severity = "info",
  title,
  message,
  metadata = null,
}) => {
  const normalizedUserIds = normalizeUserIdList(userIds);
  if (normalizedUserIds.length === 0) return [];

  const normalizedActorUserId = normalizeString(actorUserId) || null;
  const normalizedTitle = normalizeString(title);
  const normalizedMessage = normalizeString(message);

  if (!normalizedTitle) {
    const err = new Error("Notification title is required.");
    err.code = "NOTIFICATION_TITLE_REQUIRED";
    err.status = 400;
    throw err;
  }
  if (!normalizedMessage) {
    const err = new Error("Notification message is required.");
    err.code = "NOTIFICATION_MESSAGE_REQUIRED";
    err.status = 400;
    throw err;
  }

  const db = await getDatabase();
  const placeholders = normalizedUserIds.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
  const values = [];
  const createdIds = [];

  for (const userId of normalizedUserIds) {
    const notificationId = buildNotificationId();
    createdIds.push(notificationId);
    values.push(
      notificationId,
      userId,
      normalizedActorUserId,
      normalizeType(type),
      normalizeSeverity(severity),
      normalizedTitle.slice(0, 255),
      normalizedMessage.slice(0, 1000),
      serializeMetadata(metadata)
    );
  }

  await db.execute(
    `INSERT INTO notifications
      (notification_id, user_id, actor_user_id, type, severity, title, message, metadata_json)
     VALUES ${placeholders}`,
    values
  );

  for (const userId of normalizedUserIds) {
    emitNotificationsChanged(userId);
  }

  return createdIds;
};

export const createRbacNotification = async ({
  actorUserId = null,
  rbacScope = NOTIFICATION_RBAC_SCOPES.SELF,
  type = "system",
  severity = "info",
  title,
  message,
  metadata = null,
}) => {
  const normalizedActorUserId = normalizeString(actorUserId) || null;
  const recipientUserIds = await resolveRbacRecipientUserIds({
    actorUserId: normalizedActorUserId,
    rbacScope,
  });

  if (recipientUserIds.length === 0) return [];

  return createNotificationsForUsers({
    userIds: recipientUserIds,
    actorUserId: normalizedActorUserId,
    type,
    severity,
    title,
    message,
    metadata,
  });
};

export const createNotificationSafely = async (payload) => {
  try {
    return await createNotification(payload);
  } catch (err) {
    console.error("Failed to create notification:", err.message || err);
    return null;
  }
};

export const createNotificationsForUsersSafely = async (payload) => {
  try {
    return await createNotificationsForUsers(payload);
  } catch (err) {
    console.error("Failed to create notifications:", err.message || err);
    return [];
  }
};

export const createRbacNotificationSafely = async (payload) => {
  try {
    return await createRbacNotification(payload);
  } catch (err) {
    console.error("Failed to create RBAC notification:", err.message || err);
    return [];
  }
};

export const listNotifications = async ({ userId, limit = DEFAULT_LIMIT } = {}) => {
  const normalizedUserId = normalizeString(userId);
  if (!normalizedUserId) return [];

  const db = await getDatabase();
  try {
    const [rows] = await db.execute(
      `SELECT
          notification_id AS notificationId,
          actor_user_id AS actorUserId,
          type,
          severity,
          title,
          message,
          metadata_json AS metadataJson,
          is_read AS isRead,
          read_at AS readAt,
          created_at AS createdAt
       FROM notifications
       WHERE user_id = ?
       ORDER BY is_read ASC, created_at DESC
       LIMIT ?`,
      [normalizedUserId, normalizeLimit(limit)]
    );

    return rows.map(mapNotificationRow);
  } catch (err) {
    if (isMissingNotificationTableError(err)) return [];
    throw err;
  }
};

export const getUnreadNotificationCount = async (userId) => {
  const normalizedUserId = normalizeString(userId);
  if (!normalizedUserId) return 0;

  const db = await getDatabase();
  try {
    const [[row]] = await db.execute(
      `SELECT COUNT(*) AS total
       FROM notifications
       WHERE user_id = ?
         AND is_read = 0`,
      [normalizedUserId]
    );

    return Number(row?.total) || 0;
  } catch (err) {
    if (isMissingNotificationTableError(err)) return 0;
    throw err;
  }
};

export const markNotificationRead = async ({ userId, notificationId }) => {
  const normalizedUserId = normalizeString(userId);
  const normalizedNotificationId = normalizeString(notificationId);

  if (!normalizedUserId || !normalizedNotificationId) {
    return {
      found: false,
      updated: false,
      alreadyRead: false,
    };
  }

  const db = await getDatabase();
  let rows;
  try {
    const [queryRows] = await db.execute(
      `SELECT is_read AS isRead
       FROM notifications
       WHERE user_id = ?
         AND notification_id = ?
       LIMIT 1`,
      [normalizedUserId, normalizedNotificationId]
    );
    rows = queryRows;
  } catch (err) {
    if (isMissingNotificationTableError(err)) {
      return {
        found: false,
        updated: false,
        alreadyRead: false,
      };
    }
    throw err;
  }

  if (!rows[0]) {
    return {
      found: false,
      updated: false,
      alreadyRead: false,
    };
  }

  if (Number(rows[0].isRead) === 1) {
    return {
      found: true,
      updated: false,
      alreadyRead: true,
    };
  }

  try {
    await db.execute(
      `UPDATE notifications
       SET is_read = 1,
           read_at = UTC_TIMESTAMP(),
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?
         AND notification_id = ?
         AND is_read = 0`,
      [normalizedUserId, normalizedNotificationId]
    );
  } catch (err) {
    if (isMissingNotificationTableError(err)) {
      return {
        found: false,
        updated: false,
        alreadyRead: false,
      };
    }
    throw err;
  }

  emitNotificationsChanged(normalizedUserId);

  return {
    found: true,
    updated: true,
    alreadyRead: false,
  };
};

export const markAllNotificationsRead = async (userId) => {
  const normalizedUserId = normalizeString(userId);
  if (!normalizedUserId) return 0;

  const db = await getDatabase();
  try {
    const [result] = await db.execute(
      `UPDATE notifications
       SET is_read = 1,
           read_at = UTC_TIMESTAMP(),
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?
         AND is_read = 0`,
      [normalizedUserId]
    );

    const updated = Number(result?.affectedRows) || 0;
    if (updated > 0) {
      emitNotificationsChanged(normalizedUserId);
    }
    return updated;
  } catch (err) {
    if (isMissingNotificationTableError(err)) return 0;
    throw err;
  }
};
