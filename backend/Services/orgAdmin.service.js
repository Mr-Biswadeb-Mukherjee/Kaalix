import { getDatabase } from "../Connectors/DB.js";
import {
  ADMIN_SOFT_DELETE_GRACE_DAYS,
  purgeExpiredSoftDeletedAdmins,
} from "./adminLifecycle.service.js";
import {
  getDomainFromEmail,
  getDomainFromWebsite,
} from "../Utils/domain.utils.js";

const MAX_ASSIGNABLE_ADMINS = 250;
const ADMIN_ACTIONS = Object.freeze({
  BLOCK: "block",
  UNBLOCK: "unblock",
  DELETE: "delete",
  RESTORE: "restore",
});
const ACCOUNT_STATUSES = Object.freeze({
  ACTIVE: "active",
  BLOCKED: "blocked",
  DELETED: "deleted",
});
const ORG_EMAIL_DOMAIN_MISMATCH_MESSAGE =
  "Admin email domain must match the super admin organization domain.";

const normalizeIdList = (value) => {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    )
  );
};

const toIsoTimestamp = (value) => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const getDaysUntilDeletion = (value) => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const diffMs = parsed.getTime() - Date.now();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
};

const getSuperAdminOrganizationDetails = async (executor) => {
  const db = executor || (await getDatabase());
  const [rows] = await db.execute(
    `SELECT
        o.org_id AS orgId,
        o.org_name AS orgName,
        o.org_website AS orgWebsite,
        o.org_email AS orgEmail
     FROM organizations o
     INNER JOIN users u ON u.user_id = o.user_id
     WHERE u.role = 'sa'
     ORDER BY o.updated_at DESC, o.id DESC
     LIMIT 1`
  );
  return rows[0] || null;
};

const getSuperAdminOrganization = async (executor) => {
  const details = await getSuperAdminOrganizationDetails(executor);
  return details?.orgId || null;
};

const backfillUnassignedAdminsToSuperAdminOrg = async () => {
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

export const findOrganizationOwnedByUser = async ({
  ownerUserId,
  executor,
}) => {
  const normalizedOwnerUserId =
    typeof ownerUserId === "string" ? ownerUserId.trim() : "";
  if (!normalizedOwnerUserId) {
    const err = new Error("Owner user id is required.");
    err.code = "OWNER_USER_ID_REQUIRED";
    err.status = 400;
    throw err;
  }

  const db = executor || (await getDatabase());
  const [rows] = await db.execute(
    `SELECT
        org_id AS orgId,
        org_name AS orgName,
        org_website AS orgWebsite,
        org_email AS orgEmail
     FROM organizations
     WHERE user_id = ?
     LIMIT 1`,
    [normalizedOwnerUserId]
  );

  return rows[0]
    ? {
        orgId: rows[0].orgId,
        orgName: rows[0].orgName || null,
        orgWebsite: rows[0].orgWebsite || null,
        orgEmail: rows[0].orgEmail || null,
      }
    : null;
};

export const assertManagedAdminEmailDomainMatch = ({
  adminEmail,
  orgWebsite,
  orgEmail,
}) => {
  const adminDomain = getDomainFromEmail(adminEmail);
  if (!adminDomain) return;

  const orgWebsiteDomain = getDomainFromWebsite(orgWebsite);
  const orgEmailDomain = getDomainFromEmail(orgEmail);

  if (orgWebsiteDomain && orgEmailDomain && orgWebsiteDomain !== orgEmailDomain) {
    const err = new Error(
      "Super admin organization website/email domain mismatch. Update super admin profile organization details first."
    );
    err.code = "SUPER_ADMIN_ORG_DOMAIN_MISMATCH";
    err.status = 409;
    throw err;
  }

  const expectedDomain = orgWebsiteDomain || orgEmailDomain;
  if (!expectedDomain) return;

  if (adminDomain !== expectedDomain) {
    const err = new Error(
      `${ORG_EMAIL_DOMAIN_MISMATCH_MESSAGE} Expected @${expectedDomain}.`
    );
    err.code = "MANAGED_ADMIN_EMAIL_DOMAIN_MISMATCH";
    err.status = 400;
    throw err;
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

export const fetchOrganizationAdminMatrix = async () => {
  const db = await getDatabase();
  await purgeExpiredSoftDeletedAdmins();
  await backfillUnassignedAdminsToSuperAdminOrg();
  const superAdminOrganization = await getSuperAdminOrganizationDetails(db);

  const [organizationRows] = await db.execute(
    `SELECT
        o.org_id AS orgId,
        o.org_name AS orgName,
        o.org_website AS orgWebsite,
        o.org_email AS orgEmail,
        o.org_sa AS orgSa,
        COUNT(DISTINCT active_admin.user_id) AS assignedAdminCount
     FROM organizations o
     LEFT JOIN organization_admins oa ON oa.org_id = o.org_id
     LEFT JOIN users active_admin
       ON active_admin.user_id = oa.admin_user_id
      AND active_admin.role = 'admin'
      AND COALESCE(active_admin.account_status, 'active') = 'active'
     GROUP BY o.org_id, o.org_name, o.org_website, o.org_email, o.org_sa
     ORDER BY o.org_name ASC, o.org_id ASC`
  );

  const [adminRows] = await db.execute(
    `SELECT
        u.user_id AS userId,
        u.email AS email,
        COALESCE(
          (
            SELECT NULLIF(TRIM(p.fullName), '')
            FROM profiles p
            WHERE p.user_id = u.user_id
            ORDER BY p.id DESC
            LIMIT 1
          ),
          u.email,
          u.user_id
        ) AS fullName,
        COALESCE(u.account_status, 'active') AS accountStatus,
        u.deleted_at AS deletedAt,
        u.hard_delete_at AS hardDeleteAt
     FROM users u
     WHERE u.role = 'admin'
     ORDER BY fullName ASC, u.email ASC`
  );

  const [assignmentRows] = await db.execute(
    `SELECT
        oa.org_id AS orgId,
        oa.admin_user_id AS userId
     FROM organization_admins oa
     INNER JOIN users u
       ON u.user_id = oa.admin_user_id
      AND u.role = 'admin'
      AND COALESCE(u.account_status, 'active') = 'active'
     ORDER BY oa.org_id ASC`
  );

  const assignments = {};
  const orgIdSet = new Set();
  const adminIdSet = new Set();

  for (const org of organizationRows) {
    assignments[org.orgId] = [];
    orgIdSet.add(org.orgId);
  }

  for (const admin of adminRows) {
    adminIdSet.add(admin.userId);
  }

  for (const row of assignmentRows) {
    if (!orgIdSet.has(row.orgId) || !adminIdSet.has(row.userId)) continue;
    assignments[row.orgId].push(row.userId);
  }

  return {
    superAdminOrganization: superAdminOrganization
      ? {
          orgId: superAdminOrganization.orgId,
          orgName: superAdminOrganization.orgName || null,
          orgWebsite: superAdminOrganization.orgWebsite || null,
          orgEmail: superAdminOrganization.orgEmail || null,
        }
      : null,
    organizations: organizationRows.map((org) => ({
      orgId: org.orgId,
      orgName: org.orgName,
      orgWebsite: org.orgWebsite || null,
      orgEmail: org.orgEmail || null,
      orgSa: org.orgSa || null,
      assignedAdminCount: Number(org.assignedAdminCount) || 0,
    })),
    admins: adminRows.map((admin) => ({
      userId: admin.userId,
      email: admin.email,
      fullName: admin.fullName,
      accountStatus: admin.accountStatus || ACCOUNT_STATUSES.ACTIVE,
      deletedAt: toIsoTimestamp(admin.deletedAt),
      permanentDeleteAt: toIsoTimestamp(admin.hardDeleteAt),
      daysUntilPermanentDelete:
        (admin.accountStatus || ACCOUNT_STATUSES.ACTIVE) === ACCOUNT_STATUSES.DELETED
          ? getDaysUntilDeletion(admin.hardDeleteAt)
          : null,
    })),
    assignments,
  };
};

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
    return normalizedAdminIds;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

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
