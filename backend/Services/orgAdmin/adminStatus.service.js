import { getDatabase } from "../../Connectors/DB.js";
import {
  ADMIN_SOFT_DELETE_GRACE_DAYS,
  purgeExpiredSoftDeletedAdmins,
} from "../adminLifecycle.service.js";
import {
  ACCOUNT_STATUSES,
  ADMIN_ACTIONS,
  getDaysUntilDeletion,
  toIsoTimestamp,
} from "./shared.js";

export const updateManagedAdminAccountStatus = async ({
  adminUserId,
  action,
  actedBy,
}) => {
  const normalizedAdminUserId =
    typeof adminUserId === "string" ? adminUserId.trim() : "";
  const normalizedAction =
    typeof action === "string" ? action.trim().toLowerCase() : "";
  const normalizedActedBy =
    typeof actedBy === "string" ? actedBy.trim() : "";

  if (!normalizedAdminUserId) {
    const err = new Error("Admin user id is required.");
    err.code = "ADMIN_USER_ID_REQUIRED";
    err.status = 400;
    throw err;
  }
  if (!Object.values(ADMIN_ACTIONS).includes(normalizedAction)) {
    const err = new Error("Invalid action. Allowed actions: block, unblock, delete, restore.");
    err.code = "INVALID_ADMIN_ACTION";
    err.status = 400;
    throw err;
  }
  if (!normalizedActedBy) {
    const err = new Error("Acted-by user id is required.");
    err.code = "ACTED_BY_REQUIRED";
    err.status = 400;
    throw err;
  }

  const db = await getDatabase();
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();
    await purgeExpiredSoftDeletedAdmins({ executor: conn });

    const [[adminRow]] = await conn.execute(
      `SELECT
          user_id AS userId,
          role AS role,
          email AS email,
          COALESCE(account_status, 'active') AS accountStatus,
          deleted_at AS deletedAt,
          hard_delete_at AS hardDeleteAt
       FROM users
       WHERE user_id = ?
       LIMIT 1
       FOR UPDATE`,
      [normalizedAdminUserId]
    );

    if (!adminRow) {
      const err = new Error("Admin user not found.");
      err.code = "ADMIN_NOT_FOUND";
      err.status = 404;
      throw err;
    }
    if (adminRow.role !== "admin") {
      const err = new Error("Only admin users can be managed from this section.");
      err.code = "TARGET_NOT_ADMIN";
      err.status = 400;
      throw err;
    }

    const currentStatus = adminRow.accountStatus || ACCOUNT_STATUSES.ACTIVE;
    if (
      currentStatus === ACCOUNT_STATUSES.DELETED &&
      [ADMIN_ACTIONS.BLOCK, ADMIN_ACTIONS.UNBLOCK].includes(normalizedAction)
    ) {
      const err = new Error("Soft-deleted admin accounts must be restored before other updates.");
      err.code = "ADMIN_SOFT_DELETED";
      err.status = 409;
      throw err;
    }
    if (
      normalizedAction === ADMIN_ACTIONS.RESTORE &&
      currentStatus !== ACCOUNT_STATUSES.DELETED
    ) {
      const err = new Error("Only soft-deleted admin accounts can be restored.");
      err.code = "ADMIN_NOT_SOFT_DELETED";
      err.status = 409;
      throw err;
    }

    if (
      normalizedAction === ADMIN_ACTIONS.DELETE &&
      currentStatus !== ACCOUNT_STATUSES.DELETED
    ) {
      await conn.execute(
        `UPDATE users
         SET
           account_status = 'deleted',
           deleted_at = UTC_TIMESTAMP(),
           hard_delete_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ${ADMIN_SOFT_DELETE_GRACE_DAYS} DAY),
           failed_attempts = 0,
           lock_until = NULL,
           updated_at = NOW()
         WHERE user_id = ?`,
        [normalizedAdminUserId]
      );
    } else if (normalizedAction === ADMIN_ACTIONS.DELETE) {
      await conn.execute(
        `UPDATE users
         SET
           deleted_at = COALESCE(deleted_at, UTC_TIMESTAMP()),
           hard_delete_at = COALESCE(
             hard_delete_at,
             DATE_ADD(COALESCE(deleted_at, UTC_TIMESTAMP()), INTERVAL ${ADMIN_SOFT_DELETE_GRACE_DAYS} DAY)
           ),
           failed_attempts = 0,
           lock_until = NULL,
           updated_at = NOW()
         WHERE user_id = ?`,
        [normalizedAdminUserId]
      );
    } else if (normalizedAction === ADMIN_ACTIONS.RESTORE) {
      await conn.execute(
        `UPDATE users
         SET
           account_status = 'active',
           deleted_at = NULL,
           hard_delete_at = NULL,
           failed_attempts = 0,
           lock_until = NULL,
           updated_at = NOW()
         WHERE user_id = ?`,
        [normalizedAdminUserId]
      );
    } else {
      const nextStatus =
        normalizedAction === ADMIN_ACTIONS.BLOCK
          ? ACCOUNT_STATUSES.BLOCKED
          : ACCOUNT_STATUSES.ACTIVE;
      await conn.execute(
        `UPDATE users
         SET
           account_status = ?,
           deleted_at = NULL,
           hard_delete_at = NULL,
           failed_attempts = 0,
           lock_until = NULL,
           updated_at = NOW()
         WHERE user_id = ?`,
        [nextStatus, normalizedAdminUserId]
      );
    }

    const [[updatedAdminRow]] = await conn.execute(
      `SELECT
          COALESCE(account_status, 'active') AS accountStatus,
          deleted_at AS deletedAt,
          hard_delete_at AS hardDeleteAt
       FROM users
       WHERE user_id = ?
       LIMIT 1`,
      [normalizedAdminUserId]
    );

    if (!updatedAdminRow) {
      const err = new Error("Admin user not found.");
      err.code = "ADMIN_NOT_FOUND";
      err.status = 404;
      throw err;
    }

    await conn.commit();

    const normalizedNextStatus =
      updatedAdminRow.accountStatus || ACCOUNT_STATUSES.ACTIVE;
    const permanentDeleteAt = toIsoTimestamp(updatedAdminRow.hardDeleteAt);

    return {
      adminUserId: normalizedAdminUserId,
      email: adminRow.email,
      previousStatus: currentStatus,
      accountStatus: normalizedNextStatus,
      action: normalizedAction,
      deletedAt: toIsoTimestamp(updatedAdminRow.deletedAt),
      permanentDeleteAt,
      daysUntilPermanentDelete:
        normalizedNextStatus === ACCOUNT_STATUSES.DELETED
          ? getDaysUntilDeletion(updatedAdminRow.hardDeleteAt)
          : null,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};
