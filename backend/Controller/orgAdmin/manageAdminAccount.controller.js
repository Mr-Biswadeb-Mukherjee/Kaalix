import {
  fetchOrganizationAdminMatrix,
  updateManagedAdminAccountStatus,
} from "../../Services/orgAdmin.service.js";
import { createNotificationSafely } from "../../Services/notification.service.js";
import { rejectNonSuperAdmin } from "./shared.js";

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
    await createNotificationSafely({
      userId: result.adminUserId,
      actorUserId: req.user?.user_id,
      type: "account.status_changed",
      severity: result.action === "delete" || result.action === "block" ? "warning" : "info",
      title: "Account Status Updated",
      message: `Your admin account was ${actionLabel} by super admin.`,
      metadata: {
        action: result.action,
        accountStatus: result.accountStatus,
      },
    });
    await createNotificationSafely({
      userId: req.user?.user_id,
      actorUserId: req.user?.user_id,
      type: "account.status_changed",
      severity: "success",
      title: "Admin Account Updated",
      message: `Admin ${result.email || result.adminUserId} was ${actionLabel} successfully.`,
      metadata: {
        action: result.action,
        targetAdminUserId: result.adminUserId,
      },
    });

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
