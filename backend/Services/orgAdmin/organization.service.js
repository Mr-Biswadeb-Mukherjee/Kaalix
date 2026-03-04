import { getDatabase } from "../../Connectors/DB.js";
import {
  getDomainFromEmail,
  getDomainFromWebsite,
} from "../../Utils/domain.utils.js";
import { ORG_EMAIL_DOMAIN_MISMATCH_MESSAGE } from "./shared.js";

export const getSuperAdminOrganizationDetails = async (executor) => {
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

export const getSuperAdminOrganization = async (executor) => {
  const details = await getSuperAdminOrganizationDetails(executor);
  return details?.orgId || null;
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
