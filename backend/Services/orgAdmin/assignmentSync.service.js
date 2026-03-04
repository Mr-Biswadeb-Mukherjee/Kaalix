import { getDatabase } from "../../Connectors/DB.js";
import { purgeExpiredSoftDeletedAdmins } from "../adminLifecycle.service.js";
import {
  MAX_ASSIGNABLE_ADMINS,
  normalizeIdList,
} from "./shared.js";

export const assignOrganizationAdmins = async ({
  orgId,
  adminUserIds = [],
  assignedBy,
}) => {
  const normalizedOrgId =
    typeof orgId === "string" ? orgId.trim() : "";
  const normalizedAssignedBy =
    typeof assignedBy === "string" ? assignedBy.trim() : "";
  const normalizedAdminIds = normalizeIdList(adminUserIds);

  if (!normalizedOrgId) {
    const err = new Error("Organization id is required.");
    err.code = "ORG_ID_REQUIRED";
    err.status = 400;
    throw err;
  }
  if (!normalizedAssignedBy) {
    const err = new Error("Assigned-by user id is required.");
    err.code = "ASSIGNED_BY_REQUIRED";
    err.status = 400;
    throw err;
  }
  if (normalizedAdminIds.length > MAX_ASSIGNABLE_ADMINS) {
    const err = new Error(
      `Too many admins selected. Max allowed is ${MAX_ASSIGNABLE_ADMINS}.`
    );
    err.code = "TOO_MANY_ADMINS";
    err.status = 400;
    throw err;
  }

  const db = await getDatabase();
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();
    await purgeExpiredSoftDeletedAdmins({ executor: conn });

    const [[organizationRow]] = await conn.execute(
      "SELECT org_id FROM organizations WHERE org_id = ? LIMIT 1 FOR UPDATE",
      [normalizedOrgId]
    );

    if (!organizationRow) {
      const err = new Error("Organization not found.");
      err.code = "ORG_NOT_FOUND";
      err.status = 404;
      throw err;
    }

    const [existingAssignmentRows] = await conn.execute(
      `SELECT oa.admin_user_id AS userId
       FROM organization_admins oa
       INNER JOIN users u ON u.user_id = oa.admin_user_id
       WHERE oa.org_id = ?
         AND u.role = 'admin'
         AND COALESCE(u.account_status, 'active') = 'active'`,
      [normalizedOrgId]
    );
    const previousAdminUserIds = existingAssignmentRows.map((row) => row.userId);
    const previousAdminSet = new Set(previousAdminUserIds);
    const nextAdminSet = new Set(normalizedAdminIds);

    if (normalizedAdminIds.length > 0) {
      const placeholders = normalizedAdminIds.map(() => "?").join(", ");
      const [adminRows] = await conn.execute(
        `SELECT user_id
         FROM users
         WHERE role = 'admin'
           AND COALESCE(account_status, 'active') = 'active'
           AND user_id IN (${placeholders})`,
        normalizedAdminIds
      );

      const validAdminSet = new Set(adminRows.map((row) => row.user_id));
      const invalidAdmins = normalizedAdminIds.filter(
        (adminId) => !validAdminSet.has(adminId)
      );

      if (invalidAdmins.length > 0) {
        const err = new Error(
          `Invalid or inactive admin user id(s): ${invalidAdmins.join(", ")}`
        );
        err.code = "INVALID_ADMIN_IDS";
        err.status = 400;
        throw err;
      }
    }

    await conn.execute(
      `DELETE oa
       FROM organization_admins oa
       INNER JOIN users u ON u.user_id = oa.admin_user_id
       WHERE oa.org_id = ?
         AND u.role = 'admin'
         AND COALESCE(u.account_status, 'active') = 'active'`,
      [normalizedOrgId]
    );

    if (normalizedAdminIds.length > 0) {
      const values = [];
      const tuplePlaceholders = normalizedAdminIds
        .map((adminId) => {
          values.push(normalizedOrgId, adminId, normalizedAssignedBy);
          return "(?, ?, ?)";
        })
        .join(", ");

      await conn.execute(
        `INSERT IGNORE INTO organization_admins (org_id, admin_user_id, assigned_by)
         VALUES ${tuplePlaceholders}`,
        values
      );
    }

    await conn.commit();
    const addedAdminUserIds = normalizedAdminIds.filter(
      (adminId) => !previousAdminSet.has(adminId)
    );
    const removedAdminUserIds = previousAdminUserIds.filter(
      (adminId) => !nextAdminSet.has(adminId)
    );

    return {
      assignedAdminUserIds: normalizedAdminIds,
      addedAdminUserIds,
      removedAdminUserIds,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};
