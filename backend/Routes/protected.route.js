import express from "express";
import API from "@amon/shared";
import authMiddleware from "../Middleware/auth.middleware.js";
import getSystemStats from "../Services/status.service.js";
import { ChangePassword } from "../Services/changepassword.service.js";
import { DeleteAccount } from "../Services/deleteaccount.service.js";
import { FetchProfile, UpdateProfile, UpdateAvatar } from "../Controller/Profile.controller.js";
import { upload, processAvatar, handleUploadErrors } from "../Middleware/upload.middleware.js";
import { revokeUserTokens } from "../Utils/JWT.utils.js";

const router = express.Router();

// Async wrapper
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Route definitions
const routes = [
  {
    method: "post", endpoint: API.system.protected.status.endpoint,
    middleware: [authMiddleware({ revoke: false })], 
    handler: async (req, res) => {
      const stats = getSystemStats();
      return res.status(200).json({ success: true, stats });
    },
  },
  {
    method: "post", endpoint: API.system.protected.changepass.endpoint,
    middleware: [authMiddleware({ revoke: true })],
    handler: ChangePassword,
  },
  {
    method: "post", endpoint: API.system.protected.deleteacc.endpoint,
    middleware: [authMiddleware({ revoke: false })],
    handler: async (req, res) => {
      await DeleteAccount(req, res);

      const deletedUserId = res.locals.deletedUserId;
      if (deletedUserId) {
        try {
          await revokeUserTokens(deletedUserId);
          console.log(`⛔ Revoked all tokens for deleted user ${deletedUserId}`);
        } catch (err) {
          console.error(`⚠️ Failed to revoke tokens for user ${deletedUserId}: ${err.message}`);
        }
      }

      return res.status(200).json({ success: true, message: "Account deleted" });
    },
  },
  {
    method: "get", endpoint: API.system.protected.getprofile.endpoint,
    middleware: [authMiddleware({ revoke: false })],
    handler: FetchProfile,
  },
  {
    method: "post", endpoint: API.system.protected.updateprofile.endpoint,
    middleware: [authMiddleware({ revoke: false })],
    handler: UpdateProfile,
  },
  {
    method: "post", endpoint: API.system.protected.updateavatar.endpoint,
    middleware: [
      authMiddleware({ revoke: false }),
      upload.single("avatar"),
      handleUploadErrors,
      processAvatar
    ],
    handler: async (req, res) => {
      if (!req.file || !req.file.url) {
        return res.status(400).json({
          success: false,
          message: "Avatar upload failed",
        });
      }
      await UpdateAvatar(req, res);
      return res.json({
        success: true,
        avatarUrl: req.file.url,
      });
    },
  },
];

// Dynamically register all routes
routes.forEach(({ method, endpoint, middleware, handler }) => {
  router[method](endpoint, ...middleware, asyncHandler(handler));
});

// Global error handler
router.use((err, req, res, next) => {
  console.error("🚨 Router Error:", err);
  return res.status(500).json({
    success: false,
    message: "Internal Server Error",
  });
});

export default router;