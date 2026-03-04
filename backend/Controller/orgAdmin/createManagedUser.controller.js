import validator from "validator";
import {
  assignAdminToOrganization,
  assertManagedAdminEmailDomainMatch,
  findOrganizationOwnedByUser,
} from "../../Services/orgAdmin.service.js";
import { USER_ROLES, registerUser } from "../../Services/user.service.js";
import { createNotificationSafely } from "../../Services/notification.service.js";
import { rejectNonSuperAdmin } from "./shared.js";

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
    await createNotificationSafely({
      userId: createdUser.user_id,
      actorUserId: req.user?.user_id,
      type: "account.created_by_super_admin",
      severity: "info",
      title: "Admin Account Provisioned",
      message: `Your admin account was created and assigned to ${superAdminOrganization.orgName || "the organization"}.`,
      metadata: {
        orgId: superAdminOrganization.orgId,
        orgName: superAdminOrganization.orgName || null,
      },
    });
    await createNotificationSafely({
      userId: req.user?.user_id,
      actorUserId: req.user?.user_id,
      type: "account.admin_created",
      severity: "success",
      title: "Managed User Created",
      message: `Admin user ${createdUser.email} was created successfully.`,
      metadata: {
        managedUserId: createdUser.user_id,
        orgId: superAdminOrganization.orgId,
      },
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
