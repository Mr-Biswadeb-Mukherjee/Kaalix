import express from "express";
import API from "@amon/shared";
import authMiddleware from "../Middleware/auth.middleware.js";
import { ChangePassword } from "../Controller/ChangePassword.controller.js";
import {
  FetchProfile,
  UpdateProfile,
  UpdateAvatar,
  UpdateLocationConsent,
  UpdatePreciseLocation,
} from "../Controller/Profile.controller.js";
import {
  CreateManagedUser,
  FetchOrganizationAdmins,
  ManageAdminAccount,
  UpdateOrganizationAdmins,
} from "../Controller/OrgAdmin.controller.js";
import {
  CheckIntelConnectivity,
  FetchProtectedSystemStatus,
  SearchIntelGraph,
} from "../Controller/System.controller.js";
import { GetMFAStatus, ToggleMFA, VerifyMFA } from "../Controller/MFA.controller.js";
import { FetchMonitoringSnapshot } from "../Controller/Monitoring.controller.js";
import {
  FetchNotifications,
  FetchUnreadNotificationCount,
  MarkAllNotificationsRead,
  MarkNotificationRead,
} from "../Controller/Notification.controller.js";
import { FetchRecentLoginHistory } from "../Controller/LoginHistory.controller.js";
import { FetchRecentUserActivity } from "../Controller/UserActivity.controller.js";
import { upload, processAvatar, handleUploadErrors } from "../Middleware/upload.middleware.js";

const router = express.Router();
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ===================== Routes =====================

// System status
router.post(
  API.system.protected.status.endpoint,
  authMiddleware({ revoke: false }),
  asyncHandler(FetchProtectedSystemStatus)
);

router.get(
  API.system.protected.intelConnectivity.endpoint,
  authMiddleware({ revoke: false }),
  asyncHandler(CheckIntelConnectivity)
);

router.post(
  API.system.protected.intelSearch.endpoint,
  authMiddleware({ revoke: false }),
  asyncHandler(SearchIntelGraph)
);

// Change password
router.post(
  API.system.protected.changepass.endpoint,
  authMiddleware({ revoke: false, allowDuringOnboarding: true }),
  ChangePassword
);

// Get profile
router.get(
  API.system.protected.getprofile.endpoint,
  authMiddleware({ revoke: false, allowDuringOnboarding: true }),
  FetchProfile
);

// Update profile
router.post(
  API.system.protected.updateprofile.endpoint,
  authMiddleware({ revoke: false, allowDuringOnboarding: true }),
  UpdateProfile
);

// Update avatar
router.post(
  API.system.protected.updateavatar.endpoint,
  authMiddleware({ revoke: false }),
  upload.single("avatar"),
  handleUploadErrors,
  processAvatar,
  asyncHandler(async (req, res) => {
    if (!req.processedAvatarPath) {
      return res.status(400).json({ success: false, message: "Avatar upload failed" });
    }
    req.avatarUrl = req.processedAvatarPath;
    await UpdateAvatar(req, res);
  })
);

// Update location-sharing consent
router.post(
  API.system.protected.locationConsent.endpoint,
  authMiddleware({ revoke: false, allowDuringOnboarding: true }),
  UpdateLocationConsent
);

// Update precise location from browser geolocation API
router.post(
  API.system.protected.locationUpdate.endpoint,
  authMiddleware({ revoke: false, allowDuringOnboarding: true }),
  UpdatePreciseLocation
);

// Super-admin org-admin assignment
router.get(
  API.system.protected.organizationAdmins.endpoint,
  authMiddleware({ revoke: false }),
  FetchOrganizationAdmins
);

router.post(
  API.system.protected.updateOrganizationAdmins.endpoint,
  authMiddleware({ revoke: false }),
  UpdateOrganizationAdmins
);

router.post(
  API.system.protected.managedUsers.endpoint,
  authMiddleware({ revoke: false }),
  CreateManagedUser
);

router.post(
  API.system.protected.manageAdminAccount.endpoint,
  authMiddleware({ revoke: false }),
  ManageAdminAccount
);

// Monitoring snapshot
router.get(
  API.system.protected.monitoring.endpoint,
  authMiddleware({ revoke: false }),
  asyncHandler(FetchMonitoringSnapshot)
);

// Notifications
router.get(
  API.system.protected.notifications.endpoint,
  authMiddleware({ revoke: false }),
  asyncHandler(FetchNotifications)
);

router.get(
  API.system.protected.notificationsUnreadCount.endpoint,
  authMiddleware({ revoke: false }),
  asyncHandler(FetchUnreadNotificationCount)
);

router.post(
  API.system.protected.notificationsMarkRead.endpoint,
  authMiddleware({ revoke: false }),
  asyncHandler(MarkNotificationRead)
);

router.post(
  API.system.protected.notificationsMarkAllRead.endpoint,
  authMiddleware({ revoke: false }),
  asyncHandler(MarkAllNotificationsRead)
);

router.get(
  API.system.protected.loginHistory.endpoint,
  authMiddleware({ revoke: false }),
  asyncHandler(FetchRecentLoginHistory)
);

router.get(
  API.system.protected.activityLogs.endpoint,
  authMiddleware({ revoke: false }),
  asyncHandler(FetchRecentUserActivity)
);

// ===================== MFA Routes =====================

// GET MFA Status
router.get(
  API.system.protected.MFA.endpoint + "/status",
  authMiddleware({ revoke: false }),
  asyncHandler(GetMFAStatus)
);

// POST MFA Setup / Toggle
router.post(
  API.system.protected.MFA.endpoint,
  authMiddleware({ revoke: false }),
  asyncHandler(ToggleMFA)
);

// POST MFA Verify
router.post(
  API.system.protected.MFA.endpoint + "/verify",
  authMiddleware({ revoke: false }),
  asyncHandler(VerifyMFA)
);

// -------------------- Error Handler --------------------
router.use((err, req, res, next) => {
  void next;
  res.locals.errorReason = err?.message || "Protected route execution failed";
  res.locals.errorCode = err?.code || err?.name || "PROTECTED_ROUTE_ERROR";
  console.error("🚨 Router Error:", err);
  const status =
    Number.isInteger(err?.status) && err.status >= 400 && err.status <= 599
      ? err.status
      : Number.isInteger(err?.statusCode) && err.statusCode >= 400 && err.statusCode <= 599
        ? err.statusCode
        : 500;
  return res.status(status).json({
    title:
      typeof err?.title === "string" && err.title.trim()
        ? err.title
        : status === 500
          ? "Server error"
          : "Request failed",
    message:
      typeof err?.message === "string" && err.message.trim()
        ? err.message
        : "Internal Server Error",
    code:
      typeof err?.code === "string" && err.code.trim()
        ? err.code
        : status === 500
          ? "PROTECTED_ROUTE_ERROR"
          : `HTTP_${status}_ERROR`,
  });
});

export default router;
