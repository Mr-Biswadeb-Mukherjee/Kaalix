import { getDatabase } from "../Connectors/DB.js";

export const ADMIN_SOFT_DELETE_GRACE_DAYS = 30;

const PURGE_INTERVAL_MS = 60 * 60 * 1000;
const PURGE_THROTTLE_MS = 5 * 60 * 1000;

let lastPurgeAtMs = 0;
let purgeInFlight = null;
let purgeTimer = null;

const executePurgeQuery = async (executor) => {
  const [result] = await executor.execute(
    `DELETE FROM users
     WHERE role = 'admin'
       AND COALESCE(account_status, 'active') = 'deleted'
       AND hard_delete_at IS NOT NULL
       AND hard_delete_at <= UTC_TIMESTAMP()`
  );
  return Number(result?.affectedRows) || 0;
};

export const purgeExpiredSoftDeletedAdmins = async ({ executor } = {}) => {
  if (executor && typeof executor.execute === "function") {
    return executePurgeQuery(executor);
  }

  const db = await getDatabase();
  return executePurgeQuery(db);
};

export const purgeExpiredSoftDeletedAdminsIfDue = async ({
  force = false,
} = {}) => {
  const now = Date.now();
  if (!force && now - lastPurgeAtMs < PURGE_THROTTLE_MS) {
    return 0;
  }

  if (purgeInFlight) return purgeInFlight;

  purgeInFlight = (async () => {
    try {
      return await purgeExpiredSoftDeletedAdmins();
    } finally {
      lastPurgeAtMs = Date.now();
      purgeInFlight = null;
    }
  })();

  return purgeInFlight;
};

export const startAdminSoftDeletePurgeJob = () => {
  if (purgeTimer) return purgeTimer;

  purgeExpiredSoftDeletedAdminsIfDue({ force: true }).catch((err) => {
    console.error("Soft-delete purge warmup failed:", err.message);
  });

  purgeTimer = setInterval(() => {
    purgeExpiredSoftDeletedAdminsIfDue({ force: true }).catch((err) => {
      console.error("Soft-delete purge failed:", err.message);
    });
  }, PURGE_INTERVAL_MS);

  if (typeof purgeTimer.unref === "function") {
    purgeTimer.unref();
  }

  return purgeTimer;
};
