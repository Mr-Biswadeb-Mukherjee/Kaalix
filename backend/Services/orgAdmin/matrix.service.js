import { getDatabase } from "../../Connectors/DB.js";
import { purgeExpiredSoftDeletedAdmins } from "../adminLifecycle.service.js";
import { backfillUnassignedAdminsToSuperAdminOrg } from "./assignment.service.js";
import { getSuperAdminOrganizationDetails } from "./organization.service.js";
import {
  ACCOUNT_STATUSES,
  getDaysUntilDeletion,
  toIsoTimestamp,
} from "./shared.js";

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
