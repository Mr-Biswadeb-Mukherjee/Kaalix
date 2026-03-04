import { getDatabase } from "../../Connectors/DB.js";
import { getSuperAdminOrganization } from "./organization.service.js";

export const backfillUnassignedAdminsToSuperAdminOrg = async () => {
  const db = await getDatabase();
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();
    const superAdminOrgId = await getSuperAdminOrganization(conn);
    if (!superAdminOrgId) {
      await conn.rollback();
      return;
    }

    await conn.execute(
      `INSERT IGNORE INTO organization_admins (org_id, admin_user_id, assigned_by)
       SELECT ?, u.user_id, o.user_id
       FROM users u
       INNER JOIN organizations o ON o.org_id = ?
       LEFT JOIN organization_admins oa ON oa.admin_user_id = u.user_id
       WHERE u.role = 'admin'
         AND COALESCE(u.account_status, 'active') = 'active'
         AND oa.admin_user_id IS NULL`,
      [superAdminOrgId, superAdminOrgId]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

export const assignAdminToOrganization = async ({
  orgId,
  adminUserId,
  assignedBy,
}) => {
  const normalizedOrgId = typeof orgId === "string" ? orgId.trim() : "";
  const normalizedAdminUserId =
    typeof adminUserId === "string" ? adminUserId.trim() : "";
  const normalizedAssignedBy =
    typeof assignedBy === "string" ? assignedBy.trim() : "";

  if (!normalizedOrgId) {
    const err = new Error("Organization id is required.");
    err.code = "ORG_ID_REQUIRED";
    err.status = 400;
    throw err;
  }
  if (!normalizedAdminUserId) {
    const err = new Error("Admin user id is required.");
    err.code = "ADMIN_USER_ID_REQUIRED";
    err.status = 400;
    throw err;
  }
  if (!normalizedAssignedBy) {
    const err = new Error("Assigned-by user id is required.");
    err.code = "ASSIGNED_BY_REQUIRED";
    err.status = 400;
    throw err;
  }

  const db = await getDatabase();
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [[orgRow]] = await conn.execute(
      `SELECT org_id
       FROM organizations
       WHERE org_id = ?
       LIMIT 1
       FOR UPDATE`,
      [normalizedOrgId]
    );

    if (!orgRow) {
      const err = new Error("Organization not found.");
      err.code = "ORG_NOT_FOUND";
      err.status = 404;
      throw err;
    }

    const [[adminRow]] = await conn.execute(
      `SELECT user_id
       FROM users
       WHERE user_id = ?
         AND role = 'admin'
         AND COALESCE(account_status, 'active') = 'active'
       LIMIT 1
       FOR UPDATE`,
      [normalizedAdminUserId]
    );

    if (!adminRow) {
      const err = new Error("Invalid or inactive admin user.");
      err.code = "INVALID_ADMIN_USER";
      err.status = 400;
      throw err;
    }

    await conn.execute(
      `INSERT IGNORE INTO organization_admins (org_id, admin_user_id, assigned_by)
       VALUES (?, ?, ?)`,
      [normalizedOrgId, normalizedAdminUserId, normalizedAssignedBy]
    );

    await conn.commit();
    return {
      orgId: normalizedOrgId,
      adminUserId: normalizedAdminUserId,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};
