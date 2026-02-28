import express from "express";
import API from "@amon/shared";
import authMiddleware from "../Middleware/auth.middleware.js";
import getSystemStats from "../Services/status.service.js";
import { ChangePassword } from "../Services/changepassword.service.js";
import { FetchProfile, UpdateProfile, UpdateAvatar } from "../Controller/Profile.controller.js";
import { upload, processAvatar, handleUploadErrors } from "../Middleware/upload.middleware.js";
import { MFAService } from "../Services/MFA.service.js";

const router = express.Router();
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ===================== Routes =====================

// System status
router.post(
  API.system.protected.status.endpoint,
  authMiddleware({ revoke: false }),
  asyncHandler(async (req, res) => {
    const stats = getSystemStats();
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
