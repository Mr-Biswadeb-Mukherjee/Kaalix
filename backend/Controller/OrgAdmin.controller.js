import {
  assignAdminToOrganization,
  assertManagedAdminEmailDomainMatch,
  assignOrganizationAdmins,
  fetchOrganizationAdminMatrix,
  findOrganizationOwnedByUser,
  updateManagedAdminAccountStatus,
} from "../Services/orgAdmin.service.js";
import {
  USER_ROLES,
  registerUser,
} from "../Services/user.service.js";
import validator from "validator";

const isSuperAdmin = (req) => req.user?.role === "sa";

const rejectNonSuperAdmin = (req, res) => {
  if (isSuperAdmin(req)) return false;
  res.status(403).json({
    success: false,
    message: "Forbidden. Super admin access required.",
  });
  return true;
};

export const FetchOrganizationAdmins = async (req, res) => {
  if (rejectNonSuperAdmin(req, res)) return;

  try {
    const data = await fetchOrganizationAdminMatrix();
    return res.status(200).json({
      success: true,
      ...data,
    });
  } catch (err) {
    console.error("Error in FetchOrganizationAdmins:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

export const UpdateOrganizationAdmins = async (req, res) => {
  if (rejectNonSuperAdmin(req, res)) return;

  const orgId = req.body?.orgId;
  const adminUserIds =
    typeof req.body?.adminUserIds === "undefined" ? [] : req.body?.adminUserIds;

  if (!Array.isArray(adminUserIds)) {
    return res.status(400).json({
      success: false,
      message: "adminUserIds must be an array.",
    });
  }

  try {
    await assignOrganizationAdmins({
      orgId,
      adminUserIds,
      assignedBy: req.user?.user_id,
    });
    const data = await fetchOrganizationAdminMatrix();

    return res.status(200).json({
      success: true,
      message: "Organization admin assignments updated.",
      ...data,
    });
  } catch (err) {
    console.error("Error in UpdateOrganizationAdmins:", err);
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || "Internal server error.",
      code: err.code || "INTERNAL_SERVER_ERROR",
    });
  }
};

export const CreateManagedUser = async (req, res) => {
  if (rejectNonSuperAdmin(req, res)) return;

  const superAdminUserId =
    typeof req.user?.user_id === "string" ? req.user.user_id.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password.trim() : "";
  const fullName = typeof req.body?.fullName === "string" ? req.body.fullName.trim() : "";

  if (!email || !validator.isEmail(email)) {
    return res.status(400).json({
      success: false,
      message: "Valid email is required.",
      code: "EMAIL_REQUIRED",
    });
  }

  if (!password || password.length < 8) {
    return res.status(400).json({
      success: false,
      message: "Password is required and must be at least 8 characters.",
      code: "PASSWORD_TOO_SHORT",
    });
  }

  try {
    const superAdminOrganization = await findOrganizationOwnedByUser({
      ownerUserId: superAdminUserId,
    });

    if (!superAdminOrganization?.orgId) {
      return res.status(409).json({
        success: false,
        message:
          "Super admin organization is not configured. Update super admin profile organization details first.",
        code: "SUPER_ADMIN_ORG_NOT_FOUND",
      });
    }

    assertManagedAdminEmailDomainMatch({
      adminEmail: email,
      orgWebsite: superAdminOrganization.orgWebsite,
      orgEmail: superAdminOrganization.orgEmail,
    });

    const createdUser = await registerUser({
      fullName: fullName || email.split("@")[0],
      email,
      password,
      role: USER_ROLES.ADMIN,
    });

    await assignAdminToOrganization({
      orgId: superAdminOrganization.orgId,
      adminUserId: createdUser.user_id,
      assignedBy: superAdminUserId,
    });

    return res.status(201).json({
      success: true,
      message: `Admin user created and assigned to ${superAdminOrganization.orgName || "super admin organization"} successfully.`,
      user: {
        user_id: createdUser.user_id,
        email: createdUser.email,
        role: createdUser.role,
      },
      assignedOrg: {
        orgId: superAdminOrganization.orgId,
        orgName: superAdminOrganization.orgName || null,
      },
    });
  } catch (err) {
    console.error("Error in CreateManagedUser:", err);
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || "Internal server error.",
      code: err.code || "INTERNAL_SERVER_ERROR",
    });
  }
};

export const ManageAdminAccount = async (req, res) => {
  if (rejectNonSuperAdmin(req, res)) return;

  const adminUserId =
    typeof req.body?.adminUserId === "string" ? req.body.adminUserId.trim() : "";
  const action =
    typeof req.body?.action === "string" ? req.body.action.trim().toLowerCase() : "";

  if (!adminUserId) {
    return res.status(400).json({
      success: false,
      message: "adminUserId is required.",
      code: "ADMIN_USER_ID_REQUIRED",
    });
  }
  if (!action) {
    return res.status(400).json({
      success: false,
      message: "action is required.",
      code: "INVALID_ADMIN_ACTION",
    });
  }

  try {
    const result = await updateManagedAdminAccountStatus({
      adminUserId,
      action,
      actedBy: req.user?.user_id,
    });
    const data = await fetchOrganizationAdminMatrix();
    const actionLabel = result.action === "delete"
      ? "soft-deleted"
      : result.action === "block"
        ? "blocked"
        : result.action === "restore"
          ? "restored"
          : "unblocked";

    return res.status(200).json({
      success: true,
      message: `Admin ${result.email || result.adminUserId} ${actionLabel} successfully.`,
      action: result.action,
      adminUserId: result.adminUserId,
      accountStatus: result.accountStatus,
      deletedAt: result.deletedAt || null,
      permanentDeleteAt: result.permanentDeleteAt || null,
      daysUntilPermanentDelete: result.daysUntilPermanentDelete ?? null,
      ...data,
    });
  } catch (err) {
    console.error("Error in ManageAdminAccount:", err);
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || "Internal server error.",
      code: err.code || "INTERNAL_SERVER_ERROR",
    });
  }
};
