import {
  assignOrganizationAdmins,
  fetchOrganizationAdminMatrix,
} from "../../Services/orgAdmin.service.js";
import {
  createNotificationSafely,
  createNotificationsForUsersSafely,
} from "../../Services/notification.service.js";
import { rejectNonSuperAdmin } from "./shared.js";

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
    const assignmentResult = await assignOrganizationAdmins({
      orgId,
      adminUserIds,
      assignedBy: req.user?.user_id,
    });
    const data = await fetchOrganizationAdminMatrix();
    const updatedOrganization = data.organizations.find((org) => org.orgId === orgId);
    const organizationLabel = updatedOrganization?.orgName || orgId;

    if (Array.isArray(assignmentResult?.addedAdminUserIds) && assignmentResult.addedAdminUserIds.length > 0) {
      await createNotificationsForUsersSafely({
        userIds: assignmentResult.addedAdminUserIds,
        actorUserId: req.user?.user_id,
        type: "organization.assignment_added",
        severity: "info",
        title: "Organization Assignment Updated",
        message: `You were assigned to organization ${organizationLabel}.`,
        metadata: { orgId, orgName: updatedOrganization?.orgName || null },
      });
    }

    if (Array.isArray(assignmentResult?.removedAdminUserIds) && assignmentResult.removedAdminUserIds.length > 0) {
      await createNotificationsForUsersSafely({
        userIds: assignmentResult.removedAdminUserIds,
        actorUserId: req.user?.user_id,
        type: "organization.assignment_removed",
        severity: "warning",
        title: "Organization Assignment Updated",
        message: `You were removed from organization ${organizationLabel}.`,
        metadata: { orgId, orgName: updatedOrganization?.orgName || null },
      });
    }

    await createNotificationSafely({
      userId: req.user?.user_id,
      actorUserId: req.user?.user_id,
      type: "organization.assignments_changed",
      severity: "success",
      title: "Organization Assignments Saved",
      message: `Admin assignments for ${organizationLabel} were updated.`,
      metadata: {
        orgId,
        addedCount: assignmentResult?.addedAdminUserIds?.length || 0,
        removedCount: assignmentResult?.removedAdminUserIds?.length || 0,
      },
    });

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
