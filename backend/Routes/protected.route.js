import express from "express";
import API from "@amon/shared";
import authMiddleware from "../Middleware/auth.middleware.js";
import getSystemStats from "../Services/status.service.js";
import { ChangePassword } from "../Services/changepassword.service.js";
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
import { getLocationSharingState } from "../Services/profile.service.js";
import { upload, processAvatar, handleUploadErrors } from "../Middleware/upload.middleware.js";
import { MFAService } from "../Services/MFA.service.js";

const router = express.Router();
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const FALLBACK_LOCATION_TEXT = "Unknown Location";

const formatCoordinates = (preciseLocation) => {
  const latitude = Number(preciseLocation?.latitude);
  const longitude = Number(preciseLocation?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
};

const normalizeLocationText = (value) => {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text === "N/A") return null;
  return text;
};

// ===================== Routes =====================

// System status
router.post(
  API.system.protected.status.endpoint,
  authMiddleware({ revoke: false }),
  asyncHandler(async (req, res) => {
    const baseStats = getSystemStats();
    const { locationConsent, preciseLocation } = await getLocationSharingState(req.user.user_id);
    const locationSharingEnabled = locationConsent === true;
    const preciseLocationAvailable = Boolean(locationSharingEnabled && preciseLocation);
    const ipLocationText = normalizeLocationText(baseStats.location);
    const preciseLocationText = normalizeLocationText(preciseLocation?.locationLabel) || formatCoordinates(preciseLocation);

    const resolvedLocation = locationSharingEnabled
      ? (preciseLocationAvailable
          ? (preciseLocationText || ipLocationText || FALLBACK_LOCATION_TEXT)
          : (ipLocationText || FALLBACK_LOCATION_TEXT))
      : (locationConsent === null ? "Location permission required" : "Location sharing disabled");

    const stats = {
      ...baseStats,
      location: resolvedLocation,
      locationSharingEnabled,
      locationConsentRequired: locationConsent === null,
      preciseLocationAvailable,
      locationSource: locationSharingEnabled
        ? (preciseLocationAvailable ? "device-geolocation" : "ip-geolocation")
        : "blocked",
      preciseLocation,
    };

    return res.status(200).json({ success: true, stats });
  })
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

// ===================== MFA Routes =====================

// GET MFA Status
router.get(
  API.system.protected.MFA.endpoint + "/status",
  authMiddleware({ revoke: false }),
  asyncHandler(async (req, res) => {
    const userId = req.user.user_id;
    const status = await MFAService.getStatus(userId);
    return res.status(200).json({ success: true, status });
  })
);

// POST MFA Setup / Toggle
router.post(
  API.system.protected.MFA.endpoint,
  authMiddleware({ revoke: false }),
  asyncHandler(async (req, res) => {
    const userId = req.user.user_id;
    const { method, action } = req.body; // action: 'setup' or 'disable'

    if (!method || !["setup", "disable"].includes(action)) {
      return res.status(400).json({ success: false, message: "Invalid request" });
    }

    try {
      if (action === "setup") {
        const result = await MFAService.toggle(userId, method);
        return res.status(200).json({ success: true, ...result });
      } else if (action === "disable") {
        await MFAService.disable(userId, method);
        return res.status(200).json({ success: true, message: `${method} disabled` });
      }
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  })
);

// POST MFA Verify
router.post(
  API.system.protected.MFA.endpoint + "/verify",
  authMiddleware({ revoke: false }),
  asyncHandler(async (req, res) => {
    const userId = req.user.user_id;
    const { method, token } = req.body;

    if (!method || !token) {
      return res.status(400).json({ success: false, message: "Missing method or token" });
    }

    try {
      await MFAService.verify(userId, method, token);
      return res.status(200).json({ success: true, message: "MFA verified and enabled" });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  })
);

// -------------------- Error Handler --------------------
router.use((err, req, res, next) => {
  console.error("🚨 Router Error:", err);
  return res.status(500).json({ success: false, message: "Internal Server Error" });
});

export default router;
