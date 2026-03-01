import { verifyToken } from "../Utils/JWT.utils.js";
import {
  getUserAccessState,
  getUserOnboardingState,
  USER_ACCOUNT_STATUSES,
} from "../Services/user.service.js";
import API from "@amon/shared";
import { purgeExpiredSoftDeletedAdminsIfDue } from "../Services/adminLifecycle.service.js";

/**
 * Middleware factory to control token revocation
 * @param {Object} options - { revoke: boolean, allowDuringOnboarding: boolean }
 */
export default function authMiddleware(options = {}) {
  const mergedOptions = {
    revoke: true,
    allowDuringOnboarding: false,
    ...options,
  };

  return async function (req, res, next) {
    try {
      const authHeader = req.headers.authorization || "";
      const token = authHeader.split(" ")[1];

      if (!token) {
        res.locals.errorReason = "missing_auth_token";
        res.locals.errorCode = "AUTH_TOKEN_MISSING";
        return res.status(401).json({ message: "🔐 Missing token" });
      }

      const payload = await verifyToken(token, { revoke: mergedOptions.revoke });
      await purgeExpiredSoftDeletedAdminsIfDue();
      const accessState = await getUserAccessState(payload.user_id);
      if (!accessState) {
        res.locals.errorReason = "auth_user_not_found";
        res.locals.errorCode = "AUTH_USER_NOT_FOUND";
        return res.status(401).json({ message: "Unauthorized: user not found." });
      }
      if (accessState.account_status === USER_ACCOUNT_STATUSES.BLOCKED) {
        res.locals.errorReason = "account_blocked";
        res.locals.errorCode = "ACCOUNT_BLOCKED";
        return res.status(403).json({
          success: false,
          code: "ACCOUNT_BLOCKED",
          message: "Your account is blocked by super admin.",
        });
      }
      if (accessState.account_status === USER_ACCOUNT_STATUSES.DELETED) {
        res.locals.errorReason = "account_soft_deleted";
        res.locals.errorCode = "ACCOUNT_SOFT_DELETED";
        return res.status(403).json({
          success: false,
          code: "ACCOUNT_SOFT_DELETED",
          message: "Your account has been soft-deleted by super admin.",
        });
      }
      const onboarding = await getUserOnboardingState(payload.user_id);

      if (!onboarding) {
        res.locals.errorReason = "onboarding_state_missing";
        res.locals.errorCode = "ONBOARDING_STATE_MISSING";
        return res.status(401).json({ message: "Unauthorized: user not found." });
      }

      req.user = {
        ...payload,
        onboarding_required: onboarding.required,
      };
      req.onboarding = onboarding;
      req.token = token; // optional, useful for revocation

      if (onboarding.required && !mergedOptions.allowDuringOnboarding) {
        res.locals.errorReason = "onboarding_required";
        res.locals.errorCode = "ONBOARDING_REQUIRED";
        return res.status(423).json({
          success: false,
          code: "ONBOARDING_REQUIRED",
          message:
            "Required setup is incomplete. Update profile, change password, and share exact device location to continue.",
          onboarding,
          allowedEndpoints: {
            getProfile: API.system.protected.getprofile.endpoint,
            updateProfile: API.system.protected.updateprofile.endpoint,
            changePassword: API.system.protected.changepass.endpoint,
            locationConsent: API.system.protected.locationConsent.endpoint,
            locationUpdate: API.system.protected.locationUpdate.endpoint,
          },
        });
      }

      next();
    } catch (err) {
      console.error("🛑 JWT verification failed:", err.message);
      res.locals.errorReason = err.message.includes("revoked")
        ? "auth_token_revoked_or_account_deleted"
        : "auth_token_invalid_or_expired";
      res.locals.errorCode = err?.name || "AUTH_VERIFICATION_FAILED";
      res.status(401).json({
        message: err.message.includes("revoked")
          ? "Your account has been deleted or logged out from all devices."
          : "Invalid or expired token (replay blocked)"
      });
    }
  };
}
